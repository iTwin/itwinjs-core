/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
/** @packageDocumentation
 * @module Rendering
 */

import { Id64String } from "@bentley/bentleyjs-core";
import { Arc3d, Loop, Path, Point2d, Point3d, Polyface, Range3d, Transform } from "@bentley/geometry-core";
import { ColorDef, Frustum, GraphicParams, LinePixels, Npc } from "@bentley/imodeljs-common";
import { IModelConnection } from "../IModelConnection";
import { Viewport } from "../Viewport";
import { RenderGraphic } from "./RenderGraphic";

/**
 * Describes the type of a [[GraphicBuilder]], which defines the coordinate system in which the builder's geometry is defined and
 * controls the behavior of the [[RenderGraphic]] produced by the builder.
 * @note For those types for which depth-testing is disabled, the order in which the individual geometric primitives are drawn determines which geometry draws on top of other geometry.
 *  - Within a [[GraphicList]], each [[RenderGraphic]] is rendered in the order in which it appears in the list; and
 *  - Within a single [[RenderGraphic]], each geometric primitive is rendered in the ordered in which it was added to the GraphicBuilder.
 * @public
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
  /** Used for the scene itself, dynamics, and 'normal' decorations. */
  /**
   * Renders as if it were part of the scene. All of the [[ViewFlags]] applied to the view's normal geometry also applies to these types of decorations.
   * Coordinates: [[CoordSystem.World]].
   * Lighting and [[RenderMode]]: from view.
   * Depth-testing: enabled.
   * @see [[Decorations.normal]].
   */
  Scene,
  /** Renders within the scene. Coordinates: world. RenderMode: smooth. Lighting: default. Z-testing: enabled */
  /** Renders within the scene, but ignores the view's [[ViewFlags]].
   * Coordinates: [[CoordSystem.World]].
   * Lighting: default.
   * [[RenderMode]]: [[RenderMode.SmoothShade]].
   * Depth-testing: enabled.
   * @see [[Decorations.world]].
   */
  WorldDecoration,
  /**
   * Renders as an overlay on top of the scene. These decorations differ from [[GraphicType.WorldDecoration]] only in that depth-testing is disabled.
   * For example, the ACS triad and [[WindowAreaTool]] decorations are of this type.
   * Coordinates: [[CoordSystem.World]].
   * [[RenderMode]]: [[RenderMode.SmoothShade]]
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
   * [[RenderMode]]: [[RenderMode.SmoothShade]]
   * Lighting: default.
   * Depth-testing: disabled.
   * @note For more flexibility in defining view overlay decorations, consider using a [[CanvasDecorationList]].
   * @see [[Decorations.viewOverlay]]
   */
  ViewOverlay,
}

/** Provides methods for constructing a [[RenderGraphic]] from geometric primitives.
 * GraphicBuilder is primarily used for creating [[Decorations]] to be displayed inside a [[Viewport]].
 *
 * The typical process for constructing a [[RenderGraphic]] proceeds as follows:
 *  1. Use [[RenderContext.createGraphicBuilder]] to obtain a builder.
 *  2. Set up the symbology using [[GraphicBuilder.activateGraphicParams]].
 *  3. Add one or more geometric primitives using methods like [[GraphicBuilder.addShape]] and [[GraphicBuilder.addLineString]], possibly setting new symbology in between.
 *  4. Use [[GraphicBuilder.finish]] to produce the finished [[RenderGraphic]].
 *
 * @note Most of the methods which add geometry to the builder take ownership of their inputs rather than cloning them.
 * So, for example, if you pass an array of points to addLineString(), you should not subsequently modify that array.
 *
 * @see [[Decorator]].
 * @see [[RenderContext.createGraphicBuilder]].
 * @see [[RenderSystem.createGraphicBuilder]].
 * @see [[DecorateContext]].
 * @see [[DynamicsContext]].
 * @public
 */
