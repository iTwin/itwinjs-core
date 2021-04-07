/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
import { BadUnit, BasicUnit, UnitConversion, UnitProps, UnitsProvider  } from "@bentley/imodeljs-quantity";
// import { SchemaContext, Unit, UnitConverter, UnitProvider } from "@bentley/ecschema-metadata";
import { SchemaContext, Unit, UnitConverter, UnitProvider } from "../../../ecschema-metadata/src/ecschema-metadata";
import { UNIT_EXTRA_DATA } from "./UnitsData";

/** Units provider that provides a limited number of UnitDefinitions that are needed to support basic tools.
 * @internal
 */
export class BasicUnitsProvider implements UnitsProvider {
  constructor(private readonly _context: SchemaContext) {
    _context = new SchemaContext();
  }

  public async getUnitPropsFromUnit(unit: Unit): Promise<UnitProps> {
    const unitQuery = new UnitProvider(this._context, UNIT_EXTRA_DATA);
    try {
      await this.findUnitByName(unit.fullName);
      return new BasicUnit(unit.fullName, unit.label ?? "", unit.phenomenon?.fullName ?? "", unitQuery.getAlternateDisplayLabels(unit.fullName), unit.unitSystem?.fullName ?? "");
    } catch (err) {
      return new BasicUnit("", "", "");
    }
  }

  /** Find a unit given the unitLabel. */
  public async findUnit(unitLabel: string, phenomenon?: string, unitSystem?: string): Promise<UnitProps> {
    const unitProvider = new UnitProvider(this._context, UNIT_EXTRA_DATA);
    try {
      const unit = await unitProvider.findUnit(unitLabel, phenomenon, unitSystem);
      return await this.getUnitPropsFromUnit(unit);
    } catch (err) {
      return new BadUnit();
    }
  }

  /** Find all units given phenomenon */
  public async getUnitsByFamily(phenomenon: string): Promise<UnitProps[]> {
    const unitProvider = new UnitProvider(this._context, UNIT_EXTRA_DATA);
    try {
      const units = await unitProvider.findUnitsByPhenomenon(phenomenon);
      const unitPropsPromises = units.map(unit => this.getUnitPropsFromUnit(unit));
      return await Promise.all(unitPropsPromises);
    } catch (err) {
      return []
    }
  }

  /** Find a unit given the unit's unique name. */
  public async findUnitByName(unitName: string): Promise<UnitProps> {
    const unitProvider = new UnitProvider(this._context, UNIT_EXTRA_DATA);
    try {
      const unit = await unitProvider.findUnitByName(unitName);
      return await this.getUnitPropsFromUnit(unit);
    } catch (err) {
      return new BadUnit();
    }
  }

  /** Return the information needed to convert a value between two different units.  The units should be from the same phenomenon. */
  public async getConversion(fromUnit: UnitProps, toUnit: UnitProps): Promise<UnitConversion> {
    const converter = new UnitConverter(this._context);
    try {
      const conversionData = await converter.calculateConversion(fromUnit.name, toUnit.name);
      const conversion = new ConversionData(false);
      conversion.factor = conversionData.factor;
      conversion.offset = conversionData.offset;
      return conversion;
    } catch (err) {
      return new ConversionData(true);
    }
  }
}

/** Class that implements the minimum UnitConversion interface to provide information needed to convert unit values.
 * @alpha
 */
class ConversionData implements UnitConversion {
  public factor: number = 1.0;
  public offset: number = 0.0;

  constructor(public error: boolean) {}
}
