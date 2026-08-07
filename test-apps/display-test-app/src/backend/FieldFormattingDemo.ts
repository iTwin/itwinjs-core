/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/

/*
 * Demonstrates a Drawing-Production-style integration of an app-owned
 * [FormattingSpecProvider]($core-quantity) with the FieldRun formatting pathways
 * exposed by `@itwin/core-backend`.
 *
 * The keyin `dta text demo <on|off|throw>` toggles this integration for the current iModel
 * (see `TextDecoration.ts` and the `enable`/`disableFieldFormattingDemo` IPC methods on
 * [[DtaIpcInterface]]):
 *   1. `dta text demo on` registers [[FieldFormattingDemoProvider]] with
 *      `onMissingSpec: "fallback"`. `dta text demo throw` registers it with
 *      `onMissingSpec: "throw"`. `dta text demo off` unregisters.
 *   2. Fields whose `formatOptions.quantity.formatSet` equals `DEMO_FORMAT_SET_ID`
 *      (`"0xDEMO"`) format through the demo provider. When enabled:
 *      - `TextImpl.insertText` / `updateText` call [[FieldFormattingDemoProvider.prepareForBlock]]
 *        before writing the annotation, so the [FormatterSpec]($core-quantity)s required by
 *        any [FieldRun]($common)s in the block are hot before the txn commits.
 *      - The provider is registered against the iModel via
 *        [ElementDrivesTextAnnotation.registerFieldFormattingProvider]($backend), so the txn
 *        callback path that recomputes field content synchronously routes through the provider.
 *      - `Backend.generateTextAnnotationGeometry` passes the same underlying
 *        [FormatsProvider]($core-quantity) and [UnitsProvider]($core-quantity) to
 *        [ElementDrivesTextAnnotation.evaluateFieldsAsync]($backend), so the async pathway
 *        used to render dynamic geometry produces the same output as the sync one.
 *
 * This is intentionally minimal - it exists to exercise the new pathways from DTA, not to
 * be a production-quality implementation.
 */

import { ElementDrivesTextAnnotation, IModelDb } from "@itwin/core-backend";
import { TextBlock } from "@itwin/core-common";
import { createUnitsProvider, Format, FormatProps, FormatsProvider, FormatterSpec, FormattingSpecArgs, FormattingSpecEntry, FormattingSpecProvider, ParserSpec, UnitsProvider } from "@itwin/core-quantity";
import { BeEvent, BeUnorderedUiEvent, Id64String } from "@itwin/core-bentley";
import { SchemaFormatsProvider, SchemaUnitProvider } from "@itwin/ecschema-metadata";

/** [Id64String]($bentley) used by the DTA demo to register its provider. Fields whose
 * `formatOptions.quantity.formatSet` equals this id route through the demo provider (when
 * enabled via [[enableFieldFormattingDemo]]).
 */
export const DEMO_FORMAT_SET_ID: Id64String = "0xDEMO";

/** A small set of pre-canned length [FormatProps]($core-quantity) that the demo provider
 * seeds itself with. They are keyed by names in the `Demo.*` namespace so they don't collide
 * with real KoQs and are usable as `kindOfQuantity` overrides from an authoring flow (e.g.
 * `dta text field '{...formatOptions: {quantity: {kindOfQuantity: "Demo.LENGTH_MM", persistenceUnit: "Units.M"}}}'`).
 *
 * Each seed prefixes its unit label with a distinct emoji so you can visually confirm which
 * seed formatted the value at a glance.
 */
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
    precision: 3,
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
    precision: 4,
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
};

/** Persistence unit each seed in [[DEMO_SEED_FORMATS]] expects to be compiled against.
 * Seeds not listed here default to the `defaultPersistenceUnitName` passed to
 * [[FieldFormattingDemoProvider.preloadSeeds]] (`Units.M`). Required for any seed whose
 * composite unit belongs to a phenomenon other than LENGTH.
 */
const DEMO_SEED_PERSISTENCE_UNITS: { readonly [name: string]: string } = {
  "Demo.AREA_M2": "Units.SQ_M",
  "Demo.AREA_MM2": "Units.SQ_M",
  "Demo.AREA_FT2": "Units.SQ_M",
};

/** [FormatsProvider]($core-quantity) wrapper that overlays [[DEMO_SEED_FORMATS]] on top of an
 * underlying (schema-backed) provider. The seed table wins so `Demo.*` keys resolve without
 * requiring a schema, and marker-tagged formats consistently show up in DTA even when the
 * iModel has no matching KoQ.
 */
class DemoOverlayFormatsProvider implements FormatsProvider {
  public readonly onFormatsChanged = new BeEvent<(args: { formatsChanged: string[] | "all" }) => void>();

  public constructor(private readonly _inner: FormatsProvider) {}

  public async getFormat(name: string): Promise<FormatProps | undefined> {
    if (DEMO_SEED_FORMATS[name]) {
      return DEMO_SEED_FORMATS[name];
    }
    return this._inner.getFormat(name);
  }
}

/** Minimal `FormattingSpecProvider` implementation that lazily prepares specs on demand
 * from an underlying [FormatsProvider]($core-quantity) / [UnitsProvider]($core-quantity).
 *
 * If the underlying `FormatsProvider` cannot resolve a requested name, the provider falls
 * back to the [[DEMO_SEED_FORMATS]] table so testing scenarios work even when the iModel's
 * schema context has no matching KoQ.
 */
