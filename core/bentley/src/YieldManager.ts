/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
/** @packageDocumentation
 * @module Utils
 */

/** Options supplied to a [[YieldManager]].
 * @public
 */
export interface YieldManagerOptions {
  /** The number of times [[YieldManager.allowYield]] must be called to trigger an actual yield.
   * Default: 1000.
   */
  iterationsBeforeYield?: number;
}

const defaultYieldManagerOptions: Required<YieldManagerOptions> = {
  iterationsBeforeYield: 1000,
};

/** Provides a mechanism by which a loop can be made to periodically yield control back to the browser/node environment.
 * This can alleviate [performance and memory consumption issues](https://github.com/nodejs/node-addon-api/issues/1140).
 * It maintains a count of the number of iterations that have occurred since the last yield.
 * The constructor specifies how many iterations of the loop are permitted before yielding.
 * The loop should `await` [[allowYield]] on each iteration.
 * [[allowYield]] will yield (and reset the iteration counter) if the counter exceeds the specified maximum.
 * @public
 */
export class YieldManager {
  /** Options controlling the yield behavior. */
  public readonly options: Readonly<Required<YieldManagerOptions>>;
  private _counter = 0;

  /** Constructor.
   * @param options Options customizing the yield behavior. Omitted properties are assigned their default values.
   */
  public constructor(options: YieldManagerOptions = {}) {
    this.options = { ...defaultYieldManagerOptions, ...options };
  }

  /** Increment the iteration counter, yielding control and resetting the counter if [[options.iterationsBeforeYield]] is exceeded. */
  public async allowYield() {
    this._counter = (this._counter + 1) % this.options.iterationsBeforeYield;
    if (this._counter === 0) {
      await this.actualYield();
    }
  }

  /** @internal */
  protected async actualYield() {
    await new Promise((r) => setTimeout(r, 0));
  }
}
