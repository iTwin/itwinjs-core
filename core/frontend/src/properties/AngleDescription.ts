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
 * @deprecated in 5.11.0 - will not be removed until after 2027-07-03. This appui-based quantity description API is deprecated. Use [createQuantityDescription]($frontend) to build a plain [PropertyDescription]($appui-abstract) with synchronous quantity formatting callbacks backed by [IModelApp.quantityFormatter]($frontend).
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
   * @deprecated in 5.0 - might be removed in next major version. Use the `kindOfQuantityName` property instead.
   */
  public get quantityType(): string { return "Angle"; }

  public get parseError(): string { return IModelApp.localization.getLocalizedString("iModelJs:Properties.UnableToParseAngle"); }
}
