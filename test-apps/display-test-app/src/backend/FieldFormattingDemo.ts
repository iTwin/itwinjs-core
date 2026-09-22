/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/

/*
 * Wires app-supplied FormatSets into the FieldRun formatting pathway exposed by
 * `@itwin/core-backend`. `dta text import formatset <path> [id]` loads them from JSON, so DTA
 * carries no format catalog of its own.
 */

import { ElementDrivesTextAnnotation, IModelDb } from "@itwin/core-backend";
import { FormatSet } from "@itwin/ecschema-metadata";

/** FormatSets imported per iModel, so a later import adds to the routing table rather than
 * replacing it. Core's registry holds the compiled provider, not the sets it was built from.
 */
const imported = new Map<string, { defaultSet?: FormatSet, sets: { id: string, formatSet: FormatSet }[] }>();

/** Re-registers the provider for `iModel` from `defaultSet`, `sets`, and everything previously
 * imported for it. `defaultSet` applies to FieldRuns naming no set; each `sets` entry is
 * addressable by its `id`. Supplying neither unregisters, reverting to the schema defaults.
 */
export function registerFieldFormattingProviderFor(iModel: IModelDb, defaultSet?: FormatSet, sets?: { id: string, formatSet: FormatSet }[]): void {
  if (undefined === defaultSet && (undefined === sets || 0 === sets.length)) {
    unregister(iModel);
    return;
  }

  const previous = imported.get(iModel.key);
  // Absent means "leave the adopted set alone".
  const mergedDefault = defaultSet ?? previous?.defaultSet;
  // Re-importing an id replaces that entry.
  const incoming = sets ?? [];
  const mergedSets = [
    ...(previous?.sets ?? []).filter((entry) => !incoming.some((added) => added.id === entry.id)),
    ...incoming,
  ];

  ElementDrivesTextAnnotation.registerFieldFormattingProvider({
    iModel,
    formatSet: mergedDefault,
    formatSets: mergedSets,
  });

  // Core releases its provider with the IModelDb; only the routing table needs tearing down.
  if (!imported.has(iModel.key))
    iModel.onBeforeClose.addOnce(() => imported.delete(iModel.key));

  imported.set(iModel.key, { defaultSet: mergedDefault, sets: mergedSets });
}

/** Unregisters the provider for `iModel` and discards its imported FormatSets. Safe to call when
 * nothing is registered.
 */
function unregister(iModel: IModelDb): void {
  imported.delete(iModel.key);
  ElementDrivesTextAnnotation.unregisterFieldFormattingProvider(iModel);
}
