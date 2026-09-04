---
publish: false
---
# NextVersion

- [NextVersion](#nextversion)
  - [@itwin/core-backend](#itwincore-backend)
    - [Schema sync rework](#schema-sync-rework)
    - [Quantity formatting for text annotation fields](#quantity-formatting-for-text-annotation-fields)
      - [Configuring a FieldRun](#configuring-a-fieldrun)
      - [Format resolution](#format-resolution)
      - [Adopting a FormatSet](#adopting-a-formatset)
        - [Deciding what to warm](#deciding-what-to-warm)
      - [Evaluating fields](#evaluating-fields)
  - [Electron 44 support](#electron-44-support)

## @itwin/core-backend

### Schema sync rework

Schema sync lets the briefcases of one iModel import ECSchemas without taking the exclusive schema lock. This new version explicitly splits between updates, which update the sync db, and upgrades which rewrite the sync db and push it with the briefcase at the same time via the new `BriefcaseDb.upgradeSchemas` API.

Updates no longer automatically end up in other users' briefcases when they import schemas. Instead, they only pick the reference closure of what they import, so updates only hit when a briefcase pushes.

A change that would move or destroy existing data is now refused with `BE_SQLITE_ERROR_DataTransformRequired` or the new `BE_SQLITE_ERROR_DataDeletionRequired`; the new `@alpha` `BriefcaseDb.upgradeSchemas` runs those under the exclusive schema lock and lands the changeset and the sync db together. iModels without schema sync are unaffected.

SchemaSync databases now require version 5.0.0. Existing version 4 containers are outside this compatibility boundary and cannot be opened by this release.

### Quantity formatting for text annotation fields

[FieldRun]($common)s whose target property resolves to a `"quantity"` or `"coordinate"` value can now be rendered through the standard iTwin.js quantity formatting pipeline instead of the previous placeholder `toString()` representation.

A property resolves to `"quantity"` if it is numeric (`double`, `int` or `long`); `point2d` and `point3d` resolve to `"coordinate"`. Classifying a property as `"quantity"` only decides whether the formatting pipeline is consulted for it — a value that resolves no format, because neither the property nor the field names a KindOfQuantity, still renders as a bare number, so counts and identifiers are unaffected. Note that an `int` property carrying a KindOfQuantity previously rendered as a bare number and now renders as a formatted quantity: one persisting 2500 mm under a KindOfQuantity presenting metres changes from `2500` to `2.5 m`.

Formatting stays on the backend (text layout is a backend concern). Field evaluation itself is **synchronous**, because it has to run inside the `TxnManager` update callbacks that recompute cached content when a source element changes. Everything asynchronous — resolving formats, loading units, building [FormatterSpec]($core-quantity)s — happens once, up front, when an application adopts a [FormatSet]($ecschema-metadata) for an iModel.

Because the formatting types are part of this API, `@itwin/core-quantity` is now a **peer dependency** of both `@itwin/core-common` and `@itwin/core-backend`. Applications that depend on either package but did not already list `@itwin/core-quantity` must add it, at the same version as the rest of their iTwin.js core packages.

#### Configuring a FieldRun

Field-level formatting is configured via a new [QuantityFieldFormatOptions]($common) block on [FieldFormatOptions]($common):

```typescript
const fieldRun = FieldRun.create({
  propertyHost: { elementId, schemaName: "MyDomain", className: "Widget" },
  propertyPath: { propertyName: "length" },
  formatOptions: {
    quantity: {
      // Look up a specific KindOfQuantity via the active FormatsProvider,
      // overriding the property's own KoQ.
      kindOfQuantity: "AecUnits.LENGTH",
      // Optionally scope resolution to a specific registered FormatSet on
      // the synchronous path (see below).
      formatSet: myFormatSetId,
    },
  },
});
```

`kindOfQuantity` and `persistenceUnit` are **independent** overrides: setting one falls through to the property side for the other. This lets a caller pin the presentation (via `kindOfQuantity`) while still reading the persistence unit from the EC property, or vice versa.

#### Format resolution

For each `"quantity"` or `"coordinate"` field the formatter looks up a [FormatterSpec]($core-quantity) by (KindOfQuantity name, persistence unit name) pair, in this order:

1. **Effective override pair.** `formatOptions.quantity.kindOfQuantity ?? propertyKindOfQuantity` for the name, `formatOptions.quantity.persistenceUnit ?? propertyPersistenceUnit` for the unit.
2. **Property-side pair.** `(propertyKindOfQuantity, propertyPersistenceUnit)` — skipped when identical to the effective pair, and skipped entirely when `persistenceUnit` names a *different* unit than the property's own (see below).

The first pair whose format-props lookup **and** persistence-unit lookup both succeed in the active provider wins. If none succeeds, `"quantity"` and `"coordinate"` fields fall back to their raw string representation (`value.toString()` for `"quantity"`, a `(x, y[, z])` tuple for `"coordinate"`).

The property-side fallback is a **presentation** fallback only. `kindOfQuantity` chooses how a magnitude is displayed, so falling back to the property's KoQ yields a different-looking but still correct number. `persistenceUnit` is a statement about what the stored magnitude *means*: a field declaring `persistenceUnit: "Units.FT"` asserts that the `2.5` stored on the property is 2.5 feet. Formatting that `2.5` through the property's metre-based pair would render `"2.5 m"` — a plausible-looking, durable value off by the conversion factor, with nothing to signal the substitution. So when `persistenceUnit` disagrees with the property's persistence unit, there is no fallback: either the requested pair is pre-warmed, or the field renders raw and the shortfall appears on [FieldFormattingSpecProvider.misses]($backend). A `persistenceUnit` that merely restates the property's own unit, or is omitted entirely, leaves the fallback in place.

This is worth knowing when deciding what to pre-warm: a field carrying a `persistenceUnit` override is the one case where a warm-up gap cannot be papered over by the schema, so field-derived requirements ([ElementDrivesTextAnnotation.collectFieldFormattingRequirements]($backend)) are mandatory for those fields — [FieldFormattingSpecProvider.collectSchemaFormattingRequirements]($backend) cannot see a unit no property declares.

Core does not carry a built-in coordinate format: coordinate presentation is application policy and belongs to the FormatsProvider / FormatSet supplied by the host. Coordinate values whose EC property has no KindOfQuantity require the caller to declare **both** `kindOfQuantity` and `persistenceUnit` in `formatOptions.quantity` for an override to take effect — Core does not synthesize a persistence unit from the [BIS geometry meters convention](../bis/guide/other-topics/units.md). Callers that want that convention should pass `Units.LENGTH.M` (from `@itwin/core-quantity`) explicitly.

The same rule applies to a field that indexes into a string property holding serialized JSON (for example `JsonProperties`). A numeric leaf is treated as a `"quantity"`, but it has no EC property behind it and therefore no property-side pair to fall through to — so declare **both** `kindOfQuantity` and `persistenceUnit` to have it formatted. Declaring one or neither is harmless: the field renders its raw value, exactly as it would have without a quantity type. A JSON `null` resolves to no value at all, so the field displays its invalid-content indicator rather than a stringified null.

#### Adopting a FormatSet

Register the FormatSet your application has adopted for an iModel, **when the iModel opens**. Registration is asynchronous: it pre-warms a [FormatterSpec]($core-quantity) for every field requirement it can find, so that subsequent evaluation needs no `await`.

```typescript
const provider = await ElementDrivesTextAnnotation.registerFieldFormattingProvider({
  iModel,
  formatSet,
  requirements: FieldFormattingSpecProvider.collectSchemaFormattingRequirements(iModel),
});
iModel.onBeforeClose.addOnce(() => ElementDrivesTextAnnotation.unregisterFieldFormattingProvider(iModel));
```

Registering at open matters because field evaluation fires from `TxnManager` callbacks on any source-element edit. An edit that lands before registration completes formats without the provider and persists a raw string, and — since registering does not walk existing annotations — that field is not revisited until the next edit to the same source.

##### Deciding what to warm

`requirements` is mandatory, and Core performs **no discovery of its own** — it never walks the iModel looking for annotations to warm. That decision belongs to the application, which already owns the FormatSets and knows which drawing, sheet or view is in scope in a way Core cannot. Three sources compose:

| Source | Answers | Cost |
| --- | --- | --- |
| [FieldFormattingSpecProvider.collectSchemaFormattingRequirements]($backend) | every KindOfQuantity the iModel's schemas declare | two metadata queries; independent of model size |
| [ElementDrivesTextAnnotation.collectFieldFormattingRequirements]($backend) | one `TextBlock`, deduplicated | proportional to that block |
| [ElementDrivesTextAnnotation.getFieldFormattingRequirements]($backend) | one `FieldRun` | negligible |

`collectSchemaFormattingRequirements` is a sensible floor because its cost is bounded by the schemas rather than the data. It is **not** sufficient on its own: it sees only pairs a _property_ declares, so it cannot see a field whose `formatOptions.quantity.persistenceUnit` overrides that unit, nor a `"coordinate"` or no-KindOfQuantity field where both halves of the key come from the field's own overrides. Leaving those unwarmed is not a cosmetic shortfall — evaluation resolves the property's pair instead and scales the value by the wrong unit.

Applications that allow such overrides should also gather requirements from the annotations themselves. Because the overrides are persisted under their public property names, a targeted query finds the ones that need attention without loading every annotation:

```typescript
// Pass 1: the two built-in classes carry TextAnnotationData, so the substring test runs inside
// SQLite and non-overriding annotations never reach JavaScript.
const sql = `
  SELECT ECInstanceId FROM BisCore.TextAnnotation2d
    WHERE TextAnnotationData LIKE '%"kindOfQuantity"%' OR TextAnnotationData LIKE '%"persistenceUnit"%'
  UNION ALL
  SELECT ECInstanceId FROM BisCore.TextAnnotation3d
    WHERE TextAnnotationData LIKE '%"kindOfQuantity"%' OR TextAnnotationData LIKE '%"persistenceUnit"%'`;
```

Note that `BisCore.ITextAnnotation` is a mixin and does **not** carry `TextAnnotationData`, so it cannot be filtered this way. Applications with their own `ITextAnnotation` implementations need a second pass over those classes, excluding the two built-ins already covered. Getting either pass wrong yields _zero rows_, which is indistinguishable from "this iModel has no overrides" — so treat [FieldFormattingSpecProvider.misses]($backend) as the check that the requirement set was complete, not as an error report.

For each matched element, walk its blocks and accumulate:

```typescript
const requirements = ids.flatMap((id) =>
  iModel.elements.getElement<TextAnnotation2d>(id).getTextBlocks().flatMap((b) =>
    ElementDrivesTextAnnotation.collectFieldFormattingRequirements({ iModel, block: b.textBlock })));
```

A block authored later in the session may need a spec the initial warm-up never saw. Warm it before writing the annotation:

```typescript
await provider.warmUp(ElementDrivesTextAnnotation.collectFieldFormattingRequirements({ iModel, block }));
```

Most applications adopt exactly one FormatSet per iModel. To mix presentations within a single iModel — imperial callouts on an otherwise metric drawing, say — supply additional FormatSets, each paired with an application-chosen id, and have individual fields name one via `formatOptions.quantity.formatSet`:

```typescript
await ElementDrivesTextAnnotation.registerFieldFormattingProvider({
  iModel,
  formatSet,                                      // applies to every field that names no other
  formatSets: [{ id: imperialFormatSetId, formatSet: imperialFormatSet }],
});
```

Generally speaking, the formatSet id should be the id of the FormatSet definition element, but as core does not enforce the definition element workflow, this is typed as a string.

This is still a **single** registration. One `FieldFormattingSpecProvider` holds every FormatSet the iModel uses — each is warmed into its own bucket, and fields select among them at evaluation time. There is no need to register once per FormatSet, and no need to swap providers to change which presentation a given field gets.

The `unitSystem` used to pick a KindOfQuantity's presentation format when its schema offers several defaults to the adopted FormatSet's own [FormatSet.unitSystem]($ecschema-metadata), or `"metric"` when no FormatSet is adopted. Override it with `unitSystem` on the same arguments.

Registrations are keyed by [IModelDb]($backend) and are **process-wide** — Core never sweeps them automatically, so unregister when the iModel closes. Provider lifetime is deliberately the application's to manage. Forgetting to unregister pins the iModel's [SchemaContext]($ecschema-metadata), and the closed `IModelDb` behind it, alive for the lifetime of the process; and although [IModel.key]($common) is a fresh GUID on each open by default, an application that supplies its own stable `key` when opening will find the stale registration again on reopen and format against a closed schema context. Registering a provider does **not** reformat existing annotations; applications that need to refresh already-persisted `cachedContent` must re-evaluate the affected blocks explicitly. Symmetrically, unregistering a provider that saved annotations depend on causes the next source-element edit to overwrite their formatted `cachedContent` with the raw string representation.

Keep a provider registered for as long as the annotations depending on it are editable. Note that this is only a concern when _no_ provider is registered: a registered provider whose FormatSet lacks an entry for a field's KindOfQuantity still falls back to that KoQ's presentation format from the iModel's schemas, so the field renders as `"2.5 m"` rather than `"2.5"`. Changing the adopted FormatSet needs only a second `registerFieldFormattingProvider` call — each registration replaces the prior one after its pre-warm completes, so there is no window in which the iModel has no provider. Unregistering first would create one.

#### Evaluating fields

[ElementDrivesTextAnnotation.evaluateFields]($backend) updates the [FieldRun.cachedContent]($common) of every field in the supplied [TextBlock]($common) and returns the number it changed:

```typescript
const numUpdated = ElementDrivesTextAnnotation.evaluateFields({ iModel, block });
```

It mutates the in-memory `TextBlock`; **it does not persist**. Callers that want the formatted output to survive the session must assign the updated block back to the owning element (for example via `TextAnnotation2d.setAnnotation` / `TextAnnotation3d.setAnnotation`) and call `element.update()` inside a transaction. The same evaluation runs automatically from the `TxnManager` field-update callbacks when a source element changes, which is why it cannot be asynchronous.

If a field needs a spec that was never warmed, it renders as its raw string representation and the shortfall is recorded on the provider. Applications can detect this, warm the gap, and re-evaluate:

```typescript
if (provider.misses.length > 0) {
  await provider.warmUp(provider.misses);
  provider.clearMisses();
  ElementDrivesTextAnnotation.evaluateFields({ iModel, block });
}
```

## Electron 44 support

In addition to [already supported Electron versions](../learning/SupportedPlatforms.md#electron), iTwin.js now supports [Electron 44](https://www.electronjs.org/blog/electron-44-0).
