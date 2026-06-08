/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/

import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { isCustomFormattedNumberParams, PropertyEditorParamTypes, StandardEditorNames, StandardTypeNames } from "@itwin/appui-abstract";
import { EmptyLocalization } from "@itwin/core-common";
import { IModelApp } from "../IModelApp";
import { createQuantityDescription } from "../properties/FormattedQuantityDescription";

describe("FormattedQuantityDescription", () => {
  beforeAll(async () => {
    await IModelApp.startup({ localization: new EmptyLocalization() });
  });

  afterAll(async () => {
    await IModelApp.shutdown();
  });

  it("createQuantityDescription returns the correct property metadata", () => {
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

  it("createQuantityDescription sets up a NumberCustom editor with CustomFormattedNumber params", () => {
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

  it("createQuantityDescription format callback falls back to a string when no spec is registered", () => {
    const desc = createQuantityDescription({
      name: "testProp",
      displayLabel: "Test",
      kindOfQuantityName: "DefaultToolsUnits.LENGTH",
      persistenceUnitName: "Units.M",
      parseError: "parse error",
    });

    const params = desc.editor?.params ?? [];
    expect(params).toHaveLength(1);
    expect(isCustomFormattedNumberParams(params[0])).toBe(true);
    if (!isCustomFormattedNumberParams(params[0]))
      throw new Error("Expected CustomFormattedNumberParams");

    const formatted = params[0].formatFunction(1.5);
    expect(typeof formatted).toBe("string");
  });

  it("createQuantityDescription parse callback returns parseError when parserSpec is not loaded", () => {
    const desc = createQuantityDescription({
      name: "testProp",
      displayLabel: "Test",
      kindOfQuantityName: "DefaultToolsUnits.LENGTH",
      persistenceUnitName: "Units.M",
      parseError: "my parse error",
    });

    const params = desc.editor?.params ?? [];
    expect(params).toHaveLength(1);
    expect(isCustomFormattedNumberParams(params[0])).toBe(true);
    if (!isCustomFormattedNumberParams(params[0]))
      throw new Error("Expected CustomFormattedNumberParams");

    const result = params[0].parseFunction("not-a-number");
    expect(result).toEqual({ parseError: "my parse error" });
  });
});
