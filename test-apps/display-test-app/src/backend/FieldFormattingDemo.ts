/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/

/*
 * Wires app-supplied FormatSets into the FieldRun formatting pathway exposed by
 * `@itwin/core-backend`. `dta text import formatset <path> [id]` loads them from JSON, so DTA
 * carries no format catalog of its own.
 */

import { ElementDrivesTextAnnotation, FieldFormattingSpecProvider, IModelDb, isITextAnnotation } from "@itwin/core-backend";
import { BentleyError, Id64String, Logger } from "@itwin/core-bentley";
import { TextBlock } from "@itwin/core-common";
import { FormattingSpecArgs } from "@itwin/core-quantity";
import { FormatSet } from "@itwin/ecschema-metadata";

/** FormatSets imported per iModel, so a later import adds to the routing table rather than
 * replacing it. Core's registry holds the compiled provider, not the sets it was built from.
 */
const imported = new Map<string, { defaultSet?: FormatSet, sets: { id: string, formatSet: FormatSet }[] }>();

/** Teardown for the `onBeforeClose` listener installed per iModel. */
const closeUnsubscribers = new Map<string, () => void>();

/** BisCore classes that persist annotation JSON in a column, so they can be pre-filtered in SQLite. */
const TEXT_ANNOTATION_DATA_CLASSES = ["BisCore.TextAnnotation2d", "BisCore.TextAnnotation3d"] as const;

/** Selects annotations whose JSON mentions a field-level quantity override. Over-matches, since
 * the substring can appear in literal text; the block walk below decides for real.
 */
const OVERRIDE_JSON_PREDICATE = `TextAnnotationData LIKE '%"kindOfQuantity"%' OR TextAnnotationData LIKE '%"persistenceUnit"%'`;

/** Collects requirements from FieldRuns that override `kindOfQuantity` or `persistenceUnit`.
 * Schema enumeration only sees pairs a property declares, so these are reachable no other way.
 */
function collectAnnotationOverrideRequirements(iModel: IModelDb): FormattingSpecArgs[] {
  if (!ElementDrivesTextAnnotation.isSupportedForIModel(iModel))
    return [];

  const annotationIds: Id64String[] = [];

  // Pass 1: the built-in classes, pre-filtered on their persisted JSON.
  for (const className of TEXT_ANNOTATION_DATA_CLASSES) {
    iModel.withQueryReader(`SELECT ECInstanceId FROM ${className} WHERE ${OVERRIDE_JSON_PREDICATE}`, (reader) => {
      for (const row of reader)
        annotationIds.push(row[0]);
    });
  }

  // Pass 2: any other ITextAnnotation implementor. No column to pre-filter on, so these have to
  // be constructed and asked.
  const excluded = TEXT_ANNOTATION_DATA_CLASSES.join(", ");
  iModel.withQueryReader(`SELECT ECInstanceId FROM BisCore.ITextAnnotation WHERE ECClassId IS NOT (${excluded})`, (reader) => {
    for (const row of reader)
      annotationIds.push(row[0]);
  });

  const seen = new Map<string, FormattingSpecArgs>();
  for (const annotationId of annotationIds) {
    try {
      const element = iModel.elements.tryGetElement(annotationId);
      if (!element || !isITextAnnotation(element))
        continue;

      for (const { textBlock } of element.getTextBlocks()) {
        for (const args of ElementDrivesTextAnnotation.collectFieldFormattingRequirements({ iModel, block: textBlock }))
          seen.set(`${args.name}|${args.persistenceUnitName}`, args);
      }
    } catch (err) {
      // One unreadable annotation must not abort the scan.
      Logger.logError("dta", `Failed to collect field formatting requirements from ${annotationId}: ${BentleyError.getErrorMessage(err)}`);
    }
  }

  return Array.from(seen.values());
}

/** Warms the registered provider for the [FieldRun]($common)s in `block` */
export async function prepareFieldFormattingFor(iModel: IModelDb, block: TextBlock): Promise<void> {
  const provider = ElementDrivesTextAnnotation.getFieldFormattingProvider(iModel);
  if (!provider)
    return;

  await provider.warmUp(ElementDrivesTextAnnotation.collectFieldFormattingRequirements({ iModel, block }));
}

/** Re-registers the provider for `iModel` from `defaultSet`, `sets`, and everything previously
 * imported for it. `defaultSet` applies to FieldRuns naming no set; each `sets` entry is
 * addressable by its `id`. Supplying neither unregisters. Torn down when `iModel` closes.
 */
export async function registerFieldFormattingProviderFor(iModel: IModelDb, defaultSet?: FormatSet, sets?: { id: string, formatSet: FormatSet }[]): Promise<void> {
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

  // Register before tearing anything down: the new provider swaps in only once its pre-warm
  // resolves, so the previous registration keeps serving evaluations throughout.
  await ElementDrivesTextAnnotation.registerFieldFormattingProvider({
    iModel,
    formatSet: mergedDefault,
    formatSets: mergedSets,
    // Core discovers nothing on its own. Duplicates are harmless; warm-up skips what is cached.
    requirements: [
      ...FieldFormattingSpecProvider.collectSchemaFormattingRequirements(iModel),
      ...collectAnnotationOverrideRequirements(iModel),
    ],
  });

  // Recorded only once registration succeeded, so a failed warm leaves the previous state intact.
  imported.set(iModel.key, { defaultSet: mergedDefault, sets: mergedSets });

  // Only subscribe once per iModel.
  if (!closeUnsubscribers.has(iModel.key))
    closeUnsubscribers.set(iModel.key, iModel.onBeforeClose.addOnce(() => unregister(iModel)));
}

/** Unregisters the provider for `iModel` and discards its imported FormatSets. Safe to call when
 * nothing is registered.
 */
function unregister(iModel: IModelDb): void {
  const unsubscribe = closeUnsubscribers.get(iModel.key);
  if (unsubscribe) {
    unsubscribe();
    closeUnsubscribers.delete(iModel.key);
  }

  imported.delete(iModel.key);
  ElementDrivesTextAnnotation.unregisterFieldFormattingProvider(iModel);
}
