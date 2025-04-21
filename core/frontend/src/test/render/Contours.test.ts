/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/

import { afterAll, afterEach, beforeAll, describe, expect, it } from "vitest";
import { IModelApp } from "../../IModelApp";
import { DecorateContext } from "../../ViewContext";
import { ColorDef, ContourDisplay, ContourDisplayProps, Feature, FillFlags, GraphicParams, ImageBuffer, ImageBufferFormat, RenderMaterial, RenderMode, RenderTexture, RgbColor } from "@itwin/core-common";
import { Viewport } from "../../Viewport";
import { Point3d, Range3d } from "@itwin/core-geometry";
import { readUniqueColors, readUniqueFeatures, sortColorDefs, testBlankViewport } from "../openBlankViewport";
import { GraphicType, ViewRect } from "../../common";
import { RenderSystem } from "../../render/RenderSystem";
import { StandardViewId } from "../../StandardView";
import { FeatureOverrideProvider } from "../../FeatureOverrideProvider";
import { FeatureSymbology } from "../../render/FeatureSymbology";
import { DisplayStyle3dState } from "../../DisplayStyleState";

describe("Contour lines", () => {
  // Draws a 10x10 square with its bottom-left corner at (x, 0, z)
  class ContourDecorator {
    private constructor(public readonly x: number, public readonly z: number, public readonly subCategoryId: string) {
      //
    }

    public decorate(context: DecorateContext): void {
      const builder = context.renderSystem.createGraphic({
        type: GraphicType.Scene,
        pickable: { id: "0xdeadbeef", subCategoryId: this.subCategoryId },
        computeChordTolerance: () => 0,
      });
      builder.setSymbology(ColorDef.red, ColorDef.red, 1);
      builder.addShape([
        new Point3d(this.x, 0, this.z),
        new Point3d(this.x + 10, 0, this.z),
        new Point3d(this.x + 10, 0, this.z + 10),
        new Point3d(this.x, 0, this.z + 10),
        new Point3d(this.x, 0, this.z),
      ]);
      context.addDecorationFromBuilder(builder);
    }

    public static register(x: number, z: number, subCategoryId: string): ContourDecorator {
      const decorator = new this(x, z, subCategoryId);
      IModelApp.viewManager.addDecorator(decorator);
      return decorator;
    }

    public static clearAll(): void {
      const decorators = IModelApp.viewManager.decorators.filter((x) => x instanceof ContourDecorator);
      for (const decorator of decorators) {
        IModelApp.viewManager.dropDecorator(decorator);
      }
    }
  }

  beforeAll(async () => {
    await IModelApp.startup();
  });

  afterEach(() => {
    ContourDecorator.clearAll();
  });

  afterAll(async () => {
    await IModelApp.shutdown();
  });

  function testViewport(func: (vp: Viewport) => void): void {
    testBlankViewport((vp) => {
      if (vp.isCameraOn) {
        vp.turnCameraOff();
      }
      expect(vp.isCameraOn).to.be.false;

      vp.viewFlags = vp.viewFlags.copy({
        renderMode: RenderMode.SmoothShade,
        visibleEdges: false,
        lighting: false,
      });

      vp.displayStyle.backgroundColor = ColorDef.black;
      vp.addFeatureOverrideProvider({
        addFeatureOverrides: (ovrs) => ovrs.ignoreSubCategory = true,
      });

      vp.view.setStandardRotation(StandardViewId.Front);
      vp.synchWithView();

      func(vp);
    });
  }

  function lookAt(vp: Viewport, xLow: number, zLow: number, xHigh: number, zHigh: number): void {
    const range = new Range3d(xLow, 10, zLow, xHigh, -10, zHigh);
    vp.view.setStandardRotation(StandardViewId.Front);
    vp.view.lookAtVolume(range);
    vp.synchWithView();
  }
  
  function setContours(vp: Viewport, props: ContourDisplayProps): void {
    expect(vp.view.isSpatialView()).to.be.true;
    const style = (vp.view.displayStyle as DisplayStyle3dState);
    style.settings.contours = ContourDisplay.fromJSON(props);
  }

  it("renders contours of expected colors", () => {
    testViewport((vp) => {
      function expectColors(expected: ColorDef[]): void {
        sortColorDefs(expected);
        vp.invalidateDecorations();
        vp.renderFrame();
        const actual = readUniqueColors(vp).toColorDefs();
        console.log(JSON.stringify(actual));
        expect(actual).to.deep.equal(expected);
      }

      lookAt(vp, 0, 0, 10, 10);
      ContourDecorator.register(0, 0, "0x1");
      expectColors([ColorDef.red, ColorDef.black]);

      const contourDef = {
        majorStyle: {
          color: { r: 0, g: 0, b: 255 },
          pixelWidth: 2,
        },
        minorStyle: {
          color: { r: 255, g: 255, b: 255 },
          pixelWidth: 1,
        },
        minorInterval: 1,
        majorIntervalCount: 2,
        showGeometry: true,
      };
      
      const contourProps: ContourDisplayProps = {
        groups: [{
          name: "A",
          contourDef,
        }],
        displayContours: false,
      };
      
      setContours(vp, contourProps);
      vp.renderFrame();
      expectColors([ColorDef.black, ColorDef.red]);

      contourProps.displayContours = true;
      setContours(vp, contourProps);
      vp.renderFrame();
      expectColors([ColorDef.black, ColorDef.red, ColorDef.blue, ColorDef.white]);

      contourDef.majorIntervalCount = 1;
      setContours(vp, contourProps);
      vp.renderFrame();
      expectColors([ColorDef.black, ColorDef.red, ColorDef.blue]);
    });
  });
  
  it("TODO write more/better unit tests", () => { });

  describe("readPixels", () => {
    it("testing...", () => {
      testViewport((vp) => {
        lookAt(vp, 0, 0, 10, 10);
        ContourDecorator.register(0, 0, "0x1");
        vp.invalidateDecorations();
        vp.renderFrame();
        const colors = readUniqueColors(vp).array;
        console.log(`colors=${JSON.stringify(colors)}`);
        const features = readUniqueFeatures(vp).extractArray();
        console.log(JSON.stringify(features));
        expect(features).to.deep.equal(["a"]);
      });
    });
  });
});
