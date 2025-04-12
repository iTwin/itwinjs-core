/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/

import { afterAll, afterEach, beforeAll, describe, expect, it } from "vitest";
import { IModelApp } from "../../IModelApp";
import { DecorateContext } from "../../ViewContext";
import { ColorDef, FillFlags, GraphicParams, RenderMaterial, RenderMode, RenderTexture, RgbColor } from "@itwin/core-common";
import { RenderGraphic } from "../../render/RenderGraphic";
import { Viewport } from "../../Viewport";
import { Point3d } from "@itwin/core-geometry";
import { GraphicBuilder } from "../../render/GraphicBuilder";
import { readUniqueColors, testBlankViewport } from "../openBlankViewport";

describe("White-on-white reversal", () => {
  class TestDecorator {
    private constructor(public readonly decorate: (context: DecorateContext) => void) {
      
    }

    public static register(decorate: (context: DecorateContext) => void): TestDecorator {
      const decorator = new this(decorate);
      IModelApp.viewManager.addDecorator(decorator);
      return decorator;
    }

    public static clearAll(): void {
      const decorators = IModelApp.viewManager.decorators.filter((x) => x instanceof TestDecorator);
      for (const decorator of decorators) {
        IModelApp.viewManager.dropDecorator(decorator);
      }
    }
  }

  beforeAll(async () => {
    await IModelApp.startup();
  });

  afterEach(() => {
    TestDecorator.clearAll();
  });

  afterAll(async () => {
    await IModelApp.shutdown();
  });

  function addTriangleDecoration(context: DecorateContext, color: ColorDef, material?: RenderMaterial, fillFlags: FillFlags = FillFlags.None): void {
    const builder = context.createSceneGraphicBuilder();
    const params = new GraphicParams;
    params.lineColor = params.fillColor = color;
    params.material = material;
    params.fillFlags = fillFlags;
    builder.activateGraphicParams(params);

    const pts = [new Point3d(0, 0, 0), new Point3d(10, 0, 0), new Point3d(0, 10, 0), new Point3d(0, 0, 0)];
    context.viewport.viewToWorldArray(pts);
    builder.addShape(pts);
    context.addDecorationFromBuilder(builder);
  }

  function expectColors(vp: Viewport, expected: ColorDef[], bgColor: ColorDef, decorate: (context: DecorateContext) => void): void {
    TestDecorator.register(decorate);
    vp.displayStyle.backgroundColor = bgColor;
    vp.invalidateDecorations();
    vp.renderFrame();

    const actualColors = readUniqueColors(vp).array.map((x) => { return { r: x.r, g: x.g, b: x.b } });
    const expectedColors = expected.map((x) => RgbColor.fromColorDef(x));
    expect(actualColors).to.deep.equal(expectedColors);

    TestDecorator.clearAll();
  }

  it("applies to white scene decorations IFF view background is white", () => {
    testBlankViewport((vp) => {
      vp.viewFlags = vp.viewFlags.copy({ renderMode: RenderMode.SmoothShade, lighting: false });
      expectColors(vp, [ColorDef.red, ColorDef.blue], ColorDef.red, (ctx) => addTriangleDecoration(ctx, ColorDef.blue));
    });
  });

  it("only applies to textured meshes if textures are disabled", () => {
    
  });

  it("never applies to ImageGraphics", () => {
    
  });

  it("doesn't apply to surfaces if edges are displayed", () => {
    
  });

  it("doesn't apply to background fill", () => {
    
  });

  it("doesn't apply to lit surfaces", () => {
    
  });
});
