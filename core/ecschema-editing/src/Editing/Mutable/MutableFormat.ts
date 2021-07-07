/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
import { Format, FormatType, InvertedUnit, ShowSignOption, Unit } from "@bentley/ecschema-metadata";

/**
 * @internal
 * An abstract class used for schema editing.
 */
export abstract class MutableFormat extends Format {
  public abstract addUnit(unit: Unit | InvertedUnit, label?: string): void;
  public abstract setPrecision(precision: number): void;
  public abstract setFormatType(formatType: FormatType): void;
  public abstract setRoundFactor(roundFactor: number): void;
  public abstract setShowSignOption(signOption: ShowSignOption): void;
  public abstract setDecimalSeparator(separator: string): void;
  public abstract setThousandSeparator(separator: string): void;
  public abstract setUomSeparator(separator: string): void;
  public abstract setStationSeparator(separator: string): void;
  public abstract setDisplayLabel(displayLabel: string): void;
}
