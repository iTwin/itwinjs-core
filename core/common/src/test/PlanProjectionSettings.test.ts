/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/

import { expect } from "chai";
import { PlanProjectionSettings, PlanProjectionSettingsProps } from "../PlanProjectionSettings";

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
