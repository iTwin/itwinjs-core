/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/

/*
 * Demonstrates a Drawing-Production-style integration of an app-owned [FormatSet]($ecschema-metadata)
 * with the FieldRun formatting pathway exposed by `@itwin/core-backend`.
 *
 * The keyin `dta text demo <on|off>` toggles this integration for the current iModel
 * (see `TextDecoration.ts` and the `enable`/`disableFieldFormattingDemo` IPC methods on
 * [[DtaIpcInterface]]):
 *   1. `dta text demo on` adopts [[DEMO_FORMAT_SET]] for the iModel via
 *      [ElementDrivesTextAnnotation.registerFieldFormattingProvider]($backend), which
 *      asynchronously pre-warms a [FormatterSpec]($core-quantity) for every
 *      [FieldRun]($common) requirement it can find. `dta text demo off` unregisters.
 *   2. Thereafter every `"quantity"` / `"coordinate"` FieldRun in the iModel formats through
 *      the demo formats **synchronously**, including on the txn-callback path that recomputes
 *      cached content when a source element changes.
 *   3. `TextImpl.insertText` / `updateText` and `Backend.generateTextAnnotationGeometry` warm
 *      the provider for the block they are about to handle, so fields authored in this session
 *      are hot before the txn commits.
 *
 * Because there is a single, synchronous evaluation path, all three entry points render
 * identical strings for a given block.
 *
 * ## Two FormatSets
 *
 * Two sets are registered so that per-field FormatSet routing is exercisable:
 *
 *   * [[DEMO_FORMAT_SET]] (id [[DEMO_FORMAT_SET_ID]]) is **adopted** for the iModel, so it
 *     applies to every field that names no FormatSet of its own. It is also registered as an
 *     addressable set, so a field may name it explicitly.
 *   * [[DEMO_ALT_FORMAT_SET]] (id [[DEMO_ALT_FORMAT_SET_ID]]) is addressable only. It
 *     deliberately **redefines a few** of the adopted set's keys and **omits the rest**, so a
 *     field naming it demonstrates all three legs of the resolution chain:
 *     alt set -> adopted set -> the iModel's schema formats.
 *
 * See [[DEMO_ALT_SEED_FORMATS]] for which keys overlap and which do not.
 *
 * NOTE: the unit system used to pick a *schema* presentation format is provider-wide (taken
 * from the adopted set), not per-bucket. `DEMO_ALT_FORMAT_SET.unitSystem` therefore governs
 * only the formats the alt set itself defines; a field that falls all the way through to the
 * schema still resolves against the adopted set's `"metric"`.
 *
 * `dta text misses` reports requirements that evaluation asked for but that were never
 * pre-warmed, which is what distinguishes "this format did not resolve" from "this format was
 * never warmed" when a field renders as a raw string.
 *
 * This is intentionally minimal - it exists to exercise the pathway from DTA, not to be a
 * production-quality implementation.
 */

import { ElementDrivesTextAnnotation, FieldFormattingSpecProvider, IModelDb, UnresolvedFieldFormat } from "@itwin/core-backend";
import { Id64String } from "@itwin/core-bentley";
import { TextBlock } from "@itwin/core-common";
import { FormatProps, FormattingSpecArgs } from "@itwin/core-quantity";
import { FormatSet } from "@itwin/ecschema-metadata";

