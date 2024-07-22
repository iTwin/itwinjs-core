/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
/** @packageDocumentation
 * @module Rendering
 */

import { Id64String } from "@itwin/core-bentley";
import { Point3d, Range3d, Transform } from "@itwin/core-geometry";
import { IModelConnection } from "../IModelConnection";
import { Viewport } from "../Viewport";
import { RenderGraphic } from "./RenderGraphic";
import { GraphicType } from "../common/render/GraphicType";
import type { PickableGraphicOptions} from "../common/render/BatchOptions";
import { GraphicAssembler } from "../common/render/GraphicAssembler";
import { _implementationProhibited } from "../common/internal/Symbols";

/** Options for creating a [[GraphicBuilder]] used by functions like [[DecorateContext.createGraphic]] and [[RenderSystem.createGraphic]].
 * @see [[ViewportGraphicBuilderOptions]] to create a graphic builder for a [[Viewport]].
 * @see [[CustomGraphicBuilderOptions]] to create a graphic builder unassociated with any [[Viewport]].
 * @public
 * @extensions
 */
export interface GraphicBuilderOptions {
  /** The type of graphic to produce. */
  type: GraphicType;

  /** The local-to-world transform in which the builder's geometry is to be defined - by default, an identity transform. */
  placement?: Transform;

  /** If the graphic is to be pickable, specifies the pickable Id and other options. */
  pickable?: PickableGraphicOptions;

  /** If true, the order in which geometry is added to the builder is preserved.
   * This is useful for overlay and background graphics because they draw without using the depth buffer. For example, to draw an overlay containing a red shape with a white outline,
   * you would add the shape to the GraphicBuilder first, followed by the outline, to ensure the outline draws "in front of" the shape.
   * It defaults to true for overlays and background graphics, and false for other graphic types.
   * It is not useful for other types of graphics and imposes a performance penalty due to increased number of draw calls.
   * For overlay and background graphics that do not need to draw in any particular order, the performance penalty can be eliminated by setting this to `false`.
   */
  preserveOrder?: boolean;

  /** Controls whether normals are generated for surfaces. Normals allow 3d geometry to receive lighting; without them the geometry will be unaffected by lighting.
   * By default, normals are generated only for graphics of type [[GraphicType.Scene]]; or for any type of graphic if [[GraphicBuilder.wantEdges]] is true, because
   * normals are required to prevent z-fighting between surfaces and their edges. This default can be overridden by explicitly specifying `true` or `false`.
   * @see [[GraphicType]] for a description of whether and how different types of graphics are affected by lighting.
   */
  wantNormals?: boolean;

  /** Controls whether edges are generated for surfaces.
   * Edges are only displayed if [ViewFlags.renderMode]($common) is not [RenderMode.SmoothShade]($common) or [ViewFlags.visibleEdges]($common) is `true`.
   * Since all decoration graphics except [[GraphicType.Scene]] are drawn in smooth shaded mode with no visible edges, by default edges are only produced for scene graphics, and
   * - if a [[Viewport]] is supplied with the options - only if [ViewFlags.edgesRequired]($common) is true for the viewport.
   * That default can be overridden by explicitly specifying `true` or `false`. This can be useful for non-scene decorations contained in a [[GraphicBranch]] that applies [ViewFlagOverrides]($common)
   * that change the edge display settings; or for scene decorations that might be cached for reuse after the viewport's edge settings are changed.
   * @note Edges will tend to z-fight with their surfaces unless the graphic is [[pickable]].
   */
  generateEdges?: boolean;

  /** If defined, specifies a point about which the graphic will rotate such that it always faces the viewer.
   * This can be particular useful for planar regions to create a billboarding effect - e.g., to implement [[Marker]]-like WebGL decorations.
   * The graphic's [[placement]] transform is not applied to the point.
   * @note This has no effect for graphics displayed in a 2d view.
   */
  viewIndependentOrigin?: Point3d;
}

/** Options for creating a [[GraphicBuilder]] to produce a [[RenderGraphic]] to be displayed in a specific [[Viewport]].
 * The level of detail of the graphic will be computed from the position of its geometry within the viewport's [Frustum]($common).
 * Default values for [[GraphicBuilderOptions.wantNormals]] and [[GraphicBuilderOptions.generateEdges]] will be determined by the viewport's [ViewFlags]($common).
 * The [[GraphicBuilder.iModel]] will be set to the viewport's [[IModelConnection]].
 * @public
 * @extensions
 */
export interface ViewportGraphicBuilderOptions extends GraphicBuilderOptions {
  /** The viewport in which the resultant [[RenderGraphic]] is to be drawn. */
  viewport: Viewport;

  /** If true, [[ViewState.getAspectRatioSkew]] will be taken into account when computing the level of detail for the produced graphics. */
  applyAspectRatioSkew?: boolean;

  iModel?: never;
  computeChordTolerance?: never;
}

