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
  constructor(name?: string, displayLabel?: string, iconSpec?: string) {
    const defaultName = "length";
    super(
      name ? name : defaultName,
      displayLabel ? displayLabel : IModelApp.i18n.translate("iModelJs:Properties.Length"),
      iconSpec,
    );
  }

  public get formatterQuantityType(): QuantityType { return QuantityType.Length; }
  public get quantityType(): string { return "Length"; }

  public get parseError(): string { return IModelApp.i18n.translate("iModelJs:Properties.UnableToParseLength"); }
}

/**
 * Survey Length Property Description
 * @beta
 */
export class SurveyLengthDescription extends FormattedQuantityDescription {
  constructor(name?: string, displayLabel?: string, iconSpec?: string) {
    const defaultName = "surveyLength";
    super(
      name ? name : defaultName,
      displayLabel ? displayLabel : IModelApp.i18n.translate("iModelJs:Properties.Length"),
      iconSpec,
    );
  }

  public get formatterQuantityType(): QuantityType { return QuantityType.LengthSurvey; }
  public get quantityType(): string { return "LengthSurvey"; }

  public get parseError(): string { return IModelApp.i18n.translate("iModelJs:Properties.UnableToParseLength"); }
}

/**
 * Engineering Length Property Description
 * @beta
 */
export class EngineeringLengthDescription extends FormattedQuantityDescription {

  constructor(name?: string, displayLabel?: string, iconSpec?: string) {
    const defaultName = "engineeringLength";
    super(
      name ? name : defaultName,
      displayLabel ? displayLabel : IModelApp.i18n.translate("iModelJs:Properties.Length"),
      iconSpec,
    );
  }

  public get formatterQuantityType(): QuantityType { return QuantityType.LengthEngineering; }
  public get quantityType(): string { return "LengthEngineering"; }

  public get parseError(): string { return IModelApp.i18n.translate("iModelJs:Properties.UnableToParseLength"); }
}
