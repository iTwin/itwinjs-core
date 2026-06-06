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
 * @deprecated in 5.9.0. See the [quantity formatting learning docs](../../docs/quantity-formatting/usage/ParsingAndFormatting.md) for how to build a plain `PropertyDescription` with `CustomFormattedNumberParams` backed by a [FormatSpecHandle]($quantity).
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
 * @deprecated in 5.9.0. See the [quantity formatting learning docs](../../docs/quantity-formatting/usage/ParsingAndFormatting.md) for how to build a plain `PropertyDescription` with `CustomFormattedNumberParams` backed by a [FormatSpecHandle]($quantity).
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
 * @deprecated in 5.9.0. See the [quantity formatting learning docs](../../docs/quantity-formatting/usage/ParsingAndFormatting.md) for how to build a plain `PropertyDescription` with `CustomFormattedNumberParams` backed by a [FormatSpecHandle]($quantity).
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
