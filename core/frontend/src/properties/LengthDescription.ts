/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
/** @packageDocumentation
 * @module Properties
 */

import { IModelApp } from "../IModelApp";
import { QuantityType } from "../quantity-formatting/QuantityFormatter";
import { FormattedQuantityDescription } from "./FormattedQuantityDescription";

/**
 * Length Property Description
 * @beta
 */
export class LengthDescription extends FormattedQuantityDescription {
  constructor(name?: string, displayLabel?: string, iconSpec?: string, kindOfQuantityName?: string) {
    const defaultName = "length";
    super({
      name: name ? name : defaultName,
      displayLabel: displayLabel ? displayLabel : IModelApp.localization.getLocalizedString("iModelJs:Properties.Length"),
      kindOfQuantityName: kindOfQuantityName ? kindOfQuantityName : "DefaultToolsUnits.LENGTH",
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
 * @beta
 */
export class SurveyLengthDescription extends FormattedQuantityDescription {
  constructor(name?: string, displayLabel?: string, iconSpec?: string, kindOfQuantityName?: string) {
    const defaultName = "surveyLength";
    super({
      name: name ? name : defaultName,
      displayLabel: displayLabel ? displayLabel : IModelApp.localization.getLocalizedString("iModelJs:Properties.Length"),
      kindOfQuantityName: kindOfQuantityName ? kindOfQuantityName : "CivilUnits.LENGTH",
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
 * @beta
 */
export class EngineeringLengthDescription extends FormattedQuantityDescription {

  constructor(name?: string, displayLabel?: string, iconSpec?: string, kindOfQuantityName?: string) {
    const defaultName = "engineeringLength";
    super({
      name: name ? name : defaultName,
      displayLabel: displayLabel ? displayLabel : IModelApp.localization.getLocalizedString("iModelJs:Properties.Length"),
      kindOfQuantityName: kindOfQuantityName ? kindOfQuantityName : "AecUnits.LENGTH",
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
