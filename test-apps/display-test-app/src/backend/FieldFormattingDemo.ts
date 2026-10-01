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

/** FormatSets imported per iModel, so a later import adds to the registration rather than
 * replacing it. Core's registry holds the compiled formats, not the sets they were built from.
 * Weakly keyed so a closed iModel takes its entry with it.
 */
const imported = new WeakMap<IModelDb, { formatSet?: FormatSet, byId: Map<string, FormatSet> }>();

/** Registers `formatSet` for the iModel alongside everything previously imported for it. With an
 * `id` the set is addressable by a FieldRun's `formatSet` option, and re-importing that `id`
 * replaces the earlier entry; without one it becomes the iModel's default.
 */
export function importFormatSet(iModelKey: string, formatSet: FormatSet, id?: string): void {
  const iModel = IModelDb.findByKey(iModelKey);
  let entry = imported.get(iModel);
  if (!entry) {
    entry = { byId: new Map() };
    imported.set(iModel, entry);
  }

  if (id)
    entry.byId.set(id, formatSet);
  else
    entry.formatSet = formatSet;

  ElementDrivesTextAnnotation.registerFieldFormatting({
    iModel,
    formatSet: entry.formatSet,
    formatSets: [...entry.byId].map(([setId, set]) => ({ id: setId, formatSet: set })),
  });
}

/** Reverts the iModel to the schema default formats and discards its imported FormatSets. Safe to
 * call when nothing is registered.
 */
export function clearFormatSets(iModelKey: string): void {
  const iModel = IModelDb.findByKey(iModelKey);
  imported.delete(iModel);
  ElementDrivesTextAnnotation.registerFieldFormatting({ iModel });
}
