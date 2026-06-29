/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/

import * as path from "path";
import { IModelJsNative, NativeLoggerCategory } from "@bentley/imodeljs-native";
import { BentleyLoggerCategory, Logger, LogLevel, ProcessDetector } from "@itwin/core-bentley";
import { BackendLoggerCategory } from "../BackendLoggerCategory";
import { IModelHost, IModelHostOptions } from "../IModelHost";
import { IModelNative } from "../internal/NativePlatform";
import { GeoCoordConfig } from "../GeoCoordConfig";
import { SettingsPriority } from "../workspace/Settings";

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
export class DisableNativeAssertions implements Disposable {
  private _native: IModelJsNative.DisableNativeAssertions | undefined;

  constructor() {
    this._native = new IModelNative.platform.DisableNativeAssertions();
  }

  public [Symbol.dispose](): void {
    if (!this._native)
      return;

    this._native.dispose();
    this._native = undefined;
  }

  /** @deprecated in 5.0 - will not be removed until after 2026-06-13. Use [Symbol.dispose] instead. */
  public dispose(): void {
    this[Symbol.dispose]();
  }
}

export class TestUtils {
  private static shouldLogToConsole(): boolean {
    return process.env.ITWINJS_CORE_BACKEND_TEST_LOG_TO_CONSOLE === "1";
  }

  public static getCacheDir(fallback: string | undefined = undefined) {
    if (ProcessDetector.isMobileAppBackend) {
      return undefined; // Let the native side handle the cache.
    }
    return fallback ?? path.join(__dirname, ".cache"); // Set the cache dir to be under the lib directory.
  }

  /** Handles the startup of IModelHost for unit tests.
   * The provided config is used and will override any of the default values used in this method.
   *
   * The default includes:
   * - cacheDir = path.join(__dirname, ".cache")
   * - allowSharedChannel = false;
   *
   * GCS (Geographic Coordinate System) workspace loading is disabled by default, since unit tests
   * should not make network requests. Pass `loadGcsWorkspaces: true` for the rare test that genuinely
   * needs GCS data (which then belongs in the integration suite). This flag is test-only and is not
   * forwarded to `IModelHost.startup`.
   */
  public static async startBackend(config?: IModelHostOptions & { loadGcsWorkspaces?: boolean }): Promise<void> {
    const { loadGcsWorkspaces, ...cfg } = config ?? {};
    cfg.cacheDir = TestUtils.getCacheDir(cfg.cacheDir);
    cfg.allowSharedChannel ??= false; // Override default to test shared channel enforcement. Remove in version 5.0.
    cfg.implicitWriteEnforcement ??= "throw";
    await IModelHost.startup(cfg);
    if (!loadGcsWorkspaces)
      TestUtils.disableGcsWorkspaces();
  }

  /**
   * Suppress loading of Geographic Coordinate System (GCS) workspaces from cloud containers (and the
   * network requests they issue when iModels are opened) by overriding the existing GeoCoordConfig
   * setting. Unit tests should not make network calls; tests that genuinely require GCS data belong
   * in the integration suite. GCS workspaces load lazily on first iModel open, so overriding the
   * setting any time after `IModelHost.startup` is sufficient.
   */
  public static disableGcsWorkspaces(): void {
    IModelHost.appWorkspace.settings.addDictionary(
      { name: "test-gcs-disable-override", priority: SettingsPriority.application },
      { [GeoCoordConfig.settingName.disableWorkspaces]: true },
    );
  }

  public static async shutdownBackend(): Promise<void> {
    return IModelHost.shutdown();
  }

  public static setupLogging() {
    if (TestUtils.shouldLogToConsole())
      Logger.initializeToConsole();
    else
      Logger.initialize();
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

