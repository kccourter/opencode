# INC-03 Publish Verified OCI Archive

**Status:** Deferred 2026-09-28 — awaiting Artifactory registry provisioning

## Objective

Provide one on-demand fork release command that consumes an already verified
OCI archive, publishes that exact multi-platform artifact to an operator-supplied
internal registry repository, verifies the remote image index, and writes safe
registry-digest evidence for the OPA workspace to consume.

## Motivation

The OPA workspace must have no OpenCode source-build responsibility during its
normal build or startup. It must consume only a repository-qualified,
digest-pinned OpenCode image selected by this fork's release process.

The current OCI archive is the authoritative fork release artifact. Rebuilding
from `dist/`, using a host-local `docker load` digest, or substituting a tag
would break the artifact-first multi-platform contract.

## External Prerequisites

Before live publication, the project navigator must supply:

- the approved internal registry repository, without a mutable tag or digest;
- an authenticated registry session available through the operator's existing
  Docker/OCI credential configuration; and
- the approved OCI-aware copy tool/image and any required registry trust
  configuration.

The repository, credentials, auth headers, credential-store contents, and
custom certificate material are external inputs and must never be committed,
printed, or passed as command-line secrets.

## Implementation Scope

- Add an OpenCode-owned publish script beside the air-gapped release command.
  It accepts an explicit verified archive and registry repository input, never
  invokes the binary build, and rejects tag-only/malformed destinations.
- Use the approved OCI-aware copy mechanism with multi-platform preservation
  semantics (for example, an `--all` archive-to-registry copy). Do not use
  `docker load`, `docker tag`, or a source-tree `docker buildx --push` as the
  publication path.
- Verify the archive checksum and release manifest before publication, including
  version/channel and exactly `linux/amd64` plus `linux/arm64` descriptors.
- After publication, inspect the remote repository by immutable digest and
  verify it remains a multi-platform image index with exactly those two
  platforms. Record a safe registry receipt beside the local artifact: registry
  repository, fork version/channel, source archive checksum/index digest, and
  resulting repository-qualified registry index digest.
- Update `AIR-GAPPED-DEPLOY.md` so it presents the on-demand release/publish
  flow as the sole fork handoff path. Remove the independent source-tree
  `docker buildx --push` example.
- Add focused unit tests for input validation and safe receipt construction;
  use a dry-run or isolated registry only if the approved copy tool supports it.

## Expected Files

- `packages/opencode/script/` — publisher, reusable manifest validation as
  needed, and focused test coverage.
- `packages/opencode/package.json` — named on-demand publish command.
- `AIR-GAPPED-DEPLOY.md` — artifact-first handoff procedure.
- `records/` — release/publish evidence without authentication material.

## Constraints

- The OPA workspace must not build, publish, inspect, or otherwise depend on
  this checkout at runtime or normal image-build time.
- Keep the OCI archive, checksum, release manifest, and registry receipt outside
  both source repositories and Docker build contexts.
- Do not add an OpenCode runtime dependency, submodule, shared source tree, or
  cross-repository import.
- Do not record registry credentials, account identifiers, registry tokens,
  authorization headers, custom CA contents, provider credentials, prompts, or
  model responses.
- Preserve the source archive index. If the registry changes its index digest,
  record the returned immutable registry digest and stop for review unless the
  difference is explained by the approved registry mechanism.
- AMD64/x86_64 remains the only post-build runtime pilot. ARM64 must be copied
  and structurally verified, but does not require a host runtime test.

## Validation

- Run focused publisher input/receipt tests and `bun typecheck` from
  `packages/opencode`.
- Verify the local archive checksum and release manifest before publication.
- Publish exactly one approved artifact to the supplied internal repository.
- Inspect the remote immutable reference and verify the index describes exactly
  `linux/amd64` and `linux/arm64`.
- Record the repository-qualified index digest and confirm it can be used as a
  Docker `FROM` reference without a tag.
- Run `git diff --check`, formatting checks, and confirm generated artifacts and
  registry receipts remain untracked.

## Completion Criteria

- [ ] A single on-demand command publishes a pre-verified archive without
      rebuilding OpenCode.
- [ ] The remote registry reference is immutable, multi-platform, and contains
      exactly AMD64 and ARM64 image manifests.
- [ ] Safe receipt evidence gives the OPA workspace the repository-qualified
      index digest it must pin.
- [ ] The handoff guide no longer suggests an independent rebuild/push path.
- [ ] The OPA workspace has no fork source-build or startup dependency.
- [ ] Validation evidence is recorded and the increment is committed.

## Dependencies

Requires INC-01 and INC-02 complete. OPA's fork-image integration may begin
only after this increment produces the approved registry repository and
immutable image-index digest.
