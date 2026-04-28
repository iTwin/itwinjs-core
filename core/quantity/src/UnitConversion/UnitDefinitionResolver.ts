/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
import { SERIALIZED_UNIT_SCHEMA_VERSION, type SerializedConstant, type SerializedUnit, type SerializedUnitSchema } from "../SerializedUnitSchema";
import { UnitConversion } from "./UnitConversion";
import { parseDefinition } from "./Parser";
import { stripAliasPrefix } from "./nameUtils";

const MAX_RESOLUTION_DEPTH = 30;

/** Resolved unit entry containing the unit's name and its conversion to the base of its phenomenon.
 * @internal
 */
export interface ResolvedUnit {
  readonly name: string;
  readonly label: string;
  readonly phenomenon: string;
  readonly unitSystem: string;
  readonly conversion: UnitConversion;
}

/** Resolves every unit in a `SerializedUnitSchema` to a `UnitConversion` relative to its phenomenon's base unit.
 * @internal
 */
export class UnitDefinitionResolver {
  private readonly _schema: SerializedUnitSchema;
  private readonly _cache = new Map<string, UnitConversion>();

  constructor(schema: SerializedUnitSchema) {
    if (schema.version !== SERIALIZED_UNIT_SCHEMA_VERSION)
      throw new Error(`Unsupported Units.json version "${schema.version}". Expected "${SERIALIZED_UNIT_SCHEMA_VERSION}".`);
    this._schema = schema;
  }

  /** Resolve all Unit items in the schema and return a map from item name to `ResolvedUnit`. */
  public resolveAll(): Map<string, ResolvedUnit> {
    const result = new Map<string, ResolvedUnit>();

    for (const [name, item] of Object.entries(this._schema.items)) {
      if (item.schemaItemType === "Unit") {
        const conversion = this._resolveUnit(name, 0);
        result.set(name, {
          name,
          label: item.label ?? name,
          phenomenon: item.phenomenon,
          unitSystem: item.unitSystem,
          conversion,
        });
      }
    }

    return result;
  }

  /** Resolve a single unit by unqualified name, returning its conversion to base. */
  private _resolveUnit(name: string, depth: number): UnitConversion {
    if (depth > MAX_RESOLUTION_DEPTH)
      throw new Error(`Unit resolution depth exceeded ${MAX_RESOLUTION_DEPTH} for "${name}"`);

    const cached = this._cache.get(name);
    if (cached)
      return cached;

    const item = this._schema.items[name];
    if (!item)
      throw new Error(`Unknown schema item: "${name}"`);

    let conversion: UnitConversion;

    if (item.schemaItemType === "Constant") {
      conversion = this._resolveConstant(name, item, depth);
    } else if (item.schemaItemType === "Unit") {
      conversion = this._resolveUnitItem(name, item, depth);
    } else {
      throw new Error(`Cannot resolve item of type "${item.schemaItemType}": "${name}"`);
    }

    this._cache.set(name, conversion);
    return conversion;
  }

  private _resolveConstant(name: string, item: SerializedConstant, depth: number): UnitConversion {
    // A constant is identity if its definition is its own name
    if (item.definition === name)
      return UnitConversion.identity;

    const selfConv = UnitConversion.from({
      numerator: item.numerator ?? 1,
      denominator: item.denominator ?? 1,
    });

    const defConv = this._resolveDefinition(item.definition, depth + 1);
    return defConv.compose(selfConv);
  }

  private _resolveUnitItem(name: string, item: SerializedUnit, depth: number): UnitConversion {
    // A unit is a base unit if its definition is its own name
    if (item.definition === name)
      return UnitConversion.identity;

    const selfConv = UnitConversion.from({
      numerator: item.numerator ?? 1,
      denominator: item.denominator ?? 1,
      offset: item.offset,
    });

    const defConv = this._resolveDefinition(item.definition, depth + 1);
    return defConv.compose(selfConv);
  }

  /** Parse and resolve a compound definition string like `[MILLI]*M` or `IN`. */
  private _resolveDefinition(definition: string, depth: number): UnitConversion {
    const fragments = parseDefinition(definition);
    let result: UnitConversion | undefined;

    for (const [, fragment] of fragments) {
      // Strip alias prefix if present (definitions in the schema use unqualified names)
      const fragName = stripAliasPrefix(fragment.name);
      const fragConv = this._resolveUnit(fragName, depth + 1);
      const raised = fragConv.raise(fragment.exponent);
      result = result ? result.multiply(raised) : raised;
    }

    return result ?? UnitConversion.identity;
  }
}
