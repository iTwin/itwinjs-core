# Quantity formatting for text annotation fields

A [FieldRun]($common) is a run inside a [TextBlock]($common) that displays the value of a property on some other element, rather than literal text the author typed. When the source element changes, the field's cached display string is recomputed so the annotation stays in step with the data it describes.

Fields whose target property resolves to a `"quantity"` or `"coordinate"` value are rendered through the standard iTwin.js quantity formatting pipeline, so a length persisted in meters can display as millimeters, feet, or whatever units the application has adopted.

This article covers how that pipeline is configured and what an application must do to switch it on. For the mechanics of the relationship that keeps fields up to date, see [ElementDrivesTextAnnotation]($backend).

## Quantity and coordinate properties

A property resolves to `"quantity"` if it is numeric (`double`, `int` or `long`); `point2d` and `point3d` resolve to `"coordinate"`.

Classifying a property as `"quantity"` only decides whether the formatting pipeline is consulted for it. A value that resolves no format, because neither the property nor the field names a KindOfQuantity, still renders as a bare number — so counts and identifiers are unaffected.

> **Note:** an `int` property carrying a KindOfQuantity previously rendered as a bare number and now renders as a formatted quantity. One persisting 2500 mm under a KindOfQuantity presenting meters changes from `2500` to `2.5 m`.

Formatting stays on the backend, because text layout is a backend concern. Field evaluation itself is **synchronous**, because it has to run inside the `TxnManager` update callbacks that recompute cached content when a source element changes. Everything asynchronous — resolving formats, loading units, building [FormatterSpec]($quantity)s — happens once, up front, when an application adopts a [FormatSet]($ecschema-metadata) for an iModel.

Because the formatting types are part of this API, `@itwin/core-quantity` is a **peer dependency** of both `@itwin/core-common` and `@itwin/core-backend`. Applications that depend on either package but do not already list `@itwin/core-quantity` must add it, at the same version as the rest of their iTwin.js core packages.

## Configuring a FieldRun

Field-level formatting is configured via the [QuantityFieldFormatOptions]($common) block on [FieldFormatOptions]($common):

[[include:TextAnnotationFields.ConfigureFieldRun]]

`kindOfQuantity` and `persistenceUnit` are **independent** overrides: setting one falls through to the property side for the other. This lets a caller pin how a value is formatted (via `kindOfQuantity`) while still reading the persistence unit from the EC property, or vice versa.

## Format resolution

For each `"quantity"` or `"coordinate"` field the formatter looks up a [FormatterSpec]($quantity) by (KindOfQuantity name, persistence unit name) pair, in this order:

1. **Effective override pair.** `formatOptions.quantity.kindOfQuantity ?? propertyKindOfQuantity` for the name, `formatOptions.quantity.persistenceUnit ?? propertyPersistenceUnit` for the unit.
2. **Property-side pair.** `(propertyKindOfQuantity, propertyPersistenceUnit)` — skipped when identical to the effective pair, and skipped entirely when `persistenceUnit` names a *different* unit than the property's own (see below).

The first pair whose format-props lookup **and** persistence-unit lookup both succeed in the active provider wins. If none succeeds, `"quantity"` and `"coordinate"` fields fall back to their raw string representation (`value.toString()` for `"quantity"`, a `(x, y[, z])` tuple for `"coordinate"`).

### Why the fallback changes formatting, not meaning

The property-side fallback affects only **how** a magnitude is formatted — never **what** it means.

`kindOfQuantity` chooses how a magnitude is formatted, so falling back to the property's KoQ yields a different-looking but still correct number.

`persistenceUnit` is a statement about what the stored magnitude *means*. A field declaring `persistenceUnit: "Units.FT"` asserts that the `2.5` stored on the property is 2.5 feet. Formatting that `2.5` through the property's meter-based pair would render `"2.5 m"` — a plausible-looking, durable value off by the conversion factor, with nothing to signal the substitution.

