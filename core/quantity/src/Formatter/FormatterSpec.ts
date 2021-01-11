/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
import { UnitConversion, UnitConversionSpec, UnitProps, UnitsProvider } from "../Interfaces";
import { Format } from "./Format";
import { Formatter } from "./Formatter";

// cSpell:ignore ZERONORMALIZED, nosign, onlynegative, signalways, negativeparentheses
// cSpell:ignore trailzeroes, keepsinglezero, zeroempty, keepdecimalpoint, applyrounding, fractiondash, showunitlabel, prependunitlabel, exponentonlynegative

/** A class that contains both formatting information and the conversion factors necessary to convert from an input unit to the units specified in the format.
 * @alpha
 */
export class FormatterSpec {
  protected _name: string;
  protected _conversions: UnitConversionSpec[] = [];  // max four entries
  protected _format: Format;

  /** Constructor
   *  @param name     The name of a format specification.
   *  @param format   Defines the output format for the quantity value.
   *  @param conversions An array of conversion factors necessary to convert from an input unit to the units specified in the format..
   */
  constructor(name: string, format: Format, conversions?: UnitConversionSpec[]) {
    this._name = name;
    this._format = format;
    if (conversions) this._conversions = conversions;
  }

  public get name(): string { return this._name; }
  /** Returns an array of UnitConversionSpecs, one for each unit that is to be shown in the formatted quantity string. */
  public get unitConversions(): UnitConversionSpec[] { return this._conversions; }
  public get format(): Format { return this._format; }

  /** Static async method to create a FormatSpec given the format and unit of the quantity that will be passed to the Formatter. The input unit will
   * be used to generate conversion information for each unit specified in the Format. This method is async due to the fact that the units provider must make
   * async calls to lookup unit definitions.
   *  @param name     The name of a format specification.
   *  @param unitsProvider The units provider is used to look up unit definitions and provide conversion information for converting between units.
   *  @param inputUnit The unit the value to be formatted. This unit is often referred to as persistence unit.
   */
  public static async create(name: string, format: Format, unitsProvider: UnitsProvider, inputUnit?: UnitProps): Promise<FormatterSpec> {
    const conversions: UnitConversionSpec[] = [];

    if (format.units) {
      let convertFromUnit = inputUnit;
      for (const unit of format.units) {
        let unitConversion: UnitConversion;
        if (convertFromUnit) {
          unitConversion = await unitsProvider.getConversion(convertFromUnit, unit[0]);
        } else {
          unitConversion = ({ factor: 1.0, offset: 0.0 }) as UnitConversion;
        }
        const unitLabel = (unit[1] && unit[1]!.length > 0) ? unit[1]! : unit[0].label;
        const spec = ({ name: unit[0].name, label: unitLabel, conversion: unitConversion }) as UnitConversionSpec;

        conversions.push(spec);
        convertFromUnit = unit[0];
      }
    } else {
      // if format is only numeric and a input unit is defined set spec to use the input unit as the format unit
      if (inputUnit) {
        const spec: UnitConversionSpec = { name: inputUnit.name, label: inputUnit.label, conversion: { factor: 1.0, offset: 0.0 } };
        conversions.push(spec);
      }
    }

    return new FormatterSpec(name, format, conversions);
  }

  /** Format a quantity value. */
  public applyFormatting(magnitude: number): string {
    return Formatter.formatQuantity(magnitude, this);
  }
}
