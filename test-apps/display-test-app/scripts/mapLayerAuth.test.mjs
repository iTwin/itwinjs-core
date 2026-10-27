/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";
import { runInNewContext } from "node:vm";
import ts from "typescript";

/** @typedef {import("@itwin/core-frontend").MapLayerFetchHandler} MapLayerFetchHandler */
/** @typedef {import("@itwin/core-frontend").MapLayerRequest} MapLayerRequest */
/** String-valued configuration used by this isolated harness.
 * @typedef {Record<string, string | undefined>} AuthConfiguration
 */

// DTA has no browser test runner. Exercise the real setup and Markdown examples in isolation,
// replacing only IModelApp registration; no network, environment secrets, or app startup required.
const appRoot = new URL("../", import.meta.url);
const repoRoot = new URL("../../", appRoot);
const origin = "https://maps.example.com";
const layerUrl = `${origin}/wmts`;
const baseURI = `${origin}/app/`;
const configuration = {
  mapLayerAuthHeader: "Authorization=Bearer test-only",
  mapLayerAuthQueryParams: "apiKey=test-only",
  mapLayerAuthFormats: "WMTS,OgcApiFeatures",
  mapLayerAuthOrigins: origin,
};

/** @param {string} source */
function compile(source) {
  return ts.transpileModule(source, {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
  }).outputText;
}

class MapLayerAuthenticationFailedError extends Error {}

function createContext(base = baseURI) {
  /** @type {MapLayerFetchHandler[]} */
  const handlers = [];
  /** @type {string[]} */
  const warnings = [];
  const registry = {
    restrictCredentialsToTrustedOrigins: false,
    isRegistered: () => true,
    addMapLayerFetchHandler: /** @param {MapLayerFetchHandler} handler */ (handler) => handlers.push(handler),
  };
  const context = {
    IModelApp: { mapLayerFormatRegistry: registry },
    MapLayerAuthenticationFailedError,
    document: { baseURI: base },
    URL, URLSearchParams, Headers, Response,
    console: { warn: /** @param {string} message */ (message) => warnings.push(message) },
  };
  return { context, handlers, warnings, registry };
}

/** @param {AuthConfiguration} overrides */
function configure(overrides = {}, base = baseURI) {
  const result = createContext(base);
  const exports = /** @type {{ configureMapLayerAuth: (configuration: AuthConfiguration) => void }} */ ({});
  runInNewContext(compile(readFileSync(new URL("src/frontend/MapLayerAuthSetup.ts", appRoot), "utf8")), {
    ...result.context,
    exports,
    require: /** @param {string} id */ (id) => {
      assert.equal(id, "@itwin/core-frontend");
      return { IModelApp: result.context.IModelApp, MapLayerAuthenticationFailedError };
    },
  });
  exports.configureMapLayerAuth({ ...configuration, ...overrides });
  return result;
}

/**
 * @param {MapLayerFetchHandler} handler
 * @param {string} url
 * @param {number[]} statuses Status of each successive send; the last one repeats.
 */
async function invoke(handler, url, formatId = "WMTS", sourceUrl = layerUrl, statuses = [200]) {
  const request = { url, layerUrl: sourceUrl, formatId, headers: new Headers(), searchParams: new URLSearchParams("service=WMTS") };
  /** @type {MapLayerRequest[]} */
  const sends = [];
  try {
    const response = await handler(request, async (sent) => {
      sends.push(sent);
      return new Response(null, { status: statuses[Math.min(sends.length, statuses.length) - 1] });
    });
    return { response, sends };
  } finally {
    // Neither sending, declining nor failing may inject secrets into the input value.
    assert.equal(request.headers.has("Authorization"), false);
    assert.equal(request.searchParams.has("apiKey"), false);
  }
}

test("DTA injects both configured values for requests to a listed origin", async () => {
  const { handlers } = configure();
  assert.equal(handlers.length, 1);
  for (const url of [`${origin}/tiles/0/0/0`, "https://MAPS.EXAMPLE.COM:443/collections", "/tiles/0/0/0", "tiles/0/0/0"]) {
    const { sends } = await invoke(handlers[0], url);
    assert.equal(sends.length, 1);
    assert.equal(sends[0].headers.get("Authorization"), "Bearer test-only");
    assert.equal(sends[0].searchParams.get("apiKey"), "test-only");
    assert.equal(sends[0].searchParams.get("service"), "WMTS");
  }
  assert.equal((await invoke(handlers[0], `${origin}/tiles`, "WMS")).sends.length, 0);
});

