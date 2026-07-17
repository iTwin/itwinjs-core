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

  const stubFetch = (responses: { [url: string]: unknown }, statusByUrl?: { [url: string]: number }) =>
    sandbox.stub(globalThis, "fetch").callsFake(async function (input: RequestInfo | URL, init?: RequestInit) {
      const url = typeof input === "string" ? input : input instanceof URL ? input.toString() : input.url;
      fetchCalls.push({ url, init });
      const status = statusByUrl?.[url] ?? 200;
      return ({
        json: async () => responses[url],
        ok: status === 200,
        status,
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
