/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/

/** Current version of the serialized unit schema format. Follows semver.
 * @internal
 */
export const SERIALIZED_UNIT_SCHEMA_VERSION = "1.0.0";

/** A serialized constant definition (e.g. `PI`, `MILLI`).
 * @internal
 */
export interface SerializedConstant {
  readonly schemaItemType: "Constant";
  readonly label?: string;
  readonly description?: string;
  /** The phenomenon this constant belongs to. */
  readonly phenomenon: string;
  /** The unit definition expression (e.g. `"M*M"`). */
  readonly definition: string;
  /** Numerator of the conversion factor to the SI base. */
  readonly numerator?: number;
  /** Denominator of the conversion factor to the SI base. */
  readonly denominator?: number;
}

/** A serialized unit definition (e.g. `M`, `FT`, `CELSIUS`).
 * @internal
 */
export interface SerializedUnit {
  readonly schemaItemType: "Unit";
  readonly label?: string;
  readonly description?: string;
  readonly phenomenon: string;
  readonly unitSystem: string;
  /** The unit definition expression (e.g. `"M*M"`). */
  readonly definition: string;
  /** Numerator of the conversion factor to the SI base. */
  readonly numerator?: number;
  /** Denominator of the conversion factor to the SI base. */
  readonly denominator?: number;
  /** Additive offset for the conversion (e.g. temperature scales). */
  readonly offset?: number;
}

/** A serialized inverted unit definition (e.g. `HORIZONTAL_PER_VERTICAL`).
 * @internal
 */
export interface SerializedInvertedUnit {
  readonly schemaItemType: "InvertedUnit";
  readonly label?: string;
  readonly description?: string;
  readonly invertsUnit: string;
  readonly unitSystem: string;
}

/** A serialized unit system definition (e.g. `SI`, `METRIC`).
 * @internal
 */
export interface SerializedUnitSystem {
  readonly schemaItemType: "UnitSystem";
  readonly label?: string;
  readonly description?: string;
}

/** A serialized phenomenon definition (e.g. `LENGTH`, `TEMPERATURE`).
 * @internal
 */
export interface SerializedPhenomenon {
  readonly schemaItemType: "Phenomenon";
  readonly label?: string;
  readonly description?: string;
  /** The phenomenon definition expression. */
  readonly definition: string;
}

/** Discriminated union of all serialized schema item types.
 * @internal
 */
export type SerializedUnitItem = SerializedConstant | SerializedUnit | SerializedInvertedUnit | SerializedUnitSystem | SerializedPhenomenon;

/** Versioned container for a serialized BIS unit schema. The `items` map is keyed by schema-item name (unqualified).
 * @internal
 */
export interface SerializedUnitSchema {
  /** Semver string identifying the serialization format. Consumers should reject unknown major versions. */
  readonly version: string;
  readonly name: string;
  readonly alias: string;
  readonly items: { readonly [name: string]: SerializedUnitItem };
}