test("DTA does not trust a layer's own origin: an unlisted layer receives neither header nor query secrets", async () => {
  for (const restriction of [false, true]) {
    const { handlers, registry } = configure();
    registry.restrictCredentialsToTrustedOrigins = restriction;
    for (const [url, sourceUrl] of [
      ["https://other.example.com/tiles", "https://other.example.com/wmts"],
      ["https://other.example.com/collections/x/items", "https://other.example.com/collections/x"],
    ]) {
      for (const format of ["WMTS", "OgcApiFeatures"]) {
        const { sends, response } = await invoke(handlers[0], url, format, sourceUrl);
        assert.equal(sends.length, 0, `${url} (restriction ${restriction})`);
        assert.equal(response, undefined, url);
      }
    }
  }
  // A listed origin is approved regardless of which layer the request is made for.
  const { handlers } = configure({ mapLayerAuthOrigins: "https://tiles.example.com" });
  assert.equal((await invoke(handlers[0], "https://tiles.example.com/tiles", "WMTS", "https://other.example.com/wmts")).sends.length, 1);
  assert.equal((await invoke(handlers[0], `${origin}/tiles`)).sends.length, 0);
});

test("DTA declines server-advertised WMTS and OGC destinations despite a trusted layerUrl", async () => {
  for (const restriction of [false, true]) {
    const { handlers, registry } = configure();
    registry.restrictCredentialsToTrustedOrigins = restriction;
    for (const format of ["WMTS", "OgcApiFeatures"]) {
      for (const url of [
        "https://other.example.com/tiles", "//other.example.com/collections", `${origin}:8443/tiles`,
        "http://maps.example.com/tiles", "https://maps.example.com.evil.test/tiles",
        "https://sub.maps.example.com/tiles", `blob:${origin}/opaque`, "file:///tiles", "http://[bad/tiles",
      ]) {
        const { sends, response } = await invoke(handlers[0], url, format);
        assert.equal(sends.length, 0, url);
        assert.equal(response, undefined, url);
      }
    }
  }
});

test("DTA requires explicit approval for a separate tile host and port", async () => {
  const { handlers } = configure({ mapLayerAuthOrigins: "https://tiles.example.com:8443/" });
  assert.equal((await invoke(handlers[0], "https://tiles.example.com:8443/tiles")).sends.length, 1);
  assert.equal((await invoke(handlers[0], "https://tiles.example.com/tiles")).sends.length, 0);
});

test("DTA resolves relative destinations using the document base, not layerUrl", async () => {
  const { handlers } = configure({}, "https://other.example.com/app/");
  assert.equal((await invoke(handlers[0], "/tiles")).sends.length, 0);
  assert.equal((await invoke(handlers[0], "/tiles", "WMTS", "/wmts")).sends.length, 0);
});

test("DTA does not reuse the SSO trust list for injected secrets", async () => {
  const { handlers, registry } = configure({ mapLayerTrustedCredentialsOrigins: "https://sso.example.com" });
  assert.equal(registry.restrictCredentialsToTrustedOrigins, true);
  assert.equal((await invoke(handlers[0], "https://sso.example.com/tiles")).sends.length, 0);
  assert.equal(configure().registry.restrictCredentialsToTrustedOrigins, false);
});

test("DTA registers no handler for missing or invalid origin configuration", async () => {
  for (const value of [undefined, "", " ", "null", "file:///", `blob:${origin}/id`, "https://*.example.com",
    `${origin}/path`, `${origin}?apiKey=do-not-log`, `${origin}#fragment`, "https://user:do-not-log@maps.example.com"]) {
    const { handlers, warnings } = configure({ mapLayerAuthOrigins: value });
    assert.equal(handlers.length, 0, value);
    assert.ok(warnings.length > 0, value);
    assert.ok(warnings.every((warning) => !warning.includes("do-not-log")));
  }
  // A valid entry next to an invalid one is still honored.
  const { handlers } = configure({ mapLayerAuthOrigins: `${origin}/path, ${origin}` });
  assert.equal(handlers.length, 1);
  assert.equal((await invoke(handlers[0], `${origin}/tiles`)).sends.length, 1);
  assert.equal(configure({ mapLayerAuthFormats: undefined }).handlers.length, 0);
});

test("DTA reports 401/403 as an authentication failure", async () => {
  const { handlers } = configure();
  for (const status of [401, 403])
    await assert.rejects(invoke(handlers[0], `${origin}/tiles`, "WMTS", layerUrl, [status]), MapLayerAuthenticationFailedError);
  assert.equal((await invoke(handlers[0], `${origin}/tiles`, "WMTS", layerUrl, [404])).response?.status, 404);
});

