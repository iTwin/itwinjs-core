/*---------------------------------------------------------------------------------------------
|  $Copyright: (c) 2018 Bentley Systems, Incorporated. All rights reserved. $
 *--------------------------------------------------------------------------------------------*/
/** @module Rendering */

import { Transform, Arc3d, LineSegment3d, CurvePrimitive, Loop, Path, Point2d, Point3d, Polyface, IndexedPolyface, LineString3d } from "@bentley/geometry-core";
import { GraphicParams, RenderTexture, Gradient } from "@bentley/imodeljs-common";
import { IModelConnection } from "../../../IModelConnection";
import { GraphicBuilder, GraphicBuilderCreateParams } from "../../GraphicBuilder";
import { ViewContext } from "../../../ViewContext";
import { Viewport } from "../../../Viewport";
import { GeometryOptions } from "../Primitives";
import { RenderSystem, RenderGraphic } from "../../System";
import { DisplayParams } from "../DisplayParams";
import { GeometryAccumulator } from "./GeometryAccumulator";
import { Geometry } from "./GeometryPrimitives";

function copy2dTo3d(pts2d: Point2d[], depth: number): Point3d[] {
  const pts3d: Point3d[] = [];
  for (const point of pts2d)
    pts3d.push(Point3d.create(point.x, point.y, depth));
  return pts3d;
}

export abstract class GeometryListBuilder extends GraphicBuilder {
  public accum: GeometryAccumulator;
  public graphicParams: GraphicParams = new GraphicParams();

  public abstract finishGraphic(accum: GeometryAccumulator): RenderGraphic; // Invoked by _Finish() to obtain the finished RenderGraphic.

  public constructor(system: RenderSystem, params: GraphicBuilderCreateParams, accumulatorTf: Transform = Transform.createIdentity()) {
    super(params);
    this.accum = new GeometryAccumulator(params.iModel, system, undefined, accumulatorTf);
  }

  public _finish(): RenderGraphic {
    const graphic = this.finishGraphic(this.accum);
    this.accum.clear();
    return graphic;
  }

  public activateGraphicParams(graphicParams: GraphicParams): void {
    this.graphicParams = graphicParams;
  }

  public addArc2d(ellipse: Arc3d, isEllipse: boolean, filled: boolean, zDepth: number): void {
    if (0.0 === zDepth) {
      this.addArc(ellipse, isEllipse, filled);
    } else {
      const ell: Arc3d = ellipse;
      ell.center.z = zDepth;
      this.addArc(ell, isEllipse, filled);
    }
  }

  public addArc(ellipse: Arc3d, isEllipse: boolean, filled: boolean): void {
    let curve;
    let isLoop = false;
    if (isEllipse || filled) {
      curve = Loop.create(ellipse);
      isLoop = true;
    } else {
      curve = Path.create(ellipse);
    }

    if (filled && !isEllipse && !ellipse.sweep.isFullCircle()) {
      const gapSegment: CurvePrimitive = LineSegment3d.create(ellipse.startPoint(), ellipse.endPoint());
      (gapSegment as any).markerBits = 0x00010000; // Set the CURVE_PRIMITIVE_BIT_GapCurve marker bit
      curve.children.push(gapSegment);
    }
    const displayParams = curve.isAnyRegionType() ? this.getMeshDisplayParams() : this.getLinearDisplayParams();
    if (isLoop)
      this.accum.addLoop(curve, displayParams, this.localToWorldTransform, false);
    else
      this.accum.addPath(curve, displayParams, this.localToWorldTransform, false);
  }

  /** take ownership of input points and add as a line string to this builder */
  public addLineString(points: Point3d[]): void {
    if (2 === points.length && points[0].isAlmostEqual(points[1]))
      this.accum.addPointString(points, this.getLinearDisplayParams(), this.localToWorldTransform);
    else
      this.accum.addLineString(points, this.getLinearDisplayParams(), this.localToWorldTransform);
  }

  public addLineString2d(points: Point2d[], zDepth: number): void {
    const pts3d = copy2dTo3d(points, zDepth);
    this.addLineString(pts3d);
  }

  /** take ownership of input points and add as a point string to this builder */
  public addPointString(points: Point3d[]): void {
    this.accum.addPointString(points, this.getLinearDisplayParams(), this.localToWorldTransform);
  }

