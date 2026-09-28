# INC-02 Build Fork OCI Archive Record

## Result

Completed 2026-09-28. The fork release command produced the approved
`2.0.15-cam.1` / `cam` multi-platform OCI handoff artifact in `/tmp/opencode`.
The generated archive, checksum sidecar, and release manifest remain outside
the repository and untracked.

## Safe Artifact Identity

| Value                  | Digest                                                                    |
| ---------------------- | ------------------------------------------------------------------------- |
| Archive SHA-256        | `sha256:c422c63bb29d25e169c685aecbf870fa0edcff64e5c3f1695b8408599d188d02` |
| OCI image index        | `sha256:00c4999edec61ea6c75e6cb892410832e9649414cbbc1ddd2a21a41a29301f8e` |
| `linux/amd64` manifest | `sha256:24dd30e8f784f6ffc6857c653eab915592a57075e6b200148408078c20f1069a` |
| `linux/arm64` manifest | `sha256:a54682d4a41381baa824953f58e2a735966ca3c1af7b7aaad0f7761ece06c6e5` |

The archive checksum is the transfer-integrity value. The image-index digest is
the multi-platform image identity to preserve through a receiving registry; it
is not interchangeable with either platform manifest digest.

## Validation Evidence

- The local `opencode-airgap` Docker Buildx builder was configured with ARM64
  emulation and reported both required platforms before building.
- The release build completed both Dockerfile platform checks. The AMD64 and
  ARM64 image stages each printed `2.0.15-cam.1` during their build-time
  `opencode --version` command.
- `sha256sum --check` passed from `/tmp/opencode` against the generated sidecar.
- The release manifest validation confirmed version `2.0.15-cam.1`, channel
  `cam`, OCI image-index media type, and exactly `linux/amd64` plus
  `linux/arm64` platform descriptors.
- `docker load` loaded the local AMD64 image, and
  `docker run --rm --network none --entrypoint opencode opencode:2.0.15-cam.1
--version` printed exactly `2.0.15-cam.1`.
- `bun test script/air-gapped-oci.test.ts`, `bun typecheck`, Prettier check,
  and `git diff --check` passed.

## Constraints Preserved

- No registry push occurred.
- Runtime validation was limited to the AMD64/x86_64 host image. ARM64 was
  built and structurally validated, but not run as a post-build container test.
- No generated archive, checksum, manifest, credentials, SSO state, request,
  or model output was committed.
