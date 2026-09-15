/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/

import { FieldValue, QuantityFieldFormatOptions } from "@itwin/core-common";
import { FormatterSpec, FormattingSpecArgs } from "@itwin/core-quantity";

/** The provider capability synchronous field evaluation needs: look up an already-built
 * [FormatterSpec]($core-quantity), and format a magnitude through it.
 *
 * Narrower than [FormattingSpecProvider]($core-quantity), which also produces a
 * [ParserSpec]($core-quantity). Nothing on this path parses.
 * @internal
 */
export interface FieldSpecProvider {
  /** Returns the spec already built for `args`, or `undefined` if no spec was found. */
  getFormatterSpec(args: FormattingSpecArgs): FormatterSpec | undefined;
  /** Applies `formatSpec` to `magnitude`. */
  formatQuantity(magnitude: number, formatSpec: FormatterSpec): string;
}

/** Cache key for one [FormattingSpecArgs]($core-quantity). Must name everything that changes the
 * resulting spec: if two distinct requirements share a key, only the first is built and the
 * second silently formats through it, converting from the wrong unit.
 * @internal
 */
export function specKey(args: FormattingSpecArgs): string {
  return `${args.name}|${args.persistenceUnitName}|${args.system ?? ""}`;
}

/** Builds the (KindOfQuantity, persistence unit) pairs a quantity/coordinate FieldValue may
 * format through, in the priority order documented on [[QuantityFieldFormatOptions]]. Used by
 * both [[lookupFieldSpec]] and `collectFieldRequirements`, so pre-warm enumerates exactly what
 * evaluation iterates.
 *
 * A pair needs both halves, so a property with no [KindOfQuantity]($ecschema-metadata)
 * contributes none. The property-side pair is also withheld when `overridePersistence` names a
 * different unit.
 * @internal
 */
export function collectFieldQuantityPairs(args: {
  overrideName?: string;
  overridePersistence?: string;
  propertyName?: string;
  propertyPersistence?: string;
}): FormattingSpecArgs[] {
  const { overrideName, overridePersistence, propertyName, propertyPersistence } = args;
  const effectiveName = overrideName ?? propertyName;
  const effectivePersistence = overridePersistence ?? propertyPersistence;

  // An override naming the same unit as the property contradicts nothing, so the fallback stands.
  // Neither does an absent or empty override.
  const contradictsProperty =
    overridePersistence !== undefined
    && overridePersistence !== ""
    && overridePersistence !== propertyPersistence;

  const pairs: FormattingSpecArgs[] = [];
  if (effectiveName && effectivePersistence) {
    pairs.push({ name: effectiveName, persistenceUnitName: effectivePersistence });
  }
  if (
    propertyName && propertyPersistence && !contradictsProperty &&
    (propertyName !== effectiveName || propertyPersistence !== effectivePersistence)
  ) {
    pairs.push({ name: propertyName, persistenceUnitName: propertyPersistence });
  }
  return pairs;
}

/** Returns the first [FormatterSpec]($core-quantity) `provider` already holds for `value`, along
 * with the pairs that were tried, so the caller can record a miss when none resolved.
 * @internal
 */
export function lookupFieldSpec(
  quantityOptions: QuantityFieldFormatOptions | undefined,
  value: FieldValue,
  provider: FieldSpecProvider,
): { spec?: FormatterSpec, candidates: FormattingSpecArgs[] } {
  const candidates = collectFieldQuantityPairs({
    overrideName: quantityOptions?.kindOfQuantity,
    overridePersistence: quantityOptions?.persistenceUnit,
    propertyName: value.kindOfQuantityFullName,
    propertyPersistence: value.persistenceUnitFullName,
  });
  for (const candidate of candidates) {
    const spec = provider.getFormatterSpec(candidate);
    if (spec) {
      return { spec, candidates };
    }
  }
  return { candidates };
}
