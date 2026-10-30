#!/usr/bin/env node
/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/

// Standalone diagnostic: mirror the native mobile auth flow (client_credentials) and then use the
// iModels client with that token, to reproduce the "iModelNotFound" the Android app hits.
// Reads the same lib/mobile/env.json the mobile app uses, so the inputs are identical.

import * as fs from "node:fs";
import * as https from "node:https";
import * as os from "node:os";
import * as path from "node:path";
import { fileURLToPath } from "node:url";
import { createRequire } from "node:module";

const scriptDir = path.dirname(fileURLToPath(import.meta.url));
const dtaRootDir = path.join(scriptDir, "..");
const require = createRequire(path.join(dtaRootDir, "package.json"));

/** Encode a string for use in a URL query/credential the same way the iOS client does (ASCII alnum + -_.). */
function encodeForUrl(value) {
  return Array.from(value).map((ch) => {
    if (/[A-Za-z0-9\-_.]/.test(ch))
      return ch;
    return Array.from(new TextEncoder().encode(ch)).map((b) => `%${b.toString(16).toUpperCase().padStart(2, "0")}`).join("");
  }).join("");
}

/** Minimal HTTPS request helper returning { status, headers, body }. */
function httpsRequest(urlString, options, body) {
  return new Promise((resolve, reject) => {
    const url = new URL(urlString);
    const req = https.request(url, options, (res) => {
      let data = "";
      res.setEncoding("utf8");
      res.on("data", (chunk) => (data += chunk));
      res.on("end", () => resolve({ status: res.statusCode ?? 0, headers: res.headers, body: data }));
    });
    req.on("error", reject);
    if (body !== undefined)
      req.write(body);
    req.end();
  });
}

/** Decode and return the claims (payload) of a JWT without verifying the signature. */
function decodeJwtClaims(token) {
  try {
    const parts = token.split(".");
    if (parts.length < 2)
      return undefined;
    const payload = Buffer.from(parts[1], "base64url").toString("utf8");
    return JSON.parse(payload);
  } catch {
    return undefined;
  }
}

function loadEnvJson() {
  const envJsonPath = path.join(dtaRootDir, "lib", "mobile", "env.json");
  if (!fs.existsSync(envJsonPath))
    throw new Error(`env.json not found at ${envJsonPath}. Run "npm run build:mobile" (or "rushx build:mobile") first.`);
  return JSON.parse(fs.readFileSync(envJsonPath, "utf8"));
}

async function fetchToken(env) {
  const prefix = env.IMJS_URL_PREFIX ?? "";
  const authority = env.IMJS_SERVICE_AUTHORITY ?? `https://${prefix}ims.bentley.com`;
  const tokenUrl = `${authority}/connect/token`;
  const bodyStr = `grant_type=client_credentials&scope=${encodeForUrl(env.IMJS_OIDC_SCOPE)}`;
  const basic = Buffer.from(`${encodeForUrl(env.IMJS_OIDC_CLIENT_ID)}:${encodeForUrl(env.IMJS_OIDC_CLIENT_SECRET)}`, "utf8").toString("base64");

  console.log(`\n=== Token request ===`);
  console.log(`Endpoint: ${tokenUrl}`);
  console.log(`Requested scope: '${env.IMJS_OIDC_SCOPE}'`);
  console.log(`Body: ${bodyStr}`);

  const res = await httpsRequest(tokenUrl, {
    method: "POST",
    headers: {
      "Accept": "application/json",
      "Content-Type": "application/x-www-form-urlencoded",
      "Content-Length": Buffer.byteLength(bodyStr),
      "Authorization": `Basic ${basic}`,
    },
  }, bodyStr);

  console.log(`Response code: ${res.status}`);
  if (res.status !== 200) {
    console.log(`Error body: ${res.body}`);
    throw new Error(`Token request failed with status ${res.status}`);
  }
  const json = JSON.parse(res.body);
  console.log(`Granted scope (response): '${json.scope ?? ""}'`);
  console.log(`token_type: '${json.token_type}', expires_in: '${json.expires_in}'`);
  const claims = decodeJwtClaims(json.access_token);
  if (claims) {
    console.log(`Token claim scope: ${JSON.stringify(claims.scope)}`);
    console.log(`Token claim aud: ${JSON.stringify(claims.aud)}`);
  }
  return json.access_token;
}

async function rawGetIModel(env, token) {
  const prefix = env.IMJS_URL_PREFIX ?? "";
  const url = `https://${prefix}api.bentley.com/imodels/${env.IMJS_IMODEL_ID}`;
  console.log(`\n=== Raw GET iModel (shows full server error body) ===`);
  console.log(`URL: ${url}`);
  const res = await httpsRequest(url, {
    method: "GET",
    headers: {
      "Authorization": `Bearer ${token}`,
      "Accept": "application/vnd.bentley.itwin-platform.v2+json",
    },
  });
  console.log(`Response code: ${res.status}`);
  console.log(`Body: ${res.body}`);
}

async function getITwin(env, token) {
  const prefix = env.IMJS_URL_PREFIX ?? "";
  const url = `https://${prefix}api.bentley.com/itwins/${env.IMJS_ITWIN_ID}`;
  console.log(`\n=== GET iTwin (is the iTwin itself accessible to this token?) ===`);
  console.log(`URL: ${url}`);
  const res = await httpsRequest(url, {
    method: "GET",
    headers: { "Authorization": `Bearer ${token}`, "Accept": "application/vnd.bentley.itwin-platform.v1+json" },
  });
  console.log(`Response code: ${res.status}`);
  console.log(`Body: ${res.body}`);
}

