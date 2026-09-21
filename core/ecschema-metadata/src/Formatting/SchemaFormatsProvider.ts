/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
/** @packageDocumentation
 * @module Metadata
 */

import { ISchemaLocater, SchemaContext } from "../Context";
import { SchemaItemKey, SchemaKey } from "../SchemaKey";
import { SchemaMatchType } from "../ECObjects";
import { ECSchemaError, ECSchemaStatus } from "../Exception";
import { SchemaItem } from "../Metadata/SchemaItem";
import { Format } from "../Metadata/Format";
import { getFormatProps, OverrideFormat } from "../Metadata/OverrideFormat";
import { SchemaItemFormatProps } from "../Deserialization/JsonProps";
import { BeEvent, Logger } from "@itwin/core-bentley";
import { KindOfQuantity } from "../Metadata/KindOfQuantity";
import { FormatDefinition, FormatProps, FormatsChangedArgs, FormatsProvider, SyncFormatsProvider, UnitSystemKey } from "@itwin/core-quantity";
import { type LazyLoadedFormat, type LazyLoadedInvertedUnit, type LazyLoadedUnit } from "../Interfaces";
import { Unit } from "../Metadata/Unit";
import { InvertedUnit } from "../Metadata/InvertedUnit";
import { Schema } from "../Metadata/Schema";
import { UnitSystem } from "../Metadata/UnitSystem";
const loggerCategory = "SchemaFormatsProvider";
/**
 * Provides default formats and kind of quantities from a given SchemaContext or SchemaLocater.
 * @beta
 */
export class SchemaFormatsProvider implements FormatsProvider, SyncFormatsProvider {
  private _context: SchemaContext;
  private _unitSystem?: UnitSystemKey;
  private _formatsRetrieved: Set<string> = new Set();
  public onFormatsChanged = new BeEvent<(args: FormatsChangedArgs) => void>();
  /**
   *
   * @param contextOrLocater The SchemaContext or a different ISchemaLocater implementation used to retrieve the schema. The SchemaContext
   * class implements the ISchemaLocater interface. If the provided locater is not a SchemaContext instance a new SchemaContext will be
   * created and the locater will be added.
   * @param unitSystem Optional unit system used to lookup a default format through a schema specific algorithm, when the format retrieved is associated with a KindOfQuantity.
   * If not provided, the default presentation format will be used directly without matching unit systems.
   */
  constructor(contextOrLocater: ISchemaLocater, unitSystem?: UnitSystemKey) {
    if (contextOrLocater instanceof SchemaContext) {
      this._context = contextOrLocater;
    } else {
      this._context = new SchemaContext();
      this._context.addLocater(contextOrLocater);
    }
    this._unitSystem = unitSystem;
  }

  public get context() { return this._context; }
  public get unitSystem() { return this._unitSystem; }

  public set unitSystem(unitSystem: UnitSystemKey | undefined) {
    this._unitSystem = unitSystem;
    this.clear();
  }

  private clear(): void {
    const formatsChanged = Array.from(this._formatsRetrieved);
    this._formatsRetrieved.clear();
    this.onFormatsChanged.raiseEvent({ formatsChanged });
  }

  /** When using a presentation unit from a KindOfQuantity, the label and description should come from the KindOfQuantity */
  private convertToFormatDefinition(format: SchemaItemFormatProps, kindOfQuantity: KindOfQuantity): FormatDefinition {
    // Destructure all properties except 'rest'
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    const { name, label, description, $schema, schema, schemaVersion, schemaItemType,
      // eslint-disable-next-line @typescript-eslint/no-unused-vars
      customAttributes, originalECSpecMajorVersion, originalECSpecMinorVersion, ...rest } = format;

    return {
      ...rest,
      name: kindOfQuantity.fullName,
      label: kindOfQuantity.label ?? format.label,
      description: kindOfQuantity.description ?? format.description,
    }
  }

