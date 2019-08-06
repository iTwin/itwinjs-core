/*---------------------------------------------------------------------------------------------
* Copyright (c) 2019 Bentley Systems, Incorporated. All rights reserved.
* Licensed under the MIT License. See LICENSE.md in the project root for license terms.
*--------------------------------------------------------------------------------------------*/
/** @module IModelApp */

/** Describes the required and optional WebGL features used by the [[RenderSystem]].
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
}

/** Describes the state of render compatibility.
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

/** WebGL rendering compatibility information returned by [[IModelApp.queryRenderCompatibility]].
 * @beta
 */
export interface WebGLRenderCompatibilityInfo {
  /**
   * Describes the overall status of rendering compatibility.
   */
  status: WebGLRenderCompatibilityStatus;
  /**
   * An array containing required features that are unsupported by this system.
   */
  missingRequiredFeatures: WebGLFeature[];
  /**
   * An array containing optional features that are unsupported by this system.  These are features that could provide
   * a performance and/or quality benefit.
   */
  missingOptionalFeatures: WebGLFeature[];
  /**
   * An string containing the user agent of the browser that is being used.
   */
  userAgent: string;
  /**
   * An string containing the renderer that is being used in the underlying graphics driver.
   */
  unmaskedRenderer?: string;
  /**
   * An string containing the vendor that is being used in the underlying graphics driver.
   */
  unmaskedVendor?: string;
  /**
   * Possible supplemental details describing why a context could not be created (due to performance caveat or other reason).
   */
  contextErrorMessage?: string;
}
