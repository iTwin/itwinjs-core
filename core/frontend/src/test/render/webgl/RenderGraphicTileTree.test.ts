/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/

import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { IModelApp } from "../../../IModelApp";
import { GraphicType, HitDetail, HitDetailProps, HitPriority, HitSource, TileTreeReference } from "../../../core-frontend";
import { testBlankViewportAsync } from "../../openBlankViewport";
import { Feature } from "@itwin/core-common";
import { Point3d } from "@itwin/core-geometry";

describe("TileTreeReference.createFromRenderGraphic", () => {
  beforeAll(async () => IModelApp.startup());
  afterAll(async () => IModelApp.shutdown());

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

      expect(ref.isLoadingComplete).toBe(false);
      expect(ref.treeOwner.tileTree).toBeUndefined();

      const tree = await ref.treeOwner.loadTree();
      expect(tree).toBeDefined();

      expect(ref.isLoadingComplete).toBe(true);
      expect(ref.treeOwner.tileTree).toEqual(tree);
      expect(ref.treeOwner.tileTree!.rootTile.hasGraphics).toBe(true);
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
      expect(tooltip).toEqual(`hi, ${elemId}!`);

      // getToolTip is not invoked if the hit's modelId is not equal to the tile tree's model Id.
      tooltip = await vp.getToolTip(new HitDetail({ ...hitProps, modelId: vp.iModel.transientIds.getNext() }));
      expect(tooltip).toEqual("");

      tooltip = await vp.getToolTip(new HitDetail({ ...hitProps, modelId: undefined }));
      expect(tooltip).toEqual("");
    });
  });
});
