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
import { BeUnorderedUiEvent } from "@itwin/core-bentley";
import { SchemaFormatsProvider, SchemaUnitProvider } from "@itwin/ecschema-metadata";

/** Modes selectable via the `dta text formatmode ...` keyin. */
export type FieldFormattingMode = "default" | "demo" | "demo-throw";

/** Minimal `FormattingSpecProvider` implementation that lazily prepares specs on demand
 * from an underlying [FormatsProvider]($core-quantity) / [UnitsProvider]($core-quantity).
 */
export class FieldFormattingDemoProvider implements FormattingSpecProvider {
  public readonly onFormattingReady = new BeUnorderedUiEvent<void>();
  public readonly formatsProvider: FormatsProvider;
  public readonly unitsProvider: UnitsProvider;
  private readonly _specs = new Map<string, FormattingSpecEntry>();

  public constructor(iModel: IModelDb) {
    this.formatsProvider = new SchemaFormatsProvider(iModel.schemaContext, "metric");
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
    const formatProps: FormatProps | undefined = await this.formatsProvider.getFormat(req.name);
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
export function setFieldFormattingMode(iModel: IModelDb, mode: FieldFormattingMode): void {
  if (mode === "default") {
    ElementDrivesTextAnnotation.setFieldFormattingProvider(iModel, undefined);
    state.delete(iModel);
    return;
  }

  const provider = new FieldFormattingDemoProvider(iModel);
  const onMissingSpec = mode === "demo-throw" ? "throw" : "fallback";
  ElementDrivesTextAnnotation.setFieldFormattingProvider(iModel, provider, { onMissingSpec });
  state.set(iModel, { mode, provider });
}