export abstract class GraphicBuilder {
  private readonly _placement: Transform;
  /** The type of this builder. */
  public readonly type: GraphicType;
  /** The viewport in which the resultant [[RenderGraphic]] will be drawn. */
  public readonly viewport: Viewport;
  /* Some [[Decorator]]s produce "pickable" decorations with which the user can interact using tools like [[SelectionTool]].
   * To enable this behavior, the [[GraphicBuilder]] must be constructed with a unique identifier.
   * @see [[IModelConnection.transientIds]].
   */
  public pickId?: string;
  /** If true, [[ViewState.getAspectRatioSkew]] will be taken into account when computing the stroke tolerance for the produced graphics.
   * @alpha
   */
  public applyAspectRatioSkew = false;
  /** If true, the order in which geometry is added to the GraphicBuilder is preserved.
   * This is useful for overlay and background graphics because they draw without using the depth buffer. For example, to draw an overlay containing a red shape with a white outline,
   * you would add the shape to the GraphicBuilder first, followed by the outline, to ensure the outline draws "in front of" the shape.
   * It defaults to true for overlays and background graphics, and false for other graphics types.
   * It is not useful for other types of graphics, and it imposes a performance penalty (more draw calls).
   * For overlay and background graphics that do not need to draw in any particular order, performance can be improved by setting this to false.
   * @beta
   */
  public preserveOrder: boolean;

  /** The local coordinate system transform applied to this builder's geometry. */
  public get placement(): Transform { return this._placement; }
  public set placement(tf: Transform) { this._placement.setFrom(tf); }

  /** @internal */
  public get isViewCoordinates(): boolean { return this.type === GraphicType.ViewBackground || this.type === GraphicType.ViewOverlay; }
  /** @internal */
  public get isWorldCoordinates(): boolean { return !this.isViewCoordinates; }
  /** @internal */
  public get isSceneGraphic(): boolean { return this.type === GraphicType.Scene; }
  /** @internal */
  public get isViewBackground(): boolean { return this.type === GraphicType.ViewBackground; }
  /** @internal */
  public get isOverlay(): boolean { return this.type === GraphicType.ViewOverlay || this.type === GraphicType.WorldOverlay; }
  /** @internal */
  public get iModel(): IModelConnection { return this.viewport.iModel; }

  /** Controls whether normals are generated for surfaces. Normals allow 3d geometry to receive lighting; without them the geometry will be unaffected by lighting.
   * By default, normals are not generated. Changing this value only affects subsequently-added geometry. For example:
   * ```ts
   *  builder.wantNormals = true;
   *  builder.addShape(shapePoints); // this shape will have normals
   *  builder.wantNormals = false;
   *  builder.addLoop(loop); // this loop will have no normals
   *  const graphic = builder.finish(); // the result contains a shape with normals and a loop with no normals.
   * ```
   * @note Currently, no API exists to generate normals for a [Polyface]($geometry-core) that lacks them. Until such an API becomes available, if you want a lit Polyface, you
   * must both set `wantNormals` to `true` **and** supply a Polyface with precomputed normals to `addPolyface`.
   * @see [[GraphicType]] for a description of whether and how different types of graphics are affected by lighting.
   * @public
   */
  public get wantNormals(): boolean { return false; }
  public set wantNormals(_wantNormals: boolean) { }

  /** @internal */
  protected constructor(placement: Transform = Transform.identity, type: GraphicType, viewport: Viewport, pickId?: Id64String) {
    this._placement = placement;
    this.type = type;
    this.viewport = viewport;
    this.preserveOrder = this.isOverlay || this.isViewBackground;
    if (undefined !== pickId)
      this.pickId = pickId.toString();
  }

  /**
   * Processes the accumulated symbology and geometry to produce a renderable graphic.
   * This function can only be called once; after the [[RenderGraphic]] has been extracted the [[GraphicBuilder]] should no longer be used.
   */
  public abstract finish(): RenderGraphic;

  /** Sets the current active symbology for this builder. Any new geometry subsequently added to the builder will be drawn using the specified symbology.
   * @param graphicParams The symbology to apply to subsequent geometry.
   * @see [[GraphicBuilder.setSymbology]] for a convenient way to set common symbology options.
   */
  public abstract activateGraphicParams(graphicParams: GraphicParams): void;

  /**
   * Appends a 3d line string to the builder.
   * @param points Array of vertices in the line string.
   */
  public abstract addLineString(points: Point3d[]): void;

  /**
   * Appends a 2d line string to the builder.
   * @param points Array of vertices in the line string.
   * @param zDepth Z value in local coordinates to use for each point.
   */
  public abstract addLineString2d(points: Point2d[], zDepth: number): void;

  /**
   * Appends a 3d point string to the builder. The points are drawn disconnected, with a diameter in pixels defined by the builder's active [[GraphicParams.rasterWidth]].
   * @param points Array of vertices in the point string.
   */
  public abstract addPointString(points: Point3d[]): void;

  /**
   * Appends a 2d point string to the builder. The points are drawn disconnected, with a diameter in pixels defined by the builder's active [[GraphicParams.rasterWidth]].
   * @param points Array of vertices in the point string.
   * @param zDepth Z value in local coordinates to use for each point.
   */
  public abstract addPointString2d(points: Point2d[], zDepth: number): void;