So when `persistenceUnit` disagrees with the property's persistence unit, there is no fallback: either the requested pair is pre-warmed, or the field renders raw and the shortfall appears on [FieldFormattingSpecProvider.misses]($backend). A `persistenceUnit` that merely restates the property's own unit, or is omitted entirely, leaves the fallback in place.

This matters when deciding what to pre-warm. A field carrying a `persistenceUnit` override is the one case where a warm-up gap cannot be papered over by the schema, so field-derived requirements ([ElementDrivesTextAnnotation.collectFieldFormattingRequirements]($backend)) are mandatory for those fields — [FieldFormattingSpecProvider.collectSchemaFormattingRequirements]($backend) cannot see a unit no property declares.

### Coordinates and JSON values

Core does not carry a built-in coordinate format: how coordinates are formatted is application policy and belongs to the FormatsProvider / FormatSet supplied by the host. Coordinate values whose EC property has no KindOfQuantity require the caller to declare **both** `kindOfQuantity` and `persistenceUnit` in `formatOptions.quantity` for an override to take effect — Core does not synthesize a persistence unit from the [BIS geometry meters convention](../../bis/guide/other-topics/units.md). Callers that want that convention should pass `Units.LENGTH.M` (from `@itwin/core-quantity`) explicitly.

The same rule applies to a field that indexes into a string property holding serialized JSON (for example `JsonProperties`). A numeric leaf is treated as a `"quantity"`, but it has no EC property behind it and therefore no property-side pair to fall through to — so declare **both** `kindOfQuantity` and `persistenceUnit` to have it formatted. Declaring one or neither is harmless: the field renders its raw value, exactly as it would have without a quantity type. A JSON `null` resolves to no value at all, so the field displays its invalid-content indicator rather than a stringified null.

## Adopting a FormatSet

Register the FormatSet your application has adopted for an iModel **when the iModel opens**. Registration is asynchronous: it pre-warms a [FormatterSpec]($quantity) for every field requirement it can find, so that subsequent evaluation needs no `await`.

[[include:TextAnnotationFields.AdoptFormatSet]]

Registering at open matters because field evaluation fires from `TxnManager` callbacks on any source-element edit. An edit that lands before registration completes formats without the provider and persists a raw string, and — since registering does not walk existing annotations — that field is not revisited until the next edit to the same source.

### Deciding what to warm

`requirements` is mandatory, and Core performs **no discovery of its own** — it never walks the iModel looking for annotations to warm. That decision belongs to the application, which already owns the FormatSets and knows which drawing, sheet or view is in scope in a way Core cannot.

Three sources compose:

| Source | Answers | Cost |
| --- | --- | --- |
| [FieldFormattingSpecProvider.collectSchemaFormattingRequirements]($backend) | every KindOfQuantity the iModel's schemas declare | two metadata queries; independent of model size |
| [ElementDrivesTextAnnotation.collectFieldFormattingRequirements]($backend) | one `TextBlock`, deduplicated | proportional to that block |
| [ElementDrivesTextAnnotation.getFieldFormattingRequirements]($backend) | one `FieldRun` | negligible |

`collectSchemaFormattingRequirements` is a sensible floor because its cost is bounded by the schemas rather than the data. It is **not** sufficient on its own: it sees only pairs a _property_ declares, so it cannot see a field whose `formatOptions.quantity.persistenceUnit` overrides that unit, nor a `"coordinate"` or no-KindOfQuantity field where both halves of the key come from the field's own overrides. Leaving those unwarmed is not a cosmetic shortfall — evaluation resolves the property's pair instead and scales the value by the wrong unit.

Applications that allow such overrides should also gather requirements from the annotations themselves. Because the overrides are persisted under their public property names, a targeted query finds the ones that need attention without loading every annotation:

[[include:TextAnnotationFields.QueryOverridingAnnotations]]

