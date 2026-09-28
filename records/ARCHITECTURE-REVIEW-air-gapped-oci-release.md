# Architecture Review: Air-Gapped OCI Release Contract

## Result

**Conditionally aligned.** The new fork release build correctly produces one
versioned multi-platform OCI artifact with explicit AMD64 and ARM64 identities.
The remaining integration gate is the receiving registry: it must preserve the
artifact's image index and report its resulting registry index digest before the
OPA workspace updates its digest-pinned `FROM` references.

## Problem

The prior handoff process had no durable identity for the multi-platform OCI
image. A local `docker load` imports only the host platform, exposing an AMD64
manifest digest rather than a multi-platform image-index identity. That local
digest cannot safely serve both OPA Dockerfile architecture stages.

## Options Considered

| Option                                                                                                                         | Decision                                                                                                                         |
| ------------------------------------------------------------------------------------------------------------------------------ | -------------------------------------------------------------------------------------------------------------------------------- |
| Pin the digest shown after local `docker load`.                                                                                | Rejected. It is host-platform-specific and loses ARM64.                                                                          |
| Rebuild and `docker buildx --push` independently from the archive.                                                             | Rejected as the handoff path. A rebuild can create a different index digest and can restore provenance attestations.             |
| Transfer the verified OCI archive, then copy/publish that exact archive to the receiving registry with an OCI-aware mechanism. | Recommended. The archive is the portable release artifact, and the registry index digest becomes the downstream `FROM` identity. |

## Approved Artifact Contract

The fork release command is the sole artifact producer for a fork version. It
builds both required image platforms and writes the following outside the
repository:

- OCI archive;
- SHA-256 checksum sidecar; and
- release manifest with the archive checksum, OCI image-index descriptor, and
  `linux/amd64`/`linux/arm64` manifest descriptors.

The archive checksum protects transfer integrity. The archive's image-index
digest identifies the produced OCI content. The platform-manifest digests
identify the architecture-specific images. None is interchangeable with the
receiving registry's repository-qualified index digest used by a Docker
`FROM` instruction.

Buildx provenance attestations are disabled for this release format. This keeps
the OCI image index to exactly the two supported platform image manifests and
makes descriptor validation deterministic.

## Downstream Integration Boundary

The OPA workspace must consume:

```dockerfile
FROM <approved-internal-registry>/opencode@sha256:<registry-image-index-digest>
```

for both its AMD64 and ARM64 stages. The destination digest must be queried
from the receiving registry after it copies or publishes the verified archive.
The transfer procedure must preserve the multi-platform OCI index; a normal
local `docker load` is only suitable for the AMD64/x86_64 runtime pilot and
must not supply this value.

The current release manifest remains the required evidence for comparing the
source artifact and the receiver's preserved index. If the receiving registry
rewrites the index, its returned digest is still the only valid Docker source
identity, and the rewrite requires explicit transfer evidence before OPA
integration.

## Ownership

- This fork owns version/channel selection, binary build, OCI archive creation,
  artifact metadata, and source-artifact validation.
- The approved transfer process and internal registry own movement, retention,
  index preservation, and the final repository-qualified digest.
- The OPA coordination workspace owns its consumed registry digest, matching
  fork version/label assertions, containment validation, and provider policy.

No source import, shared checkout, submodule, or runtime dependency crosses
the repository boundary.

## Validation Scope

- `linux/amd64`/x86_64 has a no-network post-build runtime version check.
- `linux/arm64` is built and structurally validated by its image stage, but has
  no separate post-build runtime acceptance test in this pilot.

This is aligned with the requested pilot scope. `x86_64` and `amd64` are the
same OCI platform name.

## Required Follow-up Before OPA Integration

The handoff guide must replace its independent source-tree registry rebuild
example with the approved archive-copy/publish procedure once the receiving
registry mechanism is selected. That procedure must produce and record the
repository-qualified multi-platform registry digest. This is a transfer and
documentation increment; it must not be inferred from `docker load` output.

The release command currently documents, but does not enforce, that
`OPENCODE_ARTIFACT_DIR` is outside the source tree. A separate hardening
increment may reject repository-local artifact directories if operator error
has been observed; it is not required to consume the current verified archive.

## Recommendation

Keep the current multi-platform archive release design. Do not update the OPA
Dockerfile until the approved transfer mechanism supplies the internal registry
repository and its preserved image-index digest. Replan the registry-handoff
documentation as a distinct increment; do not substitute a local AMD64 digest,
archive checksum, tag, or independent rebuild digest.

## Addendum: Direct OCI Layout Consumption

The registry is not yet provisioned, so the approved interim is for the OPA
workspace to consume the verified artifact directly from `/tmp/opencode` as a
Buildx named OCI layout context. This keeps the OPA workspace independent of
the fork source checkout and preserves the multi-platform index without a
registry.

The OCI archive itself must first be unpacked to an OCI layout directory under
`/tmp/opencode`. Buildx then receives the layout explicitly:

```text
--build-context opencode-artifact=oci-layout:///tmp/opencode/<verified-layout>
```

and the OPA Dockerfile references `opencode-artifact` as its source stage. The
named context resolves the matching platform from the multi-platform index for
each image target. The standard Docker build context remains source-only; the
archive and unpacked layout remain outside it.

An isolated Buildx proof consumed the current verified layout on AMD64/x86_64,
ran `opencode --version` inside the resulting source stage, and returned
`2.0.15-cam.1`. The proof used no registry, no fork source import, and no
networked runtime container.

The OPA integration must add a preflight that verifies the archive checksum and
release manifest before unpacking into a session-owned `/tmp/opencode` layout,
then passes that exact directory through Compose/Buildx `additional_contexts`.
It must reject a missing, unchecked, or wrong-version artifact. The normal OPA
build and startup path remains unaware of how OpenCode was built; it receives
only the prepared portable artifact path and metadata.

Registry publication remains the later preferred distribution mode. Until an
internal Artifactory repository is provisioned, the archive-to-registry plan is
deferred rather than simulated with `docker load` or a separate rebuild.
