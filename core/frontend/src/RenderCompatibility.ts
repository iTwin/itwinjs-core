/*---------------------------------------------------------------------------------------------
* Copyright (c) 2019 Bentley Systems, Incorporated. All rights reserved.
* Licensed under the MIT License. See LICENSE.md in the project root for license terms.
*--------------------------------------------------------------------------------------------*/
/** @module IModelApp */

/** A specific WebGL rendering feature.
 * @beta
 */
export enum WebGLFeature {
  /**
   * This feature allows transparency to occur more efficiently.  The renderer will require less passes to achieve
   * transparency due to the presence of enough renderable attachments.
   */
  MrtTransparency = "mrt transparency",
  /**
   * This feature allows picking to occur more efficiently.  The renderer will require less passes to achieve picking
   * due to the presence of enough renderable attachments.
   */
  MrtPick = "mrt pick",
  /**
   * This feature provides the renderer a large enough range of element indices for drawing to happen properly.
   */
  UintElementIndex = "uint element index",
  /**
   * This feature allows transparency to achieve the optimal quality.  Without this feature, transparency will "wash out"
   * more easily.
   */
  FloatRendering = "float rendering",
  /**
   * This feature allows for the display of non-3D classification data and solar shadows.
   */
  DepthTexture = "depth texture",
  /**
   * This feature allows instancing of geometry in order to optimize rendering speed.
   */
  Instancing = "instancing",
  /**
   * This feature indicates that the system has enough texture units available for the shaders to run properly.
   */
  MinimalTextureUnits = "minimal texture units",
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