  /**
   * Appends a closed 3d planar region to the builder.
   * @param points Array of vertices of the shape.
   */
  public abstract addShape(points: Point3d[]): void;

  /**
   * Appends a closed 2d region to the builder.
   * @param points Array of vertices of the shape.
   * @param zDepth Z value in local coordinates to use for each point.
   */
  public abstract addShape2d(points: Point2d[], zDepth: number): void;

  /**
   * Appends a 3d open arc or closed ellipse to the builder.
   * @param arc Description of the arc or ellipse.
   * @param isEllipse If true, and if the arc defines a full sweep, then draw as a closed ellipse instead of an arc.
   * @param filled If true, and isEllipse is also true, then draw ellipse filled.
   */
  public abstract addArc(arc: Arc3d, isEllipse: boolean, filled: boolean): void;

  /**
   * Appends a 2d open arc or closed ellipse to the builder.
   * @param arc Description of the arc or ellipse.
   * @param isEllipse If true, and if the arc defines a full sweep, then draw as a closed ellipse instead of an arc.
   * @param filled If true, and isEllipse is also true, then draw ellipse filled.
   * @param zDepth Z value in local coordinates to use for each point in the arc or ellipse.
   */
  public abstract addArc2d(ellipse: Arc3d, isEllipse: boolean, filled: boolean, zDepth: number): void;

  /** Append a 3d open path to the builder. */
  public abstract addPath(path: Path): void;

  /** Append a 3d planar region to the builder. */
  public abstract addLoop(loop: Loop): void;

  /** Append a mesh to the builder.
   * @param meshData Describes the mesh
   * @param filled If the mesh describes a planar region, indicates whether its interior area should be drawn with fill in [[RenderMode.Wireframe]].
   */
  public abstract addPolyface(meshData: Polyface, filled: boolean): void;

  /** Add Range3d edges. Useful for debugging. */
  public addRangeBox(range: Range3d) {
    this.addFrustum(Frustum.fromRange(range));
  }

  /** Add Frustum edges. Useful for debugging. */
  public addFrustum(frustum: Frustum) {
    this.addRangeBoxFromCorners(frustum.points);
  }

  /** Add range edges from corner points */
  public addRangeBoxFromCorners(p: Point3d[]) {
    this.addLineString([
      p[Npc.LeftBottomFront],
      p[Npc.LeftTopFront],
      p[Npc.RightTopFront],
      p[Npc.RightBottomFront],
      p[Npc.RightBottomRear],
      p[Npc.RightTopRear],
      p[Npc.LeftTopRear],
      p[Npc.LeftBottomRear],
      p[Npc.LeftBottomFront].clone(),
      p[Npc.RightBottomFront].clone(),
    ]);

    this.addLineString([p[Npc.LeftTopFront].clone(), p[Npc.LeftTopRear].clone()]);
    this.addLineString([p[Npc.RightTopFront].clone(), p[Npc.RightTopRear].clone()]);
    this.addLineString([p[Npc.LeftBottomRear].clone(), p[Npc.RightBottomRear].clone()]);
  }

  /** Sets the current active symbology for this builder. Any new geometry subsequently added will be drawn using the specified symbology.
   * @param lineColor The color in which to draw lines.
   * @param fillColor The color in which to draw filled regions.
   * @param lineWidth The width in pixels to draw lines. The renderer will clamp this value to an integer in the range [1, 32].
   * @param linePixels The pixel pattern in which to draw lines.
   * @see [[GraphicBuilder.activateGraphicParams]] for additional symbology options.
   */
  public setSymbology(lineColor: ColorDef, fillColor: ColorDef, lineWidth: number, linePixels = LinePixels.Solid) {
    this.activateGraphicParams(GraphicParams.fromSymbology(lineColor, fillColor, lineWidth, linePixels));
  }

  /** Set the current active symbology for this builder to be a blanking fill before adding a planar region.
   * A planar region drawn with blanking fill renders behind other geometry in the same graphic.
   * Blanking fill is not affected by the fill [[ViewFlags]] being disabled.
   * An example would be to add a line to a graphic containing a shape with blanking fill so that the line is always shown in front of the fill.
   * @param fillColor The color in which to draw filled regions.
   */
  public setBlankingFill(fillColor: ColorDef) { this.activateGraphicParams(GraphicParams.fromBlankingFill(fillColor)); }
}
