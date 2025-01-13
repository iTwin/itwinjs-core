/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/

import * as path from "path";
import { IModelJsNative, NativeLoggerCategory } from "@bentley/imodeljs-native";
import { BentleyLoggerCategory, IDisposable, Logger, LogLevel, ProcessDetector } from "@itwin/core-bentley";
import { BackendLoggerCategory } from "../BackendLoggerCategory";
import { IModelHost, IModelHostOptions } from "../IModelHost";
import { IModelNative } from "../internal/NativePlatform";

/** Class for simple test timing */
export class Timer {
  private _label: string;
  private _start: Date;
  constructor(label: string) {
    this._label = `\t${label}`;
    this._start = new Date();
  }

  public end() {
    const stop = new Date();
    const elapsed = stop.getTime() - this._start.getTime();
    // eslint-disable-next-line no-console
    console.log(`${this._label}: ${elapsed}ms`);
  }
}

/**
 * Disables native code assertions from firing. This can be used by tests that intentionally
 * test failing operations. If those failing operations raise assertions in native code, the test
 * would fail unexpectedly in a debug build. In that case the native code assertions can be disabled with
 * this class.
 */
export class DisableNativeAssertions implements IDisposable {
  private _native: IModelJsNative.DisableNativeAssertions | undefined;

  constructor() {
    this._native = new IModelNative.platform.DisableNativeAssertions();
  }

  public dispose(): void {
    if (!this._native)
      return;

    this._native.dispose();
    this._native = undefined;
  }
}

export class TestUtils {
  public static getCacheDir(fallback: string | undefined = undefined) {
    if (ProcessDetector.isMobileAppBackend) {
      return undefined; // Let the native side handle the cache.
    }
    return fallback ?? path.join(__dirname, ".cache"); // Set the cache dir to be under the lib directory.
  }

  /** Handles the startup of IModelHost.
   * The provided config is used and will override any of the default values used in this method.
   *
   * The default includes:
   * - cacheDir = path.join(__dirname, ".cache")
   * - allowSharedChannel = false;
   */
  public static async startBackend(config?: IModelHostOptions): Promise<void> {
    const cfg = config ?? {};
    cfg.cacheDir = TestUtils.getCacheDir(cfg.cacheDir);
    cfg.allowSharedChannel ??= false; // Override default to test shared channel enforcement. Remove in version 5.0.
    await IModelHost.startup(cfg);
  }

  public static async shutdownBackend(): Promise<void> {
    return IModelHost.shutdown();
  }

  public static setupLogging() {
    Logger.initializeToConsole();
    Logger.setLevelDefault(LogLevel.Error);
  }

  private static initDebugLogLevels(reset?: boolean) {
    Logger.setLevelDefault(reset ? LogLevel.Error : LogLevel.Warning);
    Logger.setLevel(BentleyLoggerCategory.Performance, reset ? LogLevel.Error : LogLevel.Info);
    Logger.setLevel(BackendLoggerCategory.IModelDb, reset ? LogLevel.Error : LogLevel.Trace);
    Logger.setLevel(NativeLoggerCategory.DgnCore, reset ? LogLevel.Error : LogLevel.Trace);
    Logger.setLevel(NativeLoggerCategory.BeSQLite, reset ? LogLevel.Error : LogLevel.Trace);
  }

  // Setup typical programmatic log level overrides here
  // Convenience method used to debug specific tests/fixtures
  public static setupDebugLogLevels() {
    TestUtils.initDebugLogLevels(false);
  }

  public static resetDebugLogLevels() {
    TestUtils.initDebugLogLevels(true);
  }
}

// The very first "before" run to initially setup the logging and initial backend.
before(async () => {
  TestUtils.setupLogging();
  await TestUtils.startBackend();
});

after(async () => {
  await TestUtils.shutdownBackend();
});

