# Quantity formatting for text annotation fields

A [FieldRun]($common) is a run inside a [TextBlock]($common) that displays the value of a property on some other element, rather than literal text the author typed. When the source element changes, the field's cached display string is recomputed so the annotation stays in step with the data it describes.

A property stores its value in one unit, but an annotation usually needs to display it in another: a length persisted in meters may have to read as millimeters on one drawing and feet on the next. Fields whose target property resolves to a `"quantity"` or `"coordinate"` value bridge that gap by rendering through the standard iTwin.js quantity formatting pipeline.

Formatting stays on the backend, because text layout is a backend concern. For the mechanics of the relationship that keeps fields up to date, see [ElementDrivesTextAnnotation]($backend).

## Format one field

An application adopts a [FormatSet]($ecschema-metadata) for an iModel, then evaluates the blocks that need it:

[[include:TextAnnotationFields.HappyPath]]

Three things have to line up:

- **A FormatSet** naming the KindOfQuantity to present and the units to present it in.
- **A registration**, which pre-warms a [FormatterSpec]($quantity) for every requirement it is given. This is the only asynchronous step.
- **An evaluation**, which formats the fields in a block using the warmed specs.

## Evaluating fields

[ElementDrivesTextAnnotation.evaluateFields]($backend) updates the [FieldRun.cachedContent]($common) of every field in the supplied [TextBlock]($common) and returns the number it changed:

[[include:TextAnnotationFields.EvaluateFields]]

It mutates the in-memory `TextBlock`; **it does not persist**. Callers that want the formatted output to survive the session must assign the updated block back to the owning element (for example via [TextAnnotation2d.setAnnotation]($backend) / [TextAnnotation3d.setAnnotation]($backend)) and call `element.update()` inside a transaction.

The same evaluation runs automatically from the `TxnManager` field-update callbacks when a source element changes. Those callbacks are synchronous, which is why evaluation is too — and why every asynchronous step (resolving formats, loading units, building specs) happens up front, at registration.

## Overrides and format resolution

A property resolves to `"quantity"` if it is numeric (`double`, `int` or `long`); `point2d` and `point3d` resolve to `"coordinate"`. Classifying a property as `"quantity"` only decides whether the formatting pipeline is consulted for it — a value that resolves no format still renders as a bare number, so counts and identifiers are unaffected.

A field that should not simply inherit its property's KindOfQuantity configures the [QuantityFieldFormatOptions]($common) block on [FieldFormatOptions]($common):

[[include:TextAnnotationFields.ConfigureFieldRun]]

`kindOfQuantity` and `persistenceUnit` are **independent** overrides: setting one falls through to the property side for the other. This lets a caller pin how a value is formatted (via `kindOfQuantity`) while still reading the persistence unit from the EC property, or vice versa.

For each `"quantity"` or `"coordinate"` field the formatter looks up a [FormatterSpec]($quantity) by (KindOfQuantity name, persistence unit name) pair, in this order:

1. **Effective override pair.** `formatOptions.quantity.kindOfQuantity ?? propertyKindOfQuantity` for the name, `formatOptions.quantity.persistenceUnit ?? propertyPersistenceUnit` for the unit.
2. **Property-side pair.** `(propertyKindOfQuantity, propertyPersistenceUnit)` — skipped when identical to the effective pair, and skipped entirely when `persistenceUnit` names a *different* unit than the property's own.

The first pair whose format-props lookup **and** persistence-unit lookup both succeed in the active provider wins. If none succeeds, `"quantity"` and `"coordinate"` fields fall back to their raw string representation (`value.toString()` for `"quantity"`, a `(x, y[, z])` tuple for `"coordinate"`).

## Managing warm-up

Register the FormatSet your application has adopted for an iModel **when the iModel opens**:

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

`collectSchemaFormattingRequirements` is a sensible floor because its cost is bounded by the schemas rather than by the data. It enumerates every KindOfQuantity the schemas declare — referenced by a property or not — each paired with its own persistence unit.

