/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
import { BentleyError, BentleyStatus } from "@itwin/core-bentley";
import { BadUnit, UnitConversionInvert, UnitConversionProps, UnitExtraData, UnitProps, UnitsProvider } from "@itwin/core-quantity";
import { ISchemaLocater, SchemaContext } from "../Context";
import { SchemaItem } from "../Metadata/SchemaItem";
import { SchemaItemKey, SchemaKey } from "../SchemaKey";
import { Unit } from "../Metadata/Unit";
import { SchemaItemType } from "../ECObjects";
import { UnitConverter } from "../UnitConversion/UnitConverter";
import { InvertedUnit } from "../Metadata/InvertedUnit";

/**
 * Class used to find Units in SchemaContext by attributes such as Phenomenon and DisplayLabel.
 * @beta
 */
export class SchemaUnitProvider implements UnitsProvider {
  private _unitConverter: UnitConverter;
  private _context: SchemaContext;

  /**
   *
   * @param contextOrLocater The SchemaContext or a different ISchemaLocater implementation used to retrieve the schema. The SchemaContext
   * class implements the ISchemaLocater interface. If the provided locater is not a SchemaContext instance a new SchemaContext will be
   * created and the locater will be added.
   * @param _unitExtraData Additional data like alternate display label not found in Units Schema to match with Units; Defaults to empty array.
   */
  constructor(contextOrLocater: ISchemaLocater, private _unitExtraData: UnitExtraData[] = []) {
    if (contextOrLocater instanceof SchemaContext) {
      this._context = contextOrLocater;
    } else {
      this._context = new SchemaContext();
      this._context.addLocater(contextOrLocater);
    }
    this._unitConverter = new UnitConverter(this._context);
  }

  /**
   * Find unit in a schema that has unitName.
   * @param unitName Full name of unit.
   * @returns UnitProps interface from @itwin/core-quantity whose name matches unitName.
   */
  public async findUnitByName(unitName: string): Promise<UnitProps> {
    // Check if schema exists and unit exists in schema
    const [schemaName, schemaItemName] = SchemaItem.parseFullName(unitName);
    const schemaKey = new SchemaKey(schemaName);
    const schema = await this._context.getSchema(schemaKey);

    if (!schema) {
      return new BadUnit(); // return BadUnit if schema does not exist
    }

    const itemKey = new SchemaItemKey(schemaItemName, schema.schemaKey);
    const unit = await this._context.getSchemaItem(itemKey, Unit);
    if (unit && unit.schemaItemType === SchemaItemType.Unit)
      return this.getUnitsProps(unit);

    const invertedUnit = await this._context.getSchemaItem(itemKey, InvertedUnit);
    if (invertedUnit && invertedUnit.schemaItemType === SchemaItemType.InvertedUnit) {
      return this.getUnitsProps(invertedUnit);
    }

    return new BadUnit();
  }

  /**
   * Find all units in context that belongs to given phenomenon.
   * @param phenomenon Full name of phenomenon.
   * @returns Array of UnitProps (from @itwin/core-quantity) interface objects whose name matches phenomenon param.
   */
  public async getUnitsByFamily(phenomenon: string): Promise<Array<UnitProps>> {
    // Check if schema exists and phenomenon exists in schema
    const [schemaName, schemaItemName] = SchemaItem.parseFullName(phenomenon);
    const schemaKey = new SchemaKey(schemaName);
    const schema = await this._context.getSchema(schemaKey);

    if (!schema) {
      throw new BentleyError(BentleyStatus.ERROR, "Cannot find schema for phenomenon", () => {
        return { phenomenon, schema: schemaName };
      });
    }

    const itemKey = new SchemaItemKey(schemaItemName, schema.schemaKey);
    const phenom = await this._context.getSchemaItem(itemKey);
    if (!phenom)
      throw new BentleyError(BentleyStatus.ERROR, "Cannot find schema item/phenomenon", () => {
        return { item: schemaItemName, schema: schemaName };
      });

    if (phenom.schemaItemType !== SchemaItemType.Phenomenon)
      throw new BentleyError(BentleyStatus.ERROR, "Item is not a phenomenon", () => {
        return { itemType: phenom.key.fullName };
      });

    // Find units' full name that match given phenomenon param.
    const filteredUnits: Array<UnitProps> = [];
    const schemaItems = this._context.getSchemaItems();
    for (const value of schemaItems) {
      if (Unit.isUnit(value)) {
        const foundPhenomenon = await value.phenomenon;
        if (foundPhenomenon && foundPhenomenon.key.matchesFullName(phenomenon)) {
          const unitProps = await this.getUnitsProps(value);
          filteredUnits.push(unitProps);
        }
      } else if (InvertedUnit.isInvertedUnit(value) && value.invertsUnit) {
        const invertsUnit = await value.invertsUnit;
        if (invertsUnit) {
          const foundPhenomenon = await invertsUnit.phenomenon;
          if (foundPhenomenon && foundPhenomenon.key.matchesFullName(phenomenon)) {
            const unitProps = await this.getUnitsProps(value);
            filteredUnits.push(unitProps);
          }
        }
      }
    }

    return filteredUnits;
  }

