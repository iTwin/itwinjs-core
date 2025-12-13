/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
/** @packageDocumentation
 * @module Quantity
 */

import { UnitConversionProps, UnitConversionSpec, UnitProps, UnitsProvider } from "../Interfaces";
import { Format } from "./Format";
import { FormatType } from "./FormatEnums";
import { Formatter } from "./Formatter";

// cSpell:ignore ZERONORMALIZED, nosign, onlynegative, signalways, negativeparentheses
// cSpell:ignore trailzeroes, keepsinglezero, zeroempty, keepdecimalpoint, applyrounding, fractiondash, showunitlabel, prependunitlabel, exponentonlynegative

/** A class that contains both formatting information and the conversion factors necessary to convert from an input unit to the units specified in the format.
 * Once created the FormatterSpec will be able to format quantity values with synchronous calls.
 * @beta
 */
export class FormatterSpec {
  protected _name: string;
  protected _conversions: UnitConversionSpec[] = [];  // max four entries
  protected _format: Format;
  protected _persistenceUnit: UnitProps;
  protected _azimuthBaseConversion?: UnitConversionProps; // converts azimuth base unit to persistence unit
  protected _revolutionConversion?: UnitConversionProps; // converts revolution unit to persistence unit

  /** Constructor
   *  @param name     The name of a format specification.
   *  @param format   Defines the output format for the quantity value.
   *  @param conversions An array of conversion factors necessary to convert from an input unit to the units specified in the format.
   *  @param persistenceUnit The unit the magnitude value is input.
   *  @param azimuthBaseConversion The conversion used to interpret azimuth base values.
   *  @param revolutionConversion The conversion used to determine a revolution value (used for bearing and azimuth).
   */
  constructor(name: string, format: Format, conversions?: UnitConversionSpec[], persistenceUnit?: UnitProps, azimuthBaseConversion?: UnitConversionProps, revolutionConversion?: UnitConversionProps) {
    if (!persistenceUnit) {
      if (format.units) {
        const [props] = format.units[0];
        persistenceUnit = props;
      } else {
        throw new Error("Formatter Spec needs persistence unit to be specified");
      }
    }

    this._name = name;
    this._format = format;
    this._persistenceUnit = persistenceUnit;
    if (conversions)
      this._conversions = conversions;
    this._azimuthBaseConversion = azimuthBaseConversion;
    this._revolutionConversion = revolutionConversion;
  }

  public get name(): string { return this._name; }
  /** Returns an array of UnitConversionSpecs, one for each unit that is to be shown in the formatted quantity string. */
  public get unitConversions(): UnitConversionSpec[] { return this._conversions; }
  public get format(): Format { return this._format; }
  public get persistenceUnit(): UnitProps { return this._persistenceUnit; }
  public get azimuthBaseConversion(): UnitConversionProps | undefined { return this._azimuthBaseConversion; }
  public get revolutionConversion(): UnitConversionProps | undefined { return this._revolutionConversion; }

  /** Build conversion specs for ratio format with explicit numerator/denominator units. */
  private static async getRatioUnitConversions(format: Format, unitsProvider: UnitsProvider, persistenceUnit: UnitProps): Promise<UnitConversionSpec[]> {
    const conversions: UnitConversionSpec[] = [];

    // Already validated by caller that hasRatioUnits is true
    // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
    const [numeratorUnit, numeratorLabel] = format.ratioUnits![0];
    // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
    const [denominatorUnit, denominatorLabel] = format.ratioUnits![1];

    // Compute ratio scale: how many numerator units per denominator unit (e.g., IN:FT = 12)
    const denominatorToNumerator = await unitsProvider.getConversion(denominatorUnit, numeratorUnit);
    const displayRatioScale = denominatorToNumerator.factor;

    // Avoid double-scaling: if persistence unit already encodes the display ratio, use factor 1.
    // Check by name heuristic (e.g., IN_PER_FT with ratioUnits [IN, FT] → no scaling needed)
    const persistenceName = persistenceUnit.name.toUpperCase();
    const numName = numeratorUnit.name.toUpperCase().split(".").pop() ?? "";
    const denName = denominatorUnit.name.toUpperCase().split(".").pop() ?? "";
    // Split by word boundaries (underscores, dots) and check for exact token matches
    const persistenceTokens = persistenceName.split(/[._]/);
    const isPersistenceMatchingRatio = persistenceTokens.includes(numName) && persistenceTokens.includes(denName);
    const ratioScaleFactor = isPersistenceMatchingRatio ? 1.0 : displayRatioScale;

    // First conversion spec: effective ratio unit conversion
    const ratioConversionSpec: UnitConversionSpec = {
      name: `${numeratorUnit.name}_per_${denominatorUnit.name}`,
      label: "",
      system: numeratorUnit.system,
      conversion: { factor: ratioScaleFactor, offset: 0.0 },
    };
    conversions.push(ratioConversionSpec);

    // Numerator unit for label lookup
    const numeratorSpec: UnitConversionSpec = {
      name: numeratorUnit.name,
      label: (numeratorLabel && numeratorLabel.length > 0) ? numeratorLabel : numeratorUnit.label,
      system: numeratorUnit.system,
      conversion: { factor: 1.0, offset: 0.0 },
    };
    conversions.push(numeratorSpec);

    // Denominator unit for label lookup
    const denominatorSpec: UnitConversionSpec = {
      name: denominatorUnit.name,
      label: (denominatorLabel && denominatorLabel.length > 0) ? denominatorLabel : denominatorUnit.label,
      system: denominatorUnit.system,
      conversion: { factor: 1.0, offset: 0.0 },
    };
    conversions.push(denominatorSpec);

    return conversions;
  }

