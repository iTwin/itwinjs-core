/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
import { BadUnit, BasicUnit, UnitConversion, UnitExtraData, UnitProps, UnitsProvider } from "@bentley/imodeljs-quantity";
import { SchemaContext, Unit, UnitConverter, UnitProvider } from "@bentley/ecschema-metadata";

/** Units provider that provides a limited number of UnitDefinitions that are needed to support basic tools.
 * @internal
 */
export class NewUnitsProvider implements UnitsProvider {
  constructor(private readonly _context: SchemaContext, private _unitExtraData: UnitExtraData[] = []) {}

  public async getUnitPropsFromUnit(unit: Unit): Promise<UnitProps> {
    const unitQuery = new UnitProvider(this._context, this._unitExtraData);
    try {
      return new BasicUnit(unit.fullName, unit.label ?? "", unit.phenomenon?.fullName ?? "", unitQuery.getAlternateDisplayLabels(unit.fullName), unit.unitSystem?.fullName ?? "");
    } catch (err) {
      return new BasicUnit("", "", "");
    }
  }

  /** Find a unit given the unitLabel. */
  public async findUnit(unitLabel: string, schemaName?: string, phenomenon?: string, unitSystem?: string): Promise<UnitProps> {
    const unitProvider = new UnitProvider(this._context, this._unitExtraData);
    try {
      const unit = await unitProvider.findUnit(unitLabel, schemaName, phenomenon, unitSystem);
      return await this.getUnitPropsFromUnit(unit);
    } catch (err) {
      return new BadUnit();
    }
  }

  /** Find all units given phenomenon */
  public async getUnitsByFamily(phenomenon: string): Promise<UnitProps[]> {
    const unitProvider = new UnitProvider(this._context, this._unitExtraData);
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
    const unitProvider = new UnitProvider(this._context, this._unitExtraData);
    try {
      const unit = await unitProvider.findUnitByName(unitName);
      return await this.getUnitPropsFromUnit(unit);
    } catch (err) {
      return new BadUnit();
    }
  }

  /** Return the information needed to convert a value between two different units.  The units should be from the same phenomenon. */
  public async getConversion(fromUnit: UnitProps, toUnit: UnitProps): Promise<ConversionData> {
    const converter = new UnitConverter(this._context);
    try {
      const conversionData = await converter.calculateConversion(fromUnit.name, toUnit.name);
      const conversion = new ConversionData(false, conversionData.factor, conversionData.offset);
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
export class ConversionData implements UnitConversion {
  constructor(public error: boolean, public factor = 1, public offset = 0) {}
}
