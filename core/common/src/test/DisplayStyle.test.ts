/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/

import { expect } from "chai";
import { DisplayStyle3dSettings } from "../DisplayStyleSettings";
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
    };

    roundTrip(undefined, undefined);
    roundTrip({ }, undefined);

    roundTrip({ overlay: true }, "input");
    roundTrip({ overlay: false }, { });

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
    };

    clone({ }, undefined, { overlay: false });
    clone({ overlay: true }, undefined, { overlay: true });
    clone({ overlay: false }, undefined, { overlay: false });
    clone({ }, { overlay: true }, { overlay: true });
    clone({ overlay: true }, { overlay: false }, { overlay: false });

    clone({ transparency: 0.5 }, { transparency: 0.75 }, { transparency: 0.75, overlay: false });
    clone({ transparency: 0.5 }, { transparency: 1.25 }, { transparency: 1.0, overlay: false });

    clone({ }, { elevation: 1, transparency: 0.2 }, { elevation: 1, transparency: 0.2, overlay: false });
    clone({ elevation: 1, transparency: 0.2 }, { }, { elevation: 1, transparency: 0.2, overlay: false });
    clone({ elevation: 1, overlay: true }, { transparency: 0.2 }, { elevation: 1, transparency: 0.2, overlay: true });
    clone({ elevation: 1 }, { elevation: -1, transparency: 0.75 }, { elevation: -1, transparency: 0.75, overlay: false });
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
    roundTrip({ });
    roundTrip({ "not an id": { transparency: 0.5 } });
    roundTrip({ "0x1": { overlay: true } });
    roundTrip({ "0x1": { overlay: false } });
    roundTrip({ "0x1": { transparency: 0.5 }, "0x2": { elevation: -5 } });
  });

  it("sets and round-trips plan projection settings", () => {
    const roundTrip = (planProjections: SettingsMap | undefined, expected: SettingsMap | undefined | "input") => {
      if ("input" === expected)
        expected = planProjections;

      const input = new DisplayStyle3dSettings({ });
      if (undefined !== planProjections)
        for (const modelId of Object.keys(planProjections))
          input.setPlanProjectionSettings(modelId, PlanProjectionSettings.fromJSON(planProjections[modelId]));

      const output = new DisplayStyle3dSettings({ styles: input.toJSON() });
      const json = output.toJSON();
      expect(JSON.stringify(json.planProjections)).to.equal(JSON.stringify(expected));
    };

    roundTrip(undefined, undefined);
    roundTrip({ }, undefined);
    roundTrip({ "not an id": { transparency: 0.5 } }, { });
    roundTrip({ "0x1": { overlay: true } }, "input");
    roundTrip({ "0x1": { overlay: false } }, { });
    roundTrip({ "0x1": { transparency: 0.5 }, "0x2": { elevation: -5 } }, "input");
  });

  it("deletes plan projection settings", () => {
    const settings = new DisplayStyle3dSettings({ });
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
