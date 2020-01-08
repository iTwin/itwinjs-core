/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
/** @module Properties */

import { IModelApp } from "../IModelApp";
import { QuantityType } from "../QuantityFormatter";
import { BaseQuantityDescription } from "./BaseQuantityDescription";

/**
 * Length Property Description
 * @beta
 */
export class LengthDescription extends BaseQuantityDescription {
  constructor(name?: string, displayLabel?: string, iconSpec?: string) {
    const defaultName = "length";
    super(
      name ? name : defaultName,
      displayLabel ? displayLabel : IModelApp.i18n.translate("iModelJs:Properties.Length"),
      iconSpec,
    );
  }

  public get quantityType(): QuantityType { return QuantityType.Length; }

  public get parseError(): string { return IModelApp.i18n.translate("iModelJs:Properties.UnableToParseLength"); }
}

/**
 * Survey Length Property Description
 * @beta
 */
export class SurveyLengthDescription extends BaseQuantityDescription {
  constructor(name?: string, displayLabel?: string, iconSpec?: string) {
    const defaultName = "surveyLength";
    super(
      name ? name : defaultName,
      displayLabel ? displayLabel : IModelApp.i18n.translate("iModelJs:Properties.Length"),
      iconSpec,
    );
  }

  public get quantityType(): QuantityType { return QuantityType.LengthSurvey; }

  public get parseError(): string { return IModelApp.i18n.translate("iModelJs:Properties.UnableToParseLength"); }
}

/**
 * Engineering Length Property Description
 * @beta
 */
export class EngineeringLengthDescription extends BaseQuantityDescription {

  constructor(name?: string, displayLabel?: string, iconSpec?: string) {
    const defaultName = "engineeringLength";
    super(
      name ? name : defaultName,
      displayLabel ? displayLabel : IModelApp.i18n.translate("iModelJs:Properties.Length"),
      iconSpec,
    );
  }

  public get quantityType(): QuantityType { return QuantityType.LengthEngineering; }

  public get parseError(): string { return IModelApp.i18n.translate("iModelJs:Properties.UnableToParseLength"); }
}
