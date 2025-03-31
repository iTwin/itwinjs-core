/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
/** @packageDocumentation
 * @module Metadata
 */

import { SchemaItemType } from "../ECObjects";
import { ECObjectsError, ECObjectsStatus } from "../Exception";
import { SchemaItem } from "./SchemaItem";

/**
 * @public @preview
 */
export class UnitSystem extends SchemaItem {
  public override readonly schemaItemType = UnitSystem.schemaItemType;
  public static override get schemaItemType() { return SchemaItemType.UnitSystem; }

  /**
   * Type guard to check if the SchemaItem is of type UnitSystem.
   * @param item The SchemaItem to check.
   * @returns True if the item is a UnitSystem, false otherwise.
   */
  public static isUnitSystem(item?: SchemaItem): item is UnitSystem {
    if (item && item.schemaItemType === SchemaItemType.UnitSystem)
      return true;

    return false;
  }

  /**
   * Type assertion to check if the SchemaItem is of type UnitSystem.
   * @param item The SchemaItem to check.
   * @returns The item cast to UnitSystem if it is a UnitSystem, undefined otherwise.
   */
  public static assertIsUnitSystem(item?: SchemaItem): asserts item is UnitSystem {
    if (!this.isUnitSystem(item))
      throw new ECObjectsError(ECObjectsStatus.InvalidSchemaItemType, `Expected '${SchemaItemType.UnitSystem}' (UnitSystem)`);
  }
}

/**
 * @internal
 * Used for schema editing.
 */
export abstract class MutableUnitSystem extends UnitSystem {
  public abstract override setDisplayLabel(displayLabel: string): void;
}
