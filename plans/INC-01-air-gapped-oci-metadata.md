# INC-01 Air-Gapped OCI Build Metadata

**Status:** Proposed

## Objective

Make the fork's air-gapped release build produce a multi-platform OCI archive,
its checksum, and a machine-readable, non-sensitive manifest that identifies
the archive, OCI image index, and each supported platform manifest.

## Motivation

The existing manual build instructions create an OCI archive, but a local
`docker load` imports only the current host platform and does not expose the
archive's multi-platform image-index identity. The release process must retain
and report the full OCI index contract so downstream consumers can pin one
multi-platform image reference while validating AMD64/x86_64 first.

`x86_64` and `amd64` denote the same Docker/OCI platform. The release artifact
has two distinct target platforms: `linux/amd64` and `linux/arm64`.

## Implementation Scope

- Add an OpenCode-owned release script beside the existing package build
  scripts. It must build the fork binaries using the supplied
  `OPENCODE_VERSION` and `OPENCODE_CHANNEL`, create a Docker Buildx OCI archive
  for exactly `linux/amd64,linux/arm64`, and write output only below an explicit
  artifact directory outside the repository.
- Generate a JSON release manifest next to the OCI archive and its `.sha256`
  sidecar. It must include:
  - the fork version and channel;
  - the archive filename and SHA-256 checksum;
  - the OCI image-index descriptor digest and media type; and
  - one descriptor digest, media type, operating system, and architecture for
    `linux/amd64` and `linux/arm64`.
- Validate that the archive is an OCI layout, has exactly the two required
  platform manifests, and matches the requested version before emitting the
  manifest.
- Update `AIR-GAPPED-DEPLOY.md` to make the release script the authoritative
  archive-generation path and explain the distinction between the archive
  checksum, image-index digest, and platform-manifest digests.
- Add focused tests for archive metadata parsing and validation without
  requiring Docker, a registry, or production credentials.

## Expected Files

- `packages/opencode/script/` — new air-gapped release script and focused test
  coverage, following the existing package script conventions.
- `packages/opencode/package.json` — a named package script if required to
  expose the release command.
- `AIR-GAPPED-DEPLOY.md` — verified artifact contract and operator command.

## Constraints

- Do not modify upstream release workflow or publish to an external registry.
- Do not add runtime dependencies; use Bun and existing repository tooling.
- Do not write archive, checksum, manifest, build caches, credentials, or logs
  into the repository.
- Do not inspect, copy, or record AWS credentials, SSO cache data, provider
  requests, or model responses.
- The release manifest must contain only artifact identity metadata, never
  registry authorization data or local absolute paths.
- Preserve support for both `linux/amd64` and `linux/arm64`; AMD64-only runtime
  validation is an acceptance choice, not a release-artifact restriction.

## Validation

- Run focused tests for OCI layout/descriptor parsing and invalid-layout
  rejection from `packages/opencode`.
- Run `bun typecheck` from `packages/opencode`.
- Run the release script against a controlled fixture or dry validation path
  that confirms the generated metadata schema without publishing an image.
- Run `git diff --check`.

## Completion Criteria

- [ ] One command produces an OCI archive, checksum sidecar, and release
      manifest for a requested fork version.
- [ ] The manifest distinguishes the archive checksum from the OCI image-index
      digest and reports both required platform manifest digests.
- [ ] Archive validation rejects missing, duplicate, or unexpected platform
      descriptors.
- [ ] Documentation tells downstream integrators to pin the image-index digest,
      not an AMD64 local-load digest or archive checksum.
- [ ] Focused validation passes and the increment is reviewed and committed.

## Dependencies

None. INC-02 depends on this increment.
