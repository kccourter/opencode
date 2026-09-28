# INC-01 Air-Gapped OCI Build Metadata Record

## Result

Completed 2026-09-28. The fork now has a package-owned air-gapped release
command that builds the configured version/channel, writes a staged OCI archive
outside the source tree, validates its OCI layout, and atomically publishes the
archive with checksum and release-manifest sidecars.

The release manifest distinguishes the archive SHA-256 checksum from the OCI
image-index descriptor digest and reports both required platform descriptors:
`linux/amd64` and `linux/arm64`.

The release command disables Buildx provenance attestations so the OCI image
index contains exactly those two platform image manifests. This preserves the
portable artifact contract rather than requiring downstream consumers to
interpret build-attestation descriptors.

## Changed Files

- `packages/opencode/script/air-gapped-oci.ts`
- `packages/opencode/script/air-gapped-oci.test.ts`
- `packages/opencode/script/release-air-gapped.ts`
- `packages/opencode/package.json`
- `AIR-GAPPED-DEPLOY.md`

## Validation Evidence

- `bun test script/air-gapped-oci.test.ts` from `packages/opencode`: passed;
  valid multi-platform metadata plus missing, duplicate, and unexpected platform
  rejection cases passed.
- `bun typecheck` from `packages/opencode`: passed.
- Prettier check for changed source and documentation files: passed.
- `git diff --check`: passed.

## Constraints Preserved

- Generated archives, checksums, and manifests are written only to the explicit
  artifact directory and remain untracked.
- The release contract includes both OCI platforms. It does not imply ARM64
  runtime validation for the current AMD64/x86_64 pilot.
- No registry publication, provider configuration, credentials, or SSO state is
  involved.
