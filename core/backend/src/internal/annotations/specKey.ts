/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
/** @packageDocumentation
 * @module ElementGeometry
 */

import { FormattingSpecArgs } from "@itwin/core-quantity";

/** The identity of one [FormattingSpecArgs]($core-quantity): the key under which its
 * [FormatterSpec]($core-quantity) is cached, and the key requirement collection deduplicates on.
 *
 * Both callers must use this one definition. Deduplicating requirements on a *coarser* key than
 * the cache uses would collapse two distinct requirements into one, warm only the survivor, and
 * leave the other to miss at evaluation time — the same silent-shortfall failure that warming
 * exists to prevent. `system` participates because a caller may request a unit system other than
 * the provider's default; the field-driven path in `collectFieldQuantityPairs` never sets it
 * today, but keying on it costs nothing and removes the chance to get this wrong later.
 * @internal
 */
export function specKey(args: FormattingSpecArgs): string {
  return `${args.name}|${args.persistenceUnitName}|${args.system ?? ""}`;
}
