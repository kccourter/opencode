import { $ } from "bun"
import { afterEach, describe, expect, test } from "bun:test"
import path from "path"
import { readAirGappedOciLayout } from "./air-gapped-oci"

const directories: string[] = []

afterEach(async () => {
  await Promise.all(directories.splice(0).map((directory) => $`rm -rf ${directory}`))
})

describe("readAirGappedOciLayout", () => {
  test("reports the multi-platform image index", async () => {
    const directory = await fixture()

    expect(await readAirGappedOciLayout(directory)).toEqual({
      image_index: {
        digest: "sha256:index",
        media_type: "application/vnd.oci.image.index.v1+json",
      },
      platforms: [
        {
          os: "linux",
          architecture: "amd64",
          digest: "sha256:amd64",
          media_type: "application/vnd.oci.image.manifest.v1+json",
        },
        {
          os: "linux",
          architecture: "arm64",
          digest: "sha256:arm64",
          media_type: "application/vnd.oci.image.manifest.v1+json",
        },
      ],
    })
  })

  test("rejects a missing required platform", async () => {
    const directory = await fixture({ manifests: [descriptor("amd64")] })

    await expect(readAirGappedOciLayout(directory)).rejects.toThrow(
      "OCI image index must contain exactly linux/amd64 and linux/arm64 manifests",
    )
  })

  test("rejects duplicate platform manifests", async () => {
    const directory = await fixture({ manifests: [descriptor("amd64"), descriptor("amd64")] })

    await expect(readAirGappedOciLayout(directory)).rejects.toThrow(
      "OCI image index must not contain duplicate platform manifests",
    )
  })

  test("rejects an unexpected platform", async () => {
    const directory = await fixture({
      manifests: [descriptor("amd64"), { ...descriptor("arm64"), platform: { os: "linux", architecture: "s390x" } }],
    })

    await expect(readAirGappedOciLayout(directory)).rejects.toThrow(
      "OCI image index has unexpected platform linux/s390x",
    )
  })
})

async function fixture(index: { manifests: object[] } = { manifests: [descriptor("amd64"), descriptor("arm64")] }) {
  const directory = await $`mktemp -d`.text().then((value) => value.trim())
  directories.push(directory)
  await Bun.write(path.join(directory, "oci-layout"), JSON.stringify({ imageLayoutVersion: "1.0.0" }))
  await Bun.write(path.join(directory, "index.json"), JSON.stringify({ manifests: [descriptor("index", false)] }))
  await $`mkdir -p ${path.join(directory, "blobs", "sha256")}`
  await Bun.write(path.join(directory, "blobs", "sha256", "index"), JSON.stringify(index))
  return directory
}

function descriptor(architecture: "index" | "amd64" | "arm64", platform = true) {
  return {
    mediaType:
      architecture === "index"
        ? "application/vnd.oci.image.index.v1+json"
        : "application/vnd.oci.image.manifest.v1+json",
    digest: `sha256:${architecture}`,
    ...(platform ? { platform: { os: "linux", architecture } } : {}),
  }
}