  public addPointString2d(points: Point2d[], zDepth: number): void {
    const pts3d = copy2dTo3d(points, zDepth);
    this.addPointString(pts3d);
  }

  public addShape(points: Point3d[]): void {
    const loop = Loop.create(LineString3d.create(points));
    this.accum.addLoop(loop, this.getMeshDisplayParams(), this.localToWorldTransform, false);
  }

  public addShape2d(points: Point2d[], zDepth: number): void {
    const pts3d = copy2dTo3d(points, zDepth);
    this.addShape(pts3d);
  }

  public addPath(path: Path): void {
    this.accum.addPath(path, this.getLinearDisplayParams(), this.localToWorldTransform, false);
  }

  public addLoop(loop: Loop): void {
    this.accum.addLoop(loop, this.getMeshDisplayParams(), this.localToWorldTransform, false);
  }

  public addPolyface(meshData: Polyface): void {
    this.accum.addPolyface(meshData as IndexedPolyface, this.getMeshDisplayParams(), this.localToWorldTransform);
  }

  public abstract reset(): void;

  public getGraphicParams(): GraphicParams { return this.graphicParams; }

  public getDisplayParams(type: DisplayParams.Type): DisplayParams { return DisplayParams.createForType(type, this.graphicParams); }
  public getMeshDisplayParams(): DisplayParams { return DisplayParams.createForMesh(this.graphicParams, (grad) => this.resolveGradient(grad)); }
  public getLinearDisplayParams(): DisplayParams { return DisplayParams.createForLinear(this.graphicParams); }
  public get textDisplayParams(): DisplayParams { return DisplayParams.createForText(this.graphicParams); }

  public get system(): RenderSystem { return this.accum.system; }

  public add(geom: Geometry): void { this.accum.addGeometry(geom); }

  public reInitialize(localToWorld: Transform, accumTf: Transform = Transform.createIdentity()) {
    this.accum.reset(accumTf);
    this.activateGraphicParams(this.graphicParams);
    this.createParams.placement = localToWorld;
    this.reset();
  }

  private resolveGradient(gradient: Gradient.Symb): RenderTexture | undefined {
    return this.system.getGradientTexture(gradient, this.iModel);
  }
}

export class PrimitiveBuilder extends GeometryListBuilder {
  public primitives: RenderGraphic[] = [];
  public params: GraphicBuilderCreateParams;
  constructor(system: RenderSystem, params: GraphicBuilderCreateParams) {
    super(system, params);
    this.params = params;
  }

  public finishGraphic(accum: GeometryAccumulator): RenderGraphic {
    if (!accum.isEmpty) {
      // Overlay decorations don't test Z. Tools like to layer multiple primitives on top of one another; they rely on the primitives rendering
      // in that same order to produce correct results (e.g., a thin line rendered atop a thick line of another color).
      // No point generating edges for graphics that are always rendered in smooth shade mode.
      const options = GeometryOptions.createForGraphicBuilder(this.params);
      // const context = PrimitiveBuilderContext.fromPrimitiveBuilder(this);
      const tolerance = this.computeTolerance(accum);
      accum.saveToGraphicList(this.primitives, options, tolerance);
    }
    return (this.primitives.length !== 1) ? this.accum.system.createGraphicList(this.primitives) : this.primitives.pop() as RenderGraphic;
  }

  public computeTolerance(accum: GeometryAccumulator): number {
    const toleranceMult = 0.25;
    if (this.params.isViewCoordinates) return toleranceMult;
    if (!this.params.viewport) return 20;
    const range = accum.geometries!.computeRange(); // NB: Already multiplied by transform...
    // NB: Geometry::CreateFacetOptions() will apply any scale factors from transform...no need to do it here.
    const pt = range.low.interpolate(0.5, range.high);
    return this.params.viewport!.getPixelSizeAtPoint(pt) * toleranceMult;
  }

  public reset(): void { this.primitives = []; }
}

export class PrimitiveBuilderContext extends ViewContext {
  constructor(public viewport: Viewport, public imodel: IModelConnection, public system: RenderSystem) { super(viewport); }
  public static fromPrimitiveBuilder(builder: PrimitiveBuilder): PrimitiveBuilderContext { return new PrimitiveBuilderContext(builder.viewport, builder.iModel, builder.system); }
}
