/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/

import { Logger } from "@bentley/bentleyjs-core";
import { CustomQuantityTypeEntry, IModelApp, UnitSystemKey } from "@bentley/imodeljs-frontend";
import {
  Format, FormatProps, FormatterSpec, Parser, ParseResult, ParserSpec, UnitConversion, UnitConversionSpec, UnitProps, UnitsProvider,
} from "@bentley/imodeljs-quantity";

const defaultBearingFormat: FormatProps = {
  composite: {
    includeZero: true,
    spacer: "",
    units: [{ label: "°", name: "Units.ARC_DEG" }, { label: "'", name: "Units.ARC_MINUTE" }, { label: "\"", name: "Units.ARC_SECOND" }],
  },
  formatTraits: ["showUnitLabel"],
  precision: 0,
  type: "Decimal",
  uomSeparator: "",
};

class BearingFormatterSpec extends FormatterSpec {
  constructor(name: string, format: Format, conversions: UnitConversionSpec[], persistenceUnit: UnitProps) {
    super(name, format, conversions, persistenceUnit);
  }

  public applyFormatting(magnitude: number): string {
    // quadrant suffixes and prefixes
    const prefix=["N", "S", "S", "N"];
    const suffix=["E", "E", "W", "W"];

    // magnitude is assumed to be Azimuth angle
    const isNegative = magnitude < 0;
    const positiveRad = Math.abs(magnitude);
    const maxRad = Math.PI*2;
    let adjustedRad = (positiveRad + maxRad)%maxRad;
    if (isNegative)
      adjustedRad = maxRad - adjustedRad;

    let radToFormat = adjustedRad;
    let quadrant = 1;
    if (adjustedRad > Math.PI/2 && adjustedRad <= Math.PI){
      radToFormat = Math.PI - adjustedRad;
      quadrant = 2;
    }else if (adjustedRad > Math.PI && adjustedRad <= (3*Math.PI/2)){
      radToFormat = adjustedRad - Math.PI;
      quadrant = 3;
    } else if (adjustedRad > (3*Math.PI/2) && adjustedRad < (2*Math.PI)) {
      radToFormat = (2*Math.PI)-adjustedRad;
      quadrant = 4;
    }

    const formattedValue = super.applyFormatting(radToFormat);
    return `${prefix[quadrant-1]}${formattedValue}${suffix[quadrant-1]}`;
  }

  /** Static async method to create a FormatSpec given the format and unit of the quantity that will be passed to the Formatter. The input unit will
   * be used to generate conversion information for each unit specified in the Format. This method is async due to the fact that the units provider must make
   * async calls to lookup unit definitions.
   *  @param name     The name of a format specification.
   *  @param unitsProvider The units provider is used to look up unit definitions and provide conversion information for converting between units.
   *  @param inputUnit The unit the value to be formatted. This unit is often referred to as persistence unit.
   */
  public static async create(name: string, format: Format, unitsProvider: UnitsProvider, inputUnit?: UnitProps): Promise<FormatterSpec> {
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

    return new BearingFormatterSpec(name, format, conversions, persistenceUnit);
  }
}

class BearingParserSpec extends ParserSpec {
  constructor(outUnit: UnitProps, format: Format, conversions: UnitConversionSpec[]) {
    super(outUnit, format, conversions);
  }

  public parseToQuantityValue(inString: string): ParseResult {
    return Parser.parseToQuantityValue(inString, this.format, this.unitConversions);
  }

  /** Static async method to create a ParserSpec given the format and unit of the quantity that will be passed to the Parser. The input unit will
   * be used to generate conversion information for each unit specified in the Format. This method is async due to the fact that the units provider must make
   * async calls to lookup unit definitions.
   *  @param format     The format specification.
   *  @param unitsProvider The units provider is used to look up unit definitions and provide conversion information for converting between units.
   *  @param outUnit The unit the value to be formatted. This unit is often referred to as persistence unit.
   */
  public static async create(format: Format, unitsProvider: UnitsProvider, outUnit: UnitProps): Promise<ParserSpec> {
    const conversions = await Parser.createUnitConversionSpecsForUnit(unitsProvider, outUnit);
    return new BearingParserSpec(outUnit, format, conversions);
  }

}

export class BearingQuantityType implements CustomQuantityTypeEntry {
  private  _key = "BearingQuantityType";
  private _type = "Bearing";
  private _persistenceUnitName = "Units.RAD";
  private _persistenceUnit: UnitProps|undefined;
  private _labelKey = "SampleApp:BearingQuantityType.label";
  private _descriptionKey = "SampleApp:BearingQuantityType.description";
  private _label: string|undefined;
  private _description: string|undefined;
  private _formatProps = defaultBearingFormat;

  public get key(): string { return this._key; }
  public get type(): string { return this._type; }

  public get formatProps(): FormatProps { return this._formatProps; }
  public set formatProps(value: FormatProps) { this._formatProps = value; }

  public get persistenceUnit(): UnitProps {
    if (this._persistenceUnit)
      return this._persistenceUnit;
    throw new Error (`_persistenceUnit is not set, did you call BearingQuantityType.registerQuantityType?`);
  }

  public get label(): string {
    if (!this._label)
      this._label = IModelApp.i18n.translate(this._labelKey);
    return this._label;
  }

  public get description(): string {
    if (!this._description)
      this._description = IModelApp.i18n.translate(this._descriptionKey);
    return this._description;
  }

  public generateFormatterSpec = async (formatProps: FormatProps, unitsProvider: UnitsProvider) => {
    const format = new Format("Bearing");
    await format.fromJSON(unitsProvider, formatProps);
    return BearingFormatterSpec.create(format.name, format, unitsProvider, this.persistenceUnit);
  };

  public generateParserSpec = async (formatProps: FormatProps, unitsProvider: UnitsProvider) => {
    const format = new Format("Bearing");
    await format.fromJSON(unitsProvider, formatProps);
    return BearingParserSpec.create(format, unitsProvider, this.persistenceUnit);
  };

  // Bearing is not unit system specific so no need to check that here
  public getFormatPropsBySystem = (_requestedSystem: UnitSystemKey) => {
    return this.formatProps;
  };

  public static async registerQuantityType(initialProps?: FormatProps) {
    const quantityTypeEntry = new BearingQuantityType();
    if (initialProps)
      quantityTypeEntry.formatProps = initialProps;
    quantityTypeEntry._persistenceUnit = await IModelApp.quantityFormatter.findUnitByName(quantityTypeEntry._persistenceUnitName);
    if (!IModelApp.quantityFormatter.registerQuantityType (quantityTypeEntry)) {
      Logger.logInfo("BearingQuantityType",
        `Unable to register QuantityType [BearingQuantityType] with key '${quantityTypeEntry.key}'`);
    }
  }
}
