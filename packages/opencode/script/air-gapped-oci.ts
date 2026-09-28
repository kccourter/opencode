import path from "path"

export type AirGappedRelease = {
  version: string
  channel: string
  archive: {
    filename: string
    sha256: string
  }
  image_index: {
    digest: string
    media_type: string
  }
  platforms: {
    os: "linux"
    architecture: "amd64" | "arm64"
    digest: string
    media_type: string
  }[]
}

type Descriptor = {
  mediaType?: unknown
  digest?: unknown
  platform?: {
    os?: unknown
    architecture?: unknown
  }
}

type Index = {
  manifests?: unknown
}

const imageIndexMediaType = "application/vnd.oci.image.index.v1+json"
const platforms = ["linux/amd64", "linux/arm64"] as const

export async function readAirGappedOciLayout(directory: string) {
  const layout = await Bun.file(path.join(directory, "oci-layout")).json()
  if (!isRecord(layout) || layout.imageLayoutVersion !== "1.0.0") {
    throw new Error("OCI layout must declare imageLayoutVersion 1.0.0")
  }

  const root = await readIndex(path.join(directory, "index.json"))
  const descriptors = requireDescriptors(root, "OCI layout index")
  if (descriptors.length !== 1) {
    throw new Error("OCI layout index must contain exactly one image-index descriptor")
  }

  const imageIndex = requireImageIndexDescriptor(descriptors[0])
  if (imageIndex.mediaType !== imageIndexMediaType) {
    throw new Error(`OCI layout image index must use ${imageIndexMediaType}`)
  }

  const manifestIndex = await readIndex(blobPath(directory, imageIndex.digest))
  const manifests = requireDescriptors(manifestIndex, "OCI image index")
  if (manifests.length !== platforms.length) {
    throw new Error("OCI image index must contain exactly linux/amd64 and linux/arm64 manifests")
  }

  const result = manifests.map((manifest) => {
    const descriptor = requirePlatformManifestDescriptor(manifest)
    const platform = `${descriptor.platform.os}/${descriptor.platform.architecture}`
    if (!platforms.includes(platform as (typeof platforms)[number])) {
      throw new Error(`OCI image index has unexpected platform ${platform}`)
    }
    return {
      os: descriptor.platform.os as "linux",
      architecture: descriptor.platform.architecture as "amd64" | "arm64",
      digest: descriptor.digest,
      media_type: descriptor.mediaType,
    }
  })

  if (new Set(result.map((item) => `${item.os}/${item.architecture}`)).size !== platforms.length) {
    throw new Error("OCI image index must not contain duplicate platform manifests")
  }

  return {
    image_index: {
      digest: imageIndex.digest,
      media_type: imageIndex.mediaType,
    },
    platforms: platforms.map((platform) => result.find((item) => `${item.os}/${item.architecture}` === platform)!),
  }
}

async function readIndex(file: string) {
  const value = await Bun.file(file).json()
  if (!isRecord(value)) throw new Error(`${file} must contain an OCI image index`)
  return value as Index
}

function requireDescriptors(value: Index, name: string) {
  if (!Array.isArray(value.manifests)) throw new Error(`${name} must contain manifests`)
  return value.manifests
}

function requireImageIndexDescriptor(value: unknown) {
  const name = "OCI layout image-index descriptor"
  if (!isRecord(value) || typeof value.mediaType !== "string" || typeof value.digest !== "string") {
    throw new Error(`${name} must include a media type and digest`)
  }
  if (!value.digest.startsWith("sha256:")) throw new Error(`${name} must use a sha256 digest`)
  return {
    mediaType: value.mediaType,
    digest: value.digest,
  }
}

function requirePlatformManifestDescriptor(value: unknown) {
  const name = "OCI platform manifest descriptor"
  if (!isRecord(value) || typeof value.mediaType !== "string" || typeof value.digest !== "string") {
    throw new Error(`${name} must include a media type and digest`)
  }
  if (!value.digest.startsWith("sha256:")) throw new Error(`${name} must use a sha256 digest`)
  if (!isRecord(value.platform) || value.platform.os !== "linux") throw new Error(`${name} must target Linux`)
  if (typeof value.platform.architecture !== "string") throw new Error(`${name} must include an architecture`)
  return {
    mediaType: value.mediaType,
    digest: value.digest,
    platform: {
      os: value.platform.os,
      architecture: value.platform.architecture,
    },
  }
}

function blobPath(directory: string, digest: string) {
  const [algorithm, value] = digest.split(":", 2)
  return path.join(directory, "blobs", algorithm, value)
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null
}
