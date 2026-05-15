/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
import { Format, KindOfQuantity, LazyLoadedFormat, LazyLoadedInvertedUnit, LazyLoadedUnit, OverrideFormat } from "@itwin/ecschema-metadata";

/**
 * @internal
 * An abstract class used for schema editing.
 */
export abstract class MutableKindOfQuantity extends KindOfQuantity {
  public abstract override addPresentationFormat(format: LazyLoadedFormat | OverrideFormat, isDefault: boolean): void;
  public abstract override createFormatOverride(parent: Format, precision?: number, unitLabelOverrides?: Array<[LazyLoadedUnit | LazyLoadedInvertedUnit, string | undefined]>): OverrideFormat;
  public abstract override setDisplayLabel(displayLabel: string): void;
  public abstract override setDescription(description: string): void;
  public abstract override setPersistenceUnit(value: LazyLoadedUnit | LazyLoadedInvertedUnit | undefined): void;
  public abstract override setRelativeError(relativeError: number): void;
}
