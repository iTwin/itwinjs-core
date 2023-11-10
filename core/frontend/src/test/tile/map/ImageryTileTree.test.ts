/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/

import { ImageMapLayerProps, ImageMapLayerSettings } from "@itwin/core-common";
import { expect } from "chai";
import * as sinon from "sinon";
import { MockRender } from "../../../render/MockRender";
import { createBlankConnection } from "../../createBlankConnection";
import { ImageryMapLayerTreeReference } from "../../../tile/map/ImageryTileTree";
import { IModelConnection } from "../../../IModelConnection";
import { ImageryMapLayerFormat } from "../../../tile/map/MapLayerImageryFormats";
import { MapLayerImageryProvider } from "../../../tile/map/MapLayerImageryProvider";
import { IModelApp } from "../../../IModelApp";

class CustomProvider extends MapLayerImageryProvider {
  public override async constructUrl(_row: number, _column: number, _zoomLevel: number) { return this._settings.url;}
  public override async  initialize(): Promise<void> {return;}
}

class BaseCustomFormat extends ImageryMapLayerFormat {
  public static override createImageryProvider(settings: ImageMapLayerSettings): MapLayerImageryProvider | undefined {
    return new CustomProvider(settings, true);
  }
}

class CustomFormat1 extends BaseCustomFormat {
  public static override formatId = "Custom1";
  public static override createImageryProvider(settings: ImageMapLayerSettings): MapLayerImageryProvider | undefined {
    return new CustomProvider(settings, true);
  }
}

class CustomFormat2 extends BaseCustomFormat {
  public static override formatId = "Custom2";
  public static override createImageryProvider(settings: ImageMapLayerSettings): MapLayerImageryProvider | undefined {
    return new CustomProvider(settings, true);
  }
}

interface DatasetEntry {
  lhs: ImageMapLayerProps;
  rhs: ImageMapLayerProps;
  expectSameTileTree: boolean;
}

describe("ImageryTileTree", () => {

  let imodel: IModelConnection;

  before(async () => {   // Create a ViewState to load into a Viewport
    await MockRender.App.startup();
    imodel = createBlankConnection();
    IModelApp.mapLayerFormatRegistry.register(CustomFormat1);
    IModelApp.mapLayerFormatRegistry.register(CustomFormat2);
  });

  const sandbox = sinon.createSandbox();
  afterEach(async () => {
    sandbox.restore();
  });

  it("tree supplier", async () => {
    const baseProps: ImageMapLayerProps = { formatId: "Custom1", url: "https://dummy.com", name: "CustomLayer", subLayers: [{name: "sub0", visible: true}]};
    const dataset: DatasetEntry[] = [
      {lhs: {...baseProps}, rhs: {...baseProps}, expectSameTileTree:true},
      {lhs: {...baseProps, name: "someName"}, rhs: {...baseProps}, expectSameTileTree:true},
      {lhs: {...baseProps, url: "https://someUrl.com"}, rhs: {...baseProps}, expectSameTileTree:false},
      {lhs: {...baseProps, formatId:"Custom2"}, rhs: {...baseProps}, expectSameTileTree:false},
      {lhs: {...baseProps, subLayers: [{name: "sub0", visible: false}]}, rhs: {...baseProps}, expectSameTileTree:false},
      {lhs: {...baseProps, subLayers: [{name: "sub1", visible: true}]}, rhs: {...baseProps}, expectSameTileTree:false},
    ];
    for (const entry of dataset) {
      const settingsLhs = ImageMapLayerSettings.fromJSON(entry.lhs);
      const treeRefLhs = new ImageryMapLayerTreeReference({ layerSettings: settingsLhs, layerIndex: 0, iModel: imodel });
      const treeOwnerLhs = treeRefLhs.treeOwner;
      const tileTreeLhs = await treeOwnerLhs.loadTree();
      expect(tileTreeLhs).to.not.undefined;

      const settingsRhs = ImageMapLayerSettings.fromJSON(entry.rhs);
      const treeRefRhs = new ImageryMapLayerTreeReference({ layerSettings: settingsRhs, layerIndex: 0, iModel: imodel });
      const treeOwnerRhs = treeRefRhs.treeOwner;
      const tileTreeRhs = await treeOwnerRhs.loadTree();
      expect(tileTreeRhs).to.not.undefined;

      if (entry.expectSameTileTree)
        expect(tileTreeLhs!.modelId).to.equals(tileTreeRhs!.modelId);
      else
        expect(tileTreeLhs!.modelId).to.not.equals(tileTreeRhs!.modelId);
    }
  });
});
