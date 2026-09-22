# Quantity formatting for text annotation fields

A [FieldRun]($common) is a run inside a [TextBlock]($common) that displays the value of a property on some other element, rather than literal text the author typed. When the source element changes, the field's cached display string is recomputed so the annotation stays in step with the data it describes.

A property stores its value in one unit, but an annotation usually needs to display it in another: a length persisted in meters may have to read as millimeters on one drawing and feet on the next. Fields whose target property resolves to a `"quantity"` or `"coordinate"` value bridge that gap by rendering through the standard iTwin.js quantity formatting pipeline.

Formatting stays on the backend, because text layout is a backend concern. For the mechanics of the relationship that keeps fields up to date, see [ElementDrivesTextAnnotation]($backend).

## Format one field

An application adopts a [FormatSet]($ecschema-metadata) for an iModel, then evaluates the blocks that need it:

[[include:TextAnnotationFields.HappyPath]]

Three things have to line up:

- **A FormatSet** naming the KindOfQuantity to present and the units to present it in.
- **A registration**, which adopts the FormatSet for the iModel. It is synchronous and does no work up front.
- **An evaluation**, which formats the fields in a block. Each [FormatterSpec]($quantity) is built the first time a field asks for it and reused for every field that asks afterwards.

## Evaluating fields

[ElementDrivesTextAnnotation.evaluateFields]($backend) updates the [FieldRun.cachedContent]($common) of every field in the supplied [TextBlock]($common) and returns the number it changed:

[[include:TextAnnotationFields.EvaluateFields]]

It mutates the in-memory `TextBlock`; **it does not persist**. Callers that want the formatted output to survive the session must assign the updated block back to the owning element (for example via [TextAnnotation2d.setAnnotation]($backend) / [TextAnnotation3d.setAnnotation]($backend)) and call `element.update()` inside a transaction.

The same evaluation runs automatically from the `TxnManager` field-update callbacks when a source element changes. Those callbacks are synchronous, which is why evaluation is too. Resolving a format, looking up its units and building the spec are all synchronous on the backend — the iModel's [SchemaContext]($ecschema-metadata) loads schemas synchronously, and the bundled BIS units need no loading at all — so nothing has to be prepared ahead of time.

## Overrides and format resolution

A property resolves to `"quantity"` if it is numeric (`double`, `int` or `long`); `point2d` and `point3d` resolve to `"coordinate"`. Classifying a property as `"quantity"` only decides whether the formatting pipeline is consulted for it — a value that resolves no format still renders as a bare number, so counts and identifiers are unaffected.

A field that should not simply inherit its property's KindOfQuantity configures the [QuantityFieldFormatOptions]($common) block on [FieldFormatOptions]($common):

[[include:TextAnnotationFields.ConfigureFieldRun]]

`kindOfQuantity` and `persistenceUnit` are **independent** overrides: setting one falls through to the property side for the other. This lets a caller control how a value is formatted (via `kindOfQuantity`) while still reading the persistence unit from the EC property, or vice versa.

For each `"quantity"` or `"coordinate"` field the formatter looks up a [FormatterSpec]($quantity) by (KindOfQuantity name, persistence unit name) pair, in this order:

1. **Effective override pair.** `formatOptions.quantity.kindOfQuantity ?? propertyKindOfQuantity` for the name, `formatOptions.quantity.persistenceUnit ?? propertyPersistenceUnit` for the unit.
2. **Property-side pair.** `(propertyKindOfQuantity, propertyPersistenceUnit)` — skipped when identical to the effective pair, and skipped entirely when `persistenceUnit` names a *different* unit than the property's own.

Skipping the property-side pair when the units disagree is deliberate. `kindOfQuantity` only chooses how a magnitude is displayed, so falling back to the property's is harmless. `persistenceUnit` instead states what the stored magnitude *means*: a field declaring `Units.FT` asserts the `2.5` on the property is 2.5 feet, and formatting it through the property's meter-based pair would render `2.5 m` — off by the conversion factor, with nothing to signal the substitution. So a disagreeing `persistenceUnit` renders raw rather than falling back.

The first pair whose format-props lookup **and** persistence-unit lookup both succeed in the active provider wins. If none succeeds, `"quantity"` and `"coordinate"` fields fall back to their raw string representation (`value.toString()` for `"quantity"`, a `(x, y[, z])` tuple for `"coordinate"`).

## Registering a provider

Register the FormatSet your application has adopted for an iModel **when the iModel opens**:

[[include:TextAnnotationFields.AdoptFormatSet]]

Registering at open matters because field evaluation fires from `TxnManager` callbacks on any source-element edit. An edit that lands before registration formats without the provider and persists a raw string, and — since registering does not walk existing annotations — that field is not revisited until the next edit to the same source.

Core performs **no discovery of its own**: it never walks the iModel looking for annotations, and it does not need to. The first evaluation of a given (KindOfQuantity, persistence unit) pair builds and caches its spec, so the cost of formatting is proportional to the number of *distinct* pairs the fields actually use, not to the size of the iModel.

### Units

Unit lookup uses the units bundled with `@itwin/core-quantity` — the `Units` schema that BIS-based iModels share. A persistence unit or format unit defined only by a custom schema in the iModel is not recognized; a field depending on one renders raw and is recorded as a miss (below).

### Diagnosing unformatted fields

If a field needs a spec the provider cannot build — its KindOfQuantity is defined by neither a registered FormatSet nor the iModel's schemas, or one of its units is not a bundled unit — it renders as `value.toString()` and the request is recorded on the provider. Applications can inspect and clear these:

[[include:TextAnnotationFields.HandleMisses]]

A pair that failed once is remembered as failing, so the misses list does not grow on every re-evaluation of the same field. Treat [FieldFormattingSpecProvider.misses]($backend) as a diagnostic for FormatSets or annotations that are out of step with each other rather than as an error report.

## Multiple FormatSets and provider lifetime

To mix formats within a single iModel:

[[include:TextAnnotationFields.MultipleFormatSets]]

Generally speaking, the FormatSet id should be the id of the FormatSet definition element, but as Core does not enforce the definition element workflow, this is typed as a string. If two entries share an id, the last one wins.

This is still a **single** registration. One [FieldFormattingSpecProvider]($backend) holds every FormatSet the iModel uses — each FormatSet's formats are cached separately, and fields select among them at evaluation time. There is no need to register once per FormatSet, and no need to swap providers to change which format a given field gets.

### Provider lifetime

Registrations are keyed by [IModelDb]($backend) and are **process-wide** — Core never removes them automatically, so unregister when the iModel closes. Provider lifetime is deliberately the application's to manage.

Forgetting to unregister keeps the iModel's [SchemaContext]($ecschema-metadata), and the closed `IModelDb` behind it, in memory for the lifetime of the process. And although [IModel.key]($common) is a fresh GUID on each open by default, an application that supplies its own stable `key` when opening will find the stale registration again on reopen and format against a closed schema context.

Registering a provider does **not** reformat existing annotations; applications that need to refresh already-persisted `cachedContent` must re-evaluate the affected blocks explicitly. Symmetrically, unregistering a provider that saved annotations depend on causes the next source-element edit to overwrite their formatted `cachedContent` with the raw string representation.

Keep a provider registered for as long as the annotations depending on it are editable. Note that this is only a concern when *no* provider is registered: a registered provider whose FormatSet lacks an entry for a field's KindOfQuantity still falls back to that KoQ's presentation format from the iModel's schemas, so the field renders as `"2.5 m"` rather than `"2.5"`.

Changing the adopted FormatSet needs only a second `registerFieldFormattingProvider` call — each registration replaces the prior one, so there is no window in which the iModel has no provider. Unregistering first would create one.

## Advanced

<details>
<summary><strong>Coordinates and JSON values</strong></summary>

Core does not carry a built-in coordinate format: how coordinates are formatted is application policy and belongs to the FormatsProvider / FormatSet supplied by the host. Coordinate values whose EC property has no KindOfQuantity require the caller to declare **both** `kindOfQuantity` and `persistenceUnit` in `formatOptions.quantity` for an override to take effect — Core does not synthesize a persistence unit from the [BIS geometry meters convention](../../bis/guide/other-topics/units.md). Callers that want that convention should pass `Units.LENGTH.M` (from `@itwin/core-quantity`) explicitly.

The same rule applies to a field that indexes into a string property holding serialized JSON (for example `JsonProperties`). A numeric leaf is treated as a `"quantity"`, but it has no EC property behind it and therefore no property-side pair to fall through to — so declare **both** `kindOfQuantity` and `persistenceUnit` to have it formatted. Declaring one or neither is harmless: the field renders its raw value, exactly as it would have without a quantity type. A JSON `null` resolves to no value at all, so the field displays its invalid-content indicator rather than a stringified null.

</details>