  private async getKindOfQuantityFormatFromSchema(itemKey: SchemaItemKey, systemOverride?: UnitSystemKey): Promise<FormatDefinition | undefined> {
    let kindOfQuantity: KindOfQuantity | undefined;
    try {
      kindOfQuantity = await this._context.getSchemaItem(itemKey, KindOfQuantity);
    } catch {
      Logger.logError(loggerCategory, `Failed to find KindOfQuantity ${itemKey.fullName}`);
      return undefined;
    }

    if (!kindOfQuantity)
      return undefined;

    const props = await this.getKindOfQuantityFormatProps(kindOfQuantity, systemOverride);
    if (!props)
      return undefined;

    this._formatsRetrieved.add(itemKey.fullName);
    return this.convertToFormatDefinition(props, kindOfQuantity);
  }

  private async getKindOfQuantityFormatProps(kindOfQuantity: KindOfQuantity, systemOverride?: UnitSystemKey): Promise<FormatProps | undefined> {
    // Cache each lazy format and unit once per lookup because matchers may revisit them.
    const formatCache = new Map<FormatReference, Promise<ResolvedFormat>>();
    const unitCache = new Map<UnitReference, Promise<ResolvedUnit>>();
    const getFormat = async (format: FormatReference): Promise<ResolvedFormat> => {
      let resolved = formatCache.get(format);
      if (!resolved) {
        resolved = Promise.resolve(format);
        formatCache.set(format, resolved);
      }
      return resolved;
    };
    const getUnit = (unit: UnitReference | undefined): Promise<ResolvedUnit> | undefined => {
      if (!unit)
        return undefined;

      let resolved = unitCache.get(unit);
      if (!resolved) {
        resolved = resolveUnitAsync(unit);
        unitCache.set(unit, resolved);
      }
      return resolved;
    };

    for (const candidate of getFormatSelectionCandidates(kindOfQuantity, systemOverride ?? this._unitSystem)) {
      const format = candidate.type === "persistence" ? undefined : await getFormat(candidate.format);
      const unit = candidate.type === "default" ? undefined : await getUnit(candidate.type === "persistence" ? candidate.unit : format?.units?.[0]?.[0]);
      const props = getFormatPropsForCandidate(candidate, format, unit);
      if (props)
        return props;
    }

    return undefined;
  }

  /**
   * Retrieves a format definition from the schema context.
   *
   * For a KindOfQuantity with a unit system, matching presentation formats are checked first, followed by the persistence unit and then the default presentation format. Without a unit system, the default presentation format is used.
   * @param name The full name of the Format or KindOfQuantity.
   * @param system Optional unit system used to select a KindOfQuantity format.
   */
  public async getFormat(name: string, system?: UnitSystemKey): Promise<FormatDefinition | undefined> {
    const [schemaName, schemaItemName] = SchemaItem.parseFullName(name);
    const schemaKey = new SchemaKey(schemaName);
    let schema: Schema | undefined;
    try {
      schema = await this._context.getSchema(schemaKey);
    } catch {
      Logger.logError(loggerCategory, `Failed to find schema ${schemaName}`);
      return undefined;
    }
    if (!schema) {
      return undefined;
    }
    const itemKey = new SchemaItemKey(schemaItemName, schema.schemaKey);

    if (schema.name === "Formats") {
      let format: Format | undefined;
      try {
        format = await this._context.getSchemaItem(itemKey, Format);
      } catch {
        Logger.logError(loggerCategory, `Failed to find Format ${itemKey.fullName}`);
        return undefined;
      }
      if (!format) {
        return undefined;
      }
      return format.toJSON(true);
    }
    return this.getKindOfQuantityFormatFromSchema(itemKey, system);
  }

