# Thermo-Nuclear Code Quality Review — `hl662/revisit-formatted-quantity-description`

Reviewed diff: merge-base `1a7e070dcf` → `HEAD` (`aa1d9d64ac`).

**Goal context:** lean out `core-frontend`, rooted in removing the dependence on `QuantityType`. This review is framed against that goal — the deprecation is directionally right, but the current shape spreads complexity instead of deleting it, which works *against* leaning the package out for consumers.

**Verdict: Changes requested.** Behavior and deprecation bookkeeping are clean. One dominant structural regression drives the rest of the diff: the PR deletes an encapsulation and replaces it with copy-paste boilerplate in three places.

---

## 1. 🔴 Blocker — replacement helper is hidden as `internal`, so the same logic is hand-rolled 3×

`createQuantityDescription` was written precisely because the `FormatSpecHandle → PropertyDescription` boilerplate is real and worth encapsulating — then buried in `core/frontend/src/properties/internal/` where nothing outside core-frontend can reach it. Direct consequences in this same diff:

- `core/frontend/.../internal/QuantityDescriptionHelpers.ts` → `createQuantityDescription` (the good version)
- `editor/.../ProjectLocation/ProjectGeolocation.ts` → `makeAnglePropertyDescription` **and** `makeLengthPropertyDescription` (re-rolled ×2)
- `example-code/.../frontend/Formatting.ts` → `createLengthPropertyDescription` (re-rolled ×3)
- `docs/.../usage/ParsingAndFormatting.md` → tells every **external** consumer to hand-roll ~25 lines per call site

Ergonomics regression. The deprecated path was one line:

```ts
new LengthDescription("cameraHeight", label)
```

The blessed replacement is a ~25-line `PropertyDescription` literal every caller must copy. The entire reason `LengthDescription` existed was to encapsulate that. Deprecating it **without a public replacement** (commit `e98fc430ef` "deprecate … without replacement helpers" shows this was deliberate) does not remove complexity — it copies it outward onto every consumer, including third parties who cannot see the internal helper.

**This is the part that fights the stated goal.** "Lean out core-frontend / drop `QuantityType`" should mean: the public surface gets *simpler and cheaper to consume*, and the `QuantityType`-era machinery disappears behind a thinner canonical entry point. Instead, the package sheds the classes but pushes their replacement boilerplate onto every call site and the docs. Leaner internals, heavier consumers — net complexity moved, not deleted.

**Code-judo move:** promote `createQuantityDescription` to a real exported helper (public `$frontend`, or at minimum cross-package). Then:

- delete `makeAnglePropertyDescription` + `makeLengthPropertyDescription` from the editor and call the canonical one,
- point the example snippet and the new docs section at it,
- migration becomes a one-liner swap: `new LengthDescription(name, label)` → `createQuantityDescription({ … })`, instead of boilerplate transcription.

`getFormatSpecHandle`, `PropertyDescription`, and `CustomFormattedNumberParams` are all already public, so nothing forces this helper to stay internal. If there is a deliberate reason not to bless a new public frontend API, it needs to be stated explicitly — the cost is triplicated load-bearing logic plus a *worse* migration than the thing being deprecated.

---

## 2. 🟠 Divergent parse-success checks — canonical guard exists, two of three copies reimplement it worse

Core helper uses the canonical guard:

```ts
if (parseResult && Parser.isParsedQuantity(parseResult))   // QuantityDescriptionHelpers.ts:32
```

Editor + example instead duck-type by hand, identically, in three spots:

```ts
if (result !== undefined && "value" in result && typeof result.value === "number")
// ProjectGeolocation.ts:39, :64 ; Formatting.ts:239
```

That is a bespoke reimplementation of `Parser.isParsedQuantity` — less readable, and not guaranteed to track `ParsedQuantity` if its shape changes. Classic "bespoke helper where a canonical utility exists," and it is parse logic copied 3×. Consolidating (Finding #1) deletes all three. If separate impls are kept for any reason, they must call `Parser.isParsedQuantity`.

---

## 3. 🟠 The PR contradicts its own guidance on persistence units

Same pattern, three sourcing styles in one PR:

- `ViewTool.ts`: `getDefaultPersistenceUnit(Phenomena.LENGTH)` ✅
- `ProjectGeolocation.ts`: hardcoded `"Units.M"` / `"Units.RAD"`
- docs added in this PR: *"If you prefer to look up the persistence unit programmatically rather than hardcoding a string, use `getDefaultPersistenceUnit`…"*

So the editor code written in this PR does the thing the docs written in this same PR steer people away from. A single canonical helper (taking a `Phenomena`, or resolving the persistence unit internally) erases the drift.

---

## 4. 🟡 `as CustomFormattedNumberParams` cast repeated in all three impls

Each copy needs `} as CustomFormattedNumberParams]`. A cast on an object literal means it does not structurally satisfy the target without help — an unclear boundary being papered over, now copied 3×. Understand *why* the cast is needed (missing/excess property? union discriminant?) and fix the shape once in the canonical helper rather than propagating the cast. Subsumed by #1 if consolidated.

---

## Smaller notes (non-blocking)

- The two editor helpers differ only by koq name, unit, and parse-error key — one parameterized function even before considering cross-package reuse. Folds into #1.
- `ViewTool.ts` is already 4,638 lines; this PR nets it slightly smaller. No file crosses the 1k threshold — size rule satisfied.
- Deprecation tags, `core-frontend.api.md`, `core-frontend.exports.csv`, changelog, and the `type`-only import tightening all look correct and complete.
- `MapTilingScheme.rootLevel` union reorder (`0 | -1` → `-1 | 0`) is unrelated api-extractor churn — confirm it matches CI-canonical ordering before committing (known spurious-diff footgun on macOS).

---

## Bottom line

The deprecation bookkeeping is solid, but the core design choice — deprecate the encapsulation, keep its replacement `internal` — pushes the same ~25-line block into the editor (×2), the example (×1), and every downstream consumer via the docs. That is complexity *spread*, not deleted, and it runs counter to the "lean out core-frontend" goal: the package's internals get lighter while every consumer gets heavier.

Promote one canonical, exported helper; delete the editor duplicates; the parse-check divergence and persistence-unit drift collapse out for free. That is the version that actually leans the package out *and* makes the `QuantityType` removal a clean one-liner migration.

### Argument to take to the main session
1. We are deprecating an ergonomic one-line API and replacing it with copy-paste boilerplate — that is a regression for consumers, not a lean-out.
2. The proof it should be encapsulated is that *we already encapsulated it* (`createQuantityDescription`) — we just hid it. Export it.
3. Without a public helper, the editor package and the docs immediately re-rolled it 3× with a worse, ad-hoc parse check. That is the duplication tax made visible.
4. A single exported helper makes the `QuantityType` → `kindOfQuantityName` migration a one-liner and keeps the canonical parse/format logic in exactly one place.
