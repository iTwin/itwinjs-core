/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
/** @packageDocumentation
 * @module Properties
 */

import { getDefaultPersistenceUnit, Phenomena } from "@itwin/core-quantity";
import type { PropertyDescription } from "@itwin/appui-abstract";
import { IModelApp } from "../IModelApp";
import { QuantityType } from "../quantity-formatting/QuantityFormatter";
import { FormattedQuantityDescription, type QuantityDescriptionOptions } from "./FormattedQuantityDescription";
import { createQuantityDescription } from "./internal/QuantityDescriptionHelpers";

/** Create a length property description.
 * @beta
 */
export function createLengthDescription(options: QuantityDescriptionOptions = {}): PropertyDescription {
  return createQuantityDescription({
    name: options.name ?? "length",
    displayLabel: options.displayLabel ?? IModelApp.localization.getLocalizedString("iModelJs:Properties.Length"),
    kindOfQuantityName: options.kindOfQuantityName ?? "DefaultToolsUnits.LENGTH",
    persistenceUnitName: options.persistenceUnitName ?? getDefaultPersistenceUnit(Phenomena.LENGTH),
    iconSpec: options.iconSpec,
    parseError: IModelApp.localization.getLocalizedString("iModelJs:Properties.UnableToParseLength"),
  });
}

/** Create a survey length property description.
 * @beta
 */
export function createSurveyLengthDescription(options: QuantityDescriptionOptions = {}): PropertyDescription {
  const useDefaultQuantity = undefined === options.kindOfQuantityName && undefined === options.persistenceUnitName;
  return createQuantityDescription({
    name: options.name ?? "surveyLength",
    displayLabel: options.displayLabel ?? IModelApp.localization.getLocalizedString("iModelJs:Properties.Length"),
    kindOfQuantityName: options.kindOfQuantityName ?? "CivilUnits.LENGTH",
    persistenceUnitName: options.persistenceUnitName ?? getDefaultPersistenceUnit(Phenomena.LENGTH),
    iconSpec: options.iconSpec,
    parseError: IModelApp.localization.getLocalizedString("iModelJs:Properties.UnableToParseLength"),
    quantityType: useDefaultQuantity ? QuantityType.LengthSurvey : undefined,
  });
}

/** Create an engineering length property description.
 * @beta
 */
export function createEngineeringLengthDescription(options: QuantityDescriptionOptions = {}): PropertyDescription {
  return createQuantityDescription({
    name: options.name ?? "engineeringLength",
    displayLabel: options.displayLabel ?? IModelApp.localization.getLocalizedString("iModelJs:Properties.Length"),
    kindOfQuantityName: options.kindOfQuantityName ?? "AecUnits.LENGTH",
    persistenceUnitName: options.persistenceUnitName ?? getDefaultPersistenceUnit(Phenomena.LENGTH),
    iconSpec: options.iconSpec,
    parseError: IModelApp.localization.getLocalizedString("iModelJs:Properties.UnableToParseLength"),
  });
}

/**
 * Length Property Description
 * @deprecated Use `createLengthDescription` instead.
 * @beta
 */
// eslint-disable-next-line @typescript-eslint/no-deprecated
export class LengthDescription extends FormattedQuantityDescription {
  constructor(name?: string, displayLabel?: string, iconSpec?: string, kindOfQuantityName?: string) {
    const defaultName = "length";
    // eslint-disable-next-line @typescript-eslint/no-deprecated
    super({
      name: name ?? defaultName,
      displayLabel: displayLabel ?? IModelApp.localization.getLocalizedString("iModelJs:Properties.Length"),
      kindOfQuantityName: kindOfQuantityName ?? "DefaultToolsUnits.LENGTH",
      iconSpec,
    });
  }

  public get formatterQuantityType(): QuantityType { return QuantityType.Length; }
  /**
   * @deprecated in 5.0 - will not be removed until after 2026-06-13. Use the `kindOfQuantityName` property instead.
   */
  public get quantityType(): string { return "Length"; }

  public get parseError(): string { return IModelApp.localization.getLocalizedString("iModelJs:Properties.UnableToParseLength"); }
}

/**
 * Survey Length Property Description
 * @deprecated Use `createSurveyLengthDescription` instead.
 * @beta
 */
// eslint-disable-next-line @typescript-eslint/no-deprecated
export class SurveyLengthDescription extends FormattedQuantityDescription {
  constructor(name?: string, displayLabel?: string, iconSpec?: string, kindOfQuantityName?: string) {
    const defaultName = "surveyLength";
    // eslint-disable-next-line @typescript-eslint/no-deprecated
    super({
      name: name ?? defaultName,
      displayLabel: displayLabel ?? IModelApp.localization.getLocalizedString("iModelJs:Properties.Length"),
      kindOfQuantityName: kindOfQuantityName ?? "CivilUnits.LENGTH",
      iconSpec,
    });
  }

  public get formatterQuantityType(): QuantityType { return QuantityType.LengthSurvey; }
  /**
   * @deprecated in 5.0 - will not be removed until after 2026-06-13. Use the `kindOfQuantityName` property instead.
   */
  public get quantityType(): string { return "LengthSurvey"; }

  public get parseError(): string { return IModelApp.localization.getLocalizedString("iModelJs:Properties.UnableToParseLength"); }
}

/**
 * Engineering Length Property Description
 * @deprecated Use `createEngineeringLengthDescription` instead.
 * @beta
 */
// eslint-disable-next-line @typescript-eslint/no-deprecated
export class EngineeringLengthDescription extends FormattedQuantityDescription {

  constructor(name?: string, displayLabel?: string, iconSpec?: string, kindOfQuantityName?: string) {
    const defaultName = "engineeringLength";
    // eslint-disable-next-line @typescript-eslint/no-deprecated
    super({
      name: name ?? defaultName,
      displayLabel: displayLabel ?? IModelApp.localization.getLocalizedString("iModelJs:Properties.Length"),
      kindOfQuantityName: kindOfQuantityName ?? "AecUnits.LENGTH",
      iconSpec,
    });
  }

  public get formatterQuantityType(): QuantityType { return QuantityType.LengthEngineering; }
  /**
   * @deprecated in 5.0 - will not be removed until after 2026-06-13. Use the `kindOfQuantityName` property instead.
   */
  public get quantityType(): string { return "LengthEngineering"; }

  public get parseError(): string { return IModelApp.localization.getLocalizedString("iModelJs:Properties.UnableToParseLength"); }
}
