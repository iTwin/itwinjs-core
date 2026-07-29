/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/

/*
 * Demonstrates a Drawing-Production-style integration of an app-owned
 * [FormattingSpecProvider]($core-quantity) with the FieldRun formatting pathways
 * exposed by `@itwin/core-backend`.
 *
 * When "demo" mode is active for an [IModelDb]($backend):
 *   - `TextImpl.insertText` / `updateText` call [[FieldFormattingDemoProvider.prepareForBlock]]
 *     before writing the annotation, so the [FormatterSpec]($core-quantity)s required by
 *     any [FieldRun]($common)s in the block are hot before the txn commits.
 *   - The provider is registered against the iModel via
 *     [ElementDrivesTextAnnotation.setFieldFormattingProvider]($backend), so the txn callback
 *     path that recomputes field content synchronously routes through the provider.
 *   - `Backend.generateTextAnnotationGeometry` passes the same underlying
 *     [FormatsProvider]($core-quantity) and [UnitsProvider]($core-quantity) to
 *     [ElementDrivesTextAnnotation.evaluateFieldsAsync]($backend), so the async pathway
 *     used to render dynamic geometry produces the same output as the sync one.
 *
 * This is intentionally minimal - it exists to exercise the new pathways from DTA, not to
 * be a production-quality implementation.
 */

import { ElementDrivesTextAnnotation, IModelDb } from "@itwin/core-backend";
import { TextBlock } from "@itwin/core-common";
import { createUnitsProvider, Format, FormatProps, FormatsProvider, FormatterSpec, FormattingSpecArgs, FormattingSpecEntry, FormattingSpecProvider, ParserSpec, UnitsProvider } from "@itwin/core-quantity";
import { BeEvent, BeUnorderedUiEvent } from "@itwin/core-bentley";
import { SchemaFormatsProvider, SchemaUnitProvider } from "@itwin/ecschema-metadata";

/** Modes selectable via the `dta text formatmode ...` keyin. */
export type FieldFormattingMode = "default" | "demo" | "demo-throw";

/** A small set of pre-canned length [FormatProps]($core-quantity) that the demo provider
 * seeds itself with. They are keyed by names in the `Demo.*` namespace so they don't collide
 * with real KoQs and are usable as `formatSetKey` overrides from an authoring flow (e.g.
 * `dta text field '{...formatOptions: {quantity: {formatSetKey: "Demo.LENGTH_MM", persistenceUnit: "Units.M"}}}'`).
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
   */
  public async preloadSeeds(persistenceUnitName: string = "Units.M"): Promise<void> {
    const requirements: FormattingSpecArgs[] = Object.keys(DEMO_SEED_FORMATS).map((name) => ({
      name,
      persistenceUnitName,
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

const state = new WeakMap<IModelDb, { mode: FieldFormattingMode; provider: FieldFormattingDemoProvider }>();

/** Returns the demo provider registered against `iModel`, if any. */
export function getFieldFormattingDemo(iModel: IModelDb): { mode: FieldFormattingMode; provider: FieldFormattingDemoProvider } | undefined {
  return state.get(iModel);
}

/** Applies `mode` to `iModel`:
 *  - `"default"`: unregister the demo provider (raw string fallback on the sync path).
 *  - `"demo"`: register a fresh `FieldFormattingDemoProvider` with `onMissingSpec: "fallback"`.
 *  - `"demo-throw"`: register a fresh `FieldFormattingDemoProvider` with `onMissingSpec: "throw"`.
 */
export async function setFieldFormattingMode(iModel: IModelDb, mode: FieldFormattingMode): Promise<void> {
  if (mode === "default") {
    ElementDrivesTextAnnotation.setFieldFormattingProvider(iModel, undefined);
    state.delete(iModel);
    return;
  }

  const provider = new FieldFormattingDemoProvider(iModel);
  await provider.preloadSeeds();
  const onMissingSpec = mode === "demo-throw" ? "throw" : "fallback";
  ElementDrivesTextAnnotation.setFieldFormattingProvider(iModel, provider, { onMissingSpec });
  state.set(iModel, { mode, provider });
}
