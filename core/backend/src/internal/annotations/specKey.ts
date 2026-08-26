/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
/** @packageDocumentation
 * @module ElementGeometry
 */

import { FormattingSpecArgs } from "@itwin/core-quantity";

/** The identity of one [FormattingSpecArgs]($core-quantity): the key its
 * [FormatterSpec]($core-quantity) is cached under, and the key requirement collection
 * deduplicates on. Both must use this definition, and it must name everything that changes the
 * resulting spec — a key too coarse conflates two requirements, so only the first is warmed and
 * the second silently formats through it, converting from the wrong unit and recording no miss.
 * `system` is included for that reason: `collectFieldQuantityPairs` never sets it, but a caller
 * of `FieldFormattingSpecProvider.warmUp` may.
 * @internal
 */
export function specKey(args: FormattingSpecArgs): string {
  return `${args.name}|${args.persistenceUnitName}|${args.system ?? ""}`;
}
