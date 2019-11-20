/*---------------------------------------------------------------------------------------------
* Copyright (c) 2019 Bentley Systems, Incorporated. All rights reserved.
* Licensed under the MIT License. See LICENSE.md in the project root for license terms.
*--------------------------------------------------------------------------------------------*/
/** @module Properties */

import { IModelApp, QuantityType } from "../imodeljs-frontend";
import { BaseQuantityDescription } from "./BaseQuantityDescription";

/**
 * Length Property Description
 * @beta
 */
export class LengthDescription extends BaseQuantityDescription {
  private static _defaultName = "length";

  constructor(name?: string, displayLabel?: string, iconSpec?: string) {
    super(
      name ? name : LengthDescription._defaultName,
      displayLabel ? displayLabel : IModelApp.i18n.translate("iModelJs:Properties.Length"),
      iconSpec,
    );
  }

  public get quantityType(): QuantityType { return QuantityType.Length; }

  public get parseError(): string { return IModelApp.i18n.translate("iModelJs:Properties.UnableToParseLength"); }
}