Note that `BisCore.ITextAnnotation` is a mixin and does **not** carry `TextAnnotationData`, so it cannot be filtered this way. Applications with their own `ITextAnnotation` implementations need a second pass over those classes, excluding the two built-ins already covered. Getting either pass wrong yields _zero rows_, which is indistinguishable from "this iModel has no overrides" — so treat [FieldFormattingSpecProvider.misses]($backend) as the check that the requirement set was complete, not as an error report.

For each matched element, walk its blocks and accumulate:

[[include:TextAnnotationFields.CollectBlockRequirements]]

A block authored later in the session may need a spec the initial warm-up never saw. Warm it before writing the annotation:

[[include:TextAnnotationFields.WarmBeforeWrite]]

### Mixing formats in one iModel

Most applications adopt exactly one FormatSet per iModel. To mix formats within a single iModel — imperial callouts on an otherwise metric drawing, say — supply additional FormatSets, each paired with an application-chosen id, and have individual fields name one via `formatOptions.quantity.formatSet`:

[[include:TextAnnotationFields.MultipleFormatSets]]

Generally speaking, the FormatSet id should be the id of the FormatSet definition element, but as core does not enforce the definition element workflow, this is typed as a string. If two entries share an id, the last one wins.

This is still a **single** registration. One [FieldFormattingSpecProvider]($backend) holds every FormatSet the iModel uses — each is warmed into its own bucket, and fields select among them at evaluation time. There is no need to register once per FormatSet, and no need to swap providers to change which format a given field gets.

The `unitSystem` used to pick a KindOfQuantity's presentation format when its schema offers several defaults to the adopted FormatSet's own [FormatSet.unitSystem]($ecschema-metadata), or `"metric"` when no FormatSet is adopted. Override it with `unitSystem` on the same arguments.

### Provider lifetime

Registrations are keyed by [IModelDb]($backend) and are **process-wide** — Core never sweeps them automatically, so unregister when the iModel closes. Provider lifetime is deliberately the application's to manage.

Forgetting to unregister pins the iModel's [SchemaContext]($ecschema-metadata), and the closed `IModelDb` behind it, alive for the lifetime of the process. And although [IModel.key]($common) is a fresh GUID on each open by default, an application that supplies its own stable `key` when opening will find the stale registration again on reopen and format against a closed schema context.

Registering a provider does **not** reformat existing annotations; applications that need to refresh already-persisted `cachedContent` must re-evaluate the affected blocks explicitly. Symmetrically, unregistering a provider that saved annotations depend on causes the next source-element edit to overwrite their formatted `cachedContent` with the raw string representation.

Keep a provider registered for as long as the annotations depending on it are editable. Note that this is only a concern when _no_ provider is registered: a registered provider whose FormatSet lacks an entry for a field's KindOfQuantity still falls back to that KoQ's presentation format from the iModel's schemas, so the field renders as `"2.5 m"` rather than `"2.5"`.

Changing the adopted FormatSet needs only a second `registerFieldFormattingProvider` call — each registration replaces the prior one after its pre-warm completes, so there is no window in which the iModel has no provider. Unregistering first would create one.

## Evaluating fields

[ElementDrivesTextAnnotation.evaluateFields]($backend) updates the [FieldRun.cachedContent]($common) of every field in the supplied [TextBlock]($common) and returns the number it changed:

[[include:TextAnnotationFields.EvaluateFields]]

It mutates the in-memory `TextBlock`; **it does not persist**. Callers that want the formatted output to survive the session must assign the updated block back to the owning element (for example via [TextAnnotation2d.setAnnotation]($backend) / [TextAnnotation3d.setAnnotation]($backend)) and call `element.update()` inside a transaction. The same evaluation runs automatically from the `TxnManager` field-update callbacks when a source element changes, which is why it cannot be asynchronous.

If a field needs a spec that was never warmed, it renders as its raw string representation and the shortfall is recorded on the provider. Applications can detect this, warm the gap, and re-evaluate:

[[include:TextAnnotationFields.HandleMisses]]