/** Arguments used to compute the chord tolerance (level of detail) of the [[RenderGraphic]]s produced by a [[GraphicBuilder]].
 * Generally, the chord tolerance should be roughly equivalent to the size in meters of one pixel on screen where the graphic is to be displayed.
 * For [[GraphicType.ViewOverlay]] and [[GraphicType.ViewBackground]], which already define their geometry in pixels, the chord tolerance should typically be 1.
 * @see [[CustomGraphicBuilderOptions.computeChordTolerance]].
 * @public
 * @extensions
 */
export interface ComputeChordToleranceArgs {
  /** The graphic builder being used to produce the graphics. */
  readonly graphic: GraphicBuilder;
  /** A function that computes a range enclosing all of the geometry that was added to the builder. */
  readonly computeRange: () => Range3d;
}

/** Options for creating a [[GraphicBuilder]] to produce a [[RenderGraphic]] that is not associated with any particular [[Viewport]] and may not be associated with
 * any particular [[IModelConnection]].
 * This is primarily useful when the same graphic is to be saved and reused for display in multiple viewports and for which a chord tolerance can be computed
 * independently of each viewport's [Frustum]($common).
 * @public
 * @extensions
 */
export interface CustomGraphicBuilderOptions extends GraphicBuilderOptions {
  /** Optionally, the IModelConnection with which the graphic is associated. */
  iModel?: IModelConnection;
  /** A function that can compute the level of detail for the graphics produced by the builder. */
  computeChordTolerance: (args: ComputeChordToleranceArgs) => number;

  applyAspectRatioSkew?: never;
  viewport?: never;
}

/** Provides methods for constructing a [[RenderGraphic]] from geometric primitives.
 * GraphicBuilder is primarily used for creating [[Decorations]] to be displayed inside a [[Viewport]].
 *
 * The typical process for constructing a [[RenderGraphic]] proceeds as follows:
 *  1. Use [[DecorateContext.createGraphic]] or [[RenderSystem.createGraphic]] to obtain a builder.
 *  2. Set up the symbology using [[GraphicBuilder.activateGraphicParams]] or [[GraphicBuilder.setSymbology]].
 *  3. Add one or more geometric primitives using methods like [[GraphicBuilder.addShape]] and [[GraphicBuilder.addLineString]], possibly setting new symbology in between.
 *  4. Use [[GraphicBuilder.finish]] to produce the finished [[RenderGraphic]].
 *
 * @note Most of the methods which add geometry to the builder take ownership of their inputs rather than cloning them.
 * So, for example, if you pass an array of points to addLineString(), you should not subsequently modify that array.
 *
 * @public
 * @extensions
 */
export abstract class GraphicBuilder extends GraphicAssembler {
  /** The iModel associated with this builder, if any. */
  public readonly iModel?: IModelConnection;

  protected readonly _computeChordTolerance: (args: ComputeChordToleranceArgs) => number;

  /** @internal */
  protected constructor(options: ViewportGraphicBuilderOptions | CustomGraphicBuilderOptions) {
    const vp = options.viewport;
    const placement = options.placement ?? Transform.createIdentity();
    const wantEdges = options.generateEdges ?? (options.type === GraphicType.Scene && (!vp || vp.viewFlags.edgesRequired()));
    const wantNormals = options.wantNormals ?? (wantEdges || options.type === GraphicType.Scene);
    const preserveOrder = options.preserveOrder ?? (options.type === GraphicType.ViewOverlay || options.type === GraphicType.WorldOverlay || options.type === GraphicType.ViewBackground);

    super({
      ...options,
      [_implementationProhibited]: undefined,
      placement,
      wantEdges,
      wantNormals,
      preserveOrder,
    });

    this.iModel = vp?.iModel ?? options.iModel;
    if (!options.viewport) {
      this._computeChordTolerance = options.computeChordTolerance;
      return;
    }

    this._computeChordTolerance = (args: ComputeChordToleranceArgs) => {
      let pixelSize = 1;
      if (!this.isViewCoordinates) {
        // Compute the horizontal distance in meters between two adjacent pixels at the center of the geometry.
        pixelSize = options.viewport.getPixelSizeAtPoint(args.computeRange().center);
        pixelSize = options.viewport.target.adjustPixelSizeForLOD(pixelSize);

        // Aspect ratio skew > 1.0 stretches the view in Y. In that case use the smaller vertical pixel distance for our stroke tolerance.
        const skew = options.applyAspectRatioSkew ? options.viewport.view.getAspectRatioSkew() : 0;
        if (skew > 1)
          pixelSize /= skew;
      }

      return pixelSize * 0.25;
    };
  }

  /** The Id to be associated with the graphic for picking.
   * @see [[GraphicBuilderOptions.pickable]] for more options.
   * @deprecated in 3.x. This provides only the **first** pickable Id for this graphic - you should keep track of the **current** pickable Id yourself.
   */
  public get pickId(): Id64String | undefined {
    return this.pickable?.id;
  }
  /**
   * Processes the accumulated symbology and geometry to produce a renderable graphic.
   * This function can only be called once; after the [[RenderGraphic]] has been extracted the [[GraphicBuilder]] should no longer be used.
   */
  public abstract finish(): RenderGraphic;
}
