/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
/** @packageDocumentation
 * @module Metadata
 */

import { XmlSerializationUtils } from "../Deserialization/XmlSerializationUtils";
import { SchemaItemType } from "../ECObjects";
import { DecimalPrecision, FormatProps, formatStringRgx, FormatTraits, FormatType, FractionalPrecision, ScientificType, ShowSignOption } from "@itwin/core-quantity";
import { Format } from "./Format";
import { InvertedUnit } from "./InvertedUnit";
import { Schema } from "./Schema";
import { SchemaItemOverrideFormatProps } from "../Deserialization/JsonProps";
import { Unit } from "./Unit";
import { Mutable } from "@itwin/core-bentley";
import { ECObjectsError, ECObjectsStatus } from "../Exception";

/**
 * @beta
 */
export interface OverrideFormatProps {
  name: string;
  precision?: number;
  unitAndLabels?: Array<[string, string | undefined]>; // Tuple of [unit name | unit label]
}

/**
 * Overrides of a Format, from a Schema, and is SchemaItem that is used specifically on KindOfQuantity.
 * @beta
 */
export class OverrideFormat {
  private _precision?: DecimalPrecision | FractionalPrecision;
  private _units?: Array<[Unit | InvertedUnit, string | undefined]>;

  /** The Format that this OverrideFormat is extending */
  public readonly parent: Format;

  /** The name of this OverrideFormat.
   *
   * This should be set to the [FormatString]($docs/bis/ec/kindofquantity/#format-string) which represents the format override.
   */
  public readonly name: string;

  constructor(parent: Format, precision?: DecimalPrecision | FractionalPrecision, unitAndLabels?: Array<[Unit | InvertedUnit, string | undefined]>) {
    this.parent = parent;
    this.name = OverrideFormat.createOverrideFormatFullName(parent, precision, unitAndLabels);
    this._precision = precision;
    this._units = unitAndLabels;
  }

  // Properties that can be overriden
  public get precision(): DecimalPrecision | FractionalPrecision { return (undefined === this._precision) ? this.parent.precision : this._precision; }
  public get units() { return (undefined === this._units) ? this.parent.units : this._units; }

  // Properties that cannot be overriden
  public get fullName(): string { return this.name; }
  public get roundFactor(): number { return this.parent.roundFactor; }
  public get type(): FormatType { return this.parent.type; }
  public get minWidth(): number | undefined { return this.parent.minWidth; }
  public get scientificType(): ScientificType | undefined { return this.parent.scientificType; }
  public get showSignOption(): ShowSignOption { return this.parent.showSignOption; }
  public get decimalSeparator(): string { return this.parent.decimalSeparator; }
  public get thousandSeparator(): string { return this.parent.thousandSeparator; }
  public get uomSeparator(): string { return this.parent.uomSeparator; }
  public get stationSeparator(): string { return this.parent.stationSeparator; }
  public get stationOffsetSize(): number | undefined { return this.parent.stationOffsetSize; }
  public get formatTraits(): FormatTraits { return this.parent.formatTraits; }
  public get spacer(): string | undefined { return this.parent.spacer; }
  public get includeZero(): boolean | undefined { return this.parent.includeZero; }

  public hasFormatTrait(formatTrait: FormatTraits) {
    return (this.parent.formatTraits & formatTrait) === formatTrait;
  }

  /** Returns the format string of this override in the Xml full name format.
   * @alpha
   */
  public fullNameXml(koqSchema: Schema): string {
    let fullName = XmlSerializationUtils.createXmlTypedName(koqSchema, this.parent.schema, this.parent.name);

    if (undefined !== this.precision)
      fullName += `(${this.precision.toString()})`;

    if (undefined === this._units)
      return fullName;
    for (const [unit, unitLabel] of this._units) {
      fullName += "[";
      fullName += XmlSerializationUtils.createXmlTypedName(koqSchema, unit.schema, unit.name);
      if (unitLabel !== undefined)
        fullName += `|${unitLabel}`;
      fullName += `]`;
    }
    return fullName;
  }

  /**
   * Creates a valid OverrideFormat fullName from the parent Format and overridden units.
   * @param parent The parent Format.
   * @param unitAndLabels The overridden unit and labels collection.
   */
  public static createOverrideFormatFullName(parent: Format, precision?: DecimalPrecision | FractionalPrecision, unitAndLabels?: Array<[Unit | InvertedUnit, string | undefined]>): string {
    let fullName = parent.fullName;

    if (precision)
      fullName += `(${precision.toString()})`;

    if (undefined === unitAndLabels)
      return fullName;
    for (const [unit, unitLabel] of unitAndLabels)
      if (undefined === unitLabel)
        fullName += `[${unit.fullName}]`;
      else
        fullName += `[${unit.fullName}|${unitLabel}]`;
    return fullName;
  }

