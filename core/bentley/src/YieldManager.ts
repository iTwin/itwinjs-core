/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/

/** @internal options for constructing yield managers */
export interface YieldManagerOptions {
  iterationsBeforeYield?: number;
}

/** @internal the default options when constructing yield managers */
const defaultYieldManagerOptions: Required<YieldManagerOptions> = {
  iterationsBeforeYield: 1000,
};

/**
 * @internal
 * An object allowing code to optionally yield with some frequency.
 * useful in some intense loops that make processes unresponsive.
 * primarily a workaround for: https://github.com/nodejs/node-addon-api/issues/1140
 * @note see [[defaultYieldManagerOptions]], the default amount of times it must be called to cause an actual yield is 1000
 */
export class YieldManager {
  public options: Readonly<Required<YieldManagerOptions>>;
  private _counter = 0;

  public constructor(options: YieldManagerOptions = {}) {
    this.options = { ...defaultYieldManagerOptions, ...options };
  }

  public async allowYield() {
    this._counter = (this._counter + 1) % this.options.iterationsBeforeYield;
    if (this._counter === 0) {
      await this.actualYield();
    }
  }

  protected async actualYield() {
    await new Promise((r) => setTimeout(r, 0));
  }
}
