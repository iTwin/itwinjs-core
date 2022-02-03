/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
import { expect } from "chai";
import type { ThematicDisplayProps} from "@itwin/core-common";
import {
  ColorDef, RenderMode, ThematicDisplay, ThematicDisplayMode, ThematicGradientColorScheme, ThematicGradientMode,
} from "@itwin/core-common";
import type { IModelConnection, ViewState3d } from "@itwin/core-frontend";
import { SnapshotConnection, ViewRect } from "@itwin/core-frontend";
import { TestUtility } from "../TestUtility";
import type { TestViewport} from "../TestViewport";
import { Color, testViewportsWithDpr } from "../TestViewport";

describe("Thematic display", () => {
  let imodel: IModelConnection;

  before(async () => {
    await TestUtility.startFrontend();
    imodel = await SnapshotConnection.openFile("mirukuru.ibim");
  });

  after(async () => {
    if (imodel) await imodel.close();
    await TestUtility.shutdownFrontend();
  });

  function isReddish(c: Color): boolean {
    return c.r > c.g && c.g < 0xa && c.b < 0xa && c.a === 0xff;
  }

  function isBluish(c: Color): boolean {
    return c.r < 0xa && c.g < 0xa && c.b > c.g && c.a === 0xff;
  }

  function isPurplish(c: Color): boolean {
    return c.r > c.g && c.g < 0xa && c.b > c.g && c.a === 0xff;
  }

  function expectCorrectColors(vp: TestViewport) {
    // White rectangle is centered in view with black background surrounding. Thematic display sets a blue/red gradient on the rectangle. Lighting is off.
    const colors = vp.readUniqueColors();
    const bgColor = Color.fromRgba(0, 0, 0, 0xff);
    expect(colors.length).least(3); // red, blue, and black - (actually way more colors!)
    expect(colors.contains(bgColor)).to.be.true; // black background

    for (const c of colors.array) {
      if (0 !== c.compare(bgColor)) {
        expect(isReddish(c) || isBluish(c) || isPurplish(c)).to.be.true;
      }
    }
  }

  function isRed(c: Color): boolean {
    return c.r === 0xff && c.g === 0x0 && c.b === 0x0 && c.a === 0xff;
  }

  function isBlue(c: Color): boolean {
    return c.r === 0x0 && c.g === 0x0 && c.b === 0xff && c.a === 0xff;
  }

  function expectPreciseSteppedColors(vp: TestViewport) {
    // White rectangle is centered in view with black background surrounding. Thematic stepped display sets a blue/red gradient on the rectangle with two steps. Lighting is off.
    const colors = vp.readUniqueColors();
    const bgColor = Color.fromRgba(0, 0, 0, 0xff);
    expect(colors.length).least(3); // red, blue, and black - (actually way more colors!)
    expect(colors.contains(bgColor)).to.be.true; // black background

    for (const c of colors.array) {
      if (0 !== c.compare(bgColor)) {
        expect(isRed(c) || isBlue(c)).to.be.true;
      }
    }
  }

  function expectPreciseSlopeColors(vp: TestViewport) {
    // White rectangle is centered in view with black background surrounding. Thematic sloped display results in red square. Lighting is off.
    const colors = vp.readUniqueColors();
    const bgColor = Color.fromRgba(0, 0, 0, 0xff);
    expect(colors.length).least(2); // red and black
    expect(colors.contains(bgColor)).to.be.true; // black background

    for (const c of colors.array) {
      if (0 !== c.compare(bgColor)) {
        expect(isRed(c)).to.be.true;
      }
    }
  }

  function expectPreciseHillShadeColors(vp: TestViewport) {
    // White rectangle is centered in view with black background surrounding. Thematic hillshade display results in blue square. Lighting is off.
    const colors = vp.readUniqueColors();
    const bgColor = Color.fromRgba(0, 0, 0, 0xff);
    expect(colors.length).least(2); // blue and black
    expect(colors.contains(bgColor)).to.be.true; // black background

    for (const c of colors.array) {
      if (0 !== c.compare(bgColor)) {
        expect(isBlue(c)).to.be.true;
      }
    }
  }

  it("should render the model with proper thematic colors applied for smooth height mode", async () => {
    const rect = new ViewRect(0, 0, 100, 100);
    await testViewportsWithDpr(imodel, rect, async (vp) => {
      expect(vp.view.is3d());

      vp.viewFlags = vp.viewFlags.copy({ visibleEdges: false, lighting: false, renderMode: RenderMode.SmoothShade, thematicDisplay: true });

      // Create a ThematicDisplay object with the desired thematic settings
      const thematicProps: ThematicDisplayProps = {
        gradientSettings: {
          colorScheme: ThematicGradientColorScheme.Custom,
          customKeys: [{ value: 0.0, color: ColorDef.computeTbgrFromComponents(0, 0, 255) }, { value: 1.0, color: ColorDef.computeTbgrFromComponents(255, 0, 0) }],
        },
        range: { low: imodel.projectExtents.xLow, high: imodel.projectExtents.xHigh }, // grab imodel project extents to set range of thematic display
        axis: [1.0, 0.0, 0.0],
      };
      const thematicDisplay = ThematicDisplay.fromJSON(thematicProps);

      const displaySettings = (vp.view as ViewState3d).getDisplayStyle3d().settings;
      displaySettings.thematic = thematicDisplay;

      await vp.waitForAllTilesToRender();
      expect(vp.numRequestedTiles).to.equal(0);
      expect(vp.numSelectedTiles).to.equal(1);

      expectCorrectColors(vp);
    });
  });

  it("should render the model with proper thematic colors applied for stepped height mode", async () => {
    const rect = new ViewRect(0, 0, 100, 100);
    await testViewportsWithDpr(imodel, rect, async (vp) => {
      expect(vp.view.is3d());

      vp.viewFlags = vp.viewFlags.copy({ visibleEdges: false, lighting: false, renderMode: RenderMode.SmoothShade, thematicDisplay: true });

      // Create a ThematicDisplay object with the desired thematic settings
      const thematicProps: ThematicDisplayProps = {
        gradientSettings: {
          mode: ThematicGradientMode.Stepped,
          stepCount: 2,
          colorScheme: ThematicGradientColorScheme.Custom,
          customKeys: [{ value: 0.0, color: ColorDef.computeTbgrFromComponents(0, 0, 255) }, { value: 1.0, color: ColorDef.computeTbgrFromComponents(255, 0, 0) }],
        },
        range: { low: imodel.projectExtents.xLow - 3.0, high: imodel.projectExtents.xHigh + 3.0 }, // grab imodel project extents to set range of thematic display
        axis: [1.0, 0.0, 0.0],
      };
      const thematicDisplay = ThematicDisplay.fromJSON(thematicProps);

      const displaySettings = (vp.view as ViewState3d).getDisplayStyle3d().settings;
      displaySettings.thematic = thematicDisplay;

      await vp.waitForAllTilesToRender();
      expect(vp.numRequestedTiles).to.equal(0);
      expect(vp.numSelectedTiles).to.equal(1);

      expectPreciseSteppedColors(vp);
    });
  });

  it("should render the model with proper thematic colors applied for isoline height mode", async () => {
    const rect = new ViewRect(0, 0, 100, 100);
    await testViewportsWithDpr(imodel, rect, async (vp) => {
      expect(vp.view.is3d());

      vp.viewFlags = vp.viewFlags.copy({ visibleEdges: false, lighting: false, renderMode: RenderMode.SmoothShade, thematicDisplay: true });

      // Create a ThematicDisplay object with the desired thematic settings
      const thematicProps: ThematicDisplayProps = {
        gradientSettings: {
          mode: ThematicGradientMode.IsoLines,
          colorScheme: ThematicGradientColorScheme.Custom,
          customKeys: [{ value: 0.0, color: ColorDef.computeTbgrFromComponents(0, 0, 255) }, { value: 1.0, color: ColorDef.computeTbgrFromComponents(255, 0, 0) }],
        },
        range: { low: imodel.projectExtents.xLow, high: imodel.projectExtents.xHigh }, // grab imodel project extents to set range of thematic display
        axis: [1.0, 0.0, 0.0],
      };
      const thematicDisplay = ThematicDisplay.fromJSON(thematicProps);

      const displaySettings = (vp.view as ViewState3d).getDisplayStyle3d().settings;
      displaySettings.thematic = thematicDisplay;

      await vp.waitForAllTilesToRender();
      expect(vp.numRequestedTiles).to.equal(0);
      expect(vp.numSelectedTiles).to.equal(1);

      expectCorrectColors(vp);
    });
  });

  it("should render the model with proper thematic colors applied for stepped-with-delimiter height mode", async () => {
    const rect = new ViewRect(0, 0, 100, 100);
    await testViewportsWithDpr(imodel, rect, async (vp) => {
      expect(vp.view.is3d());

      vp.viewFlags = vp.viewFlags.copy({ visibleEdges: false, lighting: false, renderMode: RenderMode.SmoothShade, thematicDisplay: true });

      // Create a ThematicDisplay object with the desired thematic settings
      const thematicProps: ThematicDisplayProps = {
        gradientSettings: {
          mode: ThematicGradientMode.SteppedWithDelimiter,
          colorScheme: ThematicGradientColorScheme.Custom,
          customKeys: [{ value: 0.0, color: ColorDef.computeTbgrFromComponents(0, 0, 255) }, { value: 1.0, color: ColorDef.computeTbgrFromComponents(255, 0, 0) }],
        },
        range: { low: imodel.projectExtents.xLow, high: imodel.projectExtents.xHigh }, // grab imodel project extents to set range of thematic display
        axis: [1.0, 0.0, 0.0],
      };
      const thematicDisplay = ThematicDisplay.fromJSON(thematicProps);

      const displaySettings = (vp.view as ViewState3d).getDisplayStyle3d().settings;
      displaySettings.thematic = thematicDisplay;

      await vp.waitForAllTilesToRender();
      expect(vp.numRequestedTiles).to.equal(0);
      expect(vp.numSelectedTiles).to.equal(1);

      expectCorrectColors(vp);
    });
  });

  it("should render the model with proper thematic colors applied for sensor mode", async () => {
    const rect = new ViewRect(0, 0, 100, 100);
    await testViewportsWithDpr(imodel, rect, async (vp) => {
      expect(vp.view.is3d());

      vp.viewFlags = vp.viewFlags.copy({ visibleEdges: false, lighting: false, renderMode: RenderMode.SmoothShade, thematicDisplay: true });

      // Create a ThematicDisplay object with the desired thematic settings
      const thematicProps: ThematicDisplayProps = {
        displayMode: ThematicDisplayMode.InverseDistanceWeightedSensors,
        gradientSettings: {
          colorScheme: ThematicGradientColorScheme.Custom,
          customKeys: [{ value: 0.0, color: ColorDef.computeTbgrFromComponents(0, 0, 255) }, { value: 1.0, color: ColorDef.computeTbgrFromComponents(255, 0, 0) }],
        },
        sensorSettings: {
          sensors: [
            { position: imodel.projectExtents.low.toJSON(), value: 0.01 },
            { position: imodel.projectExtents.high.toJSON(), value: 0.99 },
          ],
        },
      };
      const thematicDisplay = ThematicDisplay.fromJSON(thematicProps);

      const displaySettings = (vp.view as ViewState3d).getDisplayStyle3d().settings;
      displaySettings.thematic = thematicDisplay;

      await vp.waitForAllTilesToRender();
      expect(vp.numRequestedTiles).to.equal(0);
      expect(vp.numSelectedTiles).to.equal(1);

      expectCorrectColors(vp);
    });
  });

  it("should render the model with proper thematic colors applied for slope mode", async () => {
    const rect = new ViewRect(0, 0, 100, 100);
    await testViewportsWithDpr(imodel, rect, async (vp) => {
      expect(vp.view.is3d());

      vp.viewFlags = vp.viewFlags.copy({ visibleEdges: false, lighting: false, renderMode: RenderMode.SmoothShade, thematicDisplay: true });

      // Create a ThematicDisplay object with the desired thematic settings
      const thematicProps: ThematicDisplayProps = {
        gradientSettings: {
          mode: ThematicGradientMode.Stepped,
          stepCount: 2,
          colorScheme: ThematicGradientColorScheme.Custom,
          customKeys: [{ value: 0.0, color: ColorDef.computeTbgrFromComponents(0, 0, 255) }, { value: 1.0, color: ColorDef.computeTbgrFromComponents(255, 0, 0) }],
        },
        range: { low: 0.0, high: 90.0 }, // range of 0 to 90 degree slopes
        axis: [1.0, 0.0, 0.0],
        displayMode: ThematicDisplayMode.Slope,
      };
      const thematicDisplay = ThematicDisplay.fromJSON(thematicProps);

      const displaySettings = (vp.view as ViewState3d).getDisplayStyle3d().settings;
      displaySettings.thematic = thematicDisplay;

      await vp.waitForAllTilesToRender();
      expect(vp.numRequestedTiles).to.equal(0);
      expect(vp.numSelectedTiles).to.equal(1);

      expectPreciseSlopeColors(vp);
    });
  });

  it("should render the model with proper thematic colors applied for hillshade mode", async () => {
    const rect = new ViewRect(0, 0, 100, 100);
    await testViewportsWithDpr(imodel, rect, async (vp) => {
      expect(vp.view.is3d());

      vp.viewFlags = vp.viewFlags.copy({ visibleEdges: false, lighting: false, renderMode: RenderMode.SmoothShade, thematicDisplay: true });

      // Create a ThematicDisplay object with the desired thematic settings
      const thematicProps: ThematicDisplayProps = {
        gradientSettings: {
          mode: ThematicGradientMode.Stepped,
          stepCount: 2,
          colorScheme: ThematicGradientColorScheme.Custom,
          customKeys: [{ value: 0.0, color: ColorDef.computeTbgrFromComponents(0, 0, 255) }, { value: 1.0, color: ColorDef.computeTbgrFromComponents(255, 0, 0) }],
        },
        sunDirection: { x: 0.0, y: 0.0, z: 1.0 },
        displayMode: ThematicDisplayMode.HillShade,
      };
      const thematicDisplay = ThematicDisplay.fromJSON(thematicProps);

      const displaySettings = (vp.view as ViewState3d).getDisplayStyle3d().settings;
      displaySettings.thematic = thematicDisplay;

      await vp.waitForAllTilesToRender();
      expect(vp.numRequestedTiles).to.equal(0);
      expect(vp.numSelectedTiles).to.equal(1);

      expectPreciseHillShadeColors(vp);
    });
  });
});
