/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
/** @packageDocumentation
 * @module Elements
 */

import { BentleyError, BeUnorderedUiEvent, Logger } from "@itwin/core-bentley";
import { TextBlock } from "@itwin/core-common";
import {
  createUnitsProvider, Format, FormatProps, FormatsProvider, FormatterSpec, FormattingSpecArgs, FormattingSpecEntry,
  FormattingSpecProvider, ParserSpec, UnitsProvider, UnitSystemKey,
} from "@itwin/core-quantity";
import { SchemaFormatsProvider, SchemaUnitProvider } from "@itwin/ecschema-metadata";
import { BackendLoggerCategory } from "../BackendLoggerCategory";
import { IModelDb } from "../IModelDb";
import { collectFieldFormattingRequirements } from "../internal/annotations/fields";

/** Arguments supplied to [[createFieldFormattingSpecProvider]].
 * @beta
 */
export interface CreateFieldFormattingSpecProviderArgs {
  /** The iModel whose schema context supplies the default formats and units providers. */
  iModel: IModelDb;
  /** Resolves a [FormatProps]($core-quantity) by KindOfQuantity name. Defaults to a
   * [SchemaFormatsProvider]($ecschema-metadata) built from [[iModel]] and [[unitSystem]].
   *
   * To layer an application-owned FormatSet over the iModel's schemas, supply a
   * [FormatSetFormatsProvider]($ecschema-metadata) whose `fallbackProvider` is a
   * [SchemaFormatsProvider]($ecschema-metadata); names the FormatSet does not define then
   * resolve from the iModel's [KindOfQuantity]($ecschema-metadata) definitions.
   */
  formatsProvider?: FormatsProvider;
  /** Resolves [UnitProps]($core-quantity) (e.g. a value's persistence unit). Defaults to a
   * [SchemaUnitProvider]($ecschema-metadata)-backed implementation built from [[iModel]], so
   * units defined in the iModel's own schemas resolve in addition to the bundled BIS units.
   */
  unitsProvider?: UnitsProvider;
  /** Unit system used by the default [SchemaFormatsProvider]($ecschema-metadata) when
   * [[formatsProvider]] is not supplied. Defaults to `"metric"`.
   */
  unitSystem?: UnitSystemKey;
}

/** A [FormattingSpecProvider]($core-quantity) that builds its [FormatterSpec]($core-quantity)s
 * asynchronously ahead of time and serves them synchronously thereafter.
 *
 * Field evaluation on the `TxnManager` callback path is synchronous and cannot await spec
 * construction, while [FormatterSpec]($core-quantity) and [ParserSpec]($core-quantity)
 * construction is inherently asynchronous. This provider bridges the two: call [[warm]] (or
 * [[warmForBlock]]) from an asynchronous context — typically just before inserting or updating
 * an annotation — and the specs it produced are then available to the synchronous path through
 * [[getSpecsByNameAndUnit]].
 *
 * Requirements that have not been warmed are simply absent, and the field falls back to the
 * next candidate in the formatting chain. Warming is therefore an optimization for coverage,
 * never a correctness requirement.
 *
 * Create instances with [[createFieldFormattingSpecProvider]].
 * @beta
 */
export class FieldFormattingSpecProvider implements FormattingSpecProvider {
  /** Raised after a [[warm]] call adds at least one new entry. */
  public readonly onFormattingReady = new BeUnorderedUiEvent<void>();
  /** Resolves formats by KindOfQuantity name. */
  public readonly formatsProvider: FormatsProvider;
  /** Resolves units and unit conversions. */
  public readonly unitsProvider: UnitsProvider;

  private readonly _specs = new Map<string, FormattingSpecEntry>();
  private readonly _iModel: IModelDb;

  /** @internal */
  public constructor(iModel: IModelDb, formatsProvider: FormatsProvider, unitsProvider: UnitsProvider) {
    this._iModel = iModel;
    this.formatsProvider = formatsProvider;
    this.unitsProvider = unitsProvider;
  }

  private static keyOf(args: FormattingSpecArgs): string {
    return `${args.name}|${args.persistenceUnitName}|${args.system ?? ""}`;
  }

