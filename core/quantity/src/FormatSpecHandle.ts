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
  /** The provider that supplies current formatting spec lookups. */
  provider: FormattingSpecProvider;
}

/** A handle to formatting and parsing specs for a specific KoQ and persistence unit.
 * Reads the current specs from the provider on access. Use [[QuantityFormatter.getFormatSpecHandle]]
 * to create instances.
 *
 * When formatting is not yet ready, [[format]] returns a `value.toString()` fallback.
 * Dispose the handle when it is no longer needed to invalidate it.
 *
 * @beta
 */
export class FormatSpecHandle implements Disposable {
  private _disposed = false;
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
  }

  /** The KoQ name this handle is keyed to. */
  public get koqName(): string { return this._koqName; }

  /** The persistence unit this handle is keyed to. */
  public get persistenceUnit(): string { return this._persistenceUnit; }

  /** The unit system this handle is pinned to, or `undefined` for the active system. */
  public get system(): UnitSystemKey | undefined { return this._system; }

  /** The current FormatterSpec, or undefined if not yet loaded. */
  public get formatterSpec(): FormatterSpec | undefined { return this._getEntry()?.formatterSpec; }

  /** The current ParserSpec, or undefined if not yet loaded. */
  public get parserSpec(): ParserSpec | undefined { return this._getEntry()?.parserSpec; }

  /** Format a quantity value using the current spec.
   * If the formatter is not yet ready, returns `value.toString()` as a fallback.
   * @param value - The numeric value to format.
   * @returns The formatted string.
   */
  public format(value: number): string {
    const formatterSpec = this.formatterSpec;
    if (!formatterSpec)
      return value.toString();
    return this._provider.formatQuantity(value, formatterSpec);
  }

  /** Invalidate this handle.
   * Idempotent and safe to call multiple times.
   * No additional teardown is required because the handle owns no external resources.
   */
  public [Symbol.dispose](): void {
    this._disposed = true;
  }

  private _getEntry(): FormattingSpecEntry | undefined {
    if (this._disposed)
      return undefined;

    return this._provider.getSpecsByNameAndUnit({
      name: this._koqName,
      persistenceUnitName: this._persistenceUnit,
      system: this._system,
    });
  }
}
