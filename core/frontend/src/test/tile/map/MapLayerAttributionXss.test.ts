/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/

import { EmptyLocalization, ImageMapLayerSettings } from "@itwin/core-common";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { ArcGISMapLayerImageryProvider, BingMapsImageryLayerProvider } from "../../../tile/internal";
import { IModelApp } from "../../../IModelApp";
import { ScreenViewport } from "../../../Viewport";

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
    const provider = new BingMapsImageryLayerProvider(settings);
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
});
