/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
/** @packageDocumentation
 * @module Compatibility
 */

import { Capabilities } from "./Capabilities";

/** Enumerates the required and optional WebGL features used by the [RenderSystem]($frontend).
 * @beta
 */
export enum WebGLFeature {
  /** This feature allows transparent geometry to be rendered more efficiently, using 1 pass instead of 2. */
  MrtTransparency = "mrt transparency",
  /** This feature allows picking to occur more efficiently, using 1 pass instead of 3. */
  MrtPick = "mrt pick",
  /** This feature ensures large meshes (with more than 21,845 triangles) can be rendered. */
  UintElementIndex = "uint element index",
  /** This feature allows transparency to achieve the optimal quality. Without this feature, overlapping transparent geometry will "wash out" more easily. */
  FloatRendering = "float rendering",
  /** This feature allows for the display of non-3D classification data and solar shadows. */
  DepthTexture = "depth texture",
  /** This feature allows instancing of repeated geometry, which can reduce memory consumption. */
  Instancing = "instancing",
  /** This feature indicates that the system has enough texture units available for the shaders to run properly. */
  MinimalTextureUnits = "minimal texture units",
  /** Indicates that shadow maps are supported. Without this feature, shadows cannot be displayed. */
  ShadowMaps = "shadow maps",
  /**
   * This feature allows a logarithmic depth buffer to be used.  Without this feature, z-fighting will be much more likely
   * to occur.
   */
  FragDepth = "fragment depth",
  /**
   * This feature allows the renderer to achieve accurate contour lines for isoline and stepped delimiter modes of thematic display.
   */
  StandardDerivatives = "standard derivatives",
  /** This feature allows the renderer to smooth curved lines. */
  AntiAliasing = "anti-aliasing",
}

/** A general "compatibility rating" based on the contents of a [[WebGLRenderCompatibilityInfo]].
 * @beta
 */
export enum WebGLRenderCompatibilityStatus {
  /**
   * Signifies that everything is ideal: context created successfully, all required and optional features are available,
   * and browser did not signal a major performance caveat.
   */
  AllOkay,
  /**
   * Signifies that the base requirements of compatibility are met but at least some optional features are missing.
   * Consult the contents of [[WebGLRenderCompatibilityInfo.missingOptionalFeatures]].
   */
  MissingOptionalFeatures,
  /**
   * Signifies that the base requirements of compatibility are met but WebGL reported a major performance caveat.  The browser
   * has likely fallen back to software rendering due to lack of a usable GPU.
   * Consult [[WebGLRenderCompatibilityInfo.contextErrorMessage]] for a possible description of what went wrong.
   * There could also be some missing optional features; consult the contents of [[WebGLRenderCompatibilityInfo.missingOptionalFeatures]].
   */
  MajorPerformanceCaveat,
  /**
   * Signifies that the base requirements of compatibility are not met; rendering cannot occur.
   * Consult the contents of [[WebGLRenderCompatibilityInfo.missingRequiredFeatures]].
   */
  MissingRequiredFeatures,
  /**
   * Signifies an inability to create either a canvas or a WebGL rendering context; rendering cannot occur.  Consult
   * [[WebGLRenderCompatibilityInfo.contextErrorMessage]] for a possible description of what went wrong.
   */
  CannotCreateContext,
}

/** Driver-specific bugs for which the iModel.js display system can apply workarounds.
 * @note The presence of such bugs is exposed by [[WebGLRenderCompatibilityInfo]] but not flagged as a problem.
 * @alpha
 */
export interface DriverBugWorkarounds {
  /** Intel HD/UHD Graphics 620/630 exhibit a bug in which transparent surfaces tend to render mostly behind opaque surfaces.
   * This occurs if:
   *  - Camera is on; and
   *  - Logarithmic depth is enabled; and
   *  - Visible edges and ViewFlags.forceSurfaceDiscard are off; and
   *  - Ambient occlusion is off; and
   *  - Floating point textures are enabled.
   *
   * Logarithmic depth involves writing to Z in the fragment shader, so should disable early Z culling; but under these conditions
   * it appears not to. Adding a conditional never-executed `discard` to the shader causes it to render correctly, supporting this diagnosis.
   * The fix is to always render as if ViewFlags.forceSurfaceDiscard is turned on; this should produce no visual differences aside from
   * *less* z-fighting in some views, but may reduce performance in 3d wireframe views or smooth views with edges turned off.
   */
  forceSurfaceDiscard?: true;
}

