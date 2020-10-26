/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/

import { expect } from "chai";
import { BackgroundMapType, GlobeMode } from "../BackgroundMapSettings";
import { ColorByName } from "../ColorByName";
import { DisplayStyle3dSettings, DisplayStyle3dSettingsProps, DisplayStyleOverridesOptions, MonochromeMode } from "../DisplayStyleSettings";
import { LinePixels } from "../LinePixels";
import { PlanProjectionSettings, PlanProjectionSettingsProps } from "../PlanProjectionSettings";
import { SpatialClassificationProps } from "../SpatialClassificationProps";
import { ThematicDisplayMode } from "../ThematicDisplay";
import { RenderMode, ViewFlags } from "../ViewFlags";

describe("DisplayStyleSettings", () => {
  interface SettingsMap { [modelId: string]: PlanProjectionSettingsProps }

  it("round-trips plan projection settings", () => {
    const roundTrip = (planProjections: SettingsMap | undefined) => {
      const settings = new DisplayStyle3dSettings({ styles: { planProjections } });
      const json = settings.toJSON();
      expect(JSON.stringify(json.planProjections)).to.equal(JSON.stringify(planProjections));
    };

    roundTrip(undefined);
    roundTrip({});
    roundTrip({ "not an id": { transparency: 0.5 } });
    roundTrip({ "0x1": { overlay: true } });
    roundTrip({ "0x1": { overlay: false } });
    roundTrip({ "0x1": { enforceDisplayPriority: true } });
    roundTrip({ "0x1": { enforceDisplayPriority: false } });
    roundTrip({ "0x1": { transparency: 0.5 }, "0x2": { elevation: -5 } });
  });

  it("sets and round-trips plan projection settings", () => {
    const roundTrip = (planProjections: SettingsMap | undefined, expected: SettingsMap | undefined | "input") => {
      if ("input" === expected)
        expected = planProjections;

      const input = new DisplayStyle3dSettings({});
      if (undefined !== planProjections)
        for (const modelId of Object.keys(planProjections))
          input.setPlanProjectionSettings(modelId, PlanProjectionSettings.fromJSON(planProjections[modelId]));

      const output = new DisplayStyle3dSettings({ styles: input.toJSON() });
      const json = output.toJSON();
      expect(JSON.stringify(json.planProjections)).to.equal(JSON.stringify(expected));
    };

    roundTrip(undefined, undefined);
    roundTrip({}, undefined);
    roundTrip({ "not an id": { transparency: 0.5 } }, {});
    roundTrip({ "0x1": { overlay: true } }, "input");
    roundTrip({ "0x1": { overlay: false } }, {});
    roundTrip({ "0x1": { enforceDisplayPriority: true } }, "input");
    roundTrip({ "0x1": { enforceDisplayPriority: false } }, {});
    roundTrip({ "0x1": { transparency: 0.5 }, "0x2": { elevation: -5 } }, "input");
  });

  it("deletes plan projection settings", () => {
    const settings = new DisplayStyle3dSettings({});
    expect(settings.planProjectionSettings).to.be.undefined;

    const countSettings = () => {
      let count = 0;
      const iter = settings.planProjectionSettings;
      if (undefined !== iter)
        for (const _entry of iter) // eslint-disable-line @typescript-eslint/naming-convention
          ++count;

      return count;
    };

    const makeSettings = (props: PlanProjectionSettingsProps) => new PlanProjectionSettings(props);

    settings.setPlanProjectionSettings("0x1", makeSettings({ elevation: 1 }));
    expect(settings.planProjectionSettings).not.to.be.undefined;
    expect(countSettings()).to.equal(1);
    expect(settings.getPlanProjectionSettings("0x1")!.elevation).to.equal(1);

    settings.setPlanProjectionSettings("0x2", makeSettings({ elevation: 2 }));
    expect(countSettings()).to.equal(2);
    expect(settings.getPlanProjectionSettings("0x2")!.elevation).to.equal(2);

    settings.setPlanProjectionSettings("0x2", makeSettings({ transparency: 0.2 }));
    expect(countSettings()).to.equal(2);
    expect(settings.getPlanProjectionSettings("0x2")!.transparency).to.equal(0.2);
    expect(settings.getPlanProjectionSettings("0x2")!.elevation).to.be.undefined;

    settings.setPlanProjectionSettings("0x3", undefined);
    expect(countSettings()).to.equal(2);

    settings.setPlanProjectionSettings("0x1", undefined);
    expect(countSettings()).to.equal(1);
    expect(settings.getPlanProjectionSettings("0x1")).to.be.undefined;

    settings.setPlanProjectionSettings("0x2", undefined);
    expect(countSettings()).to.equal(0);
    expect(settings.planProjectionSettings).to.be.undefined;
  });
});

