/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
/** @packageDocumentation
 * @module Views
 */

/** Describes the result of a viewing operation such as those exposed by [[ViewState]] and [[Viewport]].
 * @public
 */
export enum ViewStatus {
  Success = 0,
  ViewNotInitialized,
  AlreadyAttached,
  NotAttached,
  DrawFailure,
  NotResized,
  ModelNotFound,
  InvalidWindow,
  MinWindow,
  MaxWindow,
  MaxZoom,
  MaxDisplayDepth,
  InvalidUpVector,
  InvalidTargetPoint,
  InvalidLens,
  InvalidViewport,
  InvalidDirection,
  NotGeolocated,
  NotCameraView,
  NotEllipsoidGlobeMode,
  NotOrthographicView,
  DegenerateGeometry,
  HeightBelowTransition,
  NoTransitionRequired,
}
