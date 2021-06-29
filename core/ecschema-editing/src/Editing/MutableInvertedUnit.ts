/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
import { InvertedUnit, LazyLoadedUnit, LazyLoadedUnitSystem } from "@bentley/ecschema-metadata";

/**
 * @internal
 * An abstract class used for schema editing.
 */
export abstract class MutableInvertedUnit extends InvertedUnit {
  public abstract setInvertsUnit(invertsUnit: LazyLoadedUnit): void;
  public abstract setUnitSystem(unitSystem: LazyLoadedUnitSystem): void;
  public abstract setDisplayLabel(displayLabel: string): void;
}
