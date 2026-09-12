/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/

import { FormattingSpecArgs } from "@itwin/core-quantity";

/** The identity of one [FormattingSpecArgs]($core-quantity). Keys both `FieldSpecBucket._specs`
 * and the `seen` map in `collectFieldFormattingRequirements`, which must agree — and must name
 * everything that changes the resulting spec (i.e. the `FormattingSpecArgs`). Too coarse, and two
 * requirements collapse into one: only the first is warmed, and the second silently formats
 * through it, converting from the wrong unit and recording no miss. `system` is included for that
 * reason — `collectFieldQuantityPairs` never sets it, but a caller of
 * `FieldFormattingSpecProvider.warmUp` may.
 * @internal
 */
export function specKey(args: FormattingSpecArgs): string {
  return `${args.name}|${args.persistenceUnitName}|${args.system ?? ""}`;
}