  /**
   * Retrieves a format definition using only schema metadata already loaded in the context.
   * It follows the same selection order as `getFormat` but never asks a locater to load a schema. Returns `undefined` when required metadata is not cached.
   */
  public getFormatSync(name: string, system?: UnitSystemKey): FormatDefinition | undefined {
    const [schemaName, schemaItemName] = SchemaItem.parseFullName(name);
    const schemaKey = new SchemaKey(schemaName);
    const schema = getCachedSchemaSync(this._context, schemaKey);
    if (!schema)
      return undefined;

    const itemKey = new SchemaItemKey(schemaItemName, schema.schemaKey);
    if (schema.name === "Formats") {
      const format = schema.getItemSync(itemKey.name, Format);
      return format?.toJSON(true);
    }

    return this.getKindOfQuantityFormatFromSchemaSync(itemKey, system);
  }

  private getKindOfQuantityFormatFromSchemaSync(itemKey: SchemaItemKey, systemOverride?: UnitSystemKey): FormatDefinition | undefined {
    const schema = getCachedSchemaSync(this._context, itemKey.schemaKey);
    const kindOfQuantity = schema?.getItemSync(itemKey.name, KindOfQuantity);
    if (!kindOfQuantity)
      return undefined;

    const props = this.getKindOfQuantityFormatPropsSync(kindOfQuantity, systemOverride);
    if (!props)
      return undefined;

    this._formatsRetrieved.add(itemKey.fullName);
    return this.convertToFormatDefinition(props, kindOfQuantity);
  }

  private getKindOfQuantityFormatPropsSync(kindOfQuantity: KindOfQuantity, systemOverride?: UnitSystemKey): FormatProps | undefined {
    const formatCache = new Map<FormatReference, ResolvedFormat | undefined>();
    const unitCache = new Map<UnitReference, ResolvedUnit | undefined>();
    const getFormat = (format: FormatReference): ResolvedFormat | undefined => {
      if (!formatCache.has(format))
        formatCache.set(format, resolveFormatSync(this._context, format));
      return formatCache.get(format);
    };
    const getUnit = (unit: UnitReference | undefined): ResolvedUnit | undefined => {
      if (!unit)
        return undefined;
      if (!unitCache.has(unit))
        unitCache.set(unit, resolveUnitSync(this._context, unit));
      return unitCache.get(unit);
    };

    for (const candidate of getFormatSelectionCandidates(kindOfQuantity, systemOverride ?? this._unitSystem)) {
      const format = candidate.type === "persistence" ? undefined : getFormat(candidate.format);
      const unit = candidate.type === "default" ? undefined : getUnit(candidate.type === "persistence" ? candidate.unit : format?.units?.[0]?.[0]);
      const props = getFormatPropsForCandidate(candidate, format, unit);
      if (props)
        return props;
    }

    return undefined;
  }
}

type FormatReference = LazyLoadedFormat | OverrideFormat;
type UnitReference = LazyLoadedUnit | LazyLoadedInvertedUnit;
type ResolvedFormat = Format | OverrideFormat;
type UnitSystemMatcher = (unitSystemName: string) => boolean;

interface ResolvedUnit {
  unit: Unit | InvertedUnit;
  unitSystemName?: string;
}

type FormatSelectionCandidate =
  | { type: "presentation", format: FormatReference, matcher: UnitSystemMatcher }
  | { type: "persistence", unit: UnitReference | undefined, matchers: UnitSystemMatcher[] }
  | { type: "default", format: FormatReference };

/**
 * Produces candidates in lookup order: presentation formats by unit-system priority, then the persistence unit,
 * then the default presentation format. The generator defers each candidate until the lookup reaches it.
 */
function* getFormatSelectionCandidates(kindOfQuantity: KindOfQuantity, effectiveSystem?: UnitSystemKey): Iterable<FormatSelectionCandidate> {
  if (effectiveSystem) {
    const matchers = getUnitSystemGroupMatchers(effectiveSystem);
    for (const matcher of matchers) {
      for (const format of kindOfQuantity.presentationFormats)
        yield { type: "presentation", format, matcher };
    }
    yield { type: "persistence", unit: kindOfQuantity.persistenceUnit, matchers };
  }

  const defaultFormat = kindOfQuantity.defaultPresentationFormat;
  if (defaultFormat)
    yield { type: "default", format: defaultFormat };
}