test("DTA reads the explicit auth-origin environment variable", () => {
  const exports = /** @type {{ getConfig: () => AuthConfiguration }} */ ({});
  runInNewContext(compile(readFileSync(new URL("src/common/DtaConfiguration.ts", appRoot), "utf8")), {
    exports,
    process: { env: { IMJS_MAP_LAYER_AUTH_ORIGINS: origin } },
    require: /** @param {string} id */ (id) => {
      assert.equal(id, "@itwin/core-bentley");
      return { ProcessDetector: { isMobileAppBackend: false } };
    },
  });
  assert.equal(exports.getConfig().mapLayerAuthOrigins, origin);
});

/**
 * @param {string} path
 * @param {string} marker
 * @param {string} setup
 * @param {Record<string, unknown>} globals
 */
function example(path, marker, setup = "", globals = {}) {
  const markdown = readFileSync(new URL(path, repoRoot), "utf8");
  const blocks = [...markdown.matchAll(/```ts\r?\n([\s\S]*?)```/g)].map((match) => match[1]);
  const block = blocks.find((source) => source.includes(marker));
  assert.ok(block, `Missing example: ${marker}`);
  const result = createContext();
  runInNewContext(compile(`${block}\n${setup}`), { ...result.context, ...globals });
  assert.equal(result.handlers.length, 1);
  return result.handlers[0];
}

test("published auth examples check actual origins before injecting headers or parameters", async () => {
  const handlers = [
    example("docs/learning/frontend/MapLayerAuthentication.md", "const tokensByLayer", `tokensByLayer.set(${JSON.stringify(layerUrl)}, "test-only");`),
    example("docs/changehistory/NextVersion.md", "const secretParamsByLayer", "", { settings: { url: layerUrl }, secret: "test-only" }),
    example("docs/changehistory/NextVersion.md", "const authOrigins", `authOrigins.clear(); authOrigins.add(${JSON.stringify(origin)});`, { tokens: { current: "test-only" } }),
  ];
  for (const handler of handlers) {
    for (const url of [`${origin}/tiles`, "/tiles"]) {
      const { sends } = await invoke(handler, url, "WMS");
      assert.equal(sends.length, 1);
      assert.ok(sends[0].headers.has("Authorization") || sends[0].searchParams.has("apiKey"));
    }
    for (const url of ["https://other.example.com/tiles", "http://maps.example.com/tiles", `${origin}:8443/collections`, `blob:${origin}/opaque`]) {
      const { sends, response } = await invoke(handler, url, "WMS");
      assert.equal(sends.length, 0);
      assert.equal(response, undefined);
    }
  }
});

test("published auth examples report unrecoverable 401/403 as an authentication failure", async () => {
  const tokens = { current: "expired", refreshes: 0, async refresh() { this.refreshes++; this.current = "fresh"; } };
  const handlers = [
    example("docs/learning/frontend/MapLayerAuthentication.md", "const tokensByLayer", `tokensByLayer.set(${JSON.stringify(layerUrl)}, "test-only");`),
    example("docs/changehistory/NextVersion.md", "const secretParamsByLayer", "", { settings: { url: layerUrl }, secret: "test-only" }),
    example("docs/changehistory/NextVersion.md", "const authOrigins", `authOrigins.clear(); authOrigins.add(${JSON.stringify(origin)});`, { tokens }),
  ];
  for (const handler of handlers)
    await assert.rejects(invoke(handler, `${origin}/tiles`, "WMS", layerUrl, [403]), MapLayerAuthenticationFailedError);

  // The retrying recipe refreshes once, then either recovers transparently or reports the failure.
  const retrying = handlers[2];
  tokens.refreshes = 0;
  tokens.current = "expired";
  const recovered = await invoke(retrying, `${origin}/tiles`, "WMS", layerUrl, [401, 200]);
  assert.equal(recovered.response?.status, 200);
  assert.deepEqual(recovered.sends.map((sent) => sent.headers.get("Authorization")), ["Bearer expired", "Bearer fresh"]);
  assert.equal(tokens.refreshes, 1);

  tokens.refreshes = 0;
  await assert.rejects(invoke(retrying, `${origin}/tiles`, "WMS", layerUrl, [401]), MapLayerAuthenticationFailedError);
  assert.equal(tokens.refreshes, 1);
});