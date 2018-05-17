/*---------------------------------------------------------------------------------------------
|  $Copyright: (c) 2018 Bentley Systems, Incorporated. All rights reserved. $
 *--------------------------------------------------------------------------------------------*/
import { Transform, Arc3d, LineSegment3d, CurvePrimitive, Loop, Path, Point2d, Point3d, Polyface } from "@bentley/geometry-core";
import { GraphicParams } from "@bentley/imodeljs-common";
import { IModelConnection } from "../../../IModelConnection";
import { GraphicBuilder, GraphicBuilderCreateParams } from "../../GraphicBuilder";
import { ViewContext } from "../../../ViewContext";
import { Viewport } from "../../../Viewport";
import { GeometryOptions } from "../Primitives";
import { RenderSystem, RenderGraphic } from "../../System";
import { DisplayParams } from "../DisplayParams";
import { GeometryAccumulator } from "./GeometryAccumulator";
import { Geometry } from "./GeometryPrimitives";

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
    if (isLoop) // ###TODO: surely there is a better way to do this
      this.accum.addLoop(curve, displayParams, this.localToWorldTransform, false);
    else
      this.accum.addPath(curve, displayParams, this.localToWorldTransform, false);
  }

  public addLineString(_points: Point3d[]): void {
    // const curve = BagOfCurves.create(LineString3d.create(points));
    // ###TODO
  }

  public addLineString2d(points: Point2d[], zDepth: number): void {
    const pt3d: Point3d[] = [];
    points.forEach((element: Point2d) => {
      pt3d.push(Point3d.create(element.x, element.y, zDepth));
    });
    this.addLineString(pt3d);
  }

  public abstract reset(): void;

  public getGraphicParams(): GraphicParams { return this.graphicParams; }

  public getDisplayParams(type: DisplayParams.Type): DisplayParams { return DisplayParams.createForType(type, this.graphicParams); }
  public getMeshDisplayParams(): DisplayParams { return this.getDisplayParams(DisplayParams.Type.Mesh); }
  public getLinearDisplayParams(): DisplayParams { return this.getDisplayParams(DisplayParams.Type.Linear); }
  public get textDisplayParams(): DisplayParams { return this.getDisplayParams(DisplayParams.Type.Text); }

  public get system(): RenderSystem { return this.accum.system; }

  public add(geom: Geometry): void { this.accum.addGeometry(geom); }

  public reInitialize(localToWorld: Transform, accumTf: Transform = Transform.createIdentity()) {
    this.accum.reset(accumTf);
    this.activateGraphicParams(this.graphicParams);
    this.createParams.placement = localToWorld;
    this.reset();
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
    return (this.primitives.length !== 1) ? this.accum.system.createGraphicList(this.primitives, this.iModel) : this.primitives.pop() as RenderGraphic;
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

  public reset(): void { }
  public addPointString(_numPoints: number, _points: Point3d[]): void { } //tslint:disable-line
  public addPointString2d(_numPoints: number, _points: Point2d[], _zDepth: number): void { } //tslint:disable-line
  public addPolyface(_meshData: Polyface, _filled: boolean): void { } //tslint:disable-line
  public addShape(_numPoints: number, _points: Point3d[], _filled: boolean): void { } //tslint:disable-line
  public addShape2d(_numPoints: number, _points: Point2d[], _filled: boolean, _zDepth: number): void { } //tslint:disable-line
}

export class PrimitiveBuilderContext extends ViewContext {
  constructor(public viewport: Viewport, public imodel: IModelConnection, public system: RenderSystem) { super(viewport); }
  public static fromPrimitiveBuilder(builder: PrimitiveBuilder): PrimitiveBuilderContext { return new PrimitiveBuilderContext(builder.viewport, builder.iModel, builder.system); }
}