  /** Get an array of UnitConversionSpecs, one for each unit that is to be shown in the formatted quantity string. */
  public static async getUnitConversions(format: Format, unitsProvider: UnitsProvider, inputUnit?: UnitProps): Promise<UnitConversionSpec[]> {
    const conversions: UnitConversionSpec[] = [];
    let persistenceUnit = inputUnit;
    if (!persistenceUnit) {
      if (format.units) {
        const [props] = format.units[0];
        persistenceUnit = props;
      } else {
        throw new Error("Formatter Spec needs persistence unit to be specified");
      }
    }

    // Handle ratioUnits for ratio formats
    if (format.type === FormatType.Ratio && format.hasRatioUnits) {
      return FormatterSpec.getRatioUnitConversions(format, unitsProvider, persistenceUnit);
    }

    if (format.units) {
      let convertFromUnit = inputUnit;
      for (const unit of format.units) {
        let unitConversion: UnitConversionProps;
        if (convertFromUnit) {
          unitConversion = await unitsProvider.getConversion(convertFromUnit, unit[0]);
        } else {
          unitConversion = { factor: 1.0, offset: 0.0 };
        }
        const unitLabel = (unit[1] && unit[1].length > 0) ? unit[1] : unit[0].label;
        const spec = ({ name: unit[0].name, label: unitLabel, conversion: unitConversion, system: unit[0].system }) as UnitConversionSpec;

        conversions.push(spec);
        convertFromUnit = unit[0];
      }
    } else {
      // if format is only numeric and a input unit is defined set spec to use the input unit as the format unit
      if (inputUnit) {
        const spec: UnitConversionSpec = { name: inputUnit.name, label: inputUnit.label, system: inputUnit.system, conversion: { factor: 1.0, offset: 0.0 } };
        conversions.push(spec);
      }
    }

    return conversions;
  }

  /** Static async method to create a FormatSpec given the format and unit of the quantity that will be passed to the Formatter. The input unit will
   * be used to generate conversion information for each unit specified in the Format. This method is async due to the fact that the units provider must make
   * async calls to lookup unit definitions.
   *  @param name     The name of a format specification.
   *  @param unitsProvider The units provider is used to look up unit definitions and provide conversion information for converting between units.
   *  @param inputUnit The unit the value to be formatted. This unit is often referred to as persistence unit.
   */
  public static async create(name: string, format: Format, unitsProvider: UnitsProvider, inputUnit?: UnitProps): Promise<FormatterSpec> {
    const conversions: UnitConversionSpec[] = await FormatterSpec.getUnitConversions(format, unitsProvider, inputUnit);
    let azimuthBaseConversion: UnitConversionProps | undefined;
    if (format.azimuthBaseUnit !== undefined) {
      if (inputUnit !== undefined) {
        azimuthBaseConversion = await unitsProvider.getConversion(format.azimuthBaseUnit, inputUnit);
      } else {
        azimuthBaseConversion = { factor: 1.0, offset: 0.0 };
      }
    }
    let revolutionConversion: UnitConversionProps | undefined;
    if (format.revolutionUnit !== undefined) {
      if (inputUnit !== undefined) {
        revolutionConversion = await unitsProvider.getConversion(format.revolutionUnit, inputUnit);
      } else {
        revolutionConversion = { factor: 1.0, offset: 0.0 };
      }
    }

    return new FormatterSpec(name, format, conversions, inputUnit, azimuthBaseConversion, revolutionConversion);
  }

  /** Format a quantity value. */
  public applyFormatting(magnitude: number): string {
    return Formatter.formatQuantity(magnitude, this);
  }
}
