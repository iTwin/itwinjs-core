/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/

import { expect } from "chai";
import { IModelApp } from "../../../IModelApp";
import { GraphicType, TileTreeReference } from "../../../core-frontend";
import { testBlankViewportAsync } from "../../openBlankViewport";
import { ColorDef } from "@itwin/core-common";
import { Point3d } from "@itwin/core-geometry";

describe.only("TileTreeReference.createFromRenderGraphic", () => {
  
  before(async () => IModelApp.startup());
  after(async () => IModelApp.shutdown());

  it("loads asynchronously", async () => {
    testBlankViewportAsync(async (vp) => {
      vp.displayStyle.backgroundColor = ColorDef.blue;
    
      const builder = IModelApp.renderSystem.createGraphic({
        computeChordTolerance: () => 0,
        type: GraphicType.ViewOverlay,
      });

      builder.setSymbology(ColorDef.red, ColorDef.red, 1);
      builder.addPointString([new Point3d(1, 1, 1)]);

      const graphic = builder.finish();
      const modelId = vp.iModel.transientIds.getNext();
      const ref = TileTreeReference.createFromRenderGraphic({
        iModel: vp.iModel,
        graphic,
        modelId,
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

  it("renders to screen", () => {
    
  });

  it("is contains a single pickable feature by default", () => {
    
  });

  it("can contain multiple pickable features", () => {
    
  });

  it("can supply a tooltip", () => {
    
  });
});
