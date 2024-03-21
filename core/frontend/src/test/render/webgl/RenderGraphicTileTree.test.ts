/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/

import { expect } from "chai";
import { IModelApp } from "../../../IModelApp";
import { GraphicType, TileTreeReference, TiledGraphicsProvider } from "../../../core-frontend";
import { readUniquePixelData, testBlankViewportAsync } from "../../openBlankViewport";
import { ColorDef, Feature } from "@itwin/core-common";
import { Point3d } from "@itwin/core-geometry";

describe.only("TileTreeReference.createFromRenderGraphic", () => {
  
  before(async () => IModelApp.startup());
  after(async () => IModelApp.shutdown());

  it("loads asynchronously", async () => {
    testBlankViewportAsync(async (vp) => {
      const builder = IModelApp.renderSystem.createGraphic({
        computeChordTolerance: () => 0,
        type: GraphicType.ViewOverlay,
      });

      builder.addPointString([new Point3d(1, 1, 1)]);

      const ref = TileTreeReference.createFromRenderGraphic({
        iModel: vp.iModel,
        graphic: builder.finish(),
        modelId: vp.iModel.transientIds.getNext(),
      });

      expect(ref.isLoadingComplete).to.be.false;
      expect(ref.treeOwner.tileTree).to.be.undefined;

      const tree = await ref.treeOwner.loadTree();
      expect(tree).not.to.be.undefined;

      expect(ref.isLoadingComplete).to.be.true;
      expect(ref.treeOwner.tileTree).to.equal(tree);
      expect(ref.treeOwner.tileTree!.rootTile.hasGraphics).to.be.true;
    });
  });

  it("renders to screen", async () => {
    testBlankViewportAsync(async (vp) => {
      vp.displayStyle.backgroundColor = ColorDef.black;
  
      const modelId = vp.iModel.transientIds.getNext();
      const point1Id = vp.iModel.transientIds.getNext();
      const point2Id = vp.iModel.transientIds.getNext();
  
      const builder = IModelApp.renderSystem.createGraphic({
        computeChordTolerance: () => 0,
        type: GraphicType.ViewOverlay,
      });

      builder.setSymbology(ColorDef.red, ColorDef.red, 1);
      builder.activateFeature(new Feature(point1Id));
      builder.addPointString([new Point3d(1, 1, 1)]);
      builder.setSymbology(ColorDef.blue, ColorDef.blue, 1);
      builder.activateFeature(new Feature(point2Id));
      builder.addPointString([new Point3d(2, 2, 2)]);


      const ref = TileTreeReference.createFromRenderGraphic({
        iModel: vp.iModel,
        graphic: builder.finish(),
        modelId,
      });

      vp.addTiledGraphicsProvider({
        forEachTileTreeRef: (_, func) => func(ref),
      });

      await vp.waitForSceneCompletion();

      const pixels = readUniquePixelData(vp);
      expect(pixels.length).to.equal(3);
      expect(pixels.containsElement(point1Id)).to.be.true;
      expect(pixels.containsElement(point2Id)).to.be.true;
    });
  });

  it("can supply a tooltip", () => {
    
  });
});
