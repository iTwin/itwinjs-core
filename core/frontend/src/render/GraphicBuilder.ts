/*---------------------------------------------------------------------------------------------
* Copyright (c) 2018 - present Bentley Systems, Incorporated. All rights reserved.
* Licensed under the MIT License. See LICENSE.md in the project root for license terms.
*--------------------------------------------------------------------------------------------*/
/** @module Rendering */

import { IModelConnection } from "../IModelConnection";
import { Id64String } from "@bentley/bentleyjs-core";
import {
  Transform,
  Point3d,
  Point2d,
  Range3d,
  Arc3d,
  Polyface,
  Path,
  Loop,
} from "@bentley/geometry-core";
import {
  ColorDef,
  GraphicParams,
  LinePixels,
} from "@bentley/imodeljs-common";
import { Viewport } from "../Viewport";
import { RenderGraphic } from "./System";

/**
 * Describes the type of a [[GraphicBuilder]], which defines the coordinate system in which the builder's geometry is defined and
 * controls the behavior of the [[RenderGraphic]] produced by the builder.
 * @note For those types for which depth-testing is disabled, the order in which the individual geometric primitives are drawn determines which geometry draws on top of other geometry.
 *  - Within a [[GraphicList]], each [[RenderGraphic]] is rendered in the order in which it appears in the list; and
 *  - Within a single [[RenderGraphic]], each geometric primitive is rendered in the ordered in which it was added to the GraphicBuilder.
 */
export const enum GraphicType {
  /**
   * Renders behind all other graphics. For example, the [[SheetBorder]] of a [[SheetViewState]] is of this type.
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

  /** The local coordinate system transform applied to this builder's geometry. */
  public get placement(): Transform { return this._placement; }
  public set placement(tf: Transform) { this._placement.setFrom(tf); }

  /** @hidden */
  public get isViewCoordinates(): boolean { return this.type === GraphicType.ViewBackground || this.type === GraphicType.ViewOverlay; }
  /** @hidden */
  public get isWorldCoordinates(): boolean { return !this.isViewCoordinates; }
  /** @hidden */
  public get isSceneGraphic(): boolean { return this.type === GraphicType.Scene; }
  /** @hidden */
  public get isViewBackground(): boolean { return this.type === GraphicType.ViewBackground; }
  /** @hidden */
  public get isOverlay(): boolean { return this.type === GraphicType.ViewOverlay || this.type === GraphicType.WorldOverlay; }
  /** @hidden */
  public get iModel(): IModelConnection { return this.viewport.iModel; }

  /** @hidden */
  protected constructor(placement: Transform = Transform.identity, type: GraphicType, viewport: Viewport, pickId?: Id64String) {
    this._placement = placement;
    this.type = type;
    this.viewport = viewport;
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

  /** Helper for adding a series of line strings
   * @hidden
   */
  public addLineStrings(...lines: Array<[number, Point3d[]]>): void { this.convertToLineStringParams(...lines).forEach((l) => this.addLineString(l.points)); }

  /** Helper for converting an array of string param data each of which are stored as array into an array of line string params.
   * @hidden
   */
  public convertToLineStringParams(...lines: Array<[number, Point3d[]]>): Array<{ numPoints: number, points: Point3d[] }> { return lines.map((l) => ({ numPoints: l[0], points: l[1] })); }

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

  /** Add Range3d edges
   * @hidden
   */
  public addRangeBox(range: Range3d) {
    const p: Point3d[] = [];
    for (let i = 0; i < 8; ++i) p[i] = new Point3d();

    p[0].x = p[3].x = p[4].x = p[5].x = range.low.x;
    p[1].x = p[2].x = p[6].x = p[7].x = range.high.x;
    p[0].y = p[1].y = p[4].y = p[7].y = range.low.y;
    p[2].y = p[3].y = p[5].y = p[6].y = range.high.y;
    p[0].z = p[1].z = p[2].z = p[3].z = range.low.z;
    p[4].z = p[5].z = p[6].z = p[7].z = range.high.z;

    const tmpPts: Point3d[] = [];
    tmpPts[0] = p[0]; tmpPts[1] = p[1]; tmpPts[2] = p[2];
    tmpPts[3] = p[3]; tmpPts[4] = p[5]; tmpPts[5] = p[6];
    tmpPts[6] = p[7]; tmpPts[7] = p[4]; tmpPts[8] = p[0];

    this.addLineStrings([9, tmpPts], [2, [p[0], p[3]]], [2, [p[4], p[5]]], [2, [p[1], p[7]]], [2, [p[2], p[6]]]);
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

  /** Set blanking fill symbology for decoration.
   * @hidden
   */
  public setBlankingFill(fillColor: ColorDef) { this.activateGraphicParams(GraphicParams.fromBlankingFill(fillColor)); }
}
