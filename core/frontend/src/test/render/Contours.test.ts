/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/

import { afterAll, afterEach, beforeAll, describe, expect, it } from "vitest";
import { IModelApp } from "../../IModelApp";
import { DecorateContext } from "../../ViewContext";
import { ColorDef, ContourDisplay, ContourDisplayProps, RenderMode } from "@itwin/core-common";
import { Viewport } from "../../Viewport";
import { Point3d, Range3d } from "@itwin/core-geometry";
import { readUniqueColors, readUniquePixelData, sortColorDefs, testBlankViewport } from "../openBlankViewport";
import { GraphicType } from "../../common";
import { StandardViewId } from "../../StandardView";
import { DisplayStyle3dState } from "../../DisplayStyleState";
import { compareBooleans, compareNumbers, compareStrings } from "@itwin/core-bentley";

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

  function hexifyColors(defs: ColorDef[]): string[] {
    return defs.map((x) => x.tbgr.toString(16));
  }

  // ###TODO this test expects specific colors without accounting for the alpha blending applied to contour lines.
  // Make it pass and add a bunch of additional tests.
  it.skip("renders contours of expected colors", () => {
    testViewport((vp) => {
      function expectColors(expected: ColorDef[]): void {
        sortColorDefs(expected);
        vp.renderFrame();
        const actual = hexifyColors(readUniqueColors(vp).toColorDefs());
        expect(actual).to.deep.equal(hexifyColors(expected));
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
        majorIntervalCount: 1,
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
      expectColors([ColorDef.black, ColorDef.red, ColorDef.blue]);

      contourDef.majorIntervalCount = 2;
      setContours(vp, contourProps);
      vp.renderFrame();
      expectColors([ColorDef.black, ColorDef.red, ColorDef.blue, ColorDef.white]);
    });
  });

  interface ContourInfo {
    groupName: string;
    elevation: number;
    isMajor: boolean;
    subCategoryId: string;
  }

  function sortContours(contours: ContourInfo[]): ContourInfo[] {
    return contours.sort((a, b) =>
      compareStrings(a.groupName, b.groupName) || compareNumbers(a.elevation, b.elevation) ||
      compareBooleans(a.isMajor, b.isMajor) || compareStrings(a.subCategoryId, b.subCategoryId)
    );
  }

  function readUniqueContours(vp: Viewport): ContourInfo[] {
    const pixels = readUniquePixelData(vp);
    const set = new Set<ContourInfo>();
    for (const pixel of pixels) {
      if (pixel.contour) {
        set.add({
          groupName: pixel.contour.group.name,
          elevation: pixel.contour.elevation,
          isMajor: pixel.contour.isMajor,
          subCategoryId: pixel.feature!.subCategoryId,
        });
      }
    }

    return sortContours(Array.from(set));
  }

  function expectContours(vp: Viewport, expected: ContourInfo[]): void {
    sortContours(expected);
    expect(readUniqueContours(vp)).to.deep.equal(expected);
  }

  function getContourDef(args?: {
    majorIntervalCount?: number;
  }) {
    return {
      majorStyle: {
        color: { r: 0, g: 0, b: 255 },
        pixelWidth: 2,
      },
      minorStyle: {
        color: { r: 255, g: 255, b: 255 },
        pixelWidth: 1,
      },
      minorInterval: 1,
      majorIntervalCount: args?.majorIntervalCount ?? 1,
      showGeometry: true,
    };
  }

  function getContourProps(args?: {
    display?: boolean;
    majorIntervalCount?: number;
    subCategories?: string;
  }) {
    return {
      groups: [{
        name: "A",
        contourDef: getContourDef(args),
        subCategories: args?.subCategories,
      }],
      displayContours: args?.display ?? false,
    };
  }
    
  it("renders no contours if display style has no ContourDisplay", () => {
    testViewport((vp) => {
      lookAt(vp, 0, 0, 10, 10);
      ContourDecorator.register(0, 0, "0x1");
      vp.renderFrame();
      expectContours(vp, []);
    });
  });

  it("renders no contours if ContourDisplay.displayCountours is false", () => {
    testViewport((vp) => {
      lookAt(vp, 0, 0, 10, 10);
      ContourDecorator.register(0, 0, "0x1");
      setContours(vp, getContourProps());
      vp.renderFrame();
      expectContours(vp, []);
    });
  });

  it("renders no contours if no groups are defined", () => {
    testViewport((vp) => {
      lookAt(vp, 0, 0, 10, 10);
      ContourDecorator.register(0, 0, "0x1");
      const contours = getContourProps({ display: true });
      contours.groups.length = 0;
      setContours(vp, contours);
      vp.renderFrame();
      expectContours(vp, []);
    });
  });
  
  it("renders major contours for a single group", () => {
    testViewport((vp) => {
      lookAt(vp, 0, 0, 10, 10);
      ContourDecorator.register(0, 0, "0x1");
      setContours(vp, getContourProps({ display: true }));
      vp.renderFrame();
      expectContours(vp, [0,1,2,3,4,5,6,7,8,9,10].map((elevation) => {
        return { elevation, groupName: "A", subCategoryId: "0x1", isMajor: true }
      }));
    });
  });

  it("renders alternating major and minor contours", () => {
    testViewport((vp) => {
      lookAt(vp, 0, 0, 10, 10);
      ContourDecorator.register(0, 0, "0x1");
      setContours(vp, getContourProps({ display: true, majorIntervalCount: 2 }));
      vp.renderFrame();
      expectContours(vp, [0,1,2,3,4,5,6,7,8,9,10].map((elevation) => {
        return { elevation, groupName: "A", subCategoryId: "0x1", isMajor: elevation % 2 === 0 }
      }));
    });
  });

  it("renders contours at negative elevations", () => {
    testViewport((vp) => {
      ContourDecorator.register(0, 0, "0x1");
      ContourDecorator.register(10, -10, "0x2");
      lookAt(vp, 0, -10, 20, 10);
      setContours(vp, getContourProps({ display: true, majorIntervalCount: 2 }));
      vp.renderFrame();

      const expectedContours: ContourInfo[] = [];
      for (const elevation of [0,1,2,3,4,5,6,7,8,9,10]) {
        expectedContours.push({ elevation, groupName: "A", subCategoryId: "0x1", isMajor: elevation % 2 === 0 });
        expectedContours.push({ elevation: elevation !== 0 ? -elevation : elevation, groupName: "A", subCategoryId: "0x2", isMajor: elevation % 2 === 0 });
      }
      expectContours(vp, expectedContours);
    });
  });

  it("renders contours from multiple groups", () => {
    testViewport((vp) => {
      ContourDecorator.register(0, 0, "0x1");
      ContourDecorator.register(10, -10, "0x2");
      lookAt(vp, 0, -10, 20, 10);
      const contours = getContourProps({ display: true, majorIntervalCount: 2, subCategories: "+1" });
      contours.groups.push({
        name: "B",
        contourDef: getContourDef({ majorIntervalCount: 2 }),
        subCategories: "+2",
      });
      setContours(vp, contours);
      vp.renderFrame();

      const expectedContours: ContourInfo[] = [];
      for (const elevation of [0,1,2,3,4,5,6,7,8,9,10]) {
        expectedContours.push({ elevation, groupName: "A", subCategoryId: "0x1", isMajor: elevation % 2 === 0 });
        expectedContours.push({ elevation: elevation !== 0 ? -elevation : elevation, groupName: "B", subCategoryId: "0x2", isMajor: elevation % 2 === 0 });
      }
      expectContours(vp, expectedContours);
    });
  });

  it("renders contours from maximum number of groups", () => {
    testViewport((vp) => {
      lookAt(vp, 0, 0, 10, 10);
      ContourDecorator.register(0, 0, "0x1");
      const contours = getContourProps({ display: true, majorIntervalCount: 2 });
      for (let numGroups = 1; numGroups < ContourDisplay.maxContourGroups; numGroups++) {
        setContours(vp, contours);
        vp.renderFrame();
        expectContours(vp, [0,1,2,3,4,5,6,7,8,9,10].map((elevation) => {
          return { elevation, groupName: "A", subCategoryId: "0x1", isMajor: elevation % 2 === 0 }
        }));

        // prepend a group that will add no contours, so that next time through the loop the index of the group that does draw will be incremented.
        contours.groups.unshift({
          name: "no contours",
          contourDef: getContourDef(),
          subCategories: "+99999",
        });
      }
    });
  });

  it("does not render contours beyond the maximum number of groups", () => {
    testViewport((vp) => {
      lookAt(vp, 0, 0, 10, 10);
      ContourDecorator.register(0, 0, "0x1");
      const contours = getContourProps({ display: true, majorIntervalCount: 2, subCategories: "+99999" });
      for (let i = 0; i < ContourDisplay.maxContourGroups; i++) {
        contours.groups.push({ ...contours.groups[0] });
      }

      contours.groups.push({ ...contours.groups[0], subCategories: "+1", });
      setContours(vp, contours);
      vp.renderFrame();
      expectContours(vp, []);
    });
  });
});
