/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
/** @packageDocumentation
 * @module Rendering
 */

import { Id64String, assert } from "@itwin/core-bentley";
import { Transform, Point3d, Box, Range3d, SolidPrimitive, Polyface, Path, AnyCurvePrimitive, Loop, Arc3d, Point2d } from "@itwin/core-geometry";
import { AnalysisStyle, ColorDef, Feature, Frustum, GraphicParams, LinePixels, Npc } from "@itwin/core-common";
// ###TODO import { _implementationProhibited } from "../../internal/Symbols";
import { GraphicType } from "./GraphicType";
import { PickableGraphicOptions } from "./BatchOptions";
import { GraphicPrimitive } from "./GraphicPrimitive";

export interface GraphicAssemblerOptions {
  type: GraphicType;
  placement: Transform;
  pickable?: PickableGraphicOptions;
  preserveOrder: boolean;
  wantNormals: boolean;
  wantEdges: boolean;
  viewIndependentOrigin?: Point3d;
  analysisStyle?: AnalysisStyle;
  // ###TODO computeChordTolerance?
}

export abstract class GraphicAssembler {
  // ###TODO protected abstract [_implementationProhibited]: unknown;

  public readonly placement: Transform;

  public readonly type: GraphicType;

  public readonly pickable?: Readonly<PickableGraphicOptions>;

  public readonly preserveOrder: boolean;

  public readonly wantNormals: boolean;

  public readonly wantEdges: boolean;

  public readonly viewIndependentOrigin?: Readonly<Point3d>;

  /** @alpha */
  public readonly analysisStyle?: AnalysisStyle;

  /** @internal */
  protected constructor(options: GraphicAssemblerOptions) {
    this.placement = options.placement?.clone() ?? Transform.createIdentity();
    this.type = options.type;
    this.pickable = options.pickable;
    this.wantEdges = options.wantEdges;
    this.preserveOrder = options.preserveOrder;
    this.wantNormals = options.wantNormals;
    this.viewIndependentOrigin = options.viewIndependentOrigin?.clone();
    this.analysisStyle = options.analysisStyle;
  }

  /** Whether the builder's geometry is defined in [[CoordSystem.View]] coordinates.
   * @see [[isWorldCoordinates]].
   */
  public get isViewCoordinates(): boolean {
    return this.type === GraphicType.ViewBackground || this.type === GraphicType.ViewOverlay;
  }

  /** Whether the builder's geometry is defined in [[CoordSystem.World]] coordinates.
   * @see [[isViewCoordinates]].
   */
  public get isWorldCoordinates(): boolean {
    return !this.isViewCoordinates;
  }

  /** True if the builder produces a graphic of [[GraphicType.Scene]]. */
  public get isSceneGraphic(): boolean {
    return this.type === GraphicType.Scene;
  }

  /** True if the builder produces a graphic of [[GraphicType.ViewBackground]]. */
  public get isViewBackground(): boolean {
    return this.type === GraphicType.ViewBackground;
  }

  /** True if the builder produces a graphic of [[GraphicType.WorldOverlay]] or [[GraphicType.ViewOerlay]]. */
  public get isOverlay(): boolean {
    return this.type === GraphicType.ViewOverlay || this.type === GraphicType.WorldOverlay;
  }

  /** Sets the current active symbology for this builder. Any new geometry subsequently added to the builder will be drawn using the specified symbology.
   * @param graphicParams The symbology to apply to subsequent geometry.
   * @see [[GraphicBuilder.setSymbology]] for a convenient way to set common symbology options.
   */
  public abstract activateGraphicParams(graphicParams: GraphicParams): void;

  /** Called by [[activateFeature]] after validation to change the [Feature]($common) to be associated with subsequently-added geometry.
   * This default implementation does nothing.
   */
  protected _activateFeature(_feature: Feature): void { }

  /** Change the [Feature]($common) to be associated with subsequently-added geometry. This permits multiple features to be batched together into a single graphic
   * for more efficient rendering.
   * @note This method has no effect if [[GraphicBuilderOptions.pickable]] was not supplied to the GraphicBuilder's constructor.
   */
  public activateFeature(feature: Feature): void {
    assert(undefined !== this.pickable, "GraphicBuilder.activateFeature has no effect if PickableGraphicOptions were not supplied");
    if (this.pickable)
      this._activateFeature(feature);
  }

  /** Change the pickable Id to be associated with subsequently-added geometry. This permits multiple pickable objects to be batched  together into a single graphic
   * for more efficient rendering. This method calls [[activateFeature]], using the subcategory Id and [GeometryClass]($common) specified in [[GraphicBuilder.pickable]]
   * at construction, if any.
   * @note This method has no effect if [[GraphicBuilderOptions.pickable]] was not supplied to the GraphicBuilder's constructor.
   */
  public activatePickableId(id: Id64String): void {
    const pick = this.pickable;
    this.activateFeature(new Feature(id, pick?.subCategoryId, pick?.geometryClass));
  }

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