  /**
   * Find alternate display labels associated with unitName, if any.
   * @param unitName Full name of Unit.
   */
  public getAlternateDisplayLabels(unitName: string): Array<string> {
    let alternateLabels: Array<string> = [];
    for (const entry of this._unitExtraData) {
      if (entry.name.toLowerCase() === unitName.toLowerCase()) {
        alternateLabels = entry.altDisplayLabels;
      }
    }

    return alternateLabels;
  }

  /**
   * Finds Unit by unitLabel, which could be a display label in the schema or alternate an display label defined in
   * this._unitExtraData. If there are duplicates of the same display label in the context or teh same alternate display
   * labels, specify schemaName, phenomenon, or unitSystem to get a specific unit.
   *
   * @param unitLabel Display label or alternate display label to query unit by.
   * @param schemaName Ensure Unit with unitLabel belongs to Schema with schemaName.
   * @param phenomenon Full name of phenomenon that Unit belongs to.
   * @param unitSystem Full name of unitSystem that Unit belongs to.
   * @returns The UnitProps interface from the @itwin/core-quantity package.
   */
  public async findUnit(unitLabel: string, schemaName?: string, phenomenon?: string, unitSystem?: string): Promise<UnitProps> {
    const findLabel = unitLabel.toLowerCase();
    const findSchema = schemaName ? schemaName.toLowerCase() : undefined;
    const findPhenomenon = phenomenon ? phenomenon.toLowerCase() : undefined;
    const findUnitSystem = unitSystem ? unitSystem.toLowerCase() : undefined;

    const foundUnit: UnitProps = await this.findUnitByDisplayLabel(findLabel, findSchema, findPhenomenon, findUnitSystem);
    if (foundUnit.isValid)
      return foundUnit;

    // If there is no Unit with display label that matches label, then check for alternate display labels that may match
    return this.findUnitByAltDisplayLabel(findLabel, findSchema, findPhenomenon, findUnitSystem);
  }

  /**
   * Gets the @itwin/core-quantity UnitConversionProps for the given fromUnit and toUnit.
   * @param fromUnit The UnitProps of the 'from' unit.
   * @param toUnit The UnitProps of the 'to' unit.
   * @returns The UnitConversionProps interface from the @itwin/core-quantity package.
   */
  public async getConversion(fromUnit: UnitProps, toUnit: UnitProps): Promise<UnitConversionProps> {
    // need to check if either side is an inverted unit. The UnitConverter can only handle Units
    if (!fromUnit.isValid || !toUnit.isValid)
      throw new BentleyError(BentleyStatus.ERROR, "Both provided units must be valid.", () => {
        return { fromUnit, toUnit };
      });

    const { unitName: fromUnitName, isInverted: fromIsInverted } = await this.checkUnitPropsForConversion(fromUnit, this._context);
    const { unitName: toUnitName, isInverted: toIsInverted } = await this.checkUnitPropsForConversion(toUnit, this._context);

    const conversion = await this._unitConverter.calculateConversion(fromUnitName, toUnitName);
    const result: UnitConversionProps = {
      factor: conversion.factor,
      offset: conversion.offset,
    };
    if (fromIsInverted && !toIsInverted)
      result.inversion = UnitConversionInvert.InvertPreConversion;
    else if (!fromIsInverted && toIsInverted)
      result.inversion = UnitConversionInvert.InvertPostConversion;

    return result;
  }

  private async checkUnitPropsForConversion(input: UnitProps, context: SchemaContext): Promise<{ unitName: string, isInverted: boolean }> {
    const [schemaName, schemaItemName] = SchemaItem.parseFullName(input.name);
    const schemaKey = new SchemaKey(schemaName);
    const schema = await context.getSchema(schemaKey);

    if (!schema) {
      throw new BentleyError(BentleyStatus.ERROR, "Could not obtain schema for unit.", () => {
        return { name: input.name };
      });
    }

    const itemKey = new SchemaItemKey(schemaItemName, schema.schemaKey);
    const invertedUnit = await context.getSchemaItem(itemKey, InvertedUnit);
    // Check if we found an item, the item is an inverted unit, and it has its invertsUnit property set
    if (invertedUnit && InvertedUnit.isInvertedUnit(invertedUnit) && invertedUnit.invertsUnit) {
      return { unitName: invertedUnit.invertsUnit.fullName, isInverted: true };
    }

    return { unitName: input.name, isInverted: false };
  }

