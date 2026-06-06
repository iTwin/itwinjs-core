/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
/** @packageDocumentation
 * @module Properties
 */

import { getDefaultPersistenceUnit, Phenomena } from "@itwin/core-quantity";
import type { PropertyDescription } from "@itwin/appui-abstract";
import { IModelApp } from "../IModelApp";
import { QuantityType } from "../quantity-formatting/QuantityFormatter";
import { FormattedQuantityDescription, type QuantityDescriptionOptions } from "./FormattedQuantityDescription";
import { createQuantityDescription } from "./internal/QuantityDescriptionHelpers";

/** Create an angle property description.
 * @beta
 */
export function createAngleDescription(options: QuantityDescriptionOptions = {}): PropertyDescription {
  return createQuantityDescription({
    name: options.name ?? "angle",
    displayLabel: options.displayLabel ?? IModelApp.localization.getLocalizedString("iModelJs:Properties.Angle"),
    kindOfQuantityName: options.kindOfQuantityName ?? "DefaultToolsUnits.ANGLE",
    persistenceUnitName: options.persistenceUnitName ?? getDefaultPersistenceUnit(Phenomena.ANGLE),
    iconSpec: options.iconSpec,
    parseError: IModelApp.localization.getLocalizedString("iModelJs:Properties.UnableToParseAngle"),
  });
}

/**
 * Angle Property Description
 * @deprecated Use `createAngleDescription` instead.
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
