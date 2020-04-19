/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/

import { expect } from "chai";
import {
  Vector3d,
  Range1d,
} from "@bentley/geometry-core";
import { DisplayStyle3dSettings } from "../DisplayStyleSettings";
import {
  PlanProjectionSettings,
  PlanProjectionSettingsProps,
} from "../PlanProjectionSettings";
import {
  BackgroundMapProps,
  BackgroundMapSettings,
  BackgroundMapType,
  GlobeMode,
} from "../BackgroundMapSettings";
import {
  SolarShadowSettings,
  SolarShadowSettingsProps,
} from "../SolarShadows";
import { TerrainHeightOriginMode } from "../TerrainSettings";
import { ColorByName } from "../ColorByName";
import { ColorDef } from "../ColorDef";
import { RgbColor } from "../RgbColor";
import {
  LightSettings,
  LightSettingsProps,
} from "../LightSettings";
import {
  ThematicDisplayProps,
  ThematicDisplay,
  ThematicDisplayMode,
  ThematicGradientMode,
  ThematicGradientColorScheme,
} from "../ThematicDisplay";

describe("PlanProjectionSettings", () => {
  it("round-trips through JSON", () => {
    const roundTrip = (input: PlanProjectionSettingsProps | undefined, expected: PlanProjectionSettingsProps | undefined | "input") => {
      const settings = PlanProjectionSettings.fromJSON(input);
      if (undefined === settings) {
        expect(expected).to.be.undefined;
        return;
      }

      if ("input" === expected)
        expected = input;

      expect(expected).not.to.be.undefined;
      const output = settings.toJSON();
      expect(output.elevation).to.equal(expected!.elevation);
      expect(output.transparency).to.equal(expected!.transparency);
      expect(output.overlay).to.equal(expected!.overlay);
      expect(output.enforceDisplayPriority).to.equal(expected!.enforceDisplayPriority);
    };

    roundTrip(undefined, undefined);
    roundTrip({}, undefined);

    roundTrip({ overlay: true }, "input");
    roundTrip({ overlay: false }, {});
    roundTrip({ enforceDisplayPriority: true }, "input");
    roundTrip({ enforceDisplayPriority: false }, {});
    roundTrip({ overlay: false, enforceDisplayPriority: true }, { enforceDisplayPriority: true });
    roundTrip({ overlay: true, enforceDisplayPriority: false }, { overlay: true });

    roundTrip({ transparency: 0.5 }, "input");
    roundTrip({ transparency: 1.0 }, "input");
    roundTrip({ transparency: 0.0 }, "input");
    roundTrip({ transparency: 1.1 }, { transparency: 1.0 });
    roundTrip({ transparency: -0.1 }, { transparency: 0.0 });

    roundTrip({ elevation: 123.5 }, "input");
  });

  it("clones", () => {
    const clone = (input: PlanProjectionSettingsProps, changed: PlanProjectionSettingsProps | undefined, expected: PlanProjectionSettingsProps) => {
      const settings = new PlanProjectionSettings(input);
      const output = settings.clone(changed);
      expect(output.elevation).to.equal(expected.elevation);
      expect(output.transparency).to.equal(expected.transparency);
      expect(output.overlay).to.equal(expected.overlay);
      expect(output.enforceDisplayPriority).to.equal(expected.enforceDisplayPriority);
    };

    clone({}, undefined, { overlay: false, enforceDisplayPriority: false });
    clone({ overlay: true }, undefined, { overlay: true, enforceDisplayPriority: false });
    clone({ overlay: false }, undefined, { overlay: false, enforceDisplayPriority: false });
    clone({}, { overlay: true }, { overlay: true, enforceDisplayPriority: false });
    clone({ overlay: true }, { overlay: false }, { overlay: false, enforceDisplayPriority: false });

    clone({ transparency: 0.5 }, { transparency: 0.75 }, { transparency: 0.75, overlay: false, enforceDisplayPriority: false });
    clone({ transparency: 0.5 }, { transparency: 1.25 }, { transparency: 1.0, overlay: false, enforceDisplayPriority: false });

    clone({}, { elevation: 1, transparency: 0.2 }, { elevation: 1, transparency: 0.2, overlay: false, enforceDisplayPriority: false });
    clone({ elevation: 1, transparency: 0.2 }, {}, { elevation: 1, transparency: 0.2, overlay: false, enforceDisplayPriority: false });
    clone({ elevation: 1, overlay: true }, { transparency: 0.2 }, { elevation: 1, transparency: 0.2, overlay: true, enforceDisplayPriority: false });
    clone({ elevation: 1 }, { elevation: -1, transparency: 0.75 }, { elevation: -1, transparency: 0.75, overlay: false, enforceDisplayPriority: false });

    clone({}, undefined, { enforceDisplayPriority: false, overlay: false });
    clone({ enforceDisplayPriority: true }, undefined, { enforceDisplayPriority: true, overlay: false });
    clone({ enforceDisplayPriority: false }, undefined, { enforceDisplayPriority: false, overlay: false });
    clone({}, { enforceDisplayPriority: true }, { enforceDisplayPriority: true, overlay: false });
    clone({ enforceDisplayPriority: true }, { enforceDisplayPriority: false }, { enforceDisplayPriority: false, overlay: false });
  });
});

