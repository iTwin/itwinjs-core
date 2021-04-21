/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
import { BadUnit, BasicUnit, UnitConversion, UnitExtraData, UnitProps, UnitsProvider } from "@bentley/imodeljs-quantity";
import { SchemaContext, Unit, UnitConverter, UnitProvider } from "@bentley/ecschema-metadata";

/** Units provider to be used in place of BasicUnitsProvider
 * @internal
 */
export class NewUnitsProvider implements UnitsProvider {
  constructor(private readonly _context: SchemaContext, private _unitExtraData: UnitExtraData[] = []) {}

  /** Create UnitProps from Unit */
  public getUnitPropsFromUnit(unit: Unit): UnitProps {
    const unitQuery = new UnitProvider(this._context, this._unitExtraData);
    return new BasicUnit(unit.fullName, unit.label ?? "", unit.phenomenon?.fullName ?? "", unitQuery.getAlternateDisplayLabels(unit.fullName), unit.unitSystem?.fullName);
  }

  /** Find a Unit by display label or alternate display label */
  public async findUnit(unitLabel: string, schemaName?: string, phenomenon?: string, unitSystem?: string): Promise<UnitProps> {
    const unitProvider = new UnitProvider(this._context, this._unitExtraData);
    try {
      const unit = await unitProvider.findUnit(unitLabel, schemaName, phenomenon, unitSystem);
      return this.getUnitPropsFromUnit(unit);
    } catch (err) {
      return new BadUnit();
    }
  }

  /** Find all units given phenomenon */
  public async getUnitsByFamily(phenomenon: string): Promise<UnitProps[]> {
    const unitProvider = new UnitProvider(this._context, this._unitExtraData);
    try {
      const units = await unitProvider.findUnitsByPhenomenon(phenomenon);
      return units.map((unit) => this.getUnitPropsFromUnit(unit));
    } catch (err) {
      return [];
    }
  }

  /** Find a unit given the unit's unique name. */
  public async findUnitByName(unitName: string): Promise<UnitProps> {
    const unitProvider = new UnitProvider(this._context, this._unitExtraData);
    try {
      const unit = await unitProvider.findUnitByName(unitName);
      return this.getUnitPropsFromUnit(unit);
    } catch (err) {
      return new BadUnit();
    }
  }

  /** Return the information needed to convert a value between two different units.  The units should be from the same phenomenon. */
  public async getConversion(fromUnit: UnitProps, toUnit: UnitProps): Promise<ConversionData> {
    const converter = new UnitConverter(this._context);
    try {
      const conversionData = await converter.calculateConversion(fromUnit.name, toUnit.name);
      return new ConversionData(false, conversionData.factor, conversionData.offset);
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
