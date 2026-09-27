# Packaging this fork for an air-gapped deployment

This fork carries a patch on top of upstream `opencode` (see `fix(core): route
Bedrock AWS SSO/STS credential calls through configured proxy` on branch
`bedrock-proxy-fix`): AWS SSO/STS credential resolution for the Bedrock/Mantle
provider now honors `HTTP_PROXY`/`HTTPS_PROXY`, which it did not upstream.

The target environment is a network-isolated dev container whose only egress
is a Squid proxy, running the official-style single-binary `opencode`
container image. That environment currently builds its toolbox image by
pulling the *stock* upstream binary directly from
`ghcr.io/anomalyco/opencode` (pinned by digest) and extracting it. This
document is the step-by-step for replacing that with a binary built from this
fork instead.

## Versioning convention for this fork

- **Fork token**: `cam`
- **Build-time version**: `<upstream-base-version>+cam.<n>`, e.g. `2.0.15+cam.1`.
  Bump `<n>` for every rebuild against the same upstream base; bump the base
  version when rebasing onto a newer upstream release.
- **Channel**: `cam`
- **Git tags**: `cam-v<version>`, e.g. `cam-v2.0.15+cam.1` — a distinct
  namespace from upstream's bare `v*` tags (mirrors the existing
  `github-v*`/`vscode-v*` precedent already used in this repo).
- Never publish under the name `opencode-ai` if this is ever pushed to an
  internal package registry — use a scoped name instead.

The version string is a compile-time constant (`OPENCODE_VERSION`/
`OPENCODE_CHANNEL`, baked in via `packages/opencode/script/build.ts` and
surfaced at runtime by `packages/core/src/installation/version.ts`), not read
from `package.json`. Setting the env vars below at build time is sufficient —
no code changes are needed to control it.

## Step 1 — Build the patched binary

Run this on any machine with network access (it does not need to be part of
the isolated enclave, and does not need to be Linux — Bun cross-compiles):

```bash
git checkout bedrock-proxy-fix
bun install
OPENCODE_VERSION=2.0.15+cam.1 OPENCODE_CHANNEL=cam ./packages/opencode/script/build.ts
```

Do **not** pass `--single` — that only builds a binary for the host's own
platform/arch, which is not what the target container needs. Omitting it
builds all supported target platforms into `packages/opencode/dist/`. Only
two are needed, matching exactly what the target environment's toolbox
`Dockerfile` already extracts from the upstream image today:

- `dist/opencode-linux-x64-baseline-musl/bin/opencode` (amd64)
- `dist/opencode-linux-arm64-musl/bin/opencode` (arm64)

## Step 2 — Package into a container image

Use opencode's own `packages/opencode/Dockerfile` unchanged — it already
produces exactly the shape the target toolbox expects (Alpine base,
`ripgrep`/`libgcc`/`libstdc++` installed via `apk`, plus the compiled binary):

```dockerfile
FROM alpine AS base
RUN apk add libgcc libstdc++ ripgrep

FROM base AS build-amd64
COPY dist/opencode-linux-x64-baseline-musl/bin/opencode /usr/local/bin/opencode

FROM base AS build-arm64
COPY dist/opencode-linux-arm64-musl/bin/opencode /usr/local/bin/opencode

ARG TARGETARCH
FROM build-${TARGETARCH}
RUN opencode --version
ENTRYPOINT ["opencode"]
```

Build multi-arch and push to an internal registry (run from the fork
checkout, so `dist/` from Step 1 is present in the build context):

```bash
docker buildx build --platform linux/amd64,linux/arm64 \
  -f packages/opencode/Dockerfile \
  -t <your-internal-registry>/opencode:2.0.15+cam.1 \
  --push .
```

Record the resulting image digest (from the `--push` output, or
`docker inspect --format='{{index .RepoDigests 0}}' <image>`) — the toolbox
Dockerfile pins by digest, not tag.

## Step 3 — Repoint the toolbox Dockerfile

In the target environment's toolbox `Dockerfile`, swap the two pinned
upstream image references:

```dockerfile
# before
FROM ghcr.io/anomalyco/opencode@sha256:<upstream-digest> AS opencode-amd64
FROM ghcr.io/anomalyco/opencode@sha256:<upstream-digest> AS opencode-arm64

# after
FROM <your-internal-registry>/opencode@sha256:<new-digest> AS opencode-amd64
FROM <your-internal-registry>/opencode@sha256:<new-digest> AS opencode-arm64
```

Also bump the `OPENCODE_VERSION=2.0.15` build `ARG` near the top of that file
to `2.0.15+cam.1`, so the file's own sanity check
(`test "$(opencode --version)" = "opencode v${OPENCODE_VERSION}"`) still
passes. No other changes are needed — the rest of that Dockerfile (apt
packages, mise, uv, the self-check script) keeps extracting from the
`opencode-${TARGETARCH}` stage exactly as before.

## Step 4 — Widen the Squid ACL for SSO/STS (required companion change)

The target environment's `opencode-provider-proxy` Squid config currently
allows `CONNECT` only to `bedrock-mantle.us-gov-west-1.api.aws`. Once this
fix routes AWS SSO/STS credential calls through the same proxy, Squid will
still deny them — fail-closed — unless the ACL is widened.

Do not guess the exact hostnames. Deploy with the current restrictive ACL,
clear `~/.aws/sso/cache/*` to force a real token refresh, trigger a Bedrock
call, and read the Squid `access_log` for the denied `CONNECT` attempts —
that gives the exact FQDNs the `BedrockDeveloperProfile` credential chain
(an `sso_session` profile) actually hits. Add those as a second, separate
`acl`/`http_access allow CONNECT` pair rather than widening the existing
`mantle` rule, so each grant stays independently legible on review:

```squid
acl mantle dstdomain bedrock-mantle.us-gov-west-1.api.aws
acl aws_sso dstdomain <hostnames observed in access_log>

http_access allow CONNECT mantle
http_access allow CONNECT aws_sso
http_access deny all
```

## Step 5 — Crossing the air gap

Open item: how the toolbox image itself currently moves from the connected
build machine into the isolated enclave is not yet documented here. Whatever
that existing mechanism is (image tarball transfer, an internal registry the
enclave already trusts, etc.), the same path applies to this fork's image —
swapping the source registry reference in Step 3 does not change how the
crossing itself works. Fill this section in once that mechanism is
confirmed.

## Verification checklist

- [ ] `opencode --version` on the built image prints the fork's version
      string (`2.0.15+cam.1`, not an upstream-looking one).
- [ ] SSO/STS traffic is observed flowing through `opencode-provider-proxy`
      (not bypassing it) once the ACL from Step 4 is in place.
- [ ] A full credential refresh (`~/.aws/sso/cache/*` cleared) succeeds
      end-to-end inside the actual target container, not just on a dev
      machine.
- [ ] Checksum of the image tarball matches between the connected build
      machine and the far side of the transfer, before loading it into the
      target environment.
