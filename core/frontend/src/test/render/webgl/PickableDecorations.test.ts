/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/

import { expect } from "chai";
import { Point3d } from "@itwin/core-geometry";
import { IModelApp } from "../../../IModelApp";
import { DecorateContext } from "../../../ViewContext";
import { Viewport } from "../../../Viewport";
import { readUniquePixelData, testBlankViewport } from "../../openBlankViewport";
import { GraphicType } from "../../../common/render/GraphicType";

describe("Pickable decorations", () => {
  type DecorationType = "square" | "point";

  class Decorator {
    private _type = GraphicType.Scene;
    private _curId = "SetMeBeforeTesting";
    private _x = 1;
    private _y = 1;
    private _decType: DecorationType = "point";

    public test(vp: Viewport, type: GraphicType, decType: DecorationType, expectPickable = true): void {
      this._type = type;
      this._curId = vp.iModel.transientIds.getNext();
      this._decType = decType;
      this._x++;
      this._y++;

      vp.invalidateDecorations();
      vp.renderFrame();
      const pixels = readUniquePixelData(vp);
      expect(pixels.containsElement(this._curId)).to.equal(expectPickable);
    }

    public decorate(context: DecorateContext): void {
      this._curId = context.viewport.iModel.transientIds.getNext();
      const pt = new Point3d(this._x++, this._y++, 0);
      if (GraphicType.ViewBackground !== this._type && GraphicType.ViewOverlay !== this._type)
        context.viewport.viewToWorld(pt, pt);

      const builder = context.createGraphicBuilder(this._type, undefined, this._curId);
      if (this._decType === "point") {
        builder.addPointString([pt]);
      } else {
        const pts = [
          pt,
          new Point3d(pt.x + 2, pt.y, 0),
          new Point3d(pt.x + 2, pt.y + 2, 0),
          new Point3d(pt.x, pt.y + 2, 0),
          pt.clone(),
        ];
        builder.addShape(pts);
      }

      context.addDecorationFromBuilder(builder);
    }
  }

  const decorator = new Decorator();
  before(async () => {
    await IModelApp.startup();
    IModelApp.viewManager.addDecorator(decorator);
  });

  after(async () => {
    IModelApp.viewManager.dropDecorator(decorator);
    await IModelApp.shutdown();
  });

  it("world and overlay point decorations are pickable", () => {
    testBlankViewport((vp) => {
      decorator.test(vp, GraphicType.Scene, "point");
      decorator.test(vp, GraphicType.WorldDecoration, "point");
      decorator.test(vp, GraphicType.WorldOverlay, "point");
      decorator.test(vp, GraphicType.ViewOverlay, "point");
    });
  });

  it("world and overlay surface decorations are pickable", () => {
    testBlankViewport((vp) => {
      decorator.test(vp, GraphicType.Scene, "square");
      decorator.test(vp, GraphicType.WorldDecoration, "square");
      decorator.test(vp, GraphicType.WorldOverlay, "square");
      decorator.test(vp, GraphicType.ViewOverlay, "square");
    });
  });

  // There can be only one background graphic, which draws behind everything else.
  // Until we have some use case for making it pickable, we won't complicate our display code to support that.
  it("view background is not pickable", () => {
    testBlankViewport((vp) => {
      decorator.test(vp, GraphicType.ViewBackground, "point", false);
      decorator.test(vp, GraphicType.ViewBackground, "square", false);
    });
  });
});