function getFormatPropsForCandidate(candidate: FormatSelectionCandidate, format: ResolvedFormat | undefined, unit: ResolvedUnit | undefined): FormatProps | undefined {
  const unitSystemName = unit?.unitSystemName;
  switch (candidate.type) {
    case "presentation":
      return format && unitSystemName && candidate.matcher(unitSystemName) ? getFormatProps(format) : undefined;
    case "persistence":
      return unit && unitSystemName && candidate.matchers.some((matcher) => matcher(unitSystemName)) ? getPersistenceUnitFormatProps(unit.unit) : undefined;
    case "default":
      return format ? getFormatProps(format) : undefined;
  }
}

function resolveFormatSync(context: SchemaContext, format: FormatReference): ResolvedFormat | undefined {
  if (OverrideFormat.isOverrideFormat(format))
    return format;

  const schema = getCachedSchemaSync(context, format.schemaKey);
  return schema?.getItemSync(format.name, Format);
}

async function resolveUnitAsync(unit: UnitReference): Promise<ResolvedUnit> {
  const resolvedUnit = await unit;
  const unitSystem = await resolvedUnit.unitSystem;
  return { unit: resolvedUnit, unitSystemName: unitSystem?.name };
}

function resolveUnitSync(context: SchemaContext, unit: UnitReference): ResolvedUnit | undefined {
  const resolvedUnit = getLoadedUnitSync(context, unit);
  if (!resolvedUnit)
    return undefined;

  const unitSystem = resolvedUnit.unitSystem;
  if (!unitSystem)
    return { unit: resolvedUnit };

  const schema = getCachedSchemaSync(context, unitSystem.schemaKey);
  return { unit: resolvedUnit, unitSystemName: schema?.getItemSync(unitSystem.name, UnitSystem)?.name };
}

function getCachedSchemaSync(context: SchemaContext, schemaKey: SchemaKey): Schema | undefined {
  try {
    return context.getCachedSchemaSync(schemaKey, SchemaMatchType.Latest);
  } catch (error) {
    if (error instanceof ECSchemaError && error.errorNumber === ECSchemaStatus.UnableToLoadSchema)
      return undefined;
    throw error;
  }
}

function getLoadedUnitSync(context: SchemaContext, unit: UnitReference): Unit | InvertedUnit | undefined {
  const schema = getCachedSchemaSync(context, unit.schemaKey);
  const item = schema?.getItemSync(unit.name);
  return Unit.isUnit(item) || InvertedUnit.isInvertedUnit(item) ? item : undefined;
}

function getUnitSystemGroupMatchers(groupKey?: UnitSystemKey): UnitSystemMatcher[] {
  function createMatcher(name: string | string[]): UnitSystemMatcher {
    const names = Array.isArray(name) ? name : [name];
    return (unitSystemName: string) => names.some((n) => n === unitSystemName.toUpperCase());
  }
  switch (groupKey) {
    case "imperial":
      return ["IMPERIAL", "USCUSTOM", "INTERNATIONAL", "FINANCE"].map(createMatcher);
    case "metric":
      return [["SI", "METRIC"], "INTERNATIONAL", "FINANCE"].map(createMatcher);
    case "usCustomary":
      return ["USCUSTOM", "INTERNATIONAL", "FINANCE"].map(createMatcher);
    case "usSurvey":
      return ["USSURVEY", "USCUSTOM", "INTERNATIONAL", "FINANCE"].map(createMatcher);
  }
  return [];
}

function getPersistenceUnitFormatProps(persistenceUnit: Unit | InvertedUnit): FormatProps {
  // Same as Format "DefaultRealU" in Formats ecschema
  return {
    formatTraits: ["keepSingleZero", "keepDecimalPoint", "showUnitLabel"],
    precision: 6,
    type: "Decimal",
    composite: {
      units: [
        {
          name: persistenceUnit.fullName,
          label: persistenceUnit.label,
        },
      ],
    },
  };
}