  /** Parses the format string into the parts that make up an Override Format
   * @param formatString
   */
  public static parseFormatString(formatString: string): OverrideFormatProps {
    const match = formatString.split(formatStringRgx); // split string based on regex groups
    if (undefined === match[1])
      throw new ECObjectsError(ECObjectsStatus.InvalidECJson, `The format string, ${formatString}, on KindOfQuantity is missing a format.`);

    const returnValue: OverrideFormatProps = { name: match[1] };

    if (undefined !== match[2] && undefined !== match[3]) {
      const overrideString = match[2];
      const tokens: string[] = [];
      let prevPos = 1; // Initial position is the character directly after the opening '(' in the override string.
      let currPos;

      // TODO need to include `,` as a valid search argument.
      while (-1 !== (currPos = overrideString.indexOf(")", prevPos))) { // eslint-disable-line
        tokens.push(overrideString.substring(prevPos, currPos));
        prevPos = currPos + 1;
      }

      if (overrideString.length > 0 && undefined === tokens.find((token) => {
        return "" !== token; // there is at least one token that is not empty.
      })) {
        throw new ECObjectsError(ECObjectsStatus.InvalidECJson, ``);
      }

      // The first override parameter overrides the default precision of the format
      const precisionIndx: number = 0;

      if (tokens.length >= precisionIndx + 1) {
        if (tokens[precisionIndx].length > 0) {
          const precision = Number.parseInt(tokens[precisionIndx], 10);
          if (Number.isNaN(precision))
            throw new ECObjectsError(ECObjectsStatus.InvalidECJson, `The format string '${formatString}' on KindOfQuantity has a precision override '${tokens[precisionIndx]}' that is not number.`);
          returnValue.precision = precision;
        }
      }
    }

    let i = 4;
    while (i < match.length - 1) {  // The regex match ends with an empty last value, which causes problems when exactly 4 unit overrides as specified, so ignore this last empty value
      if (undefined === match[i])
        break;
      // Unit override required
      if (undefined === match[i + 1])
        throw new ECObjectsError(ECObjectsStatus.InvalidECJson, ``);

      if (undefined === returnValue.unitAndLabels)
        returnValue.unitAndLabels = [];

      if (undefined !== match[i + 2]) // matches '|'
        returnValue.unitAndLabels.push([match[i + 1], match[i + 3] ?? ""]); // add unit name and label override (if '|' matches and next value is undefined, save it as an empty string)
      else
        returnValue.unitAndLabels.push([match[i + 1], undefined]); // add unit name

      i += 4;
    }

    return returnValue;
  }

  /**
   * @internal
   */
  public static isOverrideFormat(object: any): object is OverrideFormat {
    const overrideFormat = object as OverrideFormat;

    return overrideFormat !== undefined && overrideFormat.name !== undefined && overrideFormat.parent !== undefined && overrideFormat.parent.schemaItemType === SchemaItemType.Format;
  }

  /**
   * Returns a JSON object that contains the specification for the OverrideFormat where the precision and units properties have been overriden.
   * If the precision and/or units properties have been overriden, the returned object will contain a "name" and a "parent" property.
   * The "name" property identifies the OverrideFormat object itself and the "parent" property identifies the Format that has been overriden.
   * This method is not intended for complete serialization as it does not serialize any of the schema item properties.
   */
  public getFormatProps(): SchemaItemOverrideFormatProps {
    const formatJson = this.parent.toJSON() as Mutable<SchemaItemOverrideFormatProps>;

    if (this.parent.fullName !== this.fullName) {
      // Update name and parent properties to distinguish it from parent Format
      formatJson.name = this.fullName;
      formatJson.parent = this.parent.fullName;
    }

    // Update Precision overriden property
    formatJson.precision = this.precision;

    if (this.units !== undefined) {
      // Update Units overriden property
      const units = [];
      for (const unit of this.units) {
        units.push({
          name: unit[0].fullName,
          label: unit[1],
        });
      }

      formatJson.composite = {
        spacer: (this.spacer !== " ") ? this.spacer : undefined,
        includeZero: (this.includeZero === false) ? this.includeZero : undefined,
        units,
      };
    }

    return formatJson;
  }
}

/**
 * @internal
 */
export function getFormatProps(format: Format | OverrideFormat): FormatProps {
  return OverrideFormat.isOverrideFormat(format) ? format.getFormatProps() : format.toJSON();
}
