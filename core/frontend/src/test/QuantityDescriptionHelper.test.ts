/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/

import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { PropertyEditorParamTypes, StandardEditorNames, StandardTypeNames } from "@itwin/appui-abstract";
import { EmptyLocalization } from "@itwin/core-common";
import { IModelApp } from "../IModelApp";
import { createQuantityDescription } from "../properties/QuantityDescriptionHelper";

describe("createQuantityDescription", () => {
  beforeAll(async () => {
    await IModelApp.startup({ localization: new EmptyLocalization() });
  });

  afterAll(async () => {
    await IModelApp.shutdown();
  });

  it("returns a PropertyDescription with the correct name, displayLabel, and kindOfQuantityName", () => {
    const desc = createQuantityDescription({
      name: "myLength",
      displayLabel: "My Length",
      kindOfQuantityName: "DefaultToolsUnits.LENGTH",
      persistenceUnitName: "Units.M",
      parseError: "Unable to parse",
    });

    expect(desc.name).toBe("myLength");
    expect(desc.displayLabel).toBe("My Length");
    expect(desc.kindOfQuantityName).toBe("DefaultToolsUnits.LENGTH");
    expect(desc.typename).toBe(StandardTypeNames.Number);
  });

  it("sets up a NumberCustom editor with CustomFormattedNumber params", () => {
    const desc = createQuantityDescription({
      name: "myAngle",
      displayLabel: "My Angle",
      kindOfQuantityName: "DefaultToolsUnits.ANGLE",
      persistenceUnitName: "Units.RAD",
      parseError: "Unable to parse angle",
    });

    expect(desc.editor?.name).toBe(StandardEditorNames.NumberCustom);
    const params = desc.editor?.params ?? [];
    expect(params).toHaveLength(1);
    expect(params[0].type).toBe(PropertyEditorParamTypes.CustomFormattedNumber);
  });

  it("format callback returns a string (falls back to value.toString() when no spec registered)", () => {
    const desc = createQuantityDescription({
      name: "testProp",
      displayLabel: "Test",
      kindOfQuantityName: "DefaultToolsUnits.LENGTH",
      persistenceUnitName: "Units.M",
      parseError: "parse error",
    });

    const params = desc.editor!.params![0] as any;
    const formatted = params.formatFunction(1.5);
    expect(typeof formatted).toBe("string");
  });

  it("parse callback returns parseError when parserSpec is not loaded", () => {
    const desc = createQuantityDescription({
      name: "testProp",
      displayLabel: "Test",
      kindOfQuantityName: "DefaultToolsUnits.LENGTH",
      persistenceUnitName: "Units.M",
      parseError: "my parse error",
    });

    const params = desc.editor!.params![0] as any;
    const result = params.parseFunction("not-a-number");
    expect(result).toEqual({ parseError: "my parse error" });
  });
});
