/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/

/** Strips alias prefix from a schema item reference.
 * `"u:FT"` → `"FT"`, `"FT"` → `"FT"`.
 * @internal
 */
export function stripAliasPrefix(raw: string): string {
  return raw.includes(":") ? raw.split(":")[1] : raw;
}

/** Normalizes a schema item reference to fully-qualified `SchemaName.ItemName` format.
 * Handles: already qualified (`"Units.FT"`), alias-qualified (`"u:FT"`), unqualified (`"FT"`).
 * @internal
 */
export function qualifyItemName(raw: string, schemaName: string): string {
  if (raw.includes("."))
    return raw;
  return `${schemaName}.${stripAliasPrefix(raw)}`;
}