export const DEMO_SEED_FORMATS: { readonly [name: string]: FormatProps } = {
  "Demo.LENGTH_M": {
    formatTraits: ["keepSingleZero", "showUnitLabel"],
    precision: 4,
    type: "Decimal",
    uomSeparator: " ",
    decimalSeparator: ".",
    composite: { units: [{ label: "[#]m", name: "Units.M" }] },
  },
  "Demo.LENGTH_MM": {
    formatTraits: ["keepSingleZero", "showUnitLabel"],
    precision: 1,
    type: "Decimal",
    uomSeparator: " ",
    decimalSeparator: ".",
    composite: { units: [{ label: "[*]mm", name: "Units.MM" }] },
  },
  "Demo.LENGTH_CM": {
    formatTraits: ["keepSingleZero", "showUnitLabel"],
    precision: 2,
    type: "Decimal",
    uomSeparator: " ",
    decimalSeparator: ".",
    composite: { units: [{ label: "[+]cm", name: "Units.CM" }] },
  },
  "Demo.LENGTH_FT": {
    formatTraits: ["keepSingleZero", "showUnitLabel"],
    precision: 3,
    type: "Decimal",
    uomSeparator: " ",
    decimalSeparator: ".",
    composite: { units: [{ label: "[~]ft", name: "Units.FT" }] },
  },
  "Demo.LENGTH_FT_IN": {
    formatTraits: ["keepSingleZero", "showUnitLabel"],
    precision: 8,
    type: "Fractional",
    uomSeparator: "",
    decimalSeparator: ".",
    composite: {
      units: [
        { label: "[^]'", name: "Units.FT" },
        { label: `[v]"`, name: "Units.IN" },
      ],
    },
  },
  // Marker-tagged stand-in for AecUnits.LENGTH_SHORT so the "KoQ override" scenario in
  // `dta text test` produces visible output even when the iModel's schema context has no
  // AecUnits schema loaded.
  "AecUnits.LENGTH_SHORT": {
    formatTraits: ["keepSingleZero", "showUnitLabel"],
    precision: 2,
    type: "Decimal",
    uomSeparator: " ",
    decimalSeparator: ".",
    composite: { units: [{ label: "[*]mm", name: "Units.MM" }] },
  },
  // Area seeds — persistence unit is Units.SQ_M (see DEMO_SEED_PERSISTENCE_UNITS).
  "Demo.AREA_M2": {
    formatTraits: ["keepSingleZero", "showUnitLabel"],
    precision: 4,
    type: "Decimal",
    uomSeparator: " ",
    decimalSeparator: ".",
    composite: { units: [{ label: "[$]m²", name: "Units.SQ_M" }] },
  },
  "Demo.AREA_MM2": {
    formatTraits: ["keepSingleZero", "showUnitLabel"],
    precision: 2,
    type: "Decimal",
    uomSeparator: " ",
    decimalSeparator: ".",
    composite: { units: [{ label: "[%]mm²", name: "Units.SQ_MM" }] },
  },
  "Demo.AREA_FT2": {
    formatTraits: ["keepSingleZero", "showUnitLabel"],
    precision: 4,
    type: "Decimal",
    uomSeparator: " ",
    decimalSeparator: ".",
    composite: { units: [{ label: "[&]ft²", name: "Units.SQ_FT" }] },
  },
  // Angle seeds. Two variants so both possible Rotation persistence conventions
  // (BIS `GeometricElement2d.Placement.Rotation` can be authored as either) render:
  //   * ANGLE_DEG_FROM_DEG: persistence = ARC_DEG, no unit conversion; use when the
  //     property is stored in degrees.
  //   * ANGLE_DEG_FROM_RAD: persistence = RAD, converts radians -> degrees for display;
  //     use when the property is stored in radians (AecUnits.ANGLE convention).
  "Demo.ANGLE_DEG_FROM_DEG": {
    formatTraits: ["keepSingleZero", "showUnitLabel"],
    precision: 3,
    type: "Decimal",
    uomSeparator: "",
    decimalSeparator: ".",
    composite: { units: [{ label: "[°d]°", name: "Units.ARC_DEG" }] },
  },
  "Demo.ANGLE_DEG_FROM_RAD": {
    formatTraits: ["keepSingleZero", "showUnitLabel"],
    precision: 3,
    type: "Decimal",
    uomSeparator: "",
    decimalSeparator: ".",
    composite: { units: [{ label: "[°r]°", name: "Units.ARC_DEG" }] },
  },
  "Demo.ANGLE_RAD": {
    formatTraits: ["keepSingleZero", "showUnitLabel"],
    precision: 4,
    type: "Decimal",
    uomSeparator: " ",
    decimalSeparator: ".",
    composite: { units: [{ label: "[θ]rad", name: "Units.RAD" }] },
  },
  // Slope seeds — persistence unit is Units.M_PER_M (SI slope ratio). Two variants:
  //   * SLOPE_M_PER_M: pass-through decimal (0.05 -> 0.0500 [/]m/m).
  //   * SLOPE_HORIZONTAL_PER_VERTICAL: inverted to Units.HORIZONTAL_PER_VERTICAL so 0.05 m/m renders as ~20
  //     ("1:20" convention rendered as a decimal magnitude with the [⁄]:1 label).
  // Units.PERCENT belongs to the PERCENTAGE phenomenon, not SLOPE, so a percent-style
  // seed would need a Ratio format or cross-phenomenon conversion (out of scope for the
  // demo). Use SLOPE_M_PER_M as the canonical ratio presentation.
  "Demo.SLOPE_M_PER_M": {
    formatTraits: ["keepSingleZero", "showUnitLabel"],
    precision: 4,
    type: "Decimal",
    uomSeparator: " ",
    decimalSeparator: ".",
    composite: { units: [{ label: "[/]m/m", name: "Units.M_PER_M" }] },
  },
  "Demo.SLOPE_HORIZONTAL_PER_VERTICAL": {
    formatTraits: ["keepSingleZero", "showUnitLabel"],
    precision: 2,
    type: "Decimal",
    uomSeparator: "",
    decimalSeparator: ".",
    composite: { units: [{ label: "[\u2044]:1", name: "Units.HORIZONTAL_PER_VERTICAL" }] },
  },
};

