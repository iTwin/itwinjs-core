/*---------------------------------------------------------------------------------------------
 * Copyright (c) Bentley Systems, Incorporated. All rights reserved.
 * See LICENSE.md in the project root for license terms and full copyright notice.
 *--------------------------------------------------------------------------------------------*/

import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { Point3d } from "@itwin/core-geometry";
import { IModelApp } from "../../../IModelApp";
import { DecorateContext } from "../../../ViewContext";
import { Viewport } from "../../../Viewport";
import { readUniquePixelData, testBlankViewport } from "../../openBlankViewport";
import { GraphicType } from "../../../common/render/GraphicType";

describe("Pickable decorations", () => {
  class Decorator {
    private _type = GraphicType.Scene;
    private _curId = "SetMeBeforeTesting";
    private _x = 1;
    private _y = 1;

    public test(vp: Viewport, type: GraphicType, expectPickable = true): void {
      this._type = type;
      this._curId = vp.iModel.transientIds.getNext();
      this._x++;
      this._y++;

      vp.invalidateDecorations();
      vp.renderFrame();
      const pixels = readUniquePixelData(vp);
      expect(pixels.containsElement(this._curId)).toEqual(expectPickable);
    }

    public decorate(context: DecorateContext): void {
      this._curId = context.viewport.iModel.transientIds.getNext();
      const pt = new Point3d(this._x++, this._y++, 0);
      if (GraphicType.ViewBackground !== this._type && GraphicType.ViewOverlay !== this._type)
        context.viewport.viewToWorld(pt, pt);

      const builder = context.createGraphicBuilder(this._type, undefined, this._curId);
      builder.addPointString([pt]);
      context.addDecorationFromBuilder(builder);
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

  it("world and overlay decorations are pickable", () => {
    testBlankViewport((vp) => {
      decorator.test(vp, GraphicType.Scene);
      decorator.test(vp, GraphicType.WorldDecoration);
      decorator.test(vp, GraphicType.WorldOverlay);
      decorator.test(vp, GraphicType.ViewOverlay);
    });
  });

  // There can be only one background graphic, which draws behind everything else.
  // Until we have some use case for making it pickable, we won't complicate our display code to support that.
  it("view background is not pickable", () => {
    testBlankViewport((vp) => {
      decorator.test(vp, GraphicType.ViewBackground, false);
    });
  });
});
