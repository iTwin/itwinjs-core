/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
import { Format, LazyLoadedInvertedUnit, LazyLoadedUnit } from "@itwin/ecschema-metadata";
import { FormatTraits, FormatType, ScientificType, ShowSignOption } from "@itwin/core-quantity";

/**
 * @internal
 * An abstract class used for schema editing.
 */
export abstract class MutableFormat extends Format {
  public abstract override addUnit(unit: LazyLoadedUnit | LazyLoadedInvertedUnit, label?: string): void;
  public abstract override setPrecision(precision: number): void;
  public abstract override setFormatType(formatType: FormatType): void;
  public abstract override setRoundFactor(roundFactor: number): void;
  public abstract override setShowSignOption(signOption: ShowSignOption): void;
  public abstract override setDecimalSeparator(separator: string): void;
  public abstract override setThousandSeparator(separator: string): void;
  public abstract override setUomSeparator(separator: string): void;
  public abstract override setStationSeparator(separator: string): void;
  public abstract override setMinWidth(minWidth: number): void;
  public abstract override setStationOffsetSize(stationOffsetSize: number): void;
  public abstract override setScientificType(scientificType: ScientificType): void;
  public abstract override setSpacer(spacer: string): void;
  public abstract override setIncludeZero(includeZero: boolean): void;
  public abstract override setFormatTraits(formatTraits: FormatTraits): void;
  public abstract override setUnits(units: Array<[LazyLoadedUnit | LazyLoadedInvertedUnit, string | undefined]>): void;
  public abstract override setDisplayLabel(displayLabel: string): void;
}