async function rawGetIModelAcceptVariants(env, token) {
  const prefix = env.IMJS_URL_PREFIX ?? "";
  const url = `https://${prefix}api.bentley.com/imodels/${env.IMJS_IMODEL_ID}`;
  console.log(`\n=== GET iModel with different Accept headers ===`);
  const accepts = [
    "application/vnd.bentley.itwin-platform.v2+json",
    "application/vnd.bentley.itwin-platform.v1+json",
    "application/json",
  ];
  for (const accept of accepts) {
    const res = await httpsRequest(url, { method: "GET", headers: { "Authorization": `Bearer ${token}`, "Accept": accept } });
    console.log(`Accept '${accept}' -> ${res.status}${res.status !== 200 ? ` ${res.body}` : ""}`);
  }
}

async function listIModelsByITwin(env, token) {
  const prefix = env.IMJS_URL_PREFIX ?? "";
  const url = `https://${prefix}api.bentley.com/imodels?iTwinId=${env.IMJS_ITWIN_ID}&$top=100`;
  console.log(`\n=== List iModels by iTwinId (does the target iModel appear?) ===`);
  console.log(`URL: ${url}`);
  const res = await httpsRequest(url, {
    method: "GET",
    headers: { "Authorization": `Bearer ${token}`, "Accept": "application/vnd.bentley.itwin-platform.v2+json", "Prefer": "return=representation" },
  });
  console.log(`Response code: ${res.status}`);
  if (res.status !== 200) {
    console.log(`Body: ${res.body}`);
    return;
  }
  let imodels = [];
  try {
    imodels = JSON.parse(res.body).iModels ?? [];
  } catch { /* ignore */ }
  console.log(`iModels returned: ${imodels.length}`);
  for (const im of imodels)
    console.log(`  ${im.id}  ${im.name}`);
  const found = imodels.some((im) => im.id === env.IMJS_IMODEL_ID);
  console.log(`Target iModel ${env.IMJS_IMODEL_ID} present in list: ${found}`);
}

async function clientGetSingle(env, token) {
  console.log(`\n=== iModels client getSingle ===`);
  const { IModelsClient } = require("@itwin/imodels-client-management");
  const prefix = env.IMJS_URL_PREFIX ?? "";
  const client = new IModelsClient({ api: { baseUrl: `https://${prefix}api.bentley.com/imodels` } });
  const authorization = async () => ({ scheme: "Bearer", token });
  try {
    const iModel = await client.iModels.getSingle({ authorization, iModelId: env.IMJS_IMODEL_ID });
    console.log(`SUCCESS: iModel '${iModel.name}' (id ${iModel.id}), iTwinId ${iModel.iTwinId}`);
  } catch (err) {
    console.log(`FAILED: ${err?.code ?? ""} ${err?.message ?? err}`);
    if (err?.originalError || err?.details)
      console.log(`Details: ${JSON.stringify(err.originalError ?? err.details)}`);
  }
}

// Mirror exactly what the mobile app does: core-backend BriefcaseManager.downloadBriefcase through
// BackendIModelsAccess, pull-only. This exercises the real download path (briefcase acquire +
// checkpoint/changeset download), not just the iModel metadata endpoint.
async function backendDownloadBriefcase(env, token) {
  console.log(`\n=== Backend briefcase download (mirrors requestDownloadBriefcase) ===`);
  const { IModelHost, BriefcaseManager } = require("@itwin/core-backend");
  const { BackendIModelsAccess } = require("@itwin/imodels-access-backend");
  const { IModelsClient } = require("@itwin/imodels-client-authoring");
  const { AzureClientStorage, BlockBlobClientWrapperFactory } = require("@itwin/object-storage-azure");
  const { BriefcaseIdValue } = require("@itwin/core-common");

  const prefix = env.IMJS_URL_PREFIX ?? "";
  const cacheDir = path.join(os.tmpdir(), "dta-service-briefcase-test");
  fs.mkdirSync(cacheDir, { recursive: true });

  const iModelClient = new IModelsClient({
    api: { baseUrl: `https://${prefix}api.bentley.com/imodels` },
    cloudStorage: new AzureClientStorage(new BlockBlobClientWrapperFactory()),
  });
  const hubAccess = new BackendIModelsAccess(iModelClient);
  const authorizationClient = { getAccessToken: async () => `Bearer ${token}` };

  await IModelHost.startup({ hubAccess, cacheDir, profileName: "dta-service-test", authorizationClient });
  try {
    const props = await BriefcaseManager.downloadBriefcase({
      accessToken: `Bearer ${token}`,
      iTwinId: env.IMJS_ITWIN_ID,
      iModelId: env.IMJS_IMODEL_ID,
      briefcaseId: BriefcaseIdValue.Unassigned,
    });
    console.log(`SUCCESS: downloaded briefcase to ${props.fileName}`);
  } catch (err) {
    console.log(`FAILED: errorNumber=${err?.errorNumber ?? ""} ${err?.message ?? err}`);
    if (err?.stack)
      console.log(err.stack.split("\n").slice(0, 5).join("\n"));
  } finally {
    await IModelHost.shutdown();
  }
}

async function main() {
  const env = loadEnvJson();
  console.log(`iTwinId:  ${env.IMJS_ITWIN_ID}`);
  console.log(`iModelId: ${env.IMJS_IMODEL_ID}`);
  console.log(`clientId: ${env.IMJS_OIDC_CLIENT_ID}`);
  console.log(`prefix:   '${env.IMJS_URL_PREFIX ?? ""}'`);

  const token = await fetchToken(env);
  await getITwin(env, token);
  await rawGetIModel(env, token);
  await rawGetIModelAcceptVariants(env, token);
  await listIModelsByITwin(env, token);
  await clientGetSingle(env, token);
  await backendDownloadBriefcase(env, token);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
