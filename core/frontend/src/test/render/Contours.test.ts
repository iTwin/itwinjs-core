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
import { Color, readUniqueColors, readUniquePixelData, sortColorDefs, testBlankViewport } from "../openBlankViewport";
import { GraphicType } from "../../common";
import { StandardViewId } from "../../StandardView";
import { DisplayStyle3dState } from "../../DisplayStyleState";
import { compareBooleans, compareNumbers, compareStrings, CompressedId64Set, OrderedId64Iterable } from "@itwin/core-bentley";
import { Pixel } from "../../core-frontend";

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

  function isWhitish(c: Color): boolean {
    const hasOneFullComponent = (c.r === 0xff || c.g === 0xff || c.b === 0xff) && c.a === 0xff;
    const hasAllLargeComponents = (c.r > 222 && c.g > 222 && c.b > 222);
    return hasOneFullComponent && hasAllLargeComponents
  }

  function isBlack(c: Color): boolean {
    return c.r === 0 && c.g === 0 && c.b === 0 && c.a === 0xff;
  }

  function isReddish(c: Color): boolean {
    const tendsTowardRed = c.r > c.g && c.r > c.b && c.a === 0xff;
    const rgDiff = Math.abs(c.r - c.g);
    const rbDiff = Math.abs(c.r - c.b);
    return tendsTowardRed && rgDiff > 10 && rbDiff > 10;
  }

  function isGreenish(c: Color): boolean {
    const tendsTowardGreen = c.g > c.r && c.g > c.b && c.a === 0xff;
    const grDiff = Math.abs(c.g - c.r);
    const gbDiff = Math.abs(c.g - c.b);
    return tendsTowardGreen && grDiff > 10 && gbDiff > 10;
  }

  function isBluish(c: Color): boolean {
    const tendsTowardBlue = c.b > c.r && c.b > c.g && c.a === 0xff;
    const brDiff = Math.abs(c.b - c.r);
    const bgDiff = Math.abs(c.b - c.g);
    return tendsTowardBlue && brDiff > 10 && bgDiff > 10;
  }

  function isPurplish(c: Color): boolean {
    const tendsTowardPurple = c.r > c.g && c.b > c.g && c.a === 0xff;
    const rgDiff = Math.abs(c.r - c.g);
    const bgDiff = Math.abs(c.b - c.g);
    return tendsTowardPurple && rgDiff > 10 && bgDiff > 10 && Math.abs(rgDiff - bgDiff) < 10;
  }

  // Expect the colors in the viewport to be sorted and match the expected colors.
  function expectColors(vp: Viewport, expected: ColorDef[]): void {
    sortColorDefs(expected);
    vp.renderFrame();
    const actual = hexifyColors(readUniqueColors(vp).toColorDefs());
    expect(actual).to.deep.equal(hexifyColors(expected));
  }

  // Expect each of the functions in the isExpectedColorFuncs array to return true for at least one color in the viewport. Also expect that no unexpected colors are present in the viewport.
  function expectCorrectColors(vp: Viewport, isExpectedColorFuncs: ((col: Color) => boolean)[]) {
    vp.renderFrame();
    const colors = readUniqueColors(vp);

    // First check if we find at least one occurence of each expected color.
    let numExpectedColorsFound = 0;
    // eslint-disable-next-line no-console
    console.log("checking for expected colors...");
    for (const isExpectedColor of isExpectedColorFuncs) {
      // eslint-disable-next-line no-console
      console.log("check for an expected color...");
      for (const c of colors.array) {
        // eslint-disable-next-line no-console
        console.log("checking color: ", c.r, c.g, c.b, c.a);
        if (isExpectedColor(c)) {
          // eslint-disable-next-line no-console
          console.log("found an expected color!");
          numExpectedColorsFound++;
          break;
        }
      }
    }
    expect(numExpectedColorsFound).to.equal(isExpectedColorFuncs.length);

    // Now check that we don't find any unexpected colors.
    // eslint-disable-next-line no-console
    console.log("checking for unexpected colors...");
    for (const c of colors.array) {
      // eslint-disable-next-line no-console
      console.log("checking color: ", c.r, c.g, c.b, c.a);
      let foundExpectedColor = false;
      for (const isExpectedColor of isExpectedColorFuncs) {
        if (isExpectedColor(c)) {
          // eslint-disable-next-line no-console
          console.log("found an expected color!");
          foundExpectedColor = true;
          break;
        }
      }
      if (!foundExpectedColor) {
        // eslint-disable-next-line no-console
        console.log("did not find an expected color!");
      }
      expect(foundExpectedColor).to.be.true;
    }
  }

  it("renders contours of expected colors with one group", () => {
    testViewport((vp) => {
      lookAt(vp, 0, 0, 10, 10);
      ContourDecorator.register(0, 0, "0x1");
      expectColors(vp, [ColorDef.red, ColorDef.black]);

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

      // Contours are disabled; we should not expect any colors from the contour lines to be present in the viewport.
      setContours(vp, contourProps);
      vp.renderFrame();
      expectColors(vp, [ColorDef.black, ColorDef.red]);

      // Expected only colors close to black, red, and blue to be in the rendered scene. Also expect at least one occurrence each of near-black, near-red, and near-blue to occur. If the contours do not render properly, this test will fail.
      contourProps.displayContours = true;
      setContours(vp, contourProps);
      vp.renderFrame();
      expectCorrectColors(vp, [(c) => { return isBlack(c); }, (c) => { return isReddish(c); }, (c) => { return isBluish(c); }]);

      // Expect the same conditions as above, except add whitish to the list of expected colors because majorIntervalCount is now 2. If a whitish hue is not detected in the viewport, this test will fail.
      contourDef.majorIntervalCount = 2;
      setContours(vp, contourProps);
      vp.renderFrame();
      expectCorrectColors(vp, [(c) => { return isBlack(c); }, (c) => { return isReddish(c); }, (c) => { return isBluish(c); }, (c) => { return isWhitish(c); }]);
    });
  });

  it("renders contours of expected colors for multiple default groups", () => {
    testViewport((vp) => {
      lookAt(vp, 0, 0, 10, 10);
      ContourDecorator.register(0, 0, "0x1");
      expectColors(vp, [ColorDef.red, ColorDef.black]);

      const contourDefA = {
        majorStyle: {
          color: { r: 0, g: 0, b: 255 }, // blue
          pixelWidth: 8,
        },
        minorStyle: {
          color: { r: 255, g: 255, b: 255 }, // white
          pixelWidth: 1,
        },
        minorInterval: 1,
        majorIntervalCount: 1,
        showGeometry: true,
      };

      const contourDefB = {
        majorStyle: {
          color: { r: 255, g: 0, b: 255 }, // purple
          pixelWidth: 2,
        },
        minorStyle: {
          color: { r: 0, g: 255, b: 0 }, // green
          pixelWidth: 1,
        },
        minorInterval: 2,
        majorIntervalCount: 1,
        showGeometry: true,
      };

      const contourProps: ContourDisplayProps = {
        groups: [{
          name: "A",
          contourDef: contourDefA,
        },
        {
          name: "B",
          contourDef: contourDefB,
        }],
        displayContours: false,
      };

      // Contours are disabled; we should not expect any colors from the contour lines to be present in the viewport.
      setContours(vp, contourProps);
      vp.renderFrame();
      expectColors(vp, [ColorDef.black, ColorDef.red]);

      // The last default group occuring in the array should be the only one that draws based on the documentation. Verify this occurs (purplish present but not bluish).
      contourProps.displayContours = true;
      setContours(vp, contourProps);
      vp.renderFrame();
      expectCorrectColors(vp, [(c) => { return isBlack(c); }, (c) => { return isReddish(c); }, (c) => { return isPurplish(c); }]);

      // Flip the default groups so we now expect blue to be present and purple to be absent.
      contourProps.displayContours = true;
      contourProps.groups?.reverse();
      setContours(vp, contourProps);
      vp.renderFrame();
      expectCorrectColors(vp, [(c) => { return isBlack(c); }, (c) => { return isReddish(c); }, (c) => { return isBluish(c); }]);
    });
  });

  it("renders contours of expected colors with underlying geometry not shown", () => {
    testViewport((vp) => {
      lookAt(vp, 0, 0, 10, 10);
      ContourDecorator.register(0, 0, "0x1");
      expectColors(vp, [ColorDef.red, ColorDef.black]);

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
        showGeometry: false,
      };

      const contourProps: ContourDisplayProps = {
        groups: [{
          name: "A",
          contourDef,
        }],
        displayContours: false,
      };

      // Contours are disabled; we should not expect any colors from the contour lines to be present in the viewport.
      setContours(vp, contourProps);
      vp.renderFrame();
      expectColors(vp, [ColorDef.black, ColorDef.red]);

      // Expect only colors close to black and blue to be in the rendered scene. Also expect at least one occurrence each of near-black and near-blue to occur. If the contours do not render properly, this test will fail.
      // Furthermore, the underlying red geometry is not expected to be present in the viewport because showGeometry is false.
      contourProps.displayContours = true;
      setContours(vp, contourProps);
      vp.renderFrame();
      expectCorrectColors(vp, [(c) => { return isBlack(c); }, (c) => { return isBluish(c); }]);

      // Expect the same conditions as above, except add whitish to the list of expected colors because majorIntervalCount is now 2. If a whitish hue is not detected in the viewport, this test will fail.
      contourDef.majorIntervalCount = 2;
      setContours(vp, contourProps);
      vp.renderFrame();
      expectCorrectColors(vp, [(c) => { return isBlack(c); }, (c) => { return isBluish(c); }, (c) => { return isWhitish(c); }]);
    });
  });

  it("renders contours of expected colors with two differently styled groups", () => {
    testViewport((vp) => {
      ContourDecorator.register(0, 0, "0x1");
      ContourDecorator.register(10, -10, "0x2");
      lookAt(vp, 0, -10, 20, 10);
      expectColors(vp, [ColorDef.red, ColorDef.black]);

      const contourDefA = {
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

      const contourDefB = {
        majorStyle: {
          color: { r: 255, g: 0, b: 255 },
          pixelWidth: 2,
        },
        minorStyle: {
          color: { r: 0, g: 255, b: 0 },
          pixelWidth: 1,
        },
        minorInterval: 2,
        majorIntervalCount: 1,
        showGeometry: true,
      };

      const contourProps: ContourDisplayProps = {
        groups: [{
          name: "A",
          contourDef: contourDefA,
          subCategories: CompressedId64Set.compressIds(OrderedId64Iterable.sortArray(["0x1"])),
        },
        {
          name: "B",
          contourDef: contourDefB,
          subCategories: CompressedId64Set.compressIds(OrderedId64Iterable.sortArray(["0x2"])),
        }],
        displayContours: false,
      };

      // Contours are disabled; we should not expect any colors from the contour lines to be present in the viewport.
      setContours(vp, contourProps);
      vp.renderFrame();
      expectColors(vp, [ColorDef.black, ColorDef.red]);

      // Expect black, reddish, bluish, and purplish colors to be in the rendered scene because blue and purple describe the contours in the two separate groups.
      contourProps.displayContours = true;
      setContours(vp, contourProps);
      vp.renderFrame();
      expectCorrectColors(vp, [(c) => { return isBlack(c); }, (c) => { return isReddish(c); }, (c) => { return isBluish(c); }, (c) => { return isPurplish(c); }]);

      // Expect the same conditions as above, except add whitish to the list of expected colors because majorIntervalCount is now 2 for group A. If a whitish hue is not detected in the viewport, this test will fail.
      contourDefA.majorIntervalCount = 2;
      setContours(vp, contourProps);
      vp.renderFrame();
      expectCorrectColors(vp, [(c) => { return isBlack(c); }, (c) => { return isReddish(c); }, (c) => { return isBluish(c); }, (c) => { return isPurplish(c); }, (c) => { return isWhitish(c); }]);

      // Expect the same conditions as above, except add greenish to the list of expected colors because majorIntervalCount is now 2 for group B. If a greenish hue is not detected in the viewport, this test will fail.
      contourDefB.majorIntervalCount = 2;
      setContours(vp, contourProps);
      vp.renderFrame();
      expectCorrectColors(vp, [(c) => { return isBlack(c); }, (c) => { return isReddish(c); }, (c) => { return isBluish(c); }, (c) => { return isPurplish(c); }, (c) => { return isWhitish(c); }, (c) => { return isGreenish(c); }]);
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

  function expectMultipleContourGroups(vp: Viewport): void {
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
  }

  it("renders contours from multiple groups", () => {
    testViewport((vp) => {
      expectMultipleContourGroups(vp);
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

      contours.groups = [contours.groups[contours.groups.length - 1]];
      setContours(vp, contours);
      vp.renderFrame();
      expectContours(vp, [0,1,2,3,4,5,6,7,8,9,10].map((elevation) => {
        return { elevation, groupName: "A", subCategoryId: "0x1", isMajor: elevation % 2 === 0 }
      }));
    });
  });

  it("renders contours but does not read them unless Pixel.Selector.Contours is specified", () => {
    testViewport((vp) => {
      lookAt(vp, 0, 0, 10, 10);
      ContourDecorator.register(0, 0, "0x1");
      setContours(vp, getContourProps({ display: true }));
      vp.renderFrame();
      let pixels = readUniquePixelData(vp, undefined, undefined, undefined, Pixel.Selector.Feature | Pixel.Selector.GeometryAndDistance);
      expect(pixels.array.some((x) => x.contour !== undefined)).to.be.false;
      pixels = readUniquePixelData(vp, undefined, undefined, undefined, Pixel.Selector.Contours);
      expect(pixels.array.some((x) => x.contour !== undefined)).to.be.true;
      pixels = readUniquePixelData(vp, undefined, undefined, undefined, Pixel.Selector.All);
      expect(pixels.array.some((x) => x.contour !== undefined)).to.be.true;
    });
  });

  it("works with ambient occlusion enabled", () => {
    testViewport((vp) => {
      vp.viewFlags = vp.viewFlags.with("ambientOcclusion", true);
      expectMultipleContourGroups(vp);
    });
  });

  it("works with anti-aliasing enabled", () => {
    testViewport((vp) => {
      vp.antialiasSamples = 4;
      expectMultipleContourGroups(vp);
    });
  });

  it("works with AO and AA enabled", () => {
    testViewport((vp) => {
      vp.antialiasSamples = 4;
      vp.viewFlags = vp.viewFlags.with("ambientOcclusion", true);
      expectMultipleContourGroups(vp);
    });
  });
});