/** Formats defined by [[DEMO_ALT_FORMAT_SET]], the *addressable* set a [FieldRun]($common)
 * opts into via [QuantityFieldFormatOptions.formatSet]($common).
 *
 * The overlap with [[DEMO_SEED_FORMATS]] is deliberate, so one fixture can exercise every leg
 * of the resolution chain:
 *
 *   * **Redefined** (`Demo.LENGTH_M`, `Demo.AREA_M2`, `Demo.ANGLE_DEG_FROM_DEG`,
 *     `Demo.SLOPE_M_PER_M`) - present in both sets. A field naming this set renders the `[alt]`
 *     variant; the same field without it renders the adopted variant.
 *   * **Alt-only** (`Demo.ALT_ONLY_LENGTH`) - resolvable *only* when the field names this set.
 *     Naming it otherwise falls through to the schema, and then to the raw string.
 *   * **Omitted** (every other `Demo.*` key) - a field naming this set still resolves them,
 *     because this set falls back to the adopted set. Proves the fallthrough is live.
 */
export const DEMO_ALT_SEED_FORMATS: { readonly [name: string]: FormatProps } = {
  // Redefinitions of adopted keys — same name, visibly different presentation.
  "Demo.LENGTH_M": {
    formatTraits: ["keepSingleZero", "showUnitLabel"],
    precision: 3,
    type: "Decimal",
    uomSeparator: " ",
    decimalSeparator: ".",
    composite: { units: [{ label: "[alt]ft", name: "Units.FT" }] },
  },
  "Demo.AREA_M2": {
    formatTraits: ["keepSingleZero", "showUnitLabel"],
    precision: 3,
    type: "Decimal",
    uomSeparator: " ",
    decimalSeparator: ".",
    composite: { units: [{ label: "[alt]ft²", name: "Units.SQ_FT" }] },
  },
  "Demo.ANGLE_DEG_FROM_DEG": {
    formatTraits: ["keepSingleZero", "showUnitLabel"],
    precision: 1,
    type: "Decimal",
    uomSeparator: " ",
    decimalSeparator: ".",
    composite: { units: [{ label: "[alt]deg", name: "Units.ARC_DEG" }] },
  },
  "Demo.SLOPE_M_PER_M": {
    formatTraits: ["keepSingleZero", "showUnitLabel"],
    precision: 2,
    type: "Decimal",
    uomSeparator: "",
    decimalSeparator: ".",
    composite: { units: [{ label: "[alt]:1", name: "Units.HORIZONTAL_PER_VERTICAL" }] },
  },
  // Defined only here. A field must name DEMO_ALT_FORMAT_SET_ID to resolve it.
  "Demo.ALT_ONLY_LENGTH": {
    formatTraits: ["keepSingleZero", "showUnitLabel"],
    precision: 2,
    type: "Decimal",
    uomSeparator: " ",
    decimalSeparator: ".",
    composite: { units: [{ label: "[alt-only]in", name: "Units.IN" }] },
  },
};