describe("DisplayStyleSettings overrides", () => {
  const baseProps: DisplayStyle3dSettingsProps = {
    viewflags: {
      backgroundMap: true,
      acs: true,
      noConstruct: true,
      clipVol: true,
      renderMode: RenderMode.HiddenLine,
    },
    backgroundColor: ColorByName.aquamarine,
    monochromeColor: ColorByName.cyan,
    monochromeMode: MonochromeMode.Scaled,
    environment: {
      sky: {
        display: true,
        twoColor: true,
        skyExponent: 22,
      },
      ground: {
        display: false,
      },
    },
    hline: {
      transThreshold: 0x7f,
      visible: {
        ovrColor: true,
        color: ColorByName.yellow,
        width: 12,
        pattern: LinePixels.Solid,
      },
      hidden: {
        ovrColor: false,
        color: ColorByName.white,
        pattern: LinePixels.HiddenLine,
        width: 8,
      },
    },
    ao: {
      bias: 0.5,
      zLengthCap: 0.25,
      intensity: 1.5,
      blurDelta: 1,
      blurSigma: 2,
      blurTexelStepSize: 3,
      maxDistance: 4,
      texelStepSize: 5,
    },
    solarShadows: {
      color: ColorByName.green,
      bias: 0.2,
    },
    lights: {
      portrait: {
        intensity: 1,
      },
      specularIntensity: 2,
      numCels: 3,
    },
    thematic: {
      displayMode: ThematicDisplayMode.Height,
      axis: [-1, 0, 1],
      range: undefined,
      sensorSettings: undefined,
      sunDirection: [1, 0, -1],
      gradientSettings: {
        mode: 0,
        colorScheme: 0,
        customKeys: [],
        stepCount: 2,
        marginColor: ColorByName.magenta,
        colorMix: 0,
      },
    },
  };

  const mapProps: DisplayStyle3dSettingsProps = {
    backgroundMap: {
      groundBias: 42,
      providerData: {
        mapType: BackgroundMapType.Aerial,
      },
      transparency: 0.5,
      useDepthBuffer: true,
      globeMode: GlobeMode.Plane,
      terrainSettings: {
        exaggeration: 2.5,
        heightOrigin: -42,
        nonLocatable: true, // eslint-disable-line deprecation/deprecation
        heightOriginMode: 0,
      },
    },
  };

  const projectProps: DisplayStyle3dSettingsProps = {
    timePoint: 12345,
    contextRealityModels: [{
      tilesetUrl: "google.com",
      name: "google",
      description: "a popular search engine",
    }],
  };

  const iModelProps: DisplayStyle3dSettingsProps = {
    analysisStyle: {
      inputName: "channel1",
      inputRange: undefined,
      displacementChannelName: "channel2",
      displacementScale: undefined,
      normalChannelName: undefined,
      scalarChannelName: undefined,
      scalarThematicSettings: undefined,
      scalarRange: [1, 5],
    },
    analysisFraction: 0.2,
    scheduleScript: [{
      modelId: "0x321",
      realityModelUrl: "altavista.com",
      elementTimelines: [{
        batchId: 64,
        elementIds: ["0xabc", "0xdef"],
      }],
    }],
    subCategoryOvr: [{
      subCategory: "0x789",
      color: ColorByName.fuchsia,
      invisible: true,
      style: "0xaaa",
      weight: 10,
      transp: 0.5,
    }],
    modelOvr: [{
      modelId: "0x789",
      weight: 10,
      linePixels: 4262526480,
      rgb: { r: 0, g: 255, b: 0 },
      transparency: 0.5,
      nonLocatable: true,
      emphasized: true,
    }],
    excludedElements: ["0x4", "0x8", "0x10"],
    contextRealityModels: [{
      tilesetUrl: "google.com",
      name: "google",
      description: "a popular search engine",
      classifiers: [{
        modelId: "0x123",
        expand: 0.5,
        flags: {
          inside: SpatialClassificationProps.Display.Off,
          outside: SpatialClassificationProps.Display.Dimmed,
          isVolumeClassifier: true,
          type: 0,
        },
        name: "classifier",
        isActive: true,
      }],
    }],
    thematic: {
      displayMode: ThematicDisplayMode.Height,
      gradientSettings: {
        mode: 0,
        stepCount: 2,
        marginColor: ColorByName.magenta,
        colorScheme: 0,
        customKeys: [],
        colorMix: 0,
      },
      axis: [-1, 0, 1],
      sunDirection: [1, 0, -1],
      range: [1, 100],
      sensorSettings: {
        distanceCutoff: 12,
        sensors: [
          { position: [10, 20, 30], value: 0.5 },
        ],
      },
    },
    planProjections: {
      "0x6": { elevation: 4, transparency: 0.5, overlay: true, enforceDisplayPriority: true },
    },
  };

  it("creates selective overrides", () => {
    const settings = new DisplayStyle3dSettings({ styles: { ...baseProps, ...mapProps, ...projectProps, ...iModelProps } });

    const roundTrip = (options: DisplayStyleOverridesOptions, expected: DisplayStyle3dSettingsProps) => {
      const output = settings.toOverrides(options);
      expect(output).to.deep.equal(expected);
    };

    const viewflags = ViewFlags.fromJSON(baseProps.viewflags).toFullyDefinedJSON();

    const vfNoMapNoDec = { ...viewflags };
    delete vfNoMapNoDec.acs;
    delete vfNoMapNoDec.grid;
    delete vfNoMapNoDec.backgroundMap;

    const vfNoDec = { ...vfNoMapNoDec, backgroundMap: true };
    const vfNoMap = { ...vfNoMapNoDec, acs: true, grid: false };

    roundTrip({ includeAll: true }, { ...settings.toJSON(), viewflags });
    roundTrip({}, { ...baseProps, viewflags: vfNoMapNoDec });
    roundTrip({ includeBackgroundMap: true }, { ...baseProps, ...mapProps, viewflags: vfNoDec });
    roundTrip({ includeDrawingAids: true }, { ...baseProps, viewflags: vfNoMap });
    roundTrip({ includeBackgroundMap: true, includeDrawingAids: true }, { ...baseProps, ...mapProps, viewflags });

    roundTrip({ includeProjectSpecific: true }, { ...baseProps, ...projectProps, viewflags: vfNoMapNoDec });
    roundTrip({ includeIModelSpecific: true }, { ...baseProps, ...projectProps, ...iModelProps, viewflags: vfNoMapNoDec });
    roundTrip({ includeIModelSpecific: true, includeDrawingAids: true, includeBackgroundMap: true }, { ...baseProps, ...mapProps, ...projectProps, ...iModelProps, viewflags });
  });

  it("overrides selected settings", () => {
    const test = (overrides: DisplayStyle3dSettingsProps) => {
      const settings = new DisplayStyle3dSettings({ styles: { ...baseProps, ...mapProps, ...projectProps, ...iModelProps } });
      const originalSettings = { ...settings.toJSON() };
      settings.applyOverrides(overrides);
      const output = settings.toJSON();

      for (const key of Object.keys(overrides) as Array<keyof DisplayStyle3dSettingsProps>)
        expect(output[key]).to.deep.equal(overrides[key]);

      for (const key of Object.keys(output) as Array<keyof DisplayStyle3dSettingsProps>)
        if (undefined === overrides[key])
          expect(output[key]).to.deep.equal(originalSettings[key]);
    };

    const viewflags = baseProps.viewflags;
    test({ viewflags: { ...viewflags, renderMode: RenderMode.SolidFill } });
    test({ viewflags, backgroundColor: ColorByName.honeydew });
    test({ viewflags, monochromeColor: ColorByName.hotPink });
    test({ viewflags, monochromeMode: MonochromeMode.Flat });
    test({
      viewflags,
      analysisStyle: {
        inputName: undefined,
        inputRange: [2, 4],
        displacementChannelName: "displacement",
        displacementScale: 2.5,
        normalChannelName: "normal",
        scalarChannelName: undefined,
        scalarThematicSettings: undefined,
        scalarRange: undefined,
      },
      analysisFraction: 0.8,
    });

    test({
      viewflags,
      timePoint: 87654321,
      scheduleScript: [{
        modelId: "0xadf",
        realityModelUrl: "askjeeves.com",
        elementTimelines: [{
          batchId: 54,
          elementIds: ["0x1", "0x2", "0x3", "0x4"],
        }],
      }],
    });

    test({
      viewflags,
      subCategoryOvr: [{
        subCategory: "0x987",
        color: ColorByName.brown,
        invisible: false,
        style: "0xbbb",
        weight: 20,
        transp: 0.7,
      }],
    });

    test({
      viewflags,
      modelOvr: [{
        modelId: "0x789",
        weight: 10,
        linePixels: 4262526480,
        rgb: { r: 0, g: 255, b: 0 },
        transparency: 0.5,
        nonLocatable: true,
        emphasized: true,
      }],
    });

    test({
      viewflags,
      backgroundMap: {
        groundBias: 84,
        providerData: { mapType: BackgroundMapType.Street },
        applyTerrain: true,
        terrainSettings: { exaggeration: 0.5, heightOriginMode: 1 },
      },
    });

    test({
      viewflags,
      contextRealityModels: [{
        tilesetUrl: "bing.com",
        name: "bing",
        description: "an unpopular search engine",
        classifiers: [{
          modelId: "0x321",
          expand: 1.5,
          flags: {
            inside: SpatialClassificationProps.Display.Dimmed,
            outside: SpatialClassificationProps.Display.On,
            isVolumeClassifier: false,
            type: 0,
          },
          name: "bing",
          isActive: true,
        }],
      }],
    });

    test({ viewflags, excludedElements: ["0xdeadbeef", "0xbaadf00d"] });

    test({
      viewflags,
      environment: {
        sky: { display: false },
        ground: { display: true, elevation: 17, aboveColor: ColorByName.snow },
      },
    });

    test({
      viewflags,
      thematic: {
        displayMode: ThematicDisplayMode.Slope,
        axis: [0, 0.5, 1],
        range: [12, 24],
        sunDirection: [0, 1, 0],
        gradientSettings: {
          mode: 1,
          colorScheme: 1,
          customKeys: [],
          stepCount: 3,
          marginColor: ColorByName.pink,
          colorMix: 0.5,
        },
      },
    });

    test({
      viewflags,
      hline: {
        transThreshold: 0x4f,
        visible: {
          ovrColor: true,
          color: ColorByName.green,
          width: 2,
          pattern: LinePixels.Solid,
        },
        hidden: {
          ovrColor: false,
          color: ColorByName.white,
          width: 1,
          pattern: LinePixels.Solid,
        },
      },
    });

    test({
      viewflags,
      ao: {
        bias: 1.5,
        zLengthCap: 1.25,
        intensity: 0.5,
        blurDelta: 1.5,
        blurSigma: 2.5,
        blurTexelStepSize: 3.5,
        maxDistance: 4.5,
        texelStepSize: 5.5,
      },
    });

    test({ viewflags, solarShadows: { bias: 0.4, color: ColorByName.blue } });

    test({
      viewflags,
      lights: {
        numCels: 2,
        solar: { intensity: 4, alwaysEnabled: true },
        ambient: { intensity: 2, color: { r: 12, g: 24, b: 48 } },
      },
    });

    test({
      viewflags,
      planProjections: {
        "0x8": { elevation: 2, transparency: 0.25, overlay: true, enforceDisplayPriority: true },
      },
    });
  });
});
