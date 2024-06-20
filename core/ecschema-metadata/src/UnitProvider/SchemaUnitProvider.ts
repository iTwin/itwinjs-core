/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
import { BentleyError, BentleyStatus } from "@itwin/core-bentley";
import { UnitConversionProps, UnitExtraData, UnitProps, UnitsProvider } from "@itwin/core-quantity";
import { ISchemaLocater, SchemaContext } from "../Context";
import { SchemaItem } from "../Metadata/SchemaItem";
import { SchemaItemKey, SchemaKey } from "../SchemaKey";
import { Unit } from "../Metadata/Unit";
import { SchemaItemType } from "../ECObjects";
import { UnitConverter } from "../UnitConversion/UnitConverter";

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
  constructor(contextOrLocater: ISchemaLocater, private _unitExtraData: UnitExtraData[] = []){
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
    const unit = await this.findECUnitByName(unitName);
    return this.getUnitsProps(unit);
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
    let { value, done } = schemaItems.next();
    while (!done) {
      if (Unit.isUnit(value)) {
        const foundPhenomenon = await value.phenomenon;
        if (foundPhenomenon && foundPhenomenon.key.matchesFullName(phenomenon)) {
          const unitProps = this.getUnitsProps(value);
          filteredUnits.push(unitProps);
        }
      }
      ({ value, done } = schemaItems.next());
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
    let foundUnit: Unit | undefined;

    try {
      try {
        foundUnit = await this.findUnitByDisplayLabel(findLabel, findSchema, findPhenomenon, findUnitSystem);
      } catch (err) {
        // If there is no Unit with display label that matches label, then check for alternate display labels that may match
        foundUnit = await this.findUnitByAltDisplayLabel(findLabel, findSchema, findPhenomenon, findUnitSystem);
      }
    } catch (err) {
      throw new BentleyError(BentleyStatus.ERROR, "Cannot find unit with label", () => {
        return { unitLabel };
      });
    }

    return this.getUnitsProps(foundUnit);
  }

  /**
   * Gets the @itwin/core-quantity UnitConversionProps for the given fromUnit and toUnit.
   * @param fromUnit The UnitProps of the 'from' unit.
   * @param toUnit The UnitProps of the 'to' unit.
   * @returns The UnitConversionProps interface from the @itwin/core-quantity package.
   */
  public async getConversion(fromUnit: UnitProps, toUnit: UnitProps): Promise<UnitConversionProps> {
    const conversion = await this._unitConverter.calculateConversion(fromUnit.name, toUnit.name);
    return {
      factor: conversion.factor,
      offset: conversion.offset,
    };
  }

  /**
   * Find unit in a schema that has unitName.
   * @param unitName Full name of unit.
   * @returns Unit whose full name matches unitName.
   */
  private async findECUnitByName(unitName: string): Promise<Unit> {
    // Check if schema exists and unit exists in schema
    const [schemaName, schemaItemName] = SchemaItem.parseFullName(unitName);
    const schemaKey = new SchemaKey(schemaName);
    const schema = await this._context.getSchema(schemaKey);

    if (!schema) {
      throw new BentleyError(BentleyStatus.ERROR, "Cannot find schema for unit", () => {
        return { schema: schemaName, unit: unitName };
      });
    }

    const itemKey = new SchemaItemKey(schemaItemName, schema.schemaKey);
    const item = await this._context.getSchemaItem<Unit>(itemKey);
    if (!item)
      throw new BentleyError(BentleyStatus.ERROR, "Cannot find schema item/unit", () => {
        return { item: schemaItemName, schema: schemaName };
      });

    if (item.schemaItemType === SchemaItemType.Unit)
      return item;

    throw new BentleyError(BentleyStatus.ERROR, "Item is not a unit", () => {
      return { itemType: item.key.fullName };
    });
  }

  /**
   * Gets the @itwin/core UnitProps for the given Unit.
   * @param unit The Unit to convert.
   * @returns UnitProps interface from @itwin/core.
   */
  private getUnitsProps(unit: Unit): UnitProps {
    return {
      name: unit.fullName,
      label: unit.label ?? "",
      phenomenon: unit.phenomenon ? unit.phenomenon.fullName : "",
      isValid: true,
      system: unit.unitSystem === undefined ? "" : unit.unitSystem.fullName,
    };
  }

  /**
   * Finds Unit by displayLabel and that it belongs to schemaName, phenomenon, and unitSystem if defined.
   * @internal
   */
  private async findUnitByDisplayLabel(displayLabel: string, schemaName?: string, phenomenon?: string, unitSystem?: string): Promise<Unit> {
    const schemaItems = this._context.getSchemaItems();
    let { value, done } = schemaItems.next();
    while (!done) {
      if (Unit.isUnit(value) && value.label?.toLowerCase() === displayLabel) {
        const currPhenomenon = await value.phenomenon;
        const currUnitSystem = await value.unitSystem;
        if (!schemaName || value.schema.name.toLowerCase() === schemaName)
          if (!phenomenon || (currPhenomenon && currPhenomenon.key.matchesFullName(phenomenon)))
            if (!unitSystem || (currUnitSystem && currUnitSystem.key.matchesFullName(unitSystem)))
              return value;
      }
      ({ value, done } = schemaItems.next());
    }

    throw new BentleyError(BentleyStatus.ERROR, "Cannot find unit with display label", () => {
      return { displayLabel };
    });
  }

  /**
   * Finds Unit by altDisplayLabel and that it belongs to schemaName, phenomenon, and unitSystem if defined.
   * @internal
   */
  private async findUnitByAltDisplayLabel(altDisplayLabel: string, schemaName?: string, phenomenon?: string, unitSystem?: string): Promise<Unit> {
    for (const entry of this._unitExtraData) {
      if (entry.altDisplayLabels && entry.altDisplayLabels.length > 0) {
        if (entry.altDisplayLabels.findIndex((ref: string) => ref.toLowerCase() === altDisplayLabel) !== -1) {
          // Found altDisplayLabel that matches label to find
          const unit = await this.findECUnitByName(entry.name);
          const foundPhenomenon = await unit.phenomenon;
          const foundUnitSystem = await unit.unitSystem;
          if (!schemaName || unit.schema.name.toLowerCase() === schemaName)
            if (!phenomenon || (foundPhenomenon && foundPhenomenon.key.matchesFullName(phenomenon)))
              if (!unitSystem || (foundUnitSystem && foundUnitSystem.key.matchesFullName(unitSystem)))
                return unit;
        }
      }
    }

    throw new BentleyError(BentleyStatus.ERROR, "Cannot find unit with alternate display label", () => {
      return { altDisplayLabel };
    });
  }
}