/** Persistence unit each seed expects to be compiled against, across both demo FormatSets.
 * Seeds not listed here default to the `defaultPersistenceUnitName` passed to
 * [[demoSeedRequirements]] (`Units.M`). Required for any seed whose composite unit belongs to
 * a phenomenon other than LENGTH.
 */
const DEMO_SEED_PERSISTENCE_UNITS: { readonly [name: string]: string } = {
  "Demo.AREA_M2": "Units.SQ_M",
  "Demo.AREA_MM2": "Units.SQ_M",
  "Demo.AREA_FT2": "Units.SQ_M",
  "Demo.ANGLE_DEG_FROM_DEG": "Units.ARC_DEG",
  "Demo.ANGLE_DEG_FROM_RAD": "Units.RAD",
  "Demo.ANGLE_RAD": "Units.RAD",
  "Demo.SLOPE_M_PER_M": "Units.M_PER_M",
  "Demo.SLOPE_HORIZONTAL_PER_VERTICAL": "Units.M_PER_M",
};

/** [Id64String]($bentley) under which [[DEMO_FORMAT_SET]] is registered as an *addressable*
 * set, so a [FieldRun]($common) may name it explicitly via
 * [QuantityFieldFormatOptions.formatSet]($common). Naming it is equivalent to naming nothing,
 * since the same set is also adopted for the iModel.
 */
export const DEMO_FORMAT_SET_ID: Id64String = "0xd01";

/** [Id64String]($bentley) under which [[DEMO_ALT_FORMAT_SET]] is registered. A
 * [FieldRun]($common) must name this via [QuantityFieldFormatOptions.formatSet]($common) to
 * resolve against the alternate presentations.
 */
export const DEMO_ALT_FORMAT_SET_ID: Id64String = "0xd02";

/** The [FormatSet]($ecschema-metadata) **adopted** by the demo. Registering it makes every
 * `Demo.*` key above resolvable as a `kindOfQuantity` override, and overrides any real KoQ
 * that shares a name (see `AecUnits.LENGTH_SHORT`). Keys the set does not define fall through
 * to the iModel's own schema formats.
 */
export const DEMO_FORMAT_SET: FormatSet = {
  name: "dta-field-formatting-demo",
  label: "DTA Field Formatting Demo",
  unitSystem: "metric",
  formats: DEMO_SEED_FORMATS,
};

/** The alternate [FormatSet]($ecschema-metadata), addressable per-field via
 * [[DEMO_ALT_FORMAT_SET_ID]]. Not adopted, so it applies only to fields that name it.
 */
export const DEMO_ALT_FORMAT_SET: FormatSet = {
  name: "dta-field-formatting-demo-alt",
  label: "DTA Field Formatting Demo (alternate)",
  unitSystem: "imperial",
  formats: DEMO_ALT_SEED_FORMATS,
};

/** Every key defined by either demo FormatSet, paired with the persistence unit it must be
 * compiled against, so the demo formats are usable as `kindOfQuantity` overrides even for
 * properties the iModel has never seen.
 *
 * Warming the union matters because [FieldFormattingSpecProvider.warmUp]($backend) warms every
 * bucket with every requirement: an alt-only key must be warmed for the alt bucket to hold it.
 */
