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
 * This is intentionally minimal - it exists to exercise the pathway from DTA, not to be a
 * production-quality implementation.
 */

import { ElementDrivesTextAnnotation, FieldFormattingSpecProvider, IModelDb } from "@itwin/core-backend";
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

/** Persistence unit each seed in [[DEMO_SEED_FORMATS]] expects to be compiled against.
 * Seeds not listed here default to the `defaultPersistenceUnitName` passed to
 * [[demoSeedRequirements]] (`Units.M`). Required for any seed whose
 * composite unit belongs to a phenomenon other than LENGTH.
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

/** The [FormatSet]($ecschema-metadata) adopted by the demo. Registering it makes every
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

/** Every [[DEMO_FORMAT_SET]] entry paired with the persistence unit it must be compiled
 * against, so the demo formats are usable as `kindOfQuantity` overrides even for properties
 * the iModel has never seen.
 */
function demoSeedRequirements(defaultPersistenceUnitName: string = "Units.M"): FormattingSpecArgs[] {
  return Object.keys(DEMO_SEED_FORMATS).map((name) => ({
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
    formatSet: DEMO_FORMAT_SET,
    requirements: [
      ...demoSeedRequirements(),
      ...ElementDrivesTextAnnotation.collectIModelFieldFormattingRequirements(iModel),
    ],
  });
  currentDemoIModel = iModel;
  currentDemoCloseUnsubscribe = iModel.onBeforeClose.addOnce(() => disableFieldFormattingDemo());
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
