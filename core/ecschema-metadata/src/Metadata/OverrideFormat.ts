/*---------------------------------------------------------------------------------------------
|  $Copyright: (c) 2018 Bentley Systems, Incorporated. All rights reserved. $
*--------------------------------------------------------------------------------------------*/
import Format, { IFormat } from "./Format";
import Unit from "./Unit";
import InvertedUnit from "./InvertedUnit";
import { DecimalPrecision, FractionalPrecision, ScientificType, ShowSignOption, FormatTraits, FormatType } from "../utils/FormatEnums";

/**
 * Overrides of a Format, from a Schema, and is SchemaItem that is used specifically on KindOfQuantity.
 */
export default class OverrideFormat implements IFormat {
  private _precision?: DecimalPrecision | FractionalPrecision;
  private _units?: Array<[Unit | InvertedUnit, string | undefined]>;

  /** The Format that this OverrideFormat is extending */
  public readonly parent: Format;

  /** The name of this OverrideFormat.
   *
   * This should be set to the FormatString which represents the format override.
   */
  public readonly name: string;

  constructor(parent: Format, name: string, precision?: DecimalPrecision | FractionalPrecision, unitAndLabels?: Array<[Unit | InvertedUnit, string | undefined]>) {
    this.parent = parent;
    this.name = name;
    this._precision = precision;
    this._units = unitAndLabels;
  }

  // Properties that can be overriden
  get precision(): DecimalPrecision | FractionalPrecision { return (undefined === this._precision) ? this.parent.precision : this._precision; }
  get units() { return (undefined === this._units) ? this.parent.units : this._units; }

  // Properties that cannot be overriden
  get roundFactor(): number { return this.parent.roundFactor; }
  get type(): FormatType { return this.parent.type; }
  get minWidth(): number | undefined { return this.parent.minWidth; }
  get scientificType(): ScientificType | undefined { return this.parent.scientificType; }
  get showSignOption(): ShowSignOption { return this.parent.showSignOption; }
  get decimalSeparator(): string { return this.parent.decimalSeparator; }
  get thousandSeparator(): string { return this.parent.thousandSeparator; }
  get uomSeparator(): string { return this.parent.uomSeparator; }
  get stationSeparator(): string { return this.parent.stationSeparator; }
  get stationOffsetSize(): number | undefined { return this.parent.stationOffsetSize; }
  get formatTraits(): FormatTraits { return this.parent.formatTraits; }
  get spacer(): string | undefined { return this.parent.spacer; }
  get includeZero(): boolean | undefined { return this.parent.includeZero; }

  public hasFormatTrait(formatTrait: FormatTraits) {
    return (this.parent.formatTraits & formatTrait) === formatTrait;
  }
}
