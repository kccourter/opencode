import { NodeHttpHandler } from "@smithy/node-http-handler"
import { HttpProxyAgent } from "http-proxy-agent"
import { HttpsProxyAgent } from "https-proxy-agent"
import { ProxyEnv } from "./proxy-env"

// AWS credential providers (SSO/STS/OIDC) always talk to *.amazonaws.com over
// https. Use a stable representative host so NO_PROXY/HTTPS_PROXY resolution
// reuses the same shouldProxy() logic as every other proxy-aware path here.
const AWS_STS_REPRESENTATIVE_URL = "https://sts.amazonaws.com"

export function buildAwsProxyRequestHandler() {
  const proxyURL = ProxyEnv.getProxyForUrl(AWS_STS_REPRESENTATIVE_URL)
  if (!proxyURL) return undefined
  return new NodeHttpHandler({
    httpsAgent: new HttpsProxyAgent(proxyURL),
    httpAgent: new HttpProxyAgent(proxyURL),
  })
}

export * as AwsProxy from "./aws-proxy"
