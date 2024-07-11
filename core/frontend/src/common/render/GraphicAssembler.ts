/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
/** @packageDocumentation
 * @module Rendering
 */

import { Id64String } from "@itwin/core-bentley";
import { Transform, Point3d, Point2d, Arc3d, Path, Loop, AnyCurvePrimitive, Polyface, SolidPrimitive, Range3d } from "@itwin/core-geometry";
import { AnalysisStyle, ColorDef, Feature, Frustum, GraphicParams, LinePixels } from "@itwin/core-common";
// ###TODO import { _implementationProhibited } from "../../internal/Symbols";
import { GraphicType } from "./GraphicType";
import { PickableGraphicOptions } from "./BatchOptions";
import { GraphicPrimitive } from "./GraphicPrimitive";

export interface GraphicAssembler {
  /** @internal */
  // ###TODO [_implementationProhibited]: unknown;
  
  readonly placement: Transform;
  readonly type: GraphicType;
  readonly pickable?: Readonly<PickableGraphicOptions>;
  readonly preserveOrder: boolean;
  readonly wantNormals: boolean;
  readonly wantEdges: boolean;
  /** @alpha */
  readonly analysisStyle?: AnalysisStyle;

  activateGraphicParams(params:GraphicParams): void;
  activateFeature(feature: Feature): void;
  activatePickableId(id: Id64String): void;

  addLineString(points: Point3d[]): void;

  /**
   * Appends a 3d line string to the builder.
   * @param points Array of vertices in the line string.
   */
  addLineString(points: Point3d[]): void;

  /**
   * Appends a 2d line string to the builder.
   * @param points Array of vertices in the line string.
   * @param zDepth Z value in local coordinates to use for each point.
   */
  addLineString2d(points: Point2d[], zDepth: number): void;

  /**
   * Appends a 3d point string to the builder. The points are drawn disconnected, with a diameter in pixels defined by the builder's active [[GraphicParams.rasterWidth]].
   * @param points Array of vertices in the point string.
   */
  addPointString(points: Point3d[]): void;

  /**
   * Appends a 2d point string to the builder. The points are drawn disconnected, with a diameter in pixels defined by the builder's active [[GraphicParams.rasterWidth]].
   * @param points Array of vertices in the point string.
   * @param zDepth Z value in local coordinates to use for each point.
   */
  addPointString2d(points: Point2d[], zDepth: number): void;

  /**
   * Appends a closed 3d planar region to the builder.
   * @param points Array of vertices of the shape.
   */
  addShape(points: Point3d[]): void;

  /**
   * Appends a closed 2d region to the builder.
   * @param points Array of vertices of the shape.
   * @param zDepth Z value in local coordinates to use for each point.
   */
  addShape2d(points: Point2d[], zDepth: number): void;

  /**
   * Appends a 3d open arc or closed ellipse to the builder.
   * @param arc Description of the arc or ellipse.
   * @param isEllipse If true, and if the arc defines a full sweep, then draw as a closed ellipse instead of an arc.
   * @param filled If true, and isEllipse is also true, then draw ellipse filled.
   */
  addArc(arc: Arc3d, isEllipse: boolean, filled: boolean): void;

  /**
   * Appends a 2d open arc or closed ellipse to the builder.
   * @param arc Description of the arc or ellipse.
   * @param isEllipse If true, and if the arc defines a full sweep, then draw as a closed ellipse instead of an arc.
   * @param filled If true, and isEllipse is also true, then draw ellipse filled.
   * @param zDepth Z value in local coordinates to use for each point in the arc or ellipse.
   */
  addArc2d(ellipse: Arc3d, isEllipse: boolean, filled: boolean, zDepth: number): void;

  /** Append a 3d open path to the builder. */
  addPath(path: Path): void;

  /** Append a 3d planar region to the builder. */
  addLoop(loop: Loop): void;

  /** Append a [CurvePrimitive]($core-geometry) to the builder. */
  addCurvePrimitive(curve: AnyCurvePrimitive): void;

  /** Append a mesh to the builder.
   * @param meshData Describes the mesh
   * @param filled If the mesh describes a planar region, indicates whether its interior area should be drawn with fill in [[RenderMode.Wireframe]].
   */
  addPolyface(meshData: Polyface, filled: boolean): void;

  /** Append a solid primitive to the builder. */
  addSolidPrimitive(solidPrimitive: SolidPrimitive): void;

  /** Append any primitive to the builder.
   * @param primitive The graphic primitive to append.
   */
  addPrimitive(primitive: GraphicPrimitive): void;

  /** Add a box representing a volume of space. Typically used for debugging purposes.
   * @param range The volume of space.
   * @param solid If true, a [Box]($core-geometry) solid primitive will be added; otherwise, a wireframe outline of the box will be added.
   */
  addRangeBox(range: Range3d, solid?: boolean): void;

  /** Add Frustum edges. Useful for debugging. */
  addFrustum(frustum: Frustum): void;

  /** Add Frustum sides. Useful for debugging. */
  addFrustumSides(frustum: Frustum): void;

  /** Add range edges from corner points */
  addRangeBoxFromCorners(p: Point3d[]): void;

  /** Add range sides from corner points */
  addRangeBoxSidesFromCorners(p: Point3d[]): void;

  /** Sets the current active symbology for this builder. Any new geometry subsequently added will be drawn using the specified symbology.
   * @param lineColor The color in which to draw lines.
   * @param fillColor The color in which to draw filled regions.
   * @param lineWidth The width in pixels to draw lines. The renderer will clamp this value to an integer in the range [1, 32].
   * @param linePixels The pixel pattern in which to draw lines. Default: [LinePixels.Solid]($common).
   * @see [[GraphicBuilder.activateGraphicParams]] for additional symbology options.
   */
  setSymbology(lineColor: ColorDef, fillColor: ColorDef, lineWidth: number, linePixels?: LinePixels): void;

  /** Set the current active symbology for this builder to be a blanking fill before adding a planar region.
   * A planar region drawn with blanking fill renders behind other geometry in the same graphic.
   * Blanking fill is not affected by the fill [[ViewFlags]] being disabled.
   * An example would be to add a line to a graphic containing a shape with blanking fill so that the line is always shown in front of the fill.
   * @param fillColor The color in which to draw filled regions.
   */
  setBlankingFill(fillColor: ColorDef): void;
}
