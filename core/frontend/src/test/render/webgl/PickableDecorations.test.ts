/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/

import { expect } from "chai";
import { Point3d } from "@itwin/core-geometry";
import { IModelApp } from "../../../IModelApp";
import { DecorateContext } from "../../../ViewContext";
import { Viewport } from "../../../Viewport";
import { GraphicType } from "../../../render/GraphicBuilder";
import { readUniquePixelData, testBlankViewport } from "../../openBlankViewport";

describe.only("Pickable decorations", () => {
  class Decorator {
    private _type = GraphicType.Scene;
    private _curId = "SetMeBeforeTesting";
    private _x = 1;
    private _y = 1;

    public test(vp: Viewport, type: GraphicType): void {
      this._type = type;
      this._curId = vp.iModel.transientIds.next;
      this._x++;
      this._y++;

      vp.invalidateDecorations();
      vp.renderFrame();
      const pixels = readUniquePixelData(vp);
      expect(pixels.containsElement(this._curId)).to.be.true;
    }

    public decorate(context: DecorateContext): void {
      this._curId = context.viewport.iModel.transientIds.next;
      const pt = new Point3d(this._x++, this._y++, 0);
      if (GraphicType.ViewBackground !== this._type && GraphicType.ViewOverlay !== this._type)
        context.viewport.viewToWorld(pt, pt);

      const builder = context.createGraphicBuilder(this._type, undefined, this._curId);
      builder.addPointString([pt]);
      context.addDecorationFromBuilder(builder);
    }
  }

  let decorator = new Decorator();
  before(async () => {
    await IModelApp.startup();
    IModelApp.viewManager.addDecorator(decorator);
  });

  after(async () => {
    IModelApp.viewManager.dropDecorator(decorator);
    await IModelApp.shutdown();
  });

  it("are pickable", () => {
    testBlankViewport((vp) => {
      decorator.test(vp, GraphicType.Scene);
      decorator.test(vp, GraphicType.WorldDecoration);
      decorator.test(vp, GraphicType.WorldOverlay);
      decorator.test(vp, GraphicType.ViewOverlay);
      decorator.test(vp, GraphicType.ViewBackground);
    });
  });
});
