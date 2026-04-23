# QuantityFormatter Lifecycle & Integration

This page covers the [QuantityFormatter]($frontend) lifecycle APIs — readiness signals, spec registration, multi-system access, and auto-refreshing handles. These complement the core [Parsing and Formatting](./ParsingAndFormatting.md) workflows and [Provider](./Providers.md) setup.

## Who should read this

| Role | Question you're asking | Jump to |
|------|----------------------|---------|
| **Application Developer** | "How do I know when formatting is ready after app init?" | [Readiness & Initialization](#readiness--initialization) |
| **Tool Provider** | "How do I register my domain's formatting specs and keep them fresh across reloads?" | [Spec Provider Integration](#spec-provider-integration) |
| **Tool Developer** | "How do I get auto-refreshing specs for my measure tool?" | [FormatSpecHandle](#formatspechandle) |
| **Tool Consumer** | "How do I display a formatted value in my UI component and keep it current?" | [FormatSpecHandle](#formatspechandle), [Multi-System KoQ Access](#multi-system-koq-access) |

## Readiness & Initialization

The [QuantityFormatter]($frontend) loads formatting and parsing specs asynchronously. Specs are not available immediately after `IModelApp.startup()` — you need to synchronize with the readiness lifecycle.

### whenInitialized

[QuantityFormatter.whenInitialized]($frontend) is a one-shot promise that resolves after the first successful initialization. It resolves once and stays resolved — safe to `await` at any point in app startup.

<details>
<summary>Example Code</summary>

```ts
[[include:Quantity_Formatting.WhenInitialized]]
```

</details>

### isReady

[QuantityFormatter.isReady]($frontend) is a synchronous boolean. Returns `false` until the first reload completes, then `true`. Use it as a guard before synchronous spec lookups.

<details>
<summary>Example Code</summary>

```ts
[[include:Quantity_Formatting.IsReady]]
```

</details>

### onFormattingReady

[QuantityFormatter.onFormattingReady]($frontend) fires after **every** reload completes — initialization, unit system changes, and provider changes. This is the primary signal for keeping UI and caches in sync.

<details>
<summary>Example Code</summary>

```ts
[[include:Quantity_Formatting.OnFormattingReady]]
```

</details>

> **Set-backed event:** [QuantityFormatter.onFormattingReady]($frontend) uses [BeUnorderedUiEvent]($bentley) — a Set-backed event where listeners can safely add or remove themselves during emission and unsubscribe in O(1) via the closure returned by `addListener()`.

## Spec Provider Integration

This section is for teams that **supply domain-specific formatting specs** to the [QuantityFormatter]($frontend) registry — for example, Civil's `DisplayUnitFormatter` or any package that provides KindOfQuantity definitions beyond the built-in defaults.

### The problem

When the formatter reloads (unit system change, provider change, app init), the internal spec registry is rebuilt from `IModelApp.formatsProvider`. Any specs your domain registered via [QuantityFormatter.addFormattingSpecsToRegistry]($frontend) are lost and need to be re-registered.

### The pattern

1. Subscribe to [QuantityFormatter.onBeforeFormattingReady]($frontend) to register async work **before** the formatter is considered ready
2. In your listener, call `collector.addPendingWork(promise)` with a promise that re-registers your domain's KoQ specs via [QuantityFormatter.addFormattingSpecsToRegistry]($frontend)
3. The formatter awaits all pending work (with a 10-second timeout) before emitting [QuantityFormatter.onFormattingReady]($frontend)
4. Downstream tool consumers using [FormatSpecHandle](#formatspechandle) or [getSpecsByNameAndUnit](#getspecsbynameandunit) will see your domain specs immediately when `onFormattingReady` fires

> **Event ordering note:** The formatter follows a two-phase ready flow:
>
> 1. **`onBeforeFormattingReady`** — Fires first. Providers register async work via the [FormattingReadyCollector]($quantity) passed to listeners. Call `collector.addPendingWork(promise)` to register each async task.
> 2. The formatter **awaits** all pending work (with a 10-second timeout). Rejections are logged as warnings but do not block readiness.
> 3. **`onFormattingReady`** — Fires after all provider work has settled. Consumers can now safely read specs knowing all providers have finished registering.
>
> **Pattern:** Providers use `onBeforeFormattingReady`, consumers use `onFormattingReady`.

<details>
<summary>Example: Registering async provider work before formatting is ready</summary>

```ts
[[include:Quantity_Formatting.BeforeFormattingReady]]
```

</details>

<details>
<summary>Example: Domain spec provider that re-registers on reload</summary>

```ts
[[include:Quantity_Formatting.SpecProviderIntegration]]
```

</details>

### Composite-keyed registry

The spec registry is keyed by KindOfQuantity name, persistence unit, **and** unit system (`[koqName][persistenceUnit][unitSystem]`). This means the same KoQ with different persistence units or different unit systems can coexist.

Use [QuantityFormatter.getSpecsByNameAndUnit]($frontend) to retrieve a specific entry by its composite key. Pass an optional `system` parameter to retrieve specs for a non-active unit system:

<details>
<summary>Example Code</summary>

```ts
[[include:Quantity_Formatting.GetSpecsByNameAndUnit]]
```

</details>

## Multi-System KoQ Access

The spec registry supports storing and retrieving specs for multiple unit systems simultaneously. This is useful when you need to display the same measurement in different unit systems — for example, showing both metric and imperial values side-by-side.

- [QuantityFormatter.getSpecsByNameAndUnit]($frontend) accepts an optional `system` parameter to retrieve specs for a specific unit system
- [FormatSpecHandle]($quantity) accepts an optional `system` parameter to pin the handle to a specific unit system
- [QuantityFormatter.addFormattingSpecsToRegistry]($frontend) accepts an optional `system` parameter to register specs for a specific unit system

<details>
<summary>Example: Format a KoQ in multiple unit systems</summary>

```ts
[[include:Quantity_Formatting.MultiSystemKoQ]]
```

</details>

## FormatSpecHandle

[FormatSpecHandle]($quantity) is a cacheable, auto-refreshing handle to formatting specs. It's the recommended way for **tool developers** and **UI components** to hold a reference to a formatting spec without manually subscribing to reload events.

Key behaviors:
- **Fallback formatting** — `format(value)` returns `value.toString()` if specs aren't loaded yet, so your tool always produces output
- **Auto-refresh** — The handle subscribes to [QuantityFormatter.onFormattingReady]($frontend) and updates its internal specs on every reload
- **Disposable** — Call `dispose()` or use a `using` declaration to unsubscribe from events and avoid leaks

### Basic Usage

Create a handle via [QuantityFormatter.getFormatSpecHandle]($frontend), use it to format values, and dispose when done:

<details>
<summary>Example Code</summary>

```ts
[[include:Quantity_Formatting.FormatSpecHandle_Basic]]
```

</details>

### Using Declaration

[FormatSpecHandle]($quantity) implements `Symbol.dispose`, so you can use a `using` declaration for automatic cleanup when the handle goes out of scope:

<details>
<summary>Example Code</summary>

```ts
[[include:Quantity_Formatting.FormatSpecHandle_Using]]
```

</details>

### When to use FormatSpecHandle vs events

| Pattern | Best for | Why |
|---------|----------|-----|
| `FormatSpecHandle` | Tool developers, UI components that format a specific KoQ | Zero boilerplate — just create, format, dispose. Auto-refreshes. |
| `onBeforeFormattingReady` | Spec providers that register domain specs, async loading | Async work is awaited before the formatter is considered ready. Specs are available to all `onFormattingReady` consumers. |
| `onFormattingReady` | Consumers that refresh UI or read specs after each reload | Fires after all provider work has settled — safe to read any registered specs. |
| `isReady` / `whenInitialized` | App startup gates, lazy initialization | One-time checks before first use. |

## Migrating from Multiple Event Subscriptions

If your code subscribes to multiple [QuantityFormatter]($frontend) events to stay in sync with formatting changes, you can simplify by migrating to [QuantityFormatter.onFormattingReady]($frontend) or [FormatSpecHandle]($quantity).

### Before: Multiple event subscriptions

A common legacy pattern involves subscribing to several events to cover all the ways formatting can change:

```ts
// ❌ Old pattern — subscribing to multiple events
const unsubscribers = [
  IModelApp.quantityFormatter.onActiveFormattingUnitSystemChanged.addListener(() => {
    refreshDisplay();
  }),
  IModelApp.quantityFormatter.onQuantityFormatsChanged.addListener(() => {
    refreshDisplay();
  }),
  IModelApp.formatsProvider.onFormatsChanged.addListener(async () => {
    await rebuildCaches();
    refreshDisplay();
  }),
];
// Must remember to unsubscribe all on teardown
```

Each of these events covers a different reload trigger, but they all mean the same thing: "formatting specs have changed."

### After: Single event or auto-refreshing handle

**Option A — For spec providers** (packages that register domain KoQs):

Replace all subscriptions with [QuantityFormatter.onBeforeFormattingReady]($frontend). Register your async loading work via the [FormattingReadyCollector]($quantity) — the formatter awaits all pending work before emitting [QuantityFormatter.onFormattingReady]($frontend).

```ts
// ✅ Provider work is awaited before formatting is considered ready
const removeListener = IModelApp.quantityFormatter.onBeforeFormattingReady.addListener((collector) => {
  collector.addPendingWork(
    IModelApp.quantityFormatter.addFormattingSpecsToRegistry("MyDomain.PRESSURE", "Units.PA")
  );
});

// Single unsubscribe on teardown
removeListener();
```

**Option B — For tool developers and UI components** (recommended):

Replace event subscriptions entirely with [FormatSpecHandle]($quantity). Each handle auto-refreshes when formatting changes and provides a `format()` method with a built-in fallback:

```ts
// ✅ No event subscriptions needed
const handle = IModelApp.quantityFormatter.getFormatSpecHandle(
  "DefaultToolsUnits.LENGTH", "Units.M",
);

// Always produces output — auto-refreshes on formatting changes
label.textContent = handle.format(distanceInMeters);

// Clean up on teardown
handle[Symbol.dispose]();
```

### Migration summary

| Old pattern | New pattern | When to use |
|-------------|-------------|-------------|
| 2-4 event subscriptions + async spec registration | `onBeforeFormattingReady` | You re-register domain specs or perform async loading before ready |
| Event subscription + manual spec re-fetch | `onFormattingReady` | You refresh UI or read specs after each reload |
| Event subscription + `findFormatterSpecByQuantityType()` | `FormatSpecHandle` | You format values for display in a tool or UI component |
| Guard pattern against double-subscription | Neither needed | Events fire exactly once per reload; `FormatSpecHandle` manages its own subscription |

## See Also

- [Providers](./Providers.md) - Setting up UnitsProvider and FormatsProvider
- [Parsing and Formatting](./ParsingAndFormatting.md) - FormatterSpec, ParserSpec, and tool integration patterns
- [Migrating from QuantityType to KindOfQuantity](./ParsingAndFormatting.md#migrating-from-quantitytype-to-kindofquantity)
