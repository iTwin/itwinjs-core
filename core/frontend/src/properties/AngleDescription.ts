/*---------------------------------------------------------------------------------------------
* Copyright (c) 2019 Bentley Systems, Incorporated. All rights reserved.
* Licensed under the MIT License. See LICENSE.md in the project root for license terms.
*--------------------------------------------------------------------------------------------*/
/** @module Properties */

import { IModelApp, QuantityType } from "../imodeljs-frontend";
import { BaseQuantityDescription } from "./BaseQuantityDescription";

/**
 * Angle Property Description
 * @beta
 */
export class AngleDescription extends BaseQuantityDescription {
  private static _defaultName = "angle";

  constructor(name?: string, displayLabel?: string, iconSpec?: string) {
    super(
      name ? name : AngleDescription._defaultName,
      displayLabel ? displayLabel : IModelApp.i18n.translate("iModelJs:Properties.Angle"),
      iconSpec,
    );
  }

  public get quantityType(): QuantityType { return QuantityType.Angle; }

  public get parseError(): string { return IModelApp.i18n.translate("iModelJs:Properties.UnableToParseAngle"); }
}