What it cannot see are any `persistenceUnit`/`kindOfQuantity` pairs overridden by **fields** inside annotation elements. The schema has no knowledge of these. Any annotations that contain pairs not declared by the schema will fall back to their raw string representations. Applications that allow such overrides should gather requirements from the annotations themselves as well — see [Advanced](#advanced) below for a query that finds them.

A block authored later in the session may need a spec the initial warm-up never saw. Warm it before writing the annotation:

[[include:TextAnnotationFields.WarmBeforeWrite]]

### Repairing a gap

If a field needs a spec that was never warmed, it renders as its raw string representation and the shortfall is recorded on the provider. Applications can detect this, warm the gap, and re-evaluate:

[[include:TextAnnotationFields.HandleMisses]]

Because Core never discovers requirements on its own, [FieldFormattingSpecProvider.misses]($backend) is the check that a requirement set is complete — treat it as an expected part of an incremental workflow rather than an error report.

## Multiple FormatSets and provider lifetime

To mix formats within a single iModel:

[[include:TextAnnotationFields.MultipleFormatSets]]

Generally speaking, the FormatSet id should be the id of the FormatSet definition element, but as Core does not enforce the definition element workflow, this is typed as a string. If two entries share an id, the last one wins.

This is still a **single** registration. One [FieldFormattingSpecProvider]($backend) holds every FormatSet the iModel uses — each is warmed into its own bucket, and fields select among them at evaluation time. There is no need to register once per FormatSet, and no need to swap providers to change which format a given field gets.

### Provider lifetime

Registrations are keyed by [IModelDb]($backend) and are **process-wide** — Core never sweeps them automatically, so unregister when the iModel closes. Provider lifetime is deliberately the application's to manage.

Forgetting to unregister pins the iModel's [SchemaContext]($ecschema-metadata), and the closed `IModelDb` behind it, alive for the lifetime of the process. And although [IModel.key]($common) is a fresh GUID on each open by default, an application that supplies its own stable `key` when opening will find the stale registration again on reopen and format against a closed schema context.

Registering a provider does **not** reformat existing annotations; applications that need to refresh already-persisted `cachedContent` must re-evaluate the affected blocks explicitly. Symmetrically, unregistering a provider that saved annotations depend on causes the next source-element edit to overwrite their formatted `cachedContent` with the raw string representation.

Keep a provider registered for as long as the annotations depending on it are editable. Note that this is only a concern when *no* provider is registered: a registered provider whose FormatSet lacks an entry for a field's KindOfQuantity still falls back to that KoQ's presentation format from the iModel's schemas, so the field renders as `"2.5 m"` rather than `"2.5"`.

Changing the adopted FormatSet needs only a second `registerFieldFormattingProvider` call — each registration replaces the prior one after its pre-warm completes, so there is no window in which the iModel has no provider. Unregistering first would create one.

## Advanced

<details>
<summary><strong>Coordinates and JSON values</strong></summary>

Core does not carry a built-in coordinate format: how coordinates are formatted is application policy and belongs to the FormatsProvider / FormatSet supplied by the host. Coordinate values whose EC property has no KindOfQuantity require the caller to declare **both** `kindOfQuantity` and `persistenceUnit` in `formatOptions.quantity` for an override to take effect — Core does not synthesize a persistence unit from the [BIS geometry meters convention](../../bis/guide/other-topics/units.md). Callers that want that convention should pass `Units.LENGTH.M` (from `@itwin/core-quantity`) explicitly.

The same rule applies to a field that indexes into a string property holding serialized JSON (for example `JsonProperties`). A numeric leaf is treated as a `"quantity"`, but it has no EC property behind it and therefore no property-side pair to fall through to — so declare **both** `kindOfQuantity` and `persistenceUnit` to have it formatted. Declaring one or neither is harmless: the field renders its raw value, exactly as it would have without a quantity type. A JSON `null` resolves to no value at all, so the field displays its invalid-content indicator rather than a stringified null.

</details>

<details>
<summary><strong>Finding annotations that override their property's units</strong></summary>

Because field overrides are persisted under their public property names, a targeted query finds the annotations that need attention without loading every annotation:

[[include:TextAnnotationFields.QueryOverridingAnnotations]]

Note that `BisCore.ITextAnnotation` is a mixin and does **not** carry `TextAnnotationData`, so it cannot be filtered this way. Applications with their own `ITextAnnotation` implementations need a second pass over those classes, excluding the two built-ins already covered.

For each matched element, walk its blocks and accumulate:

[[include:TextAnnotationFields.CollectBlockRequirements]]

</details>
