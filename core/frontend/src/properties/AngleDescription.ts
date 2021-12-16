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
 * @beta
 */
export class AngleDescription extends FormattedQuantityDescription {
  constructor(name?: string, displayLabel?: string, iconSpec?: string) {
    const defaultName = "angle";
    super(
      name ? name : defaultName,
      displayLabel ? displayLabel : IModelApp.localization.getLocalizedString("iModelJs:Properties.Angle"),
      iconSpec,
    );
  }

  public get formatterQuantityType(): QuantityType { return QuantityType.Angle; }
  public get quantityType(): string { return "Angle"; }

  public get parseError(): string { return IModelApp.localization.getLocalizedString("iModelJs:Properties.UnableToParseAngle"); }
}