/** WebGL rendering compatibility information produced by [[queryRenderCompatibility]].
 * @beta
 */
export interface WebGLRenderCompatibilityInfo {
  /** Describes the overall status of rendering compatibility. */
  status: WebGLRenderCompatibilityStatus;
  /** An array containing required features that are unsupported by this system. */
  missingRequiredFeatures: WebGLFeature[];
  /** An array containing optional features that are unsupported by this system. These are features that could provide
   * a performance and/or quality benefit.
   */
  missingOptionalFeatures: WebGLFeature[];
  /** An string containing the user agent of the browser that is being used. */
  userAgent: string;
  /** A string containing the renderer that is being used in the underlying graphics driver. */
  unmaskedRenderer?: string;
  /** A string containing the vendor that is being used in the underlying graphics driver.*/
  unmaskedVendor?: string;
  /** Possible supplemental details describing why a context could not be created (due to performance caveat or other reason). */
  contextErrorMessage?: string;
  /** The context used to generate the compatibility information. */
  createdContext?: WebGLRenderingContext | WebGL2RenderingContext | undefined;
  /** Workarounds that should be applied to address known driver bugs.
   * @alpha
   */
  workarounds?: DriverBugWorkarounds;
}

/** A function that creates and returns a WebGLRenderingContext given a canvas and desired attributes.
 * @beta
 */
export type ContextCreator = (canvas: HTMLCanvasElement, useWebGL2: boolean, inputContextAttributes?: WebGLContextAttributes) => WebGLRenderingContext | WebGL2RenderingContext | undefined;

function createDefaultContext(canvas: HTMLCanvasElement, useWebGL2: boolean = true, attributes?: WebGLContextAttributes): WebGLRenderingContext | WebGL2RenderingContext | undefined {
  let context = useWebGL2 ? canvas.getContext("webgl2", attributes) : canvas.getContext("webgl", attributes);
  if (context === null && useWebGL2)
    context = canvas.getContext("webgl", attributes);
  return context ?? undefined;
}

/** Produces information about the client's compatibility with the iModel.js rendering system.
 * @param useWebGL2 passed on to the createContext function to create the desired type of context; true to use WebGL2, false to use WebGL1.
 * @param createContext a function that returns a WebGLRenderingContext. The default uses `canvas.getContext()`.
 * @returns a compatibility summary.
 * @beta
 */
export function queryRenderCompatibility(useWebGL2: boolean, createContext?: ContextCreator): WebGLRenderCompatibilityInfo {
  const canvas = document.createElement("canvas");
  if (null === canvas)
    return { status: WebGLRenderCompatibilityStatus.CannotCreateContext, missingOptionalFeatures: [], missingRequiredFeatures: [], userAgent: navigator.userAgent };

  let errorMessage: string | undefined;
  canvas.addEventListener("webglcontextcreationerror", (event) => {
    errorMessage = (event as WebGLContextEvent).statusMessage || "webglcontextcreationerror was triggered with no error provided";
  }, false);

  if (undefined === createContext)
    createContext = createDefaultContext;

  let hasMajorPerformanceCaveat = false;
  let context = createContext(canvas, useWebGL2, { failIfMajorPerformanceCaveat: true });
  if (undefined === context) {
    hasMajorPerformanceCaveat = true;
    context = createContext(canvas, useWebGL2); // try to create context without black-listed GPU
    if (undefined === context)
      return {
        status: WebGLRenderCompatibilityStatus.CannotCreateContext,
        missingOptionalFeatures: [],
        missingRequiredFeatures: [],
        userAgent: navigator.userAgent,
        contextErrorMessage: errorMessage,
      };
  }

  const capabilities = new Capabilities();
  const compatibility = capabilities.init(context, undefined);
  compatibility.contextErrorMessage = errorMessage;

  if (hasMajorPerformanceCaveat && compatibility.status !== WebGLRenderCompatibilityStatus.MissingRequiredFeatures)
    compatibility.status = WebGLRenderCompatibilityStatus.MajorPerformanceCaveat;

  return compatibility;
}
