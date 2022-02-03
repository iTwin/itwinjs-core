/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/

import { Vector3d } from "@itwin/core-geometry";
import { expect } from "chai";
import { DisplayStyle3dSettings } from "../DisplayStyleSettings";
import type { LightSettingsProps, SolarLightProps } from "../LightSettings";
import { LightSettings } from "../LightSettings";
import { RgbColor } from "../RgbColor";

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
    roundTrip({ solar: { timePoint: 54321 } }, "input");
    roundTrip({ solar: { direction: new Vector3d(-1, 0, 1).toJSON(), timePoint: 12345 } }, "input");

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

    roundTrip({ fresnel: { } }, undefined);
    roundTrip({ fresnel: { intensity: 0.8, invert: false } }, { fresnel: { intensity: 0.8 } });
    roundTrip({ fresnel: { intensity: 0, invert: true } }, { fresnel: { invert: true } });
    roundTrip({ fresnel: { intensity: -1, invert: true } }, { fresnel: { invert: true } });
    roundTrip({ fresnel: { intensity: 1.2, invert: true } }, "input");
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

  it("clone preserves solar time point unless new direction differs from previous direction and new time point was not supplied", () => {
    const test = (srcProps: SolarLightProps, changedProps: SolarLightProps, expectedProps: SolarLightProps) => {
      const src = LightSettings.fromJSON({ solar: srcProps });
      const clone = src.clone({ solar: changedProps });
      const expected = LightSettings.fromJSON({ solar: expectedProps });
      expect(clone.equals(expected)).to.be.true;
    };

    const dir1 = { x: 1, y: 2, z: 3 };
    const dir2 = { x: -1, y: -2, z: -3 };

    test({ }, { timePoint: 123 }, { timePoint: 123 });
    test({ direction: dir1 }, { timePoint: 123 }, { direction: dir1, timePoint: 123 });
    test({ direction: dir1, timePoint: 123 }, { timePoint: 456 }, { direction: dir1, timePoint: 456 });
    test({ direction: dir1, timePoint: 123 }, { direction: dir2 }, { direction: dir2 });
    test({ direction: dir1, timePoint: 123 }, { direction: dir1, timePoint: 456 }, { direction: dir1, timePoint: 456 });
    test({ direction: dir1 }, { direction: dir2, timePoint: 456 }, { direction: dir2, timePoint: 456 });
  });
});
