/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/

import { EmptyLocalization, ImageMapLayerSettings } from "@itwin/core-common";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { ArcGISMapLayerImageryProvider, BingMapsImageryLayerProvider, MapLayerTileTreeReference, OrbitGtTreeReference, RealityModelTileTree, RealityTreeReference } from "../../../tile/internal";
import { IModelApp } from "../../../IModelApp";
import { ScreenViewport } from "../../../Viewport";
import { HitDetail } from "../../../HitDetail";

// Adversarial payload: if any fixed call site regresses to innerHTML, this creates an <img> element
// with an onerror handler instead of literal text.
const xssPayload = `<img src="x" onerror="(window.__xss = true)">&copy; Evil <script>window.__xss2 = true;</script>`;

function expectTextOnly(cards: HTMLTableElement) {
  // The payload must never be parsed as markup...
  expect(cards.querySelector("img[src='x']")).toBeNull();
  expect(cards.querySelector("img[onerror]")).toBeNull();
  expect(cards.querySelector("script")).toBeNull();
  // ...and must survive verbatim as text.
  expect(cards.textContent).toContain(`<img src="x" onerror="(window.__xss = true)">`);
  expect(cards.textContent).toContain(`<script>`);
}

describe("Map layer attribution XSS hardening", () => {
  beforeEach(async () => {
    await IModelApp.startup({ localization: new EmptyLocalization() });
  });

  afterEach(async () => {
    vi.restoreAllMocks();
    if (IModelApp.initialized)
      await IModelApp.shutdown();
  });

  it("ArcGIS logo card renders server-provided copyright text as plain text", () => {
    const settings = ImageMapLayerSettings.fromJSON({ formatId: "ArcGIS", name: "TestArcGIS", url: "https://arcgis.example.com/rest/services/x/MapServer" });
    const provider = new ArcGISMapLayerImageryProvider(settings);
    (provider as any)._copyrightText = xssPayload;   // normally read from server metadata in initialize()

    const cards = document.createElement("table");
    provider.addLogoCards(cards);   // eslint-disable-line @typescript-eslint/no-deprecated

    expectTextOnly(cards);
  });

  it("Bing logo card renders server-provided attributions as plain text", () => {
    const settings = ImageMapLayerSettings.fromJSON({ formatId: "BingMaps", name: "TestBing", url: "https://bing.example.com/{bingKey}" });
    const provider = new BingMapsImageryLayerProvider(settings);   // eslint-disable-line @typescript-eslint/no-deprecated
    vi.spyOn(provider as any, "getMatchingAttributions").mockReturnValue([
      { copyrightMessage: xssPayload },
      { copyrightMessage: "Second provider" },
    ]);

    const cards = document.createElement("table");
    provider.addLogoCards(cards, {} as ScreenViewport);   // eslint-disable-line @typescript-eslint/no-deprecated

    expectTextOnly(cards);
    expect(cards.textContent).toContain("Second provider");
    // The <br> separator between attributions is created from code and must still be a real element.
    expect(cards.querySelectorAll("br")).toHaveLength(1);
  });

  it("ArcGIS identify tooltip escapes server-provided field names and values", async () => {
    const settings = ImageMapLayerSettings.fromJSON({ formatId: "ArcGIS", name: "TestArcGIS", url: "https://arcgis.example.com/rest/services/x/MapServer" });
    const provider = new ArcGISMapLayerImageryProvider(settings);
    (provider as any)._querySupported = true;
    // Malicious identify response: both the display field name and its value are server-controlled.
    vi.spyOn(provider as any, "getIdentifyData").mockResolvedValue({
      results: [{ displayFieldName: xssPayload, attributes: { [xssPayload]: xssPayload } }],
    });

    const strings: string[] = [];
    await provider.getToolTip(strings, {} as any, {} as any, {} as any);

    expect(strings).toHaveLength(1);
    // Emulate MapLayerTileTreeReference.getToolTip, which joins the strings into innerHTML.
    const div = document.createElement("div");
    div.innerHTML = strings.join("<br>");
    expect(div.querySelector("img")).toBeNull();
    expect(div.querySelector("script")).toBeNull();
    expect(div.textContent).toContain(`<img src="x" onerror="(window.__xss = true)">`);
  });

  it("reality model tooltip renders tileset-provided name and batch-table properties as plain text", () => {
    // _getToolTip requires a loaded tile tree; bypass the constructors and supply the minimal
    // shape it consumes so we can exercise the DOM-building logic with adversarial content.
    const iModel = {};
    const tree = Object.create(RealityModelTileTree.prototype);
    // Use defineProperties: some of these shadow getter-only accessors on the prototype.
    Object.defineProperties(tree, {
      iModel: { value: iModel },
      modelId: { value: "0x1" },
      batchTableProperties: { value: { getFeatureProperties: () => ({ vendor: xssPayload }) } },
      loader: { value: { tree: { dataSource: { realityDataType: undefined } } } },
    });

    const ref = Object.create(RealityTreeReference.prototype);
    ref._name = xssPayload;
    Object.defineProperty(ref, "treeOwner", { value: { tileTree: tree } });

    const hit = { iModel, sourceId: "0xfeature" } as unknown as HitDetail;
    const tooltip: HTMLElement = ref._getToolTip(hit);

    expect(tooltip.querySelector("img[src='x']")).toBeNull();
    expect(tooltip.querySelector("img[onerror]")).toBeNull();
    expect(tooltip.querySelector("script")).toBeNull();
    // The name line survives verbatim; the batch value survives JSON-stringified (quotes escaped) but unparsed.
    expect(tooltip.textContent).toContain(`<img src="x" onerror="(window.__xss = true)">`);
    expect(tooltip.textContent).toContain("vendor:");
    expect(tooltip.textContent).toContain("<script>");
    // Line separators are created from code and must still be real elements.
    expect(tooltip.querySelectorAll("br").length).toBeGreaterThan(0);
  });

  it("OrbitGT point cloud tooltip renders the user-supplied model name as plain text", async () => {
    const iModel = {};
    const ref = Object.create(OrbitGtTreeReference.prototype);
    ref._name = xssPayload;
    Object.defineProperty(ref, "treeOwner", { value: { tileTree: { iModel } } });

    const hit = { iModel } as unknown as HitDetail;
    const tooltip = await ref.getToolTip(hit) as HTMLElement;

    expect(tooltip.querySelector("img[src='x']")).toBeNull();
    expect(tooltip.querySelector("img[onerror]")).toBeNull();
    expect(tooltip.querySelector("script")).toBeNull();
    expect(tooltip.textContent).toContain(`<img src="x" onerror="(window.__xss = true)">`);
    expect(tooltip.querySelectorAll("br")).toHaveLength(1);
  });

  it("map layer tooltip renders the user-supplied layer name as plain text", async () => {
    const iModel = {};
    const ref = Object.create(MapLayerTileTreeReference.prototype);
    ref._layerSettings = { name: xssPayload };
    Object.defineProperty(ref, "treeOwner", { value: { tileTree: { iModel, modelId: "0x1" } } });

    const hit = { iModel, sourceId: "0x1" } as unknown as HitDetail;
    const tooltip = await ref.getToolTip(hit) as HTMLElement;

    expect(tooltip.querySelector("img[src='x']")).toBeNull();
    expect(tooltip.querySelector("img[onerror]")).toBeNull();
    expect(tooltip.querySelector("script")).toBeNull();
    expect(tooltip.textContent).toContain(`Map Layer: ${xssPayload}`);
  });
});
