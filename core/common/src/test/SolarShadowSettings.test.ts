/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/

import { expect } from "chai";
import { ColorByName } from "../ColorByName";
import type { SolarShadowSettingsProps } from "../SolarShadows";
import { SolarShadowSettings } from "../SolarShadows";

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
