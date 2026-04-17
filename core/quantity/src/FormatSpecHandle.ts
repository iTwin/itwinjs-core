/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/

/** @packageDocumentation
 * @module Quantity
 */

import type { FormatterSpec } from "./Formatter/FormatterSpec";
import type { FormattingSpecArgs, FormattingSpecEntry, FormattingSpecProvider } from "./Formatter/Interfaces";
import type { ParserSpec } from "./ParserSpec";
import type { UnitSystemKey } from "./Interfaces";

/** Arguments for constructing a [[FormatSpecHandle]].
 * @internal
 */
export interface FormatSpecHandleArgs extends FormattingSpecArgs {
  /** The provider that supplies spec lookups and reload events. */
  provider: FormattingSpecProvider;
}

/** A cacheable handle to formatting and parsing specs for a specific KoQ and persistence unit.
 * Automatically refreshes when the QuantityFormatter reloads. Use [[QuantityFormatter.getFormatSpecHandle]]
 * to create instances.
 *
 * When formatting is not yet ready, [[format]] returns a `value.toString()` fallback.
 * Call [[dispose]] when the handle is no longer needed to unsubscribe from reload events.
 *
 * @beta
 */
export class FormatSpecHandle implements Disposable {
  private _formatterSpec: FormatterSpec | undefined;
  private _parserSpec: ParserSpec | undefined;
  private _removeListener: (() => void) | undefined;
  private readonly _provider: FormattingSpecProvider;
  private readonly _koqName: string;
  private readonly _persistenceUnit: string;
  private readonly _system: UnitSystemKey | undefined;

  /** @internal */
  constructor(args: FormatSpecHandleArgs) {
    this._provider = args.provider;
    this._koqName = args.name;
    this._persistenceUnit = args.persistenceUnitName;
    this._system = args.system;
    this._removeListener = args.provider.onFormattingReady.addListener(() => {
      this._refresh();
    });
    this._refresh();
  }

  /** The KoQ name this handle is keyed to. */
  public get koqName(): string { return this._koqName; }

  /** The persistence unit this handle is keyed to. */
  public get persistenceUnit(): string { return this._persistenceUnit; }

  /** The unit system this handle is pinned to, or `undefined` for the active system. */
  public get system(): UnitSystemKey | undefined { return this._system; }

  /** The current FormatterSpec, or undefined if not yet loaded. */
  public get formatterSpec(): FormatterSpec | undefined { return this._formatterSpec; }

  /** The current ParserSpec, or undefined if not yet loaded. */
  public get parserSpec(): ParserSpec | undefined { return this._parserSpec; }

  /** Format a quantity value using the current spec.
   * If the formatter is not yet ready, returns `value.toString()` as a fallback.
   * @param value - The numeric value to format.
   * @returns The formatted string.
   */
  public format(value: number): string {
    if (!this._formatterSpec)
      return value.toString();
    return this._provider.formatQuantity(value, this._formatterSpec);
  }

  /** Unsubscribe from reload events and clear cached specs.
   * Idempotent and safe to call during a pending reload.
   */
  public [Symbol.dispose](): void {
    if (this._removeListener) {
      this._removeListener();
      this._removeListener = undefined;
    }
    this._formatterSpec = undefined;
    this._parserSpec = undefined;
  }

  private _refresh(): void {
    // Guard against mid-emission callbacks after dispose() — event may still fire during iteration.
    if (!this._removeListener)
      return;
    const entry: FormattingSpecEntry | undefined = this._provider.getSpecsByNameAndUnit({
      name: this._koqName,
      persistenceUnitName: this._persistenceUnit,
      system: this._system,
    });
    if (entry) {
      this._formatterSpec = entry.formatterSpec;
      this._parserSpec = entry.parserSpec;
    } else {
      this._formatterSpec = undefined;
      this._parserSpec = undefined;
    }
  }
}
