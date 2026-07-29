/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/

import { IModelApp, MapLayerFormatRegistry, MapLayerSource, MapLayerSourceStatus } from "@itwin/core-frontend";
import { expect } from "chai";
import sinon from "sinon";
import { OgcApiFeaturesMapLayerFormat } from "../../OgcApiFeatures/OgcApiFeaturesFormat.js";

describe("OgcApiFeaturesMapLayerFormat", () => {
  const sandbox = sinon.createSandbox();

  const sourceUrl = "https://maps.example.com/landing";
  const sameOriginCollectionsUrl = "https://maps.example.com/collections";
  const crossOriginCollectionsUrl = "https://third-party.example.org/collections";

  const makeLandingPage = (collectionsHref: string) => ({
    links: [{ rel: "data", type: "application/json", href: collectionsHref }],
  });
  const collectionsDoc = { collections: [{ id: "c1", itemType: "feature", title: "c1" }] };

  let registry: MapLayerFormatRegistry;
  let fetchCalls: { url: string, init?: RequestInit }[];

  /** `finalUrlByUrl` simulates fetch transparently following a redirect: the response reports a `url`
   * that may differ in origin from the one that was requested.
   */
  const stubFetch = (responses: { [url: string]: unknown }, statusByUrl?: { [url: string]: number }, finalUrlByUrl?: { [url: string]: string }) =>
    sandbox.stub(globalThis, "fetch").callsFake(async function (input: RequestInfo | URL, init?: RequestInit) {
      const url = typeof input === "string" ? input : input instanceof URL ? input.toString() : input.url;
      fetchCalls.push({ url, init });
      const status = statusByUrl?.[url] ?? 200;
      return ({
        json: async () => responses[url],
        ok: status === 200,
        status,
        url: finalUrlByUrl?.[url],
      } as unknown) as Response;
    });

  const getAuthorization = (init?: RequestInit): string | null =>
    init?.headers instanceof Headers ? init.headers.get("Authorization") : null;

  const createSource = () => {
    const source = MapLayerSource.fromJSON({ name: "test", url: sourceUrl, formatId: OgcApiFeaturesMapLayerFormat.formatId });
    expect(source).to.not.be.undefined;
    source!.userName = "user1";
    source!.password = "pass1";
    return source!;
  };

  beforeEach(() => {
    registry = new MapLayerFormatRegistry({});
    sandbox.stub(IModelApp, "mapLayerFormatRegistry").get(() => registry);
    fetchCalls = [];
  });

  afterEach(() => {
    sandbox.restore();
  });

  it("withholds basic-auth credentials from a cross-origin advertised collections link when restriction is enabled", async () => {
    registry.restrictCredentialsToTrustedOrigins = true;
    stubFetch({
      [sourceUrl]: makeLandingPage(crossOriginCollectionsUrl),
      [crossOriginCollectionsUrl]: collectionsDoc,
    });

    const validation = await OgcApiFeaturesMapLayerFormat.validate({ source: createSource() });

    expect(fetchCalls.length).to.equals(2);
    // The landing page shares the source origin, so credentials are attached...
    expect(getAuthorization(fetchCalls[0].init)).to.not.be.null;
    // ...but the collections URL is advertised by the server-controlled landing document
    // and targets an untrusted origin, so credentials must be withheld.
    expect(fetchCalls[1].url).to.equals(crossOriginCollectionsUrl);
    expect(getAuthorization(fetchCalls[1].init)).to.be.null;
    // The anonymous request succeeded, so validation still succeeds.
    expect(validation.status).to.equals(MapLayerSourceStatus.Valid);
  });

  it("reports UntrustedOrigin when the credential-less cross-origin collections fetch is challenged", async () => {
    registry.restrictCredentialsToTrustedOrigins = true;
    stubFetch(
      { [sourceUrl]: makeLandingPage(crossOriginCollectionsUrl) },
      { [crossOriginCollectionsUrl]: 401 },
    );

    const validation = await OgcApiFeaturesMapLayerFormat.validate({ source: createSource() });

    expect(getAuthorization(fetchCalls[1].init)).to.be.null;
    expect(validation.status).to.equals(MapLayerSourceStatus.UntrustedOrigin);
  });

  it("reports UntrustedOrigin when the credential-less cross-origin collections fetch is rejected with 403", async () => {
    registry.restrictCredentialsToTrustedOrigins = true;
    stubFetch(
      { [sourceUrl]: makeLandingPage(crossOriginCollectionsUrl) },
      { [crossOriginCollectionsUrl]: 403 },
    );

    const validation = await OgcApiFeaturesMapLayerFormat.validate({ source: createSource() });

    expect(getAuthorization(fetchCalls[1].init)).to.be.null;
    expect(validation.status).to.equals(MapLayerSourceStatus.UntrustedOrigin);
  });

  it("attaches basic-auth credentials to a whitelisted cross-origin collections link", async () => {
    registry.restrictCredentialsToTrustedOrigins = true;
    registry.trustedCredentialsOrigins = ["https://third-party.example.org"];
    stubFetch({
      [sourceUrl]: makeLandingPage(crossOriginCollectionsUrl),
      [crossOriginCollectionsUrl]: collectionsDoc,
    });

    const validation = await OgcApiFeaturesMapLayerFormat.validate({ source: createSource() });

    expect(getAuthorization(fetchCalls[1].init)).to.not.be.null;
    expect(validation.status).to.equals(MapLayerSourceStatus.Valid);
  });

  it("reports InvalidCredentials when the credentialed collections fetch is challenged", async () => {
    registry.restrictCredentialsToTrustedOrigins = true;
    registry.trustedCredentialsOrigins = ["https://third-party.example.org"];
    stubFetch(
      { [sourceUrl]: makeLandingPage(crossOriginCollectionsUrl) },
      { [crossOriginCollectionsUrl]: 401 },
    );

    const validation = await OgcApiFeaturesMapLayerFormat.validate({ source: createSource() });

    expect(getAuthorization(fetchCalls[1].init)).to.not.be.null;
    expect(validation.status).to.equals(MapLayerSourceStatus.InvalidCredentials);
  });

  it("reports UntrustedOrigin when a credentialed collections fetch is redirected to an untrusted origin", async () => {
    registry.restrictCredentialsToTrustedOrigins = true;
    registry.trustedCredentialsOrigins = ["https://third-party.example.org"];
    stubFetch(
      { [sourceUrl]: makeLandingPage(crossOriginCollectionsUrl) },
      { [crossOriginCollectionsUrl]: 401 },
      { [crossOriginCollectionsUrl]: "https://evil.example.net/collections" },
    );

    const validation = await OgcApiFeaturesMapLayerFormat.validate({ source: createSource() });

    // Credentials were attached because the advertised link was trusted, but fetch stripped them across the
    // cross-origin redirect: the challenge comes from an origin that must not receive them.
    expect(getAuthorization(fetchCalls[1].init)).to.not.be.null;
    expect(validation.status).to.equals(MapLayerSourceStatus.UntrustedOrigin);
  });

  it("does not report UntrustedOrigin when an anonymous collections fetch is redirected to a trusted origin", async () => {
    registry.restrictCredentialsToTrustedOrigins = true;
    registry.trustedCredentialsOrigins = ["https://redirect.example.net"];
    stubFetch(
      { [sourceUrl]: makeLandingPage(crossOriginCollectionsUrl) },
      { [crossOriginCollectionsUrl]: 401 },
      { [crossOriginCollectionsUrl]: "https://redirect.example.net/collections" },
    );

    const validation = await OgcApiFeaturesMapLayerFormat.validate({ source: createSource() });

    // The challenge comes from an origin trusted to receive credentials, so this is an authentication
    // failure rather than an origin our policy blocked.
    expect(getAuthorization(fetchCalls[1].init)).to.be.null;
    expect(validation.status).to.equals(MapLayerSourceStatus.InvalidCredentials);
  });

  it("reports InvalidUrl when the collections fetch fails for a non-auth reason", async () => {
    stubFetch(
      { [sourceUrl]: makeLandingPage(sameOriginCollectionsUrl) },
      { [sameOriginCollectionsUrl]: 500 },
    );

    const validation = await OgcApiFeaturesMapLayerFormat.validate({ source: createSource() });

    expect(validation.status).to.equals(MapLayerSourceStatus.InvalidUrl);
  });

  it("attaches basic-auth credentials to a same-origin collections link when restriction is enabled", async () => {
    registry.restrictCredentialsToTrustedOrigins = true;
    stubFetch({
      [sourceUrl]: makeLandingPage(sameOriginCollectionsUrl),
      [sameOriginCollectionsUrl]: collectionsDoc,
    });

    const validation = await OgcApiFeaturesMapLayerFormat.validate({ source: createSource() });

    expect(getAuthorization(fetchCalls[1].init)).to.not.be.null;
    expect(validation.status).to.equals(MapLayerSourceStatus.Valid);
  });

  it("resolves a relative collections link against the landing page URL", async () => {
    registry.restrictCredentialsToTrustedOrigins = true;
    stubFetch({
      [sourceUrl]: makeLandingPage("/collections"),
      [sameOriginCollectionsUrl]: collectionsDoc,
    });

    const validation = await OgcApiFeaturesMapLayerFormat.validate({ source: createSource() });

    expect(fetchCalls[1].url).to.equals(sameOriginCollectionsUrl);
    // The resolved link shares the source origin, so credentials remain attached.
    expect(getAuthorization(fetchCalls[1].init)).to.not.be.null;
    expect(validation.status).to.equals(MapLayerSourceStatus.Valid);
  });

  it("resolves a relative collections link and appends saved and unsaved query params", async () => {
    registry.restrictCredentialsToTrustedOrigins = true;
    const source = createSource();
    source.savedQueryParams = { saved: "1" };
    source.unsavedQueryParams = { unsaved: "2" };
    stubFetch({
      [`${sourceUrl}?saved=1&unsaved=2`]: makeLandingPage("./collections"),
      [`${sameOriginCollectionsUrl}?saved=1&unsaved=2`]: collectionsDoc,
    });

    const validation = await OgcApiFeaturesMapLayerFormat.validate({ source });

    expect(fetchCalls[1].url).to.equals(`${sameOriginCollectionsUrl}?saved=1&unsaved=2`);
    expect(getAuthorization(fetchCalls[1].init)).to.not.be.null;
    expect(validation.status).to.equals(MapLayerSourceStatus.Valid);
  });

  it("resolves a relative collections link against the post-redirect landing page URL", async () => {
    registry.restrictCredentialsToTrustedOrigins = true;
    stubFetch(
      {
        [sourceUrl]: makeLandingPage("/collections"),
        [crossOriginCollectionsUrl]: collectionsDoc,
      },
      undefined,
      { [sourceUrl]: "https://third-party.example.org/landing" },
    );

    const validation = await OgcApiFeaturesMapLayerFormat.validate({ source: createSource() });

    // The landing document was served from another origin, so the relative link resolves there too,
    // and credentials must be withheld from it.
    expect(fetchCalls[1].url).to.equals(crossOriginCollectionsUrl);
    expect(getAuthorization(fetchCalls[1].init)).to.be.null;
    expect(validation.status).to.equals(MapLayerSourceStatus.Valid);
  });

  it("attaches basic-auth credentials to a cross-origin collections link when restriction is disabled (legacy default)", async () => {
    stubFetch({
      [sourceUrl]: makeLandingPage(crossOriginCollectionsUrl),
      [crossOriginCollectionsUrl]: collectionsDoc,
    });

    const validation = await OgcApiFeaturesMapLayerFormat.validate({ source: createSource() });

    expect(getAuthorization(fetchCalls[1].init)).to.not.be.null;
    expect(validation.status).to.equals(MapLayerSourceStatus.Valid);
  });
});
