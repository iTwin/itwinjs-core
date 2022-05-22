/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
import { Compiler } from "webpack";

/**
 * Used for reloading a _frontend_ anytime its corresponding backend changes.
 */
export class WatchBackendPlugin {
  private _prevTimestamp = Date.now();

  constructor(private _backendOutputPath: string) { }

  public apply(compiler: Compiler) {
    compiler.hooks.emit.tap("WatchBackendPlugin", (compilation: any) => {
      const newTimestamp = compilation.fileTimestamps.get(this._backendOutputPath);
      const didBackendChange = this._prevTimestamp < (newTimestamp || -Infinity);
      if (!didBackendChange)
        return;

      this._prevTimestamp = newTimestamp || 0;
      compilation.modifyHash(`${newTimestamp}`);
      return true;
    });

    compiler.hooks.afterCompile.tap("WatchBackendPlugin", (compilation: any) => {
      compilation.fileDependencies.add(this._backendOutputPath);
    });
  }
}
