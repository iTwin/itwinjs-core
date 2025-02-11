/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
/** @packageDocumentation
 * @module Rendering
 */

/** @internal */
export enum RenderDiagnostics {
  /** No diagnostics enabled. */
  None = 0,
  /** Debugging output to browser console enabled. */
  DebugOutput = 1 << 1,
  /** Potentially expensive checks of WebGL state enabled. */
  WebGL = 1 << 2,
  /** All diagnostics enabled. */
  All = DebugOutput | WebGL,
}

/** @internal */
export interface GLTimerResult {
  /** Label from GLTimer.beginOperation */
  label: string;
  /** Time elapsed in nanoseconds, inclusive of child result times.
   *  @note no-op queries seem to have 32ns of noise.
   */
  nanoseconds: number;
  /** Child results if GLTimer.beginOperation calls were nested */
  children?: GLTimerResult[];
}

export type GLTimerResultCallback = (result: GLTimerResult) => void;

/** @internal exported strictly for display-test-app until we remove CommonJS support. */
export class DebugShaderFile {
  public constructor(
    public readonly filename: string,
    public readonly src: string,
    public isVS: boolean,
    public isGL: boolean,
    public isUsed: boolean,
  ) { }
}

/** An interface optionally exposed by a RenderSystem that allows control of various debugging features.
 * @internal
 */
export interface RenderSystemDebugControl {
  /** Destroy this system's webgl context. Returns false if this behavior is not supported. */
  loseContext(): boolean;

  /** Overrides [[RenderSystem.dpiAwareLOD]]. */
  dpiAwareLOD: boolean;

  /** Record GPU profiling information for each frame drawn. Check isGLTimerSupported before using. */
  resultsCallback?: GLTimerResultCallback;

  /** Returns true if the browser supports GPU profiling queries. */
  readonly isGLTimerSupported: boolean;

  /** Attempts to compile all shader programs and returns true if all were successful. May throw exceptions on errors.
   * This is useful for debugging shader compilation on specific platforms - especially those which use neither ANGLE nor SwiftShader (e.g., linux, mac, iOS)
   * because our unit tests which also compile all shaders run in software mode and therefore may not catch some "errors" (especially uniforms that have no effect on
   * program output).
   */
  compileAllShaders(): boolean;

  /** Obtain accumulated debug info collected during shader compilation. See `RenderSystem.Options.debugShaders`. */
  debugShaderFiles?: DebugShaderFile[];

  /** Default: enable all diagnostics. */
  enableDiagnostics(_enable: RenderDiagnostics | undefined): void;
}
