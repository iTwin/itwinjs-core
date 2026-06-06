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
 * Angle Property Description
 * @deprecated in 5.9.0. See the [quantity formatting learning docs](../../docs/quantity-formatting/usage/ParsingAndFormatting.md) for how to build a plain `PropertyDescription` with `CustomFormattedNumberParams` backed by a [FormatSpecHandle]($quantity).
 * @beta
 */
// eslint-disable-next-line @typescript-eslint/no-deprecated
export class AngleDescription extends FormattedQuantityDescription {
  constructor(name?: string, displayLabel?: string, iconSpec?: string, kindOfQuantityName?: string) {
    const defaultName = "angle";
    // eslint-disable-next-line @typescript-eslint/no-deprecated
    super({
      name: name ?? defaultName,
      displayLabel: displayLabel ?? IModelApp.localization.getLocalizedString("iModelJs:Properties.Angle"),
      kindOfQuantityName: kindOfQuantityName ?? "DefaultToolsUnits.ANGLE",
      iconSpec,
    });
  }

  public get formatterQuantityType(): QuantityType { return QuantityType.Angle; }
  /**
   * @deprecated in 5.0 - will not be removed until after 2026-06-13. Use the `kindOfQuantityName` property instead.
   */
  public get quantityType(): string { return "Angle"; }

  public get parseError(): string { return IModelApp.localization.getLocalizedString("iModelJs:Properties.UnableToParseAngle"); }
}
