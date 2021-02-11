/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
import { expect } from "chai";
import { CompressedId64Set } from "@bentley/bentleyjs-core";
import { Vector3d } from "@bentley/geometry-core";
import {
  BackgroundMapType, ColorByName, DisplayStyle3dProps, DisplayStyle3dSettingsProps, FeatureAppearance, PlanarClipMaskMode, PlanarClipMaskSettings,
  SpatialClassificationProps, ThematicDisplayMode,
} from "@bentley/imodeljs-common";
import { ContextRealityModelState, DisplayStyle3dState, IModelConnection, MockRender, SnapshotConnection } from "@bentley/imodeljs-frontend";

describe("DisplayStyle", () => {
  let imodel: IModelConnection;
  const styleProps: DisplayStyle3dProps = {
    classFullName: "bis.DisplayStyle3d",
    model: "0",
    code: {
      spec: "0x1",
      scope: "0x1",
      value: "",
    },
  };

  before(async () => {
    await MockRender.App.startup();
    imodel = await SnapshotConnection.openFile("test.bim");
  });

  after(async () => {
    if (imodel)
      await imodel.close();

    await MockRender.App.shutdown();
  });

  it("should clone correctly", () => {
    const style1 = new DisplayStyle3dState(styleProps, imodel);
    const style2 = style1.clone(imodel);
    expect(JSON.stringify(style1)).to.equal(JSON.stringify(style2));

    // ###TODO More substantial tests (change style properties)
  });

  it("should preserve sun direction", () => {
    const style1 = new DisplayStyle3dState(styleProps, imodel);
    expect(style1.sunDirection).not.to.be.undefined;

    style1.setSunTime(Date.now());
    expect(style1.sunDirection).not.to.be.undefined;

    const style2 = style1.clone(imodel);
    expect(style2.sunDirection).not.to.be.undefined;
    expect(style2.sunDirection.isAlmostEqual(style1.sunDirection)).to.be.true;
  });

  it("should read sun direction from json", () => {
    const props = { ...styleProps };
    const sunDir = new Vector3d(1, 0, 0.5);
    props.jsonProperties = { styles: { sceneLights: { sunDir } } };

    const style = new DisplayStyle3dState(props, imodel);
    expect(style.sunDirection).not.to.be.undefined;
    expect(style.sunDirection.x).to.equal(sunDir.x);
    expect(style.sunDirection.y).to.equal(sunDir.y);
    expect(style.sunDirection.z).to.equal(sunDir.z);
  });

  it("Should override model appearance correctly", () => {
    const style = new DisplayStyle3dState(styleProps, imodel);
    const appearanceOverride = FeatureAppearance.fromJSON({
      rgb: { r: 0, g: 255, b: 0 },
      transparency: 0.5,
      nonLocatable: true,
      emphasized: true,
    });

    let index = 0;
    style.forEachRealityModel((_realityModel) => {
      style.overrideRealityModelAppearance(index, appearanceOverride);

      expect(appearanceOverride).to.deep.equal(style.getRealityModelAppearanceOverride(index));
      index++;
    });

    const modelId = "0x001f";
    style.overrideModelAppearance(modelId, appearanceOverride);
    expect(appearanceOverride).to.deep.equal(style.getModelAppearanceOverride(modelId));
  });

  it("Should override reality model planar clip masks correctly", () => {
    const style = new DisplayStyle3dState(styleProps, imodel);
    const compressedModelIds = CompressedId64Set.compressArray([ "0x001", "0x002", "0x003"]);
    const compressedElementIds =  CompressedId64Set.compressArray([ "0x004", "0x004", "0x006"]);
    const planarClipMask = PlanarClipMaskSettings.fromJSON({
      mode: PlanarClipMaskMode.IncludeElements,
      modelIds: compressedModelIds,
      subCategoryOrElementIds: compressedElementIds,
      priority: 0,
    });

    let index = 0;
    style.forEachRealityModel((_realityModel) => {
      style.overrideRealityModelPlanarClipMask(index, planarClipMask);

      expect(planarClipMask).to.deep.equal(style.getRealityModelPlanarClipMask(index));
      index++;
    });
  });

  it("should use iModel extents for thematic height range if unspecified", () => {
    const style = new DisplayStyle3dState(styleProps, imodel);
    style.settings.applyOverrides({ thematic: { displayMode: ThematicDisplayMode.Height, range: [1, 100] } });
    expect(style.settings.thematic.range.low).to.equal(1);
    expect(style.settings.thematic.range.high).to.equal(100);

    style.settings.applyOverrides({ thematic: { displayMode: ThematicDisplayMode.Height } });
    expect(style.settings.thematic.range.low).to.equal(imodel.projectExtents.zLow);
    expect(style.settings.thematic.range.high).to.equal(imodel.projectExtents.zHigh);

    style.settings.applyOverrides({ thematic: { displayMode: ThematicDisplayMode.Slope } });
    expect(style.settings.thematic.range.isNull).to.be.true;
  });

  it("should override selected settings", () => {
    const style = new DisplayStyle3dState(styleProps, imodel);
    const test = (overrides: DisplayStyle3dSettingsProps, changed?: DisplayStyle3dSettingsProps) => {
      const originalSettings = { ...style.settings.toJSON() };
      style.settings.applyOverrides(overrides);
      const output = style.settings.toJSON();

      const expected = { ...overrides, changed };
      for (const key of Object.keys(expected) as Array<keyof DisplayStyle3dSettingsProps>)
        expect(output[key]).to.deep.equal(expected[key]);

      for (const key of Object.keys(output) as Array<keyof DisplayStyle3dSettingsProps>)
        if (undefined === expected[key])
          expect(output[key]).to.deep.equal(originalSettings[key]);

      if (undefined !== expected.contextRealityModels)
        compareRealityModels(style, expected);

      if (undefined !== expected.scheduleScript)
        compareScheduleScripts(style, expected);
    };

    function compareRealityModels(style3d: DisplayStyle3dState, expected: any): void {
      const models: ContextRealityModelState[] = [];
      style3d.forEachRealityModel((model) => models.push(model));
      if (undefined !== expected.contextRealityModels) {
        expect(models.length).to.equal(expected.contextRealityModels.length);
        for (let i = 0; i < models.length; i++) {
          const a = models[i];
          const e = expected.contextRealityModels[i];
          expect(a.name).to.equal(e.name);
          expect(a.url).to.equal(e.tilesetUrl);
          expect(a.orbitGtBlob).to.equal(e.orbitGtBlob);
          expect(a.realityDataId).to.equal(e.realityDataId);
          expect(a.description).to.equal(e.description);
          expect(a.treeRef).not.to.be.undefined;

          expect(undefined === a.classifiers).to.equal(undefined === e.classifiers);
          if (undefined !== a.classifiers && undefined !== e.classifiers)
            expect(a.classifiers.length).to.equal(e.classifiers.length);

          expect(undefined === a.planarClipMask).to.equal(undefined === e.planarClipMask);
          if (undefined !== a.planarClipMask && undefined !== e.planarClipMask)
            expect(a.planarClipMask.settings.equals(PlanarClipMaskSettings.fromJSON(e.planarClipMask)));

          const foundIndex = style3d.findRealityModelIndex((accept) => { return accept.url === a.url; });
          expect(i === foundIndex);
        }
        // Detach all.
        style3d.detachRealityModelByIndex(-1);
        style3d.forEachRealityModel((_model) => expect(false));
      } else {
        expect(models.length).to.equal(0);
      }
    }

    function compareScheduleScripts(style3d: DisplayStyle3dState, expected: any): void {
      if (undefined !== style3d.scheduleScript)
        expect(JSON.stringify(style3d.scheduleScript.toJSON())).to.equal(JSON.stringify(expected.scheduleScript));
      else
        expect(expected.scheduleScript).to.be.undefined;
    }

    // Note that each test adds some new settings to our display style. This allows us to test that settings not specified in overrides retain their previous values.
    test({
      backgroundMap: {
        groundBias: 84,
        providerData: { mapType: BackgroundMapType.Street },
        applyTerrain: true,
        terrainSettings: { exaggeration: 0.5, heightOriginMode: 1 },
        planarClipMask: { mode: PlanarClipMaskMode.IncludeSubCategories, modelIds: CompressedId64Set.compressArray(["0x123", "0x456"]), transparency: .5, subCategoryOrElementIds: CompressedId64Set.compressArray(["0x123", "0x456"]), priority: 0 },
      },
    });

    test({ planProjections: { "0x8": { elevation: 2, transparency: 0.25, overlay: true, enforceDisplayPriority: true } } });
    test({ environment: { sky: { display: false, twoColor: true }, ground: { display: true } } });

    test({
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
      },
      {
        tilesetUrl: "google.com",
        name: "google",
        description: "a popular search engine",

        classifiers: [{
          modelId: "0x321",
          expand: 1.5,
          flags: {
            inside: SpatialClassificationProps.Display.Dimmed,
            outside: SpatialClassificationProps.Display.On,
            isVolumeClassifier: false,
            type: 0,
          },
          name: "google",
          isActive: true,
        }],
      },
      ],
    });

    test({
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
          colorMix: 0.333,
        },
      },
    });

    test({
      backgroundMap: {
        groundBias: 42,
        providerData: { mapType: BackgroundMapType.Aerial },
        terrainSettings: { exaggeration: 0.2, heightOriginMode: 0 },
      },
    });

    test({ planProjections: { "0x9": { elevation: 3, transparency: 0.75, overlay: true, enforceDisplayPriority: true } } });
    test({ environment: { sky: { display: true, twoColor: true }, ground: { display: false } } });

    test({
      contextRealityModels: [{
        tilesetUrl: "google.com",
        name: "google",
        description: "a popular search engine",
        planarClipMask: { mode: PlanarClipMaskMode.IncludeSubCategories, modelIds: CompressedId64Set.compressArray(["0x123", "0x456"]), transparency: .5, subCategoryOrElementIds: CompressedId64Set.compressArray(["0x123", "0x456"]), priority: 1024 },
        classifiers: [{
          modelId: "0x123",
          expand: 0.5,
          flags: {
            inside: SpatialClassificationProps.Display.Off,
            outside: SpatialClassificationProps.Display.Dimmed,
            isVolumeClassifier: true,
            type: 0,
          },
          name: "google",
          isActive: false,
        }],
      }],
    });

    test({
      scheduleScript: [{
        modelId: "0xfda",
        realityModelUrl: "altavista.com",
        elementTimelines: [{
          batchId: 45,
          elementIds: ["0xa", "0xb"],
        }],
      }],
    });

    // Also, while we have one constructed, test creation with reality model and script.
    const newStyle = new DisplayStyle3dState(style.toJSON(), imodel);
    expect(newStyle.equals(style)).to.be.true;
    compareRealityModels(newStyle, style.settings.toJSON());
    compareScheduleScripts(newStyle, style.settings.toJSON());
  });
});
