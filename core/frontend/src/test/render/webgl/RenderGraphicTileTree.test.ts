/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/

import { expect } from "chai";
import { IModelApp } from "../../../IModelApp";
import { GraphicType, HitDetail, HitDetailProps, HitPriority, HitSource, TileTreeReference } from "../../../core-frontend";
import { Color, readUniqueColors, readUniquePixelData, testBlankViewportAsync } from "../../openBlankViewport";
import { ColorDef, Feature } from "@itwin/core-common";
import { Point3d } from "@itwin/core-geometry";

describe("TileTreeReference.createFromRenderGraphic", () => {
  before(async () => IModelApp.startup());
  after(async () => IModelApp.shutdown());

  it("loads asynchronously", async () => {
    await testBlankViewportAsync(async (vp) => {
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
    await testBlankViewportAsync(async (vp) => {
      vp.displayStyle.backgroundColor = ColorDef.black;

      const modelId = vp.iModel.transientIds.getNext();
      const point1Id = vp.iModel.transientIds.getNext();
      const point2Id = vp.iModel.transientIds.getNext();

      const builder = IModelApp.renderSystem.createGraphic({
        computeChordTolerance: () => 0,
        type: GraphicType.ViewOverlay,
        pickable: { id: modelId, modelId },
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
      expect(pixels.containsFeature(point1Id, undefined, undefined, modelId)).to.be.true;
      expect(pixels.containsFeature(point2Id, undefined, undefined, modelId)).to.be.true;

      const colors = readUniqueColors(vp);
      expect(colors.length).to.equal(3);
      expect(colors.contains(Color.fromColorDef(ColorDef.black))).to.be.true;
      expect(colors.contains(Color.fromColorDef(ColorDef.blue))).to.be.true;
      expect(colors.contains(Color.fromColorDef(ColorDef.red))).to.be.true;
    });
  });

  it("can supply a tooltip", async () => {
    await testBlankViewportAsync(async (vp) => {
      const modelId = vp.iModel.transientIds.getNext();
      const builder = IModelApp.renderSystem.createGraphic({
        computeChordTolerance: () => 0,
        type: GraphicType.ViewOverlay,
        pickable: { id: modelId, modelId },
      });

      const elemId = vp.iModel.transientIds.getNext();
      builder.activateFeature(new Feature(elemId));
      builder.addPointString([new Point3d(1, 1, 1)]);

      const ref = TileTreeReference.createFromRenderGraphic({
        iModel: vp.iModel,
        graphic: builder.finish(),
        modelId,
        getToolTip: async (hit: HitDetail) => Promise.resolve(`hi, ${hit.sourceId}!`),
      });

      vp.addTiledGraphicsProvider({
        forEachTileTreeRef: (_, func) => func(ref),
      });

      const hitProps: HitDetailProps = {
        testPoint: new Point3d(),
        viewport: vp,
        hitSource: HitSource.DataPoint,
        hitPoint: new Point3d(),
        sourceId: elemId,
        priority: HitPriority.Unknown,
        distXY: 0,
        distFraction: 0,
        modelId,
      };

      let tooltip = await vp.getToolTip(new HitDetail(hitProps));
      expect(tooltip).to.equal(`hi, ${elemId}!`);

      // getToolTip is not invoked if the hit's modelId is not equal to the tile tree's model Id.
      tooltip = await vp.getToolTip(new HitDetail({ ...hitProps, modelId: vp.iModel.transientIds.getNext() }));
      expect(tooltip).to.equal("");

      tooltip = await vp.getToolTip(new HitDetail({ ...hitProps, modelId: undefined }));
      expect(tooltip).to.equal("");
    });
  });
});
