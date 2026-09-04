/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/

/*
 * Wires app-supplied [FormatSet]($ecschema-metadata)s into the FieldRun formatting pathway
 * exposed by `@itwin/core-backend`, the way a production consumer such as Drawing Production
 * would.
 *
 * The sets themselves are not defined here. `dta text import formatset <path> [id]` loads one
 * from a JSON file, so DTA carries no format catalog of its own and can be pointed at a real
 * application's FormatSets:
 *
 *   1. Importing with no `id` *adopts* the set for the iModel, so it applies to every FieldRun
 *      that names no FormatSet of its own. Importing with an `id` makes it addressable by
 *      [QuantityFieldFormatOptions.formatSet]($common) instead. Import more than once to build
 *      up a routing table.
 *   2. Thereafter every `"quantity"` / `"coordinate"` FieldRun in the iModel formats through
 *      those sets **synchronously**, including on the txn-callback path that recomputes cached
 *      content when a source element changes.
 *   3. `TextImpl.insertText` / `updateText` and `Backend.generateTextAnnotationGeometry` warm
 *      the provider for the block they are about to handle, so fields authored in this session
 *      are hot before the txn commits.
 *
 * Because there is a single, synchronous evaluation path, all three entry points render
 * identical strings for a given block.
 *
 * `dta text import formatset off`, and closing the iModel, unregister.
 */

import { ElementDrivesTextAnnotation, FieldFormattingSpecProvider, IModelDb, isITextAnnotation } from "@itwin/core-backend";
import { BentleyError, Id64String, Logger } from "@itwin/core-bentley";
import { TextBlock } from "@itwin/core-common";
import { FormattingSpecArgs } from "@itwin/core-quantity";
import { FormatSet } from "@itwin/ecschema-metadata";

/** The FormatSets imported for each iModel, keyed by [IModelDb.key]($backend), so a later
 * import adds to the routing table rather than replacing it. `sets` is held in the same shape
 * `registerFieldFormattingProvider` accepts, so it passes straight through.
 *
 * This is the *source* material, which Core does not retain: its registry holds the compiled
 * provider, not the sets it was built from. Keeping the imports is what lets a second
 * `import formatset` re-register the union without the caller re-sending everything.
 */
const imported = new Map<string, { defaultSet?: FormatSet, sets: { id: string, formatSet: FormatSet }[] }>();

/** Unsubscribes the [IModelDb.onBeforeClose]($backend) teardown installed for each iModel that
 * has FormatSets registered, keyed by [IModelDb.key]($backend).
 *
 * The provider itself is deliberately *not* stored here.
 * [ElementDrivesTextAnnotation]($backend) already owns a per-iModel provider registry, so
 * duplicating it would just risk the two disagreeing. This map holds only the one thing Core
 * does not do for us: dropping the registration when the briefcase it was warmed against
 * closes.
 */
const closeUnsubscribers = new Map<string, () => void>();

/** The two BisCore classes that persist their annotation JSON in a `TextAnnotationData`
 * column, and can therefore be pre-filtered in SQLite rather than in JavaScript.
 */
const TEXT_ANNOTATION_DATA_CLASSES = ["BisCore.TextAnnotation2d", "BisCore.TextAnnotation3d"] as const;

/** Selects persisted annotations whose JSON mentions a field-level quantity override.
 *
 * Both keys are [QuantityFieldFormatOptions]($common) property names, which is what makes this
 * legitimate to match on: they are the persisted form, not an implementation detail. A hit is a
 * *superset* of "some field overrides its format" — the substring could equally appear in
 * literal text — which is the safe direction to err in, since the block walk below decides for
 * real and over-matching only costs time.
 *
 * `formatSet`, the third key, is deliberately absent: it selects *which* FormatSet resolves a
 * field, not which (KindOfQuantity, persistence unit) pair the field needs. A field naming only a
 * FormatSet still requires its property's own pair, which the schema sweep already supplies.
 */
const OVERRIDE_JSON_PREDICATE = `TextAnnotationData LIKE '%"kindOfQuantity"%' OR TextAnnotationData LIKE '%"persistenceUnit"%'`;

