/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
/** @packageDocumentation
 * @module Quantity
 */

import { Format } from "./Formatter/Format";
import { FormatType } from "./Formatter/FormatEnums";
import { AlternateUnitLabelsProvider, UnitConversionProps, UnitConversionSpec, UnitProps, UnitsProvider } from "./Interfaces";
import { Parser, QuantityParseResult } from "./Parser";

/** A ParserSpec holds information needed to parse a string into a quantity synchronously.
 * @beta
 */
export class ParserSpec {
  private _outUnit: UnitProps;
  private _conversions: UnitConversionSpec[] = [];  // max four entries
  private _format: Format;
  protected _azimuthBaseConversion?: UnitConversionProps; // converts azimuth base unit to persistence unit
  protected _revolutionConversion?: UnitConversionProps; // converts revolution unit to persistence unit

  /** Constructor
   *  @param outUnit     The name of a format specification.
   *  @param format   Defines the output format for the quantity value.
   *  @param conversions An array of conversion factors necessary to convert from an input unit to the units specified in the format..
   */
  constructor(outUnit: UnitProps, format: Format, conversions: UnitConversionSpec[]) {
    this._outUnit = outUnit;
    this._format = format;
    this._conversions = conversions;
  }

  /** Returns an array of UnitConversionSpecs for each unit label that may be used in the input string. */
  public get unitConversions(): UnitConversionSpec[] { return this._conversions; }
  public get format(): Format { return this._format; }
  public get outUnit(): UnitProps { return this._outUnit; }
  public get azimuthBaseConversion(): UnitConversionProps | undefined { return this._azimuthBaseConversion; }
  public get revolutionConversion(): UnitConversionProps | undefined { return this._revolutionConversion; }

  /** Build conversion specs for ratio format with 2 composite units (numerator/denominator). */
  private static async getRatioUnitConversions(units: ReadonlyArray<[UnitProps, string | undefined]>, unitsProvider: UnitsProvider, outUnit: UnitProps, altUnitLabelsProvider?: AlternateUnitLabelsProvider): Promise<UnitConversionSpec[]> {
    const conversions: UnitConversionSpec[] = [];

    const [numeratorUnit, numeratorLabel] = units[0];
    const [denominatorUnit, denominatorLabel] = units[1];

    // Compute ratio scale: how many numerator units per denominator unit (e.g., IN:FT = 12)
    const denominatorToNumerator = await unitsProvider.getConversion(denominatorUnit, numeratorUnit);
    const displayRatioScale = denominatorToNumerator.factor;

    // Avoid double-scaling: if persistence unit already encodes the display ratio, use factor 1.
    // Check by name heuristic (e.g., IN_PER_FT with ratioUnits [IN, FT] → no scaling needed)
    const persistenceName = outUnit.name.toUpperCase();
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
      label: numeratorLabel?.length ? numeratorLabel : numeratorUnit.label,
      system: numeratorUnit.system,
      conversion: { factor: 1.0, offset: 0.0 },
      parseLabels: altUnitLabelsProvider?.getAlternateUnitLabels(numeratorUnit),
    };
    conversions.push(numeratorSpec);

    // Denominator unit for label lookup
    const denominatorSpec: UnitConversionSpec = {
      name: denominatorUnit.name,
      label: denominatorLabel?.length ? denominatorLabel : denominatorUnit.label,
      system: denominatorUnit.system,
      conversion: { factor: 1.0, offset: 0.0 },
      parseLabels: altUnitLabelsProvider?.getAlternateUnitLabels(denominatorUnit),
    };
    conversions.push(denominatorSpec);

    return conversions;
  }

  /** Static async method to create a ParserSpec given the format and unit of the quantity that will be passed to the Parser. The input unit will
   * be used to generate conversion information for each unit specified in the Format. This method is async due to the fact that the units provider must make
   * async calls to lookup unit definitions.
   *  @param format     The format specification.
   *  @param unitsProvider The units provider is used to look up unit definitions and provide conversion information for converting between units.
   *  @param outUnit The unit a value will be formatted to. This unit is often referred to as persistence unit.
   */
  public static async create(format: Format, unitsProvider: UnitsProvider, outUnit: UnitProps, altUnitLabelsProvider?: AlternateUnitLabelsProvider): Promise<ParserSpec> {
    let conversions: UnitConversionSpec[];

    // For ratio formats with 2 composite units, use private helper method
    if (format.type === FormatType.Ratio && format.units && format.units.length === 2) {
      conversions = await ParserSpec.getRatioUnitConversions(format.units, unitsProvider, outUnit, altUnitLabelsProvider);
    } else {
      conversions = await Parser.createUnitConversionSpecsForUnit(unitsProvider, outUnit, altUnitLabelsProvider);
    }

    const spec = new ParserSpec(outUnit, format, conversions);
    if (format.azimuthBaseUnit !== undefined) {
      if (outUnit !== undefined) {
        spec._azimuthBaseConversion = await unitsProvider.getConversion(format.azimuthBaseUnit, outUnit);
      } else {
        spec._azimuthBaseConversion = { factor: 1.0, offset: 0.0 };
      }
    }
    if (format.revolutionUnit !== undefined) {
      if (outUnit !== undefined) {
        spec._revolutionConversion = await unitsProvider.getConversion(format.revolutionUnit, outUnit);
      } else {
        spec._revolutionConversion = { factor: 1.0, offset: 0.0 };
      }
    }
    return spec;
  }

  /** Do the parsing. Done this way to allow Custom Parser Specs to parse custom formatted strings into their quantities. */
  public parseToQuantityValue(inString: string): QuantityParseResult {
    return Parser.parseQuantityString(inString, this);
  }
}