  /** Builds and caches the specs described by `requirements`. Requirements already cached are
   * skipped, and requirements whose format or persistence unit cannot be resolved are omitted
   * rather than throwing — a field needing an omitted spec falls back to its raw string.
   *
   * Obtain `requirements` from
   * [ElementDrivesTextAnnotation.collectFieldFormattingRequirements]($backend), or use
   * [[warmForBlock]] to do both in one call.
   * @returns the number of entries added.
   */
  public async warm(requirements: Iterable<FormattingSpecArgs>): Promise<number> {
    let added = 0;
    for (const requirement of requirements) {
      const key = FieldFormattingSpecProvider.keyOf(requirement);
      if (this._specs.has(key)) {
        continue;
      }

      const entry = await this.buildEntry(requirement);
      if (entry) {
        this._specs.set(key, entry);
        ++added;
      }
    }

    if (added > 0) {
      this.onFormattingReady.raiseEvent();
    }

    return added;
  }

  /** Builds and caches the specs required to format every `"quantity"` and `"coordinate"`
   * [FieldRun]($common) in `block`. Equivalent to passing
   * [ElementDrivesTextAnnotation.collectFieldFormattingRequirements]($backend)'s output to
   * [[warm]]. Call this before inserting or updating the annotation that hosts `block`, so the
   * specs are cached before the `TxnManager` callback path evaluates its fields.
   * @returns the number of entries added.
   */
  public async warmForBlock(block: TextBlock): Promise<number> {
    return this.warm(collectFieldFormattingRequirements(block, this._iModel));
  }

  /** Discards every cached spec, so subsequent [[warm]] calls rebuild them. Call this when the
   * underlying [[formatsProvider]] changes the formats it resolves — for example when the
   * application adopts a different FormatSet.
   */
  public clear(): void {
    this._specs.clear();
  }

  private async buildEntry(requirement: FormattingSpecArgs): Promise<FormattingSpecEntry | undefined> {
    try {
      const formatProps: FormatProps | undefined = await this.formatsProvider.getFormat(requirement.name, requirement.system);
      if (!formatProps) {
        return undefined;
      }

      const persistenceUnit = await this.unitsProvider.findUnitByName(requirement.persistenceUnitName);
      if (!persistenceUnit.isValid) {
        return undefined;
      }

      const format = await Format.createFromJSON(requirement.name, this.unitsProvider, formatProps);
      return {
        formatterSpec: await FormatterSpec.create(requirement.name, format, this.unitsProvider, persistenceUnit),
        parserSpec: await ParserSpec.create(format, this.unitsProvider, persistenceUnit),
      };
    } catch (err) {
      Logger.logInfo(BackendLoggerCategory.IModelDb, `Unable to prepare formatting spec for "${requirement.name}" (${requirement.persistenceUnitName}): ${BentleyError.getErrorMessage(err)}`);
      return undefined;
    }
  }

  /** Returns the spec previously built by [[warm]] for `args`, or `undefined` if it was never
   * warmed or could not be resolved.
   */
  public getSpecsByNameAndUnit(args: FormattingSpecArgs): FormattingSpecEntry | undefined {
    return this._specs.get(FieldFormattingSpecProvider.keyOf(args));
  }

  /** Formats `magnitude` using `formatSpec`. */
  public formatQuantity(magnitude: number, formatSpec: FormatterSpec): string {
    return formatSpec.applyFormatting(magnitude);
  }
}

/** Creates a [[FieldFormattingSpecProvider]] backed by `args.iModel`'s schemas, optionally
 * layered with application-owned formats and units providers.
 *
 * The returned provider is empty until warmed; see [[FieldFormattingSpecProvider.warm]].
 * @beta
 */
export function createFieldFormattingSpecProvider(args: CreateFieldFormattingSpecProviderArgs): FieldFormattingSpecProvider {
  const formatsProvider = args.formatsProvider ?? new SchemaFormatsProvider(args.iModel.schemaContext, args.unitSystem ?? "metric");
  const unitsProvider = args.unitsProvider ?? createUnitsProvider({ primary: new SchemaUnitProvider(args.iModel.schemaContext) });
  return new FieldFormattingSpecProvider(args.iModel, formatsProvider, unitsProvider);
}