describe("DisplayStyleSettings", () => {
  interface SettingsMap { [modelId: string]: PlanProjectionSettingsProps; }

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
        for (const _entry of iter)
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

describe("BackgroundMapSettings", () => {
  it("round-trips through JSON", () => {
    const roundTrip = (input: BackgroundMapProps | undefined, expected: BackgroundMapProps | "input") => {
      if (!input)
        input = {};

      if ("input" === expected)
        expected = input;

      const settings = BackgroundMapSettings.fromJSON(input);
      const output = settings.toJSON();

      expect(output.groundBias).to.equal(expected.groundBias);
      expect(output.providerName).to.equal(expected.providerName);
      expect(output.providerData?.mapType).to.equal(expected.providerData?.mapType);
      expect(output.transparency).to.equal(expected.transparency);
      expect(output.useDepthBuffer).to.equal(expected.useDepthBuffer);
      expect(output.applyTerrain).to.equal(expected.applyTerrain);
      expect(output.globeMode).to.equal(expected.globeMode);

      const outTerrain = output.terrainSettings;
      const expTerrain = expected.terrainSettings;
      expect(undefined === outTerrain).to.equal(undefined === expTerrain);
      if (outTerrain && expTerrain) {
        expect(outTerrain.providerName).to.equal(expTerrain.providerName);
        expect(outTerrain.exaggeration).to.equal(expTerrain.exaggeration);
        expect(outTerrain.applyLighting).to.equal(expTerrain.applyLighting);
        expect(outTerrain.heightOrigin).to.equal(expTerrain.heightOrigin);
        expect(outTerrain.heightOriginMode).to.equal(expTerrain.heightOriginMode);
      }

      expect(settings.equalsJSON(expected)).to.be.true;

      const expectedSettings = BackgroundMapSettings.fromJSON(expected);
      expect(settings.equals(expectedSettings)).to.be.true;
    };

    roundTrip(undefined, {});
    roundTrip({}, "input");

    roundTrip({ groundBias: 123 }, "input");

    roundTrip({ providerName: "BingProvider" }, {});
    roundTrip({ providerName: "MapBoxProvider" }, "input");
    roundTrip({ providerName: "UnknownProvider" }, {});

    roundTrip({ providerData: { mapType: BackgroundMapType.Hybrid } }, {});
    roundTrip({ providerData: { mapType: BackgroundMapType.Street } }, "input");
    roundTrip({ providerData: { mapType: BackgroundMapType.Aerial } }, "input");
    roundTrip({ providerData: { mapType: -123 } }, {});

    roundTrip({ transparency: false }, {});
    roundTrip({ transparency: 0 }, "input");
    roundTrip({ transparency: 1 }, "input");
    roundTrip({ transparency: 1.1 }, { transparency: 1 });
    roundTrip({ transparency: -0.1 }, { transparency: 0 });

    roundTrip({ useDepthBuffer: false }, {});
    roundTrip({ useDepthBuffer: true }, "input");

    roundTrip({ applyTerrain: false }, {});
    roundTrip({ applyTerrain: true }, "input");

    roundTrip({ globeMode: GlobeMode.Ellipsoid }, {});
    roundTrip({ globeMode: GlobeMode.Plane }, "input");
    roundTrip({ globeMode: 42 }, {});

    roundTrip({ terrainSettings: { providerName: "CesiumWorldTerrain" } }, {});
    roundTrip({ terrainSettings: { providerName: "UnknownProvider" } }, {});

    roundTrip({ terrainSettings: { exaggeration: 1 } }, {});
    roundTrip({ terrainSettings: { exaggeration: 99 } }, "input");
    roundTrip({ terrainSettings: { exaggeration: 101 } }, { terrainSettings: { exaggeration: 100 } });
    roundTrip({ terrainSettings: { exaggeration: 0.05 } }, { terrainSettings: { exaggeration: 0.1 } });
    roundTrip({ terrainSettings: { exaggeration: 0.15 } }, "input");

    roundTrip({ terrainSettings: { applyLighting: false } }, {});
    roundTrip({ terrainSettings: { applyLighting: true } }, "input");

    roundTrip({ terrainSettings: { heightOrigin: 0 } }, {});
    roundTrip({ terrainSettings: { heightOrigin: 42 } }, "input");

    roundTrip({ terrainSettings: { heightOriginMode: TerrainHeightOriginMode.Ground } }, {});
    roundTrip({ terrainSettings: { heightOriginMode: TerrainHeightOriginMode.Geodetic } }, "input");
    roundTrip({ terrainSettings: { heightOriginMode: TerrainHeightOriginMode.Geoid } }, "input");
    roundTrip({ terrainSettings: { heightOriginMode: -99 } }, {});

    roundTrip({
      providerName: "BingProvider",
      providerData: { mapType: BackgroundMapType.Hybrid },
      transparency: false,
      useDepthBuffer: false,
      applyTerrain: false,
      globeMode: GlobeMode.Ellipsoid,
      terrainSettings: {
        providerName: "CesiumWorldTerrain",
        applyLighting: false,
        exaggeration: 1,
        heightOrigin: 0,
        heightOriginMode: TerrainHeightOriginMode.Ground,
      },
    }, {});
  });
});

describe("SolarShadowSettings", () => {
  it("round-trips through JSON", () => {
    const roundTrip = (input: SolarShadowSettingsProps | undefined, expected: SolarShadowSettingsProps | "input" | undefined) => {
      if ("input" === expected)
        expected = input;

      const settings = SolarShadowSettings.fromJSON(input);
      const output = settings.toJSON();

      expect(output === undefined).to.equal(expected === undefined);
      if (output && expected) {
        expect(output.color).to.equal(expected.color);
        expect(output.bias).to.equal(expected.bias);
      }

      const expectedSettings = SolarShadowSettings.fromJSON(expected);
      expect(settings.equals(expectedSettings)).to.be.true;
    };

    roundTrip(undefined, undefined);
    roundTrip({}, undefined);
    roundTrip(SolarShadowSettings.defaults.toJSON(), undefined);

    roundTrip({ color: ColorByName.grey }, undefined);

    roundTrip({ color: ColorByName.red }, "input");
    roundTrip({ color: ColorByName.black }, "input");
    roundTrip({ color: undefined }, undefined);

    roundTrip({ bias: 0 }, "input");
    roundTrip({ bias: 0.001 }, undefined);
    roundTrip({ bias: 1234.5 }, "input");
    roundTrip({ bias: undefined }, undefined);

    roundTrip({ color: ColorByName.grey, bias: 0.001 }, undefined);
    roundTrip({ color: ColorByName.bisque, bias: 42 }, "input");
  });
});

describe("LightSettings", () => {
  it("round-trips through JSON", () => {
    const roundTrip = (input: LightSettingsProps | undefined, expected: LightSettingsProps | "input" | undefined) => {
      const settings = LightSettings.fromJSON(input);

      if ("input" === expected) {
        expected = input;
      } else {
        const expectedSettings = LightSettings.fromJSON(expected);
        expect(settings.equals(expectedSettings)).to.be.true;
      }

      const output = settings.toJSON();
      expect(output).to.deep.equal(expected);
    };

    roundTrip(undefined, undefined);
    roundTrip({}, undefined);

    roundTrip({ numCels: 0 }, undefined);
    roundTrip({ numCels: 1 }, "input");

    roundTrip({ specularIntensity: 1 }, undefined);
    roundTrip({ specularIntensity: 0.5 }, "input");
    roundTrip({ specularIntensity: 5.1 }, { specularIntensity: 5.0 });
    roundTrip({ specularIntensity: -0.1 }, { specularIntensity: 0.0 });

    roundTrip({ portrait: { intensity: 0.3 } }, undefined);
    roundTrip({ portrait: { intensity: 2.0 } }, "input");
    roundTrip({ portrait: { intensity: 5.1 } }, { portrait: { intensity: 5.0 } });
    roundTrip({ portrait: { intensity: -0.1 } }, { portrait: { intensity: 0.0 } });

    roundTrip({ solar: { direction: Vector3d.create(0.272166, 0.680414, 0.680414).toJSON(), intensity: 1, alwaysEnabled: false } }, undefined);
    roundTrip({ solar: { direction: Vector3d.create(-1, -1, -1).toJSON() } }, "input");
    roundTrip({ solar: { intensity: 4.9 } }, "input");
    roundTrip({ solar: { intensity: 5.1 } }, { solar: { intensity: 5.0 } });
    roundTrip({ solar: { intensity: -0.1 } }, { solar: { intensity: 0.0 } });
    roundTrip({ solar: { alwaysEnabled: true } }, "input");

    roundTrip({ ambient: { color: new RgbColor(0, 0, 0).toJSON(), intensity: 0.2 } }, undefined);
    roundTrip({ ambient: { color: new RgbColor(1, 127, 255).toJSON() } }, "input");
    roundTrip({ ambient: { intensity: 0.1 } }, "input");
    roundTrip({ ambient: { intensity: -0.1 } }, { ambient: { intensity: 0.0 } });
    roundTrip({ ambient: { intensity: 5.1 } }, { ambient: { intensity: 5.0 } });

    roundTrip({ hemisphere: { lowerColor: new RgbColor(120, 143, 125).toJSON(), upperColor: new RgbColor(143, 205, 255), intensity: 0 } }, undefined);
    roundTrip({ hemisphere: { lowerColor: new RgbColor(0, 1, 2).toJSON() } }, "input");
    roundTrip({ hemisphere: { upperColor: new RgbColor(254, 254, 255).toJSON() } }, "input");
    roundTrip({ hemisphere: { intensity: 2.5 } }, "input");
    roundTrip({ hemisphere: { intensity: -0.1 } }, undefined);
    roundTrip({ hemisphere: { intensity: 5.1 } }, { hemisphere: { intensity: 5.0 } });
  });

  it("should preserve sun direction", () => {
    const sunDir = Vector3d.create(0, 0.5, 1.0);
    const props = {
      styles: {
        sceneLights: { sunDir: sunDir.toJSON() },
      },
    };

    const style = new DisplayStyle3dSettings(props);
    expect(style.lights.solar.direction.isAlmostEqual(sunDir)).to.be.true;
  });
});

describe("ThematicDisplay", () => {
  it("Ensures ThematicDisplay derives values properly from JSON, including handling defaults and incorrect values", () => {
    function verifyDefaults(thematicDisplay: ThematicDisplay) {
      expect(thematicDisplay.axis).to.deep.equal(Vector3d.fromJSON({ x: 0.0, y: 0.0, z: 0.0 }));
      expect(thematicDisplay.displayMode).to.equal(ThematicDisplayMode.Height);
      expect(thematicDisplay.gradientSettings.mode).to.equal(ThematicGradientMode.Smooth);
      expect(thematicDisplay.gradientSettings.stepCount).to.equal(10);
      expect(thematicDisplay.gradientSettings.colorScheme).to.equal(ThematicGradientColorScheme.BlueRed);
      expect(thematicDisplay.gradientSettings.marginColor.colors.r).to.equal(0);
      expect(thematicDisplay.gradientSettings.marginColor.colors.g).to.equal(0);
      expect(thematicDisplay.gradientSettings.marginColor.colors.b).to.equal(0);
      expect(thematicDisplay.gradientSettings.marginColor.colors.t).to.equal(0);
      expect(thematicDisplay.gradientSettings.customKeys.length).to.equal(0);
      expect(thematicDisplay.range).to.deep.equal(Range1d.createNull());
    }

    // check if the creation and back-and-forth via JSON works
    function verifyBackAndForth(a: ThematicDisplay) {
      const aCopy = ThematicDisplay.fromJSON(a.toJSON());
      expect(aCopy.equals(a)).to.be.true;
    }

    // create default ThematicDisplay object and verify the default values are correct
    const defaultThematicDisplay = ThematicDisplay.fromJSON();
    verifyDefaults(defaultThematicDisplay);

    // check if the creation and back-and-forth via JSON works using the default object
    verifyBackAndForth(defaultThematicDisplay);

    // check if setting bad values for displayMode, gradient mode, and gradient color scheme yields expected defaults
    let badThematicProps: ThematicDisplayProps = {
      displayMode: 99999,
      gradientSettings: {
        mode: 99999,
        colorScheme: 99999,
      },
    };
    let td = ThematicDisplay.fromJSON(badThematicProps);
    expect(td.equals(defaultThematicDisplay)).to.be.true;
    verifyBackAndForth(td);

    // check if configuring custom color scheme incorrectly is resolved as expected
    badThematicProps = {
      gradientSettings: {
        colorScheme: ThematicGradientColorScheme.Custom,
        customKeys: [{ value: 0.0, color: 0 }], // (one entry is not okay - need at least two)
      },
    };
    td = ThematicDisplay.fromJSON(badThematicProps);
    expect(td.gradientSettings.customKeys.length).to.equal(2); // 2 entries should get manufactured
    expect(td.gradientSettings.customKeys[0].color).to.deep.equal(ColorDef.from(255, 255, 255, 0)); // first should be white
    expect(td.gradientSettings.customKeys[0].value).to.equal(0.0); // value for black should be 0.0
    expect(td.gradientSettings.customKeys[1].color).to.deep.equal(ColorDef.from(0, 0, 0, 0)); // second should be black
    expect(td.gradientSettings.customKeys[1].value).to.equal(1.0); // value for white should be 1.0
    verifyBackAndForth(td);
  });
});
