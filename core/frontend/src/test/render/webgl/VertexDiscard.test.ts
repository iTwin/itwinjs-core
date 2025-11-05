/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/

import { afterAll, beforeAll, describe, it } from "vitest";
import { Point3d } from "@itwin/core-geometry";
import { IModelApp } from "../../../IModelApp";
import { DecorateContext } from "../../../ViewContext";
import { Viewport } from "../../../Viewport";
import { readUniquePixelData, testBlankViewport } from "../../openBlankViewport";
import { GraphicType } from "../../../common/render/GraphicType";
import { FeatureOverrideProvider } from "../../../FeatureOverrideProvider";
import { FeatureSymbology } from "../../../core-frontend";

// ### WIP!!!!!

describe("Vertex discard decorations", () => {
  class Decorator {
    private _type = GraphicType.Scene;
    public featureIds: string[] = [];

    public test(vp: Viewport, type: GraphicType): void {
      for (let i = 0; i < 2; i++) {
        this.featureIds.push(vp.iModel.transientIds.getNext());
      }

      this._type = type;
      vp.invalidateDecorations();
      vp.renderFrame();
      const pixels = readUniquePixelData(vp);
      console.log("pixels.length = " + pixels.length);
      // expect(pixels.containsElement(this.featureIds[0])).toEqual(false);
      // expect(pixels.containsElement(this.featureIds[1])).toEqual(true);
    }

    public decorate(context: DecorateContext): void {
      let x = 1;
      let y = 1;
      // this.featureIds = [];
      for (let i = 0; i < 2; i++) {
        // const elementId = `0x10000000${i + 1}`;
        // this.featureIds.push(elementId);
        const pt = new Point3d(x++, y++, 0);
        if (GraphicType.ViewBackground !== this._type && GraphicType.ViewOverlay !== this._type)
          context.viewport.viewToWorld(pt, pt);

        // Pass elementId as the feature argument
        const builder = context.createGraphicBuilder(this._type, undefined, this.featureIds[i]);
        builder.addPointString([pt]);
        context.addDecorationFromBuilder(builder);
      }
    }
  }

  class TestOverrideProvider implements FeatureOverrideProvider {
    constructor(private decorator: Decorator) { }
    public addFeatureOverrides(overrides: FeatureSymbology.Overrides, _vp: Viewport): void {
      overrides.setNeverDrawn(this.decorator.featureIds[0]);
      // overrides.setNeverDrawn(this.decorator.featureIds[1]);
    }
  }

  const decorator = new Decorator();
  beforeAll(async () => {
    await IModelApp.startup();
    IModelApp.viewManager.addDecorator(decorator);
  });

  afterAll(async () => {
    IModelApp.viewManager.dropDecorator(decorator);
    await IModelApp.shutdown();
  });

  it("visible and hidden features work", () => {
    testBlankViewport((vp) => {
      const overrideProvider = new TestOverrideProvider(decorator);
      vp.addFeatureOverrideProvider(overrideProvider);
      decorator.test(vp, GraphicType.Scene);
      vp.dropFeatureOverrideProvider(overrideProvider);
    });
  });
});
