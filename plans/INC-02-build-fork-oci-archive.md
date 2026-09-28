# INC-02 Build Fork OCI Archive

**Status:** Complete 2026-09-28

## Objective

Build the approved `2.0.15-cam.1` fork release using the new air-gapped release
process and publish its OCI archive, checksum sidecar, and release manifest to
`/tmp/opencode` for the approved manual transfer boundary.

## Motivation

The OPA integration workspace needs a reproducible multi-platform OpenCode
artifact identity. This increment produces the portable artifact and records
only the safe identity values needed to consume it. Runtime validation is
limited to `linux/amd64`/x86_64 for this pilot; `linux/arm64` remains part of
the produced and verified OCI index.

## Prerequisites

- INC-01 is complete and committed.
- The checkout is on `bedrock-proxy-fix` at the reviewed proxy-routing change.
- `bun install` dependencies and Docker Buildx are available.
- The requested version is exactly `2.0.15-cam.1` and the channel is `cam`.

## Implementation Scope

- Run the approved release command with `OPENCODE_VERSION=2.0.15-cam.1` and
  `OPENCODE_CHANNEL=cam`, targeting `/tmp/opencode`.
- Verify the archive checksum against its sidecar.
- Verify the release manifest reports exactly `linux/amd64` and `linux/arm64`,
  a multi-platform image-index descriptor, and version/channel values matching
  the requested release.
- Load only as needed to perform a no-network `linux/amd64`/x86_64
  `opencode --version` validation. Do not treat the local loaded image digest
  as the multi-platform image-index digest.
- Record safe release evidence: version, channel, archive checksum, image-index
  digest, and both platform-manifest digests. Leave the archive, checksum, and
  manifest untracked under `/tmp/opencode`.
- Update `AIR-GAPPED-DEPLOY.md` only if the implemented release command reveals
  an operator-facing correction required by the completed increment.

## Constraints

- Do not publish to an external or internal registry in this increment.
- Do not load or move artifacts into the OPA workspace or any Docker build
  context.
- Do not test ARM64 runtime behavior in this increment.
- Do not retain build logs containing environmental secrets, credentials, or
  request payloads.
- Preserve existing `/tmp/opencode` artifacts until the new artifacts have
  passed validation; never delete ambiguous user-created files.

## Validation

- Verify the sidecar with `sha256sum --check`.
- Validate release-manifest structure and platform descriptors using the INC-01
  release script's verification path.
- Run the AMD64 binary in a container with `--network none` and verify exact
  version output `2.0.15-cam.1`.
- Confirm no generated artifact appears in `git status`.
- Run `git diff --check` for any durable documentation/evidence updates.

## Completion Criteria

- [ ] `/tmp/opencode` contains a verified OCI archive, `.sha256` sidecar, and
      release manifest for `2.0.15-cam.1`.
- [ ] The manifest exposes one image-index digest plus AMD64 and ARM64 manifest
      digests.
- [ ] The AMD64/x86_64 no-network version test passes.
- [ ] Artifact identity evidence is recorded without credentials or archive
      contents.
- [ ] The increment is reviewed and committed without tracking generated
      artifacts.

## Dependencies

Requires INC-01 complete. The OPA workspace's fork-image integration may begin
after this artifact is transferred/published through its separately approved
boundary and the receiving registry supplies the image-index digest.