  /** Append a [CurvePrimitive]($core-geometry) to the builder. */
  public addCurvePrimitive(curve: AnyCurvePrimitive): void {
    switch (curve.curvePrimitiveType) {
      case "lineString":
        this.addLineString(curve.points);
        break;
      case "lineSegment":
        this.addLineString([curve.startPoint(), curve.endPoint()]);
        break;
      case "arc":
        this.addArc(curve, false, false);
        break;
      default:
        const path = new Path();
        if (path.tryAddChild(curve))
          this.addPath(path);

        break;
    }
  }

  /** Append a mesh to the builder.
   * @param meshData Describes the mesh
   * @param filled If the mesh describes a planar region, indicates whether its interior area should be drawn with fill in [[RenderMode.Wireframe]].
   */
  public abstract addPolyface(meshData: Polyface, filled: boolean): void;

  /** Append a solid primitive to the builder. */
  public abstract addSolidPrimitive(solidPrimitive: SolidPrimitive): void;

  /** Append any primitive to the builder.
   * @param primitive The graphic primitive to append.
   */
  public addPrimitive(primitive: GraphicPrimitive): void {
    switch (primitive.type) {
      case "linestring":
        this.addLineString(primitive.points);
        break;
      case "linestring2d":
        this.addLineString2d(primitive.points, primitive.zDepth);
        break;
      case "pointstring":
        this.addPointString(primitive.points);
        break;
      case "pointstring2d":
        this.addPointString2d(primitive.points, primitive.zDepth);
        break;
      case "shape":
        this.addShape(primitive.points);
        break;
      case "shape2d":
        this.addShape2d(primitive.points, primitive.zDepth);
        break;
      case "arc":
        this.addArc(primitive.arc, true === primitive.isEllipse, true === primitive.filled);
        break;
      case "arc2d":
        this.addArc2d(primitive.arc, true === primitive.isEllipse, true === primitive.filled, primitive.zDepth);
        break;
      case "path":
        this.addPath(primitive.path);
        break;
      case "loop":
        this.addLoop(primitive.loop);
        break;
      case "polyface":
        this.addPolyface(primitive.polyface, true === primitive.filled);
        break;
      case "solidPrimitive":
        this.addSolidPrimitive(primitive.solidPrimitive);
        break;
    }
  }

  /** Add a box representing a volume of space. Typically used for debugging purposes.
   * @param range The volume of space.
   * @param solid If true, a [[Box]] solid primitive will be added; otherwise, a wireframe outline of the box will be added.
   */
  public addRangeBox(range: Range3d, solid = false): void {
    if (!solid) {
      this.addFrustum(Frustum.fromRange(range));
      return;
    }

    const box = Box.createRange(range, true);
    if (box)
      this.addSolidPrimitive(box);
  }

  /** Add Frustum edges. Useful for debugging. */
  public addFrustum(frustum: Frustum) {
    this.addRangeBoxFromCorners(frustum.points);
  }

  /** Add Frustum sides. Useful for debugging. */
  public addFrustumSides(frustum: Frustum) {
    this.addRangeBoxSidesFromCorners(frustum.points);
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

  /** Add range sides from corner points */
  public addRangeBoxSidesFromCorners(p: Point3d[]) {
    this.addShape([
      p[Npc.LeftBottomFront].clone(),
      p[Npc.LeftTopFront].clone(),
      p[Npc.RightTopFront].clone(),
      p[Npc.RightBottomFront].clone(),
      p[Npc.LeftBottomFront].clone()]);
    this.addShape([
      p[Npc.RightTopRear].clone(),
      p[Npc.LeftTopRear].clone(),
      p[Npc.LeftBottomRear].clone(),
      p[Npc.RightBottomRear].clone(),
      p[Npc.RightTopRear].clone()]);
    this.addShape([
      p[Npc.RightTopRear].clone(),
      p[Npc.LeftTopRear].clone(),
      p[Npc.LeftTopFront].clone(),
      p[Npc.RightTopFront].clone(),
      p[Npc.RightTopRear].clone()]);
    this.addShape([
      p[Npc.RightTopRear].clone(),
      p[Npc.RightBottomRear].clone(),
      p[Npc.RightBottomFront].clone(),
      p[Npc.RightTopFront].clone(),
      p[Npc.RightTopRear].clone()]);
    this.addShape([
      p[Npc.LeftBottomRear].clone(),
      p[Npc.RightBottomRear].clone(),
      p[Npc.RightBottomFront].clone(),
      p[Npc.LeftBottomFront].clone(),
      p[Npc.LeftBottomRear].clone()]);
    this.addShape([
      p[Npc.LeftBottomRear].clone(),
      p[Npc.LeftTopRear].clone(),
      p[Npc.LeftTopFront].clone(),
      p[Npc.LeftBottomFront].clone(),
      p[Npc.LeftBottomRear].clone()]);
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
