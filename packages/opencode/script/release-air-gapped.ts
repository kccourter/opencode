#!/usr/bin/env bun

import { $ } from "bun"
import path from "path"
import { fileURLToPath } from "url"
import { Script } from "@opencode-ai/script"
import { readAirGappedOciLayout } from "./air-gapped-oci"
import type { AirGappedRelease } from "./air-gapped-oci"

const dir = fileURLToPath(new URL("..", import.meta.url))
process.chdir(dir)

const artifactDir = process.env.OPENCODE_ARTIFACT_DIR
if (!artifactDir) throw new Error("OPENCODE_ARTIFACT_DIR is required")
if (Script.channel !== "cam") throw new Error("OPENCODE_CHANNEL must be cam")
if (!/^\d+\.\d+\.\d+-cam\.\d+$/.test(Script.version)) {
  throw new Error("OPENCODE_VERSION must use the <upstream>-cam.<n> format")
}

const archive = path.join(artifactDir, `opencode-${Script.version}.oci.tar`)
const temporary = path.join(artifactDir, `.opencode-${Script.version}.${crypto.randomUUID()}.oci.tar`)
const manifest = archive + ".manifest.json"

await $`mkdir -p ${artifactDir}`
await $`rm -f ${temporary}`
await $`OPENCODE_VERSION=${Script.version} OPENCODE_CHANNEL=${Script.channel} bun ./script/build.ts`
await $`docker buildx build --platform linux/amd64,linux/arm64 -t opencode:${Script.version} --output type=oci,dest=${temporary} .`

const release = await releaseManifest(temporary, path.basename(archive))
await Bun.write(temporary + ".sha256", `${release.archive.sha256}  ${path.basename(archive)}\n`)
await Bun.write(temporary + ".manifest.json", JSON.stringify(release, null, 2) + "\n")
await $`mv -f ${temporary} ${archive}`
await $`mv -f ${temporary}.sha256 ${archive}.sha256`
await $`mv -f ${temporary}.manifest.json ${manifest}`
console.log(JSON.stringify(release, null, 2))

async function releaseManifest(archive: string, filename: string): Promise<AirGappedRelease> {
  const extracted = await $`mktemp -d`.text().then((value) => value.trim())
  try {
    await $`tar -xf ${archive} -C ${extracted}`
    const layout = await readAirGappedOciLayout(extracted)
    return {
      version: Script.version,
      channel: Script.channel,
      archive: {
        filename,
        sha256: await sha256(archive),
      },
      ...layout,
    }
  } finally {
    await $`rm -rf ${extracted}`
  }
}

async function sha256(file: string) {
  return new Bun.CryptoHasher("sha256").update(await Bun.file(file).arrayBuffer()).digest("hex")
}
