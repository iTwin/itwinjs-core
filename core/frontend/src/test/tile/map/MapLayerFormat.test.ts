/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/

import { expect } from "chai";
import {
  ImageryMapLayerTreeReference,
  MapLayerFormat,
  MapLayerFormatRegistry,
  MapLayerImageryProvider,
} from "../../../tile/internal";
import { ImageMapLayerProps, ImageMapLayerSettings } from "@itwin/core-common";
import { IModelConnection } from "../../../IModelConnection";

class TestMapLayerFormat extends MapLayerFormat {
  public static override formatId = "TestMapLayerFormat";

  public static override createImageryProvider(settings: TestMapLayerSettings): MapLayerImageryProvider | undefined {
    return new TestMapLayerImageryProvider(settings, false);
  }

  public static override createMapLayerTree(layerSettings: TestMapLayerSettings, layerIndex: number, iModel: IModelConnection) {
    return new ImageryMapLayerTreeReference({ layerSettings, layerIndex, iModel });
  }
}

class TestMapLayerImageryProvider extends MapLayerImageryProvider {
  public async constructUrl(row: number, column: number, zoomLevel: number) {
    return `test.com/tile/${zoomLevel}/${row}/${column}`;
  }
}

class TestMapLayerSettings extends ImageMapLayerSettings { }

const testMapLayer = {
  name: "TestName",
  visible: true,
  title: "TestTitle",
  formatId: TestMapLayerFormat.formatId,
};

describe("MapLayerFormat", () => {
  let imodel: IModelConnection;

  it("should create proper provider", async () => {
    const input = JSON.parse(JSON.stringify(testMapLayer)) as ImageMapLayerProps;
    const settings = TestMapLayerSettings.fromJSON(input);
    const provider = TestMapLayerFormat.createImageryProvider(settings);

    expect(provider).to.not.undefined;
    expect(provider instanceof TestMapLayerImageryProvider);

    const url = await provider?.constructUrl(1, 2, 3);
    expect(url).to.eq("test.com/tile/3/1/2");
  });

  it("should be registered correctly", () => {
    const registry = new MapLayerFormatRegistry({});
    registry.register(TestMapLayerFormat);
    const isRegistered = registry.isRegistered("TestMapLayerFormat");
    expect(isRegistered).to.true;
  });

  it("should create proper map layer tree", () => {
    const input = JSON.parse(JSON.stringify(testMapLayer)) as ImageMapLayerProps;
    const settings = TestMapLayerSettings.fromJSON(input);
    const mapLayerTree = TestMapLayerFormat.createMapLayerTree(settings, 0, imodel);
    expect(mapLayerTree).to.not.undefined;
  });
});