export class FieldFormattingDemoProvider implements FormattingSpecProvider {
  public readonly onFormattingReady = new BeUnorderedUiEvent<void>();
  public readonly formatsProvider: FormatsProvider;
  public readonly unitsProvider: UnitsProvider;
  /** Mirrored copy of the `onMissingSpec` policy this provider was registered with, so callers
   * on the async path (e.g. `Backend.generateTextAnnotationGeometry`) can pass the same policy
   * to [[ElementDrivesTextAnnotation.evaluateFieldsAsync]] and keep the two paths consistent.
   */
  public onMissingSpec: "fallback" | "throw" = "fallback";
  private readonly _specs = new Map<string, FormattingSpecEntry>();

  public constructor(iModel: IModelDb) {
    this.formatsProvider = new DemoOverlayFormatsProvider(new SchemaFormatsProvider(iModel.schemaContext, "metric"));
    this.unitsProvider = createUnitsProvider({ primary: new SchemaUnitProvider(iModel.schemaContext) });
  }

  private static keyOf(args: { name: string; persistenceUnitName: string }): string {
    return `${args.name}|${args.persistenceUnitName}`;
  }

  /** Populate specs required by the [FieldRun]($common)s in `block` so that subsequent
   * [[getSpecsByNameAndUnit]] calls (from the sync txn callback path) hit the cache.
   */
  public async prepareForBlock(iModel: IModelDb, block: TextBlock): Promise<void> {
    const requirements = ElementDrivesTextAnnotation.collectFieldFormattingRequirements({ iModel, block });
    await this.prepareForRequirements(requirements);
  }

  /** Preload every entry in [[DEMO_SEED_FORMATS]] against the given persistence unit
   * (`Units.M` by default). Called automatically when the demo provider is registered.
   * Seeds whose composite unit belongs to a non-LENGTH phenomenon use the persistence
   * unit declared in [[DEMO_SEED_PERSISTENCE_UNITS]] instead of `defaultPersistenceUnitName`.
   */
  public async preloadSeeds(defaultPersistenceUnitName: string = "Units.M"): Promise<void> {
    const requirements: FormattingSpecArgs[] = Object.keys(DEMO_SEED_FORMATS).map((name) => ({
      name,
      persistenceUnitName: DEMO_SEED_PERSISTENCE_UNITS[name] ?? defaultPersistenceUnitName,
    }));
    await this.prepareForRequirements(requirements);
  }

  public async prepareForRequirements(requirements: FormattingSpecArgs[]): Promise<void> {
    const added: string[] = [];
    for (const req of requirements) {
      const key = FieldFormattingDemoProvider.keyOf(req);
      if (this._specs.has(key)) {
        continue;
      }
      const entry = await this.buildEntry(req);
      if (entry) {
        this._specs.set(key, entry);
        added.push(key);
      }
    }
    if (added.length > 0) {
      this.onFormattingReady.raiseEvent();
    }
  }

  private async buildEntry(req: FormattingSpecArgs): Promise<FormattingSpecEntry | undefined> {
    // 1. Try the underlying (schema-backed) FormatsProvider.
    let formatProps: FormatProps | undefined = await this.formatsProvider.getFormat(req.name);

    // 2. Fall back to the seed table so demo-only keys (Demo.*) resolve without a schema.
    if (!formatProps) {
      formatProps = DEMO_SEED_FORMATS[req.name];
    }

    if (!formatProps) {
      return undefined;
    }

    const format = await Format.createFromJSON("dtaField", this.unitsProvider, formatProps);

    let persistenceUnit;
    try {
      persistenceUnit = await this.unitsProvider.findUnitByName(req.persistenceUnitName);
    } catch {
      return undefined;
    }

    const formatterSpec = await FormatterSpec.create("dtaField", format, this.unitsProvider, persistenceUnit);
    const parserSpec = await ParserSpec.create(format, this.unitsProvider, persistenceUnit);
    return { formatterSpec, parserSpec };
  }

  public getSpecsByNameAndUnit(args: { name: string; persistenceUnitName: string }): FormattingSpecEntry | undefined {
    return this._specs.get(FieldFormattingDemoProvider.keyOf(args));
  }

  public formatQuantity(magnitude: number, spec: FormatterSpec): string {
    return spec.applyFormatting(magnitude);
  }
}

let currentDemo: FieldFormattingDemoProvider | undefined;

/** Returns the currently-registered demo provider, if any. */
export function getFieldFormattingDemo(): FieldFormattingDemoProvider | undefined {
  return currentDemo;
}

/** Registers a fresh [[FieldFormattingDemoProvider]] under [[DEMO_FORMAT_SET_ID]] for
 * `iModel`, so `"quantity"` and `"coordinate"` fields whose
 * `formatOptions.quantity.formatSet` equals `DEMO_FORMAT_SET_ID` format through the demo
 * provider on both the sync and async paths. Toggled by the `dta text demo <on|off|throw>`
 * keyin.
 */
export async function enableFieldFormattingDemo(iModel: IModelDb, opts?: { onMissingSpec?: "fallback" | "throw" }): Promise<void> {
  const provider = new FieldFormattingDemoProvider(iModel);
  provider.onMissingSpec = opts?.onMissingSpec ?? "fallback";
  await provider.preloadSeeds();
  ElementDrivesTextAnnotation.registerFieldFormattingProvider({
    formatSet: DEMO_FORMAT_SET_ID,
    provider,
    onMissingSpec: provider.onMissingSpec,
  });
  currentDemo = provider;
}

/** Unregisters the demo provider previously registered via [[enableFieldFormattingDemo]]. */
export function disableFieldFormattingDemo(): void {
  ElementDrivesTextAnnotation.unregisterFieldFormattingProvider(DEMO_FORMAT_SET_ID);
  currentDemo = undefined;
}
