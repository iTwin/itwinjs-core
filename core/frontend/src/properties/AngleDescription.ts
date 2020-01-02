/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* Licensed under the MIT License. See LICENSE.md in the project root for license terms.
*--------------------------------------------------------------------------------------------*/
/** @module Properties */

import { IModelApp } from "../IModelApp";
import { QuantityType } from "../QuantityFormatter";
import { BaseQuantityDescription } from "./BaseQuantityDescription";

/**
 * Angle Property Description
 * @beta
 */
export class AngleDescription extends BaseQuantityDescription {
  constructor(name?: string, displayLabel?: string, iconSpec?: string) {
    const defaultName = "angle";
    super(
      name ? name : defaultName,
      displayLabel ? displayLabel : IModelApp.i18n.translate("iModelJs:Properties.Angle"),
      iconSpec,
    );
  }

  public get quantityType(): QuantityType { return QuantityType.Angle; }

  public get parseError(): string { return IModelApp.i18n.translate("iModelJs:Properties.UnableToParseAngle"); }
}
