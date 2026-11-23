/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/

import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { expectDefined, expectNotNull } from "@itwin/core-bentley";
import { EmptyLocalization, ImageMapLayerSettings, ImageSource, ImageSourceFormat } from "@itwin/core-common";
import { Range3d } from "@itwin/core-geometry";
import { LocateOptions } from "../../../ElementLocateManager";
import { IModelApp } from "../../../IModelApp";
import { ImageryMapLayerFormat } from "../../../tile/map/MapLayerImageryFormats";
import { MapLayerImageryProvider } from "../../../tile/map/MapLayerImageryProvider";
import { testBlankViewportAsync } from "../../openBlankViewport";

let solidTile: ImageSource;
const tooltipMarkup = '<h3>Feature info</h3><table style="color: red"><tr><th>Parcel</th><td><strong>42</strong></td></tr></table><svg><title>Not tooltip HTML</title></svg>';

class TestProvider extends MapLayerImageryProvider {
  public override async constructUrl() { return ""; }
  public override async loadTile() { return solidTile; }
  public override async getToolTip(strings: string[]) { strings.push(tooltipMarkup); }
}

class TestFormat extends ImageryMapLayerFormat {
  public static override formatId = "MapTooltipTest";
  public static override createImageryProvider(settings: ImageMapLayerSettings): MapLayerImageryProvider {
    return new TestProvider(settings, true);
  }
}

describe("Map tooltip", { timeout: 60000 }, () => {
  beforeAll(async () => {
    await IModelApp.startup({ localization: new EmptyLocalization() });
    IModelApp.mapLayerFormatRegistry.register(TestFormat);
    const canvas = document.createElement("canvas");
    canvas.width = canvas.height = 1;
    const context = expectNotNull(canvas.getContext("2d"));
    context.fillStyle = "red";
    context.fillRect(0, 0, 1, 1);
    const blob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve));
    solidTile = new ImageSource(new Uint8Array(await expectNotNull(blob).arrayBuffer()), ImageSourceFormat.Png);
  });

  afterAll(async () => IModelApp.shutdown());

  it("preserves formatted map tooltip content without inserting unsupported markup", async () => {
    await testBlankViewportAsync(async (vp) => {
      vp.overrideDisplayStyle({
        viewflags: { backgroundMap: true },
        mapImagery: {
          backgroundBase: {
            formatId: TestFormat.formatId,
            name: "Base",
            url: "https://test.invalid/Base",
            visible: true,
            subLayers: [{ name: "Base", visible: true }],
          },
        },
      });

      vp.zoomToVolume(Range3d.createXYZXYZ(-500, -500, -10, 500, 500, 10));
      await vp.waitForSceneCompletion();
      const picker = IModelApp.locateManager.picker;
      picker.doPick(vp, vp.view.getCenter(), 1, new LocateOptions());
      const tooltip = await vp.getToolTip(expectDefined(picker.getHit(0)));
      if (!(tooltip instanceof HTMLElement))
        throw new Error("Expected an HTML map tooltip");

      expect(tooltip.querySelector("h3")?.textContent).toBe("Feature info");
      expect(tooltip.querySelector("th")?.textContent).toBe("Parcel");
      expect(tooltip.querySelector("td strong")?.textContent).toBe("42");
      expect(tooltip.querySelector("[style], svg")).toBeNull();
    });
  });
});
