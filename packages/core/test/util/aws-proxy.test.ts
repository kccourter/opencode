import { afterEach, describe, expect, test } from "bun:test"
import { NodeHttpHandler } from "@smithy/node-http-handler"
import { AwsProxy } from "@opencode-ai/core/util/aws-proxy"

const PROXY_KEYS = ["http_proxy", "https_proxy", "all_proxy", "no_proxy"]
const originalEnv = new Map<string, string | undefined>()

function set(key: string, value: string) {
  if (!originalEnv.has(key)) originalEnv.set(key, process.env[key])
  process.env[key] = value
}

afterEach(() => {
  for (const key of PROXY_KEYS) {
    if (!originalEnv.has(key)) continue
    const value = originalEnv.get(key)
    if (value === undefined) delete process.env[key]
    else process.env[key] = value
  }
  originalEnv.clear()
})

describe("util.aws-proxy", () => {
  test("returns undefined when no proxy env var is set", () => {
    expect(AwsProxy.buildAwsProxyRequestHandler()).toBeUndefined()
  })

  test("returns undefined when NO_PROXY disables all proxying", () => {
    set("https_proxy", "http://proxy.internal:8080")
    set("no_proxy", "*")
    expect(AwsProxy.buildAwsProxyRequestHandler()).toBeUndefined()
  })

  test("builds a proxy-aware NodeHttpHandler when a proxy is configured", () => {
    set("https_proxy", "http://proxy.internal:8080")

    const handler = AwsProxy.buildAwsProxyRequestHandler()
    expect(handler).toBeInstanceOf(NodeHttpHandler)
  })

  test("respects NO_PROXY host exceptions", () => {
    set("https_proxy", "http://proxy.internal:8080")
    set("no_proxy", "sts.amazonaws.com")
    expect(AwsProxy.buildAwsProxyRequestHandler()).toBeUndefined()
  })
})
