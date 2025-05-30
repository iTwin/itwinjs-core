/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
/** @packageDocumentation
 * @module Rendering
 */

/**
 * Describes the type of a [[GraphicBuilder]], which defines the coordinate system in which the builder's geometry is defined and
 * controls the behavior of the [[RenderGraphic]] produced by the builder.
 * @note For those types for which depth-testing is disabled, the order in which the individual geometric primitives are drawn determines which geometry draws on top of other geometry.
 *  - Within a [[GraphicList]], each [[RenderGraphic]] is rendered in the order in which it appears in the list; and
 *  - Within a single [[RenderGraphic]], each geometric primitive is rendered in the ordered in which it was added to the GraphicBuilder.
 * @public
 * @extensions
 */
export enum GraphicType {
  /**
   * Renders behind all other graphics. For example, the border of a [[SheetViewState]] is of this type.
   * Coordinates: [[CoordSystem.View]].
   * [[RenderMode]]: [[RenderMode.SmoothShade]].
   * Lighting: none.
   * Depth-testing: disabled.
   * @see [[Decorations.viewBackground]]
   */
  ViewBackground,
  /**
   * Renders as if it were part of the scene. All of the [[ViewFlags]] applied to the view's normal geometry also applies to these types of decorations.
   * Coordinates: [[CoordSystem.World]].
   * Lighting and [RenderMode]($common): from view.
   * Depth-testing: enabled.
   * @see [[Decorations.normal]].
   */
  Scene,
  /** Renders within the scene, but ignores the view's [[ViewFlags]].
   * Coordinates: [[CoordSystem.World]].
   * Lighting: default.
   * RenderMode: [RenderMode.SmoothShade]($common).
   * Depth-testing: enabled.
   * @see [[Decorations.world]].
   */
  WorldDecoration,
  /**
   * Renders as an overlay on top of the scene. These decorations differ from [[GraphicType.WorldDecoration]] only in that depth-testing is disabled.
   * For example, the ACS triad and [[WindowAreaTool]] decorations are of this type.
   * Coordinates: [[CoordSystem.World]].
   * [RenderMode]: [RenderMode.SmoothShade]($common)
   * Lighting: default.
   * Depth-testing: disabled.
   * Renders atop the scene. Coordinates: world. RenderMode: smooth. Lighting: none. Z-testing: disabled
   * @note Overlay decorations typically employ some degree of transparency to ensure that they do not fully obscure the scene.
   * @see [[Decorations.worldOverlay]]
   */
  WorldOverlay,
  /**
   * Renders as an overlay on top of the scene. These decorations differ from [[GraphicType.WorldOverlay]] only in that their geometry is defined in view coordinates rather than world.
   * Coordinates: [[CoordSystem.View]].
   * RenderMode: [RenderMode.SmoothShade]($common)
   * Lighting: default.
   * Depth-testing: disabled.
   * @note For more flexibility in defining view overlay decorations, consider using a [[CanvasDecorationList]].
   * @see [[Decorations.viewOverlay]]
   */
  ViewOverlay,
}