/** Gathers the requirements contributed by [FieldRun]($common)s that carry an explicit
 * `kindOfQuantity` or `persistenceUnit` override, by walking the annotations that have one.
 *
 * This is the half of the requirement set that [FieldFormattingSpecProvider.collectSchemaFormattingRequirements]($backend)
 * cannot supply. Schema enumeration sees only pairs a *property* declares; a field may name a
 * persistence unit no property in the iModel declares, and that pair is reachable no other way.
 * Missing it is not a cosmetic shortfall. A field that renames the persistence unit gets no
 * property-side fallback — falling back there would format the magnitude as though it were in the
 * property's unit — so the field renders its raw value and the pair lands on
 * [FieldFormattingSpecProvider.misses]($backend). The txn callback then persists that raw string
 * into `cachedContent`.
 *
 * Core deliberately does not do this: which annotations are in scope is an application question
 * (a drawing? a sheet? the whole briefcase?), and the app already owns the FormatSets that the
 * requirements resolve against. DTA answers "the whole briefcase" because it is a test app. A
 * real application would more likely scope this to the model or view being opened.
 *
 * Pass 1's substring test runs inside SQLite, so annotations that override nothing never reach
 * JavaScript. Pass 2 has no column to filter on and so constructs every element it selects, but
 * it selects none in a stock briefcase: no class outside the two above implements the mixin.
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

  // Pass 2: any other ITextAnnotation implementor. The mixin does not declare where an
  // implementor keeps its text, so there is no column to pre-filter on — these have to be
  // constructed and asked. Excluding the two classes above keeps that cost off the common case.
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
        // Core supplies the field -> (KindOfQuantity, persistence unit) mapping. Reimplementing
        // it here would be the one part of this an application must not do: the requirement has
        // to match the candidate evaluation actually walks, or the wrong pair resolves.
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

/** Warms the registered provider for the [FieldRun]($common)s in `block`, so the synchronous
 * evaluation that follows finds every spec it needs in cache. A no-op when nothing is
 * registered.
 *
 * Load-bearing rather than belt-and-braces: `dta text import annotation` can introduce a field
 * naming any KindOfQuantity or persistence unit, so registration cannot know in advance every
 * pair a session will ask for.
 */
export async function prepareFieldFormattingFor(iModel: IModelDb, block: TextBlock): Promise<void> {
  const provider = ElementDrivesTextAnnotation.getFieldFormattingProvider(iModel);
  if (!provider)
    return;

  await provider.warmUp(ElementDrivesTextAnnotation.collectFieldFormattingRequirements({ iModel, block }));
}

/** Re-registers the field formatting provider for `iModel` from `defaultSet`, `sets`, and
 * everything previously imported for it - so importing a second FormatSet builds up a routing
 * table rather than replacing the first. `defaultSet` is adopted as the iModel's default; each
 * entry of `sets` is addressable under its `id` by a FieldRun's `formatSet` option. Re-supplying
 * the default, or an id, replaces it. Supplying neither discards everything and unregisters.
 *
 * Named for its effect rather than its arguments: each call rebuilds and re-warms the provider
 * from the accumulated imports. Wraps
 * [ElementDrivesTextAnnotation.registerFieldFormattingProvider]($backend), adding the import
 * bookkeeping and close teardown that Core leaves to the host.
 *
 * The registration is torn down automatically when `iModel` closes (via
 * [IModelDb.onBeforeClose]($backend)) so it cannot outlive the briefcase it was warmed against.
 */
export async function registerFieldFormattingProviderFor(iModel: IModelDb, defaultSet?: FormatSet, sets?: { id: string, formatSet: FormatSet }[]): Promise<void> {
  if (undefined === defaultSet && (undefined === sets || 0 === sets.length)) {
    unregister(iModel);
    return;
  }

  const previous = imported.get(iModel.key);
  // Absent means "leave the adopted set alone", so importing an addressable set does not
  // silently drop the default that fields naming no set depend on.
  const mergedDefault = defaultSet ?? previous?.defaultSet;
  // Re-importing an id replaces that entry rather than leaving two competing for the same slot.
  const incoming = sets ?? [];
  const mergedSets = [
    ...(previous?.sets ?? []).filter((entry) => !incoming.some((added) => added.id === entry.id)),
    ...incoming,
  ];

  // Register *before* tearing anything down. registerFieldFormattingProvider swaps in the new
  // provider only once its pre-warm resolves, so re-importing leaves the previous registration
  // serving evaluations throughout - and still serving them if warming throws. Unregistering
  // first would open a window in which the iModel has no provider at all.
  await ElementDrivesTextAnnotation.registerFieldFormattingProvider({
    iModel,
    formatSet: mergedDefault,
    formatSets: mergedSets,
    // Core discovers nothing on its own. Two sources cover what registration can know:
    // every KindOfQuantity the iModel's schemas declare, and every pair contributed by an
    // annotation that already overrides one. Anything a field invents later is warmed by
    // prepareFieldFormattingFor. Duplicates are harmless: warm-up skips what is already cached.
    requirements: [
      ...FieldFormattingSpecProvider.collectSchemaFormattingRequirements(iModel),
      ...collectAnnotationOverrideRequirements(iModel),
    ],
  });

  // Only recorded once registration succeeded, so a failed warm leaves both the previous
  // provider and the imports that produced it intact.
  imported.set(iModel.key, { defaultSet: mergedDefault, sets: mergedSets });

  // Only subscribe once per iModel: importing is repeatable, and each import would otherwise
  // stack another listener on the same briefcase.
  if (!closeUnsubscribers.has(iModel.key))
    closeUnsubscribers.set(iModel.key, iModel.onBeforeClose.addOnce(() => unregister(iModel)));
}

/** Unregisters the provider for `iModel`, discards its imported FormatSets, and detaches the
 * [IModelDb.onBeforeClose]($backend) listener that would otherwise fire it. Safe to call when
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
