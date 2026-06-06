/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/

import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { EmptyLocalization } from "@itwin/core-common";
import { getDefaultPersistenceUnit, Phenomena } from "@itwin/core-quantity";
import { isCustomFormattedNumberParams, type PropertyDescription, PropertyEditorParamTypes, StandardEditorNames, StandardTypeNames } from "@itwin/appui-abstract";
import { IModelApp } from "../../IModelApp";
import { createAngleDescription } from "../../properties/AngleDescription";
import { createEngineeringLengthDescription, createLengthDescription, createSurveyLengthDescription } from "../../properties/LengthDescription";

function getCustomFormattedNumberParams(description: PropertyDescription) {
  const params = description.editor?.params ?? [];
  const customParams = params.find(isCustomFormattedNumberParams);
  expect(customParams).toBeDefined();
  return customParams!;
}

describe("Quantity description helpers", () => {
  beforeAll(async () => {
    await IModelApp.startup({ localization: new EmptyLocalization() });
  });

  afterAll(async () => {
    await IModelApp.shutdown();
  });

  it("creates a plain length property description with default formatting metadata", () => {
    const description = createLengthDescription();

    expect(Object.getPrototypeOf(description)).toBe(Object.prototype);
    expect(description.name).toBe("length");
    expect(description.displayLabel).toBe(IModelApp.localization.getLocalizedString("iModelJs:Properties.Length"));
    expect(description.typename).toBe(StandardTypeNames.Number);
    expect(description.kindOfQuantityName).toBe("DefaultToolsUnits.LENGTH");
    // eslint-disable-next-line @typescript-eslint/no-deprecated
    expect(description.quantityType).toBeUndefined();
    expect(description.editor?.name).toBe(StandardEditorNames.NumberCustom);
    expect(getCustomFormattedNumberParams(description)).toBeDefined();
  });

  it("creates length variants with their existing KindOfQuantity defaults", () => {
    expect(createSurveyLengthDescription().kindOfQuantityName).toBe("CivilUnits.LENGTH");
    expect(createEngineeringLengthDescription().kindOfQuantityName).toBe("AecUnits.LENGTH");
  });

  it("preserves distinct survey and engineering length formatting defaults", async () => {
    await IModelApp.quantityFormatter.setActiveUnitSystem("imperial");

    const surveyParams = getCustomFormattedNumberParams(createSurveyLengthDescription());
    const engineeringParams = getCustomFormattedNumberParams(createEngineeringLengthDescription());

    expect(surveyParams.formatFunction(1000)).toBe("3280.8333 ft (US Survey)");
    expect(engineeringParams.formatFunction(1000)).toBe("3280.84 ft");
    expect(surveyParams.parseFunction("3280.8333 ft (US Survey)").value).toBeCloseTo(1000);
    expect(engineeringParams.parseFunction("3280.84 ft").value).toBeCloseTo(1000);
  });

  it("creates an angle property description with default formatting metadata", () => {
    const description = createAngleDescription();

    expect(Object.getPrototypeOf(description)).toBe(Object.prototype);
    expect(description.name).toBe("angle");
    expect(description.displayLabel).toBe(IModelApp.localization.getLocalizedString("iModelJs:Properties.Angle"));
    expect(description.typename).toBe(StandardTypeNames.Number);
    expect(description.kindOfQuantityName).toBe("DefaultToolsUnits.ANGLE");
    // eslint-disable-next-line @typescript-eslint/no-deprecated
    expect(description.quantityType).toBeUndefined();
    expect(description.editor?.name).toBe(StandardEditorNames.NumberCustom);
    expect(getCustomFormattedNumberParams(description)).toBeDefined();
  });

  it("supports description overrides and icon params", () => {
    const description = createLengthDescription({
      name: "offset",
      displayLabel: "Offset",
      iconSpec: "icon-placeholder",
      kindOfQuantityName: "Custom.LENGTH",
      persistenceUnitName: "Units.FT",
    });

    expect(description.name).toBe("offset");
    expect(description.displayLabel).toBe("Offset");
    expect(description.kindOfQuantityName).toBe("Custom.LENGTH");
    expect(description.editor?.params?.some((param) => param.type === PropertyEditorParamTypes.Icon)).toBe(true);
  });

  it("uses FormatSpecHandle-backed callbacks for formatting and parsing", async () => {
    const description = createLengthDescription();
    const customParams = getCustomFormattedNumberParams(description);
    await IModelApp.quantityFormatter.addFormattingSpecsToRegistry({
      name: "DefaultToolsUnits.LENGTH",
      persistenceUnitName: getDefaultPersistenceUnit(Phenomena.LENGTH),
    });

    expect(customParams.formatFunction(0.3048)).toBe("1'-0\"");
    const parseResult = customParams.parseFunction("1'-0\"");
    expect(parseResult.value).toBe(0.3048);
  });

  it("uses persistence unit override when looking up formatting specs", async () => {
    const description = createLengthDescription({
      kindOfQuantityName: "Test.LENGTH",
      persistenceUnitName: "Units.FT",
    });
    const customParams = getCustomFormattedNumberParams(description);
    await IModelApp.quantityFormatter.addFormattingSpecsToRegistry({
      name: "Test.LENGTH",
      persistenceUnitName: "Units.FT",
      formatProps: {
        type: "Decimal",
        precision: 2,
        formatTraits: ["keepSingleZero", "showUnitLabel"],
        uomSeparator: " ",
        composite: { includeZero: true, units: [{ name: "Units.FT", label: "ft" }] },
      },
    });

    const formatted = customParams.formatFunction(2);
    expect(formatted).not.toBe("2");
    expect(formatted).toContain("ft");
  });

  it("falls back when formatting and parsing specs are unavailable", () => {
    const description = createAngleDescription({ kindOfQuantityName: "Missing.ANGLE" });
    const customParams = getCustomFormattedNumberParams(description);

    expect(customParams.formatFunction(42)).toBe("42");
    expect(customParams.parseFunction("42").parseError).toBe(IModelApp.localization.getLocalizedString("iModelJs:Properties.UnableToParseAngle"));
  });

  it("registers the helper default KoQs in the formatter registry", async () => {
    await IModelApp.quantityFormatter.addFormattingSpecsToRegistry({
      name: "DefaultToolsUnits.LENGTH",
      persistenceUnitName: getDefaultPersistenceUnit(Phenomena.LENGTH),
    });
    await IModelApp.quantityFormatter.addFormattingSpecsToRegistry({
      name: "CivilUnits.LENGTH",
      persistenceUnitName: getDefaultPersistenceUnit(Phenomena.LENGTH),
    });
    await IModelApp.quantityFormatter.addFormattingSpecsToRegistry({
      name: "AecUnits.LENGTH",
      persistenceUnitName: getDefaultPersistenceUnit(Phenomena.LENGTH),
    });
    await IModelApp.quantityFormatter.addFormattingSpecsToRegistry({
      name: "DefaultToolsUnits.ANGLE",
      persistenceUnitName: getDefaultPersistenceUnit(Phenomena.ANGLE),
    });

    expect(IModelApp.quantityFormatter.getSpecsByNameAndUnit({ name: "DefaultToolsUnits.LENGTH", persistenceUnitName: getDefaultPersistenceUnit(Phenomena.LENGTH) })).toBeDefined();
    expect(IModelApp.quantityFormatter.getSpecsByNameAndUnit({ name: "CivilUnits.LENGTH", persistenceUnitName: getDefaultPersistenceUnit(Phenomena.LENGTH) })).toBeDefined();
    expect(IModelApp.quantityFormatter.getSpecsByNameAndUnit({ name: "AecUnits.LENGTH", persistenceUnitName: getDefaultPersistenceUnit(Phenomena.LENGTH) })).toBeDefined();
    expect(IModelApp.quantityFormatter.getSpecsByNameAndUnit({ name: "DefaultToolsUnits.ANGLE", persistenceUnitName: getDefaultPersistenceUnit(Phenomena.ANGLE) })).toBeDefined();
  });
});