function demoSeedRequirements(defaultPersistenceUnitName: string = "Units.M"): FormattingSpecArgs[] {
  const names = new Set([...Object.keys(DEMO_SEED_FORMATS), ...Object.keys(DEMO_ALT_SEED_FORMATS)]);
  return Array.from(names, (name) => ({
    name,
    persistenceUnitName: DEMO_SEED_PERSISTENCE_UNITS[name] ?? defaultPersistenceUnitName,
  }));
}

let currentDemo: FieldFormattingSpecProvider | undefined;
let currentDemoIModel: IModelDb | undefined;
let currentDemoCloseUnsubscribe: (() => void) | undefined;

/** Returns the provider registered by [[enableFieldFormattingDemo]], if any. */
export function getFieldFormattingDemo(): FieldFormattingSpecProvider | undefined {
  return currentDemo;
}

/** Warms the demo provider for the [FieldRun]($common)s in `block`, so the synchronous
 * evaluation that follows finds every spec it needs in cache. A no-op when the demo is off.
 */
export async function prepareFieldFormattingDemoFor(iModel: IModelDb, block: TextBlock): Promise<void> {
  if (!currentDemo)
    return;

  await currentDemo.warmUp(ElementDrivesTextAnnotation.collectFieldFormattingRequirements({ iModel, block }));
}

/** Adopts [[DEMO_FORMAT_SET]] for `iModel`, pre-warming both the demo seeds and every field
 * requirement already persisted in the iModel. Toggled by the `dta text demo <on|off>` keyin.
 *
 * The registration is torn down automatically when `iModel` closes (via
 * [IModelDb.onBeforeClose]($backend)) so it cannot outlive the briefcase it was warmed against.
 */
export async function enableFieldFormattingDemo(iModel: IModelDb): Promise<void> {
  // Re-entrancy: tear down any prior registration and its onBeforeClose subscription first
  // so we never leak a listener if the keyin is invoked twice or across iModels.
  disableFieldFormattingDemo();

  currentDemo = await ElementDrivesTextAnnotation.registerFieldFormattingProvider({
    iModel,
    // Both sets are addressable so a field can name either one; the adopted set is listed too
    // so that naming it explicitly is meaningful rather than an unresolved id.
    formatSets: [
      { id: DEMO_FORMAT_SET_ID, formatSet: DEMO_FORMAT_SET },
      { id: DEMO_ALT_FORMAT_SET_ID, formatSet: DEMO_ALT_FORMAT_SET },
    ],
    requirements: [
      ...demoSeedRequirements(),
      ...ElementDrivesTextAnnotation.collectIModelFieldFormattingRequirements(iModel),
    ],
  });
  currentDemoIModel = iModel;
  currentDemoCloseUnsubscribe = iModel.onBeforeClose.addOnce(() => disableFieldFormattingDemo());
}

/** Returns the requirements the demo provider was asked for during evaluation but had never
 * pre-warmed. A field that renders as a raw string is listed here only if nothing was warmed
 * for it; a field that *was* warmed but whose format or unit failed to resolve is not. That
 * distinction is what makes a raw fallback diagnosable. Surfaced by `dta text misses`.
 */
export function getFieldFormattingDemoMisses(): UnresolvedFieldFormat[] {
  return currentDemo?.misses ?? [];
}

/** Discards the accumulated [[getFieldFormattingDemoMisses]], so the next evaluation reports
 * only fresh shortfalls. Surfaced by `dta text misses clear`.
 */
export function clearFieldFormattingDemoMisses(): void {
  currentDemo?.clearMisses();
}

/** Unregisters the demo provider previously registered via [[enableFieldFormattingDemo]]
 * and detaches the [IModelDb.onBeforeClose]($backend) listener that would otherwise fire it.
 * Safe to call when no demo is registered.
 */
export function disableFieldFormattingDemo(): void {
  if (currentDemoCloseUnsubscribe) {
    currentDemoCloseUnsubscribe();
    currentDemoCloseUnsubscribe = undefined;
  }
  if (currentDemoIModel) {
    ElementDrivesTextAnnotation.unregisterFieldFormattingProvider(currentDemoIModel);
    currentDemoIModel = undefined;
  }
  currentDemo = undefined;
}