  /**
   * Gets the @itwin/core UnitProps for the given Unit.
   * @param unit The Unit to convert.
   * @returns UnitProps interface from @itwin/core.
   */
  private async getUnitsProps(unit: Unit | InvertedUnit): Promise<UnitProps> {
    if (Unit.isUnit(unit)) {
      return {
        name: unit.fullName,
        label: unit.label ?? "",
        phenomenon: unit.phenomenon ? unit.phenomenon.fullName : "",
        isValid: true,
        system: unit.unitSystem === undefined ? "" : unit.unitSystem.fullName,
      };
    }

    const invertsUnit = await unit.invertsUnit;
    if (!invertsUnit)
      return new BadUnit();

    return {
      name: unit.fullName,
      label: unit.label ?? "",
      phenomenon: invertsUnit.phenomenon ? invertsUnit.phenomenon.fullName : "",
      isValid: true,
      system: unit.unitSystem === undefined ? "" : unit.unitSystem.fullName,
    };
  }

  /**
   * Finds Unit by displayLabel and that it belongs to schemaName, phenomenon, and unitSystem if defined.
   * @internal
   */
  private async findUnitByDisplayLabel(displayLabel: string, schemaName?: string, phenomenon?: string, unitSystem?: string): Promise<UnitProps> {
    // TODO: Known bug: This only looks through loaded schemas. If schema name is provided, we can attempt to load that schema
    const schemaItems = this._context.getSchemaItems();
    for (const value of schemaItems) {
      if (Unit.isUnit(value) && value.label?.toLowerCase() === displayLabel) {
        // TODO: this can be optimized. We don't have to await these if we don't want to check for them
        const currPhenomenon = await value.phenomenon;
        const currUnitSystem = await value.unitSystem;
        if (!schemaName || value.schema.name.toLowerCase() === schemaName)
          if (!phenomenon || (currPhenomenon && currPhenomenon.key.matchesFullName(phenomenon)))
            if (!unitSystem || (currUnitSystem && currUnitSystem.key.matchesFullName(unitSystem)))
              return this.getUnitsProps(value);
      } else if (InvertedUnit.isInvertedUnit(value) && value.label?.toLowerCase() === displayLabel && value.invertsUnit) {
        const invertsUnit = await value.invertsUnit;
        if (invertsUnit) {
          const currPhenomenon = await invertsUnit.phenomenon;
          const currUnitSystem = await invertsUnit.unitSystem;
          if (!schemaName || value.schema.name.toLowerCase() === schemaName)
            if (!phenomenon || (currPhenomenon && currPhenomenon.key.matchesFullName(phenomenon)))
              if (!unitSystem || (currUnitSystem && currUnitSystem.key.matchesFullName(unitSystem)))
                return this.getUnitsProps(value);
        }
      }
    }

    return new BadUnit();
  }

  /**
   * Finds Unit by altDisplayLabel and that it belongs to schemaName, phenomenon, and unitSystem if defined.
   * @internal
   */
  private async findUnitByAltDisplayLabel(altDisplayLabel: string, schemaName?: string, phenomenon?: string, unitSystem?: string): Promise<UnitProps> {
    for (const entry of this._unitExtraData) {
      if (entry.altDisplayLabels && entry.altDisplayLabels.length > 0) {
        if (entry.altDisplayLabels.findIndex((ref: string) => ref.toLowerCase() === altDisplayLabel) !== -1) {
          // Found altDisplayLabel that matches label to find
          const unitProps = await this.findUnitByName(entry.name);
          // If no schemaName, phenomenon, or unitSystem are provided, return unitProps
          if (!schemaName && !phenomenon && !unitSystem)
            return unitProps;

          // Check if the provided values match unitProps
          const schemaNameMatches = !schemaName || unitProps.name.toLowerCase().startsWith(schemaName);
          const phenomenonMatches = !phenomenon || unitProps.phenomenon.toLowerCase() === phenomenon;
          const unitSystemMatches = !unitSystem || unitProps.system.toLowerCase() === unitSystem;
          // If all provided values match, return unitProps
          if (schemaNameMatches && phenomenonMatches && unitSystemMatches)
            return unitProps;
        }
      }
    }
    return new BadUnit();
  }
}
