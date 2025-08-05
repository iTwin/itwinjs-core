/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
/** @packageDocumentation
 * @module Rendering
 */

/** Describes timing statistics for a single rendered frame. Aside from `frameId`, `totalFrameTime`, and `totalSceneTime`, the other entries may represent operations that are not performed every frame and may contain an expected value of zero.
 * @note By default, the display system does not render frames continuously. The display system will render a new frame only when the view changes. Therefore, the data contained within this interface cannot directly be used to compute a representative framerate.
 * @alpha
 */
export interface FrameStats {
  /** A unique number identifying the frame to which these statistics belong. */
  frameId: number;
  /** The CPU time in milliseconds spent setting up the scene. This does not include the time described by `totalFrameTime`. */
  totalSceneTime: number;
  /** The CPU time in milliseconds spent performing animations while setting up the scene. This is included in `totalSceneTime`. */
  animationTime: number;
  /** The CPU time in milliseconds spent setting up the view while setting up the scene. This is included in `totalSceneTime`. */
  setupViewTime: number;
  /** The CPU time in milliseconds spent when creating or changing the scene if invalid. This is included in `totalSceneTime`. */
  createChangeSceneTime: number;
  /** The CPU time in milliseconds spent validating the render plan while setting up the scene. This is included in `totalSceneTime`. */
  validateRenderPlanTime: number;
  /** The CPU time in milliseconds spent adding or changing decorations while setting up the scene. This is included in `totalSceneTime`. */
  decorationsTime: number;
  /** The CPU time in milliseconds spent executing the target's `onBeforeRender` call while setting up the scene. This is included in `totalSceneTime`. */
  onBeforeRenderTime: number;
  /** The CPU time in milliseconds spent rendering the frame. This does not include the time described by `totalSceneTime`. */
  totalFrameTime: number;
  /** The CPU time in milliseconds spent rendering opaque geometry. This is included in `totalFrameTime`. */
  opaqueTime: number;
  /** The CPU time in milliseconds spent executing the `IModelFrameLifecycle.onRenderOpaque` call. This is included in `totalFrameTime`. */
  onRenderOpaqueTime: number;
  /** The CPU time in milliseconds spent rendering translucent geometry. This is included in `totalFrameTime`. */
  translucentTime: number;
  /** The CPU time in milliseconds spent rendering overlays. This is included in `totalFrameTime`. */
  overlaysTime: number;
  /** The CPU time in milliseconds spent rendering the solar shadow map. This is included in `totalFrameTime`. */
  shadowsTime: number;
  /** The CPU time in milliseconds spent rendering both planar and volume classifiers. This is included in `totalFrameTime`. */
  classifiersTime: number;
  /** The CPU time in milliseconds spent applying screenspace effects. This is included in `totalFrameTime`. */
  screenspaceEffectsTime: number;
  /** The CPU time in milliseconds spent rendering background geometry including backgrounds, skyboxes, and background maps. This is included in `totalFrameTime`. */
  backgroundTime: number;
}
