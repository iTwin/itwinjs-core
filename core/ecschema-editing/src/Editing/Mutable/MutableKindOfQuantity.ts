/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
import { Format, InvertedUnit, KindOfQuantity, LazyLoadedInvertedUnit, LazyLoadedUnit, OverrideFormat, Unit } from "@itwin/ecschema-metadata";

/**
 * @internal
 * An abstract class used for schema editing.
 */
export abstract class MutableKindOfQuantity extends KindOfQuantity {
  public abstract override addPresentationFormat(format: Format | OverrideFormat, isDefault: boolean): void;
  public abstract override createFormatOverride(parent: Format, precision?: number, unitLabelOverrides?: Array<[Unit | InvertedUnit, string | undefined]>): OverrideFormat;
  public abstract override setDisplayLabel(displayLabel: string): void;
  public abstract override setDescription(description: string): void;
  public abstract override setRelativeError(relativeError: number): void;
  public abstract override set persistenceUnit(value: LazyLoadedUnit | LazyLoadedInvertedUnit | undefined);
}
