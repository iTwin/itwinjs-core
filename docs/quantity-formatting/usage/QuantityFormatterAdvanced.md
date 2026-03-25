# QuantityFormatter Lifecycle & Integration

This page covers the [QuantityFormatter]($frontend) lifecycle APIs — readiness signals, spec registration, multi-system access, and auto-refreshing handles. These complement the core [Parsing and Formatting](./ParsingAndFormatting.md) workflows and [Provider](./Providers.md) setup.

## Who should read this

| Role | Question you're asking | Jump to |
|------|----------------------|---------|
| **Application Developer** | "How do I know when formatting is ready after app init?" | [Readiness & Initialization](#readiness--initialization) |
| **Tool Provider** | "How do I register my domain's formatting specs and keep them fresh across reloads?" | [Spec Provider Integration](#spec-provider-integration) |
| **Tool Developer** | "How do I get auto-refreshing specs for my measure tool?" | [FormatSpecHandle](#formatspechandle) |
| **Tool Consumer** | "How do I display a formatted value in my UI component and keep it current?" | [FormatSpecHandle](#formatspechandle), [Multi-System Access](#multi-system-access) |

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

> **Ordered vs Unordered:** [onFormattingReady]($frontend) fires listeners in insertion order. [onFormattingReadyUnordered]($frontend) uses a Set-backed [BeUnorderedEvent]($bentley) where listeners can safely add/remove themselves during emission — used internally by [FormatSpecHandle]($frontend).

## Spec Provider Integration

This section is for teams that **supply domain-specific formatting specs** to the [QuantityFormatter]($frontend) registry — for example, Civil's `DisplayUnitFormatter` or any package that provides KindOfQuantity definitions beyond the built-in defaults.

### The problem

When the formatter reloads (unit system change, provider change, app init), the internal spec registry is rebuilt from `IModelApp.formatsProvider`. Any specs your domain registered via [addFormattingSpecsToRegistry]($frontend) are lost and need to be re-registered.

### The pattern

1. Subscribe to [onFormattingReady]($frontend) to know when a reload has completed
2. In your listener, call [addFormattingSpecsToRegistry]($frontend) to re-register your domain's KoQ specs
3. Downstream tool consumers using [FormatSpecHandle](#formatspechandle) or [getSpecsByNameAndUnit](#getspecsbynameandunit) will pick up the re-registered specs automatically on the next `onFormattingReady` cycle

<details>
<summary>Example: Domain spec provider that re-registers on reload</summary>

```ts
[[include:Quantity_Formatting.SpecProviderIntegration]]
```

</details>

### Composite-keyed registry

The spec registry is keyed by both KindOfQuantity name **and** persistence unit. This means the same KoQ with different persistence units can coexist — for example, `"CivilUnits.LENGTH"` with `"Units.M"` and `"CivilUnits.LENGTH"` with `"Units.FT"`.

Use [QuantityFormatter.getSpecsByNameAndUnit]($frontend) to retrieve a specific entry by its composite key:

<details>
<summary>Example Code</summary>

```ts
[[include:Quantity_Formatting.GetSpecsByNameAndUnit]]
```

</details>

## Multi-System Access

All four unit systems (`metric`, `imperial`, `usCustomary`, `usSurvey`) are preloaded during every reload. You can access formatter and parser specs for **any** system synchronously — without changing the active system.

This is useful for dual-unit displays, comparison views, or tools that need to show values in a system other than the user's active preference.

<details>
<summary>Example: Format the same value in multiple unit systems</summary>

```ts
[[include:Quantity_Formatting.FindSpecBySystem]]
```

</details>

## FormatSpecHandle

[FormatSpecHandle]($frontend) is a cacheable, auto-refreshing handle to formatting specs. It's the recommended way for **tool developers** and **UI components** to hold a reference to a formatting spec without manually subscribing to reload events.

Key behaviors:
- **Fallback formatting** — `format(value)` returns `value.toString()` if specs aren't loaded yet, so your tool always produces output
- **Auto-refresh** — The handle subscribes to [onFormattingReadyUnordered]($frontend) and updates its internal specs on every reload
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

[FormatSpecHandle]($frontend) implements `Symbol.dispose`, so you can use a `using` declaration for automatic cleanup when the handle goes out of scope:

<details>
<summary>Example Code</summary>

```ts
[[include:Quantity_Formatting.FormatSpecHandle_Using]]
```

</details>

### When to use FormatSpecHandle vs onFormattingReady

| Pattern | Best for | Why |
|---------|----------|-----|
| `FormatSpecHandle` | Tool developers, UI components that format a specific KoQ | Zero boilerplate — just create, format, dispose. Auto-refreshes. |
| `onFormattingReady` | Spec providers that re-register domain specs, app-level orchestration | You need to run custom logic (re-registration, state sync) after each reload. |
| `isReady` / `whenInitialized` | App startup gates, lazy initialization | One-time checks before first use. |

## Migrating from Multiple Event Subscriptions

If your code subscribes to multiple [QuantityFormatter]($frontend) events to stay in sync with formatting changes, you can simplify by migrating to [onFormattingReady]($frontend) or [FormatSpecHandle]($frontend).

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

Replace all subscriptions with a single [onFormattingReady]($frontend) listener. It fires after every reload path — initialization, unit system changes, provider changes — guaranteed to run after the [QuantityFormatter]($frontend) has finished rebuilding its internal caches.

```ts
// ✅ Single terminal signal — covers all reload paths
const removeListener = IModelApp.quantityFormatter.onFormattingReady.addListener(async () => {
  // Re-register domain specs (safe — registry is rebuilt before this fires)
  await IModelApp.quantityFormatter.addFormattingSpecsToRegistry("MyDomain.PRESSURE", "Units.PA");
  refreshDisplay();
});

// Single unsubscribe on teardown
removeListener();
```

**Option B — For tool developers and UI components** (recommended):

Replace event subscriptions entirely with [FormatSpecHandle]($frontend). Each handle auto-refreshes when formatting changes and provides a `format()` method with a built-in fallback:

```ts
// ✅ No event subscriptions needed
const handle = IModelApp.quantityFormatter.getFormatSpecHandle(
  "DefaultToolsUnits.LENGTH", "Units.M",
);

// Always produces output — auto-refreshes on formatting changes
label.textContent = handle.format(distanceInMeters);

// Clean up on teardown
handle.dispose();
```

### Migration summary

| Old pattern | New pattern | When to use |
|-------------|-------------|-------------|
| 2-4 event subscriptions + manual spec re-fetch | `onFormattingReady` | You re-register domain specs or run custom reload logic |
| Event subscription + `findFormatterSpecByQuantityType()` | `FormatSpecHandle` | You format values for display in a tool or UI component |
| Guard pattern against double-subscription | Neither needed | `onFormattingReady` fires exactly once per reload; `FormatSpecHandle` manages its own subscription |

## See Also

- [Providers](./Providers.md) - Setting up UnitsProvider and FormatsProvider
- [Parsing and Formatting](./ParsingAndFormatting.md) - FormatterSpec, ParserSpec, and tool integration patterns
- [Migrating from QuantityType to KindOfQuantity](./ParsingAndFormatting.md#migrating-from-quantitytype-to-kindofquantity)
