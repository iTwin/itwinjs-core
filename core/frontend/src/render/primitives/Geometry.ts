/*---------------------------------------------------------------------------------------------
|  $Copyright: (c) 2018 Bentley Systems, Incorporated. All rights reserved. $
 *--------------------------------------------------------------------------------------------*/
import { assert, Iterable } from "@bentley/bentleyjs-core";
import {
  Transform,
  Range3d,
  Arc3d,
  LineSegment3d,
  LineString3d,
  CurvePrimitive,
  Loop,
  Path,
  Point2d,
  Point3d,
  Polyface,
  StrokeOptions,
  Angle,
  IndexedPolyface,
  PolyfaceBuilder,
  SweepContour,
} from "@bentley/geometry-core";
import {
  GraphicParams,
  QParams3d,
} from "@bentley/imodeljs-common";
import { IModelConnection } from "../../IModelConnection";
import { GraphicBuilder, GraphicBuilderCreateParams } from "../GraphicBuilder";
import { ViewContext } from "../../ViewContext";
import { Viewport } from "../../Viewport";
import { GeometryOptions } from "./Primitives";
import { RenderSystem, RenderGraphic } from "../System";
import { DisplayParams } from "./DisplayParams";
import { StrokesPrimitive, StrokesPrimitiveList, StrokesPrimitivePointList, StrokesPrimitivePointLists } from "./Strokes";
import { PolyfacePrimitive, PolyfacePrimitiveList } from "./Polyface";
import { MeshGraphicArgs, MeshList, MeshBuilderMap, Mesh, MeshBuilder } from "./Mesh";

export type PrimitiveGeometryType = Loop | Path | IndexedPolyface;

export abstract class Geometry {
  public readonly transform: Transform;
  public readonly tileRange: Range3d;
  public readonly displayParams: DisplayParams;

  public constructor(transform: Transform, tileRange: Range3d, displayParams: DisplayParams) {
    this.transform = transform;
    this.tileRange = tileRange;
    this.displayParams = displayParams;
  }

  public static createFromLoop(loop: Loop, tf: Transform, tileRange: Range3d, params: DisplayParams, disjoint: boolean): Geometry {
    return new PrimitiveLoopGeometry(loop, tf, tileRange, params, disjoint);
  }

  public static createFromPath(path: Path, tf: Transform, tileRange: Range3d, params: DisplayParams, disjoint: boolean): Geometry {
    return new PrimitivePathGeometry(path, tf, tileRange, params, disjoint);
  }

  public static createFromPolyface(ipf: IndexedPolyface, tf: Transform, tileRange: Range3d, params: DisplayParams): Geometry {
    return new PrimitivePolyfaceGeometry(ipf, tf, tileRange, params);
  }

  protected abstract _getPolyfaces(facetOptions: StrokeOptions): PolyfacePrimitiveList | undefined;
  protected abstract _getStrokes(facetOptions: StrokeOptions): StrokesPrimitiveList | undefined;

  public getPolyfaces(facetOptions: StrokeOptions): PolyfacePrimitiveList | undefined {
    return this._getPolyfaces(facetOptions);
  }

  public getStrokes(facetOptions: StrokeOptions): StrokesPrimitiveList | undefined {
    return this._getStrokes(facetOptions);
  }

  public get hasTexture() { return this.displayParams.isTextured; }
  public doDecimate() { return false; }
  public doVertexCluster() { return true; }
  public part() { return undefined; }

  public static createFacetOptions(chordTolerance: number): StrokeOptions {
    const strkOpts: StrokeOptions = StrokeOptions.createForFacets();
    strkOpts.chordTol = chordTolerance;
    strkOpts.angleTol = Angle.createRadians(Angle.piOver2Radians);
    // ###TODO: strkOpts.convexFacetsRequired = true; // not available yet
    strkOpts.needParams = true;
    strkOpts.needNormals = true;

    return strkOpts;
  }
}

export class PrimitivePathGeometry extends Geometry {
  public readonly path: Path;
  public readonly isDisjoint: boolean;

  public constructor(path: Path, tf: Transform, range: Range3d, params: DisplayParams, isDisjoint: boolean) {
    super(tf, range, params);
    this.path = path;
    this.isDisjoint = isDisjoint;
  }

  protected _getPolyfaces(_facetOptions: StrokeOptions): PolyfacePrimitiveList | undefined { return undefined; }

  protected _getStrokes(facetOptions: StrokeOptions): StrokesPrimitiveList | undefined {
    return PrimitivePathGeometry.getStrokesForLoopOrPath(this.path, facetOptions, this.displayParams, this.isDisjoint, this.transform);
  }

  public static getStrokesForLoopOrPath(loopOrPath: Loop | Path, facetOptions: StrokeOptions, params: DisplayParams, isDisjoint: boolean, transform: Transform): StrokesPrimitiveList | undefined {
    const strksList = new StrokesPrimitiveList();

    if (!loopOrPath.isAnyRegionType() || params.wantRegionOutline) {
      const strksPts: StrokesPrimitivePointLists = new StrokesPrimitivePointLists();
      PrimitivePathGeometry.collectCurveStrokes(strksPts, loopOrPath, facetOptions, transform);

      if (strksPts.length > 0) {
        const isPlanar = loopOrPath.isAnyRegionType();
        assert(isPlanar === params.wantRegionOutline);
        const strksPrim: StrokesPrimitive = StrokesPrimitive.create(params, isDisjoint, isPlanar);
        strksPrim.strokes = strksPts;
        strksList.push(strksPrim);
      }
    }

    return strksList;
  }

  private static collectCurveStrokes(strksPts: StrokesPrimitivePointLists, loopOrPath: Loop | Path, facetOptions: StrokeOptions, trans: Transform) {
    const strokes: LineString3d = loopOrPath.cloneStroked(facetOptions) as LineString3d;
    assert(strokes instanceof LineString3d);
    const pt: Point3d = Point3d.create(0, 0, 0);
    const pts: Point3d[] = [];
    for (let i = 0; i < strokes.numPoints(); i++) {
      strokes.pointAt(i, pt);
      pts.push(trans.multiplyPoint(pt));
    }
    strksPts.push(new StrokesPrimitivePointList(0, pts));
  }
}

export class PrimitiveLoopGeometry extends Geometry {
  public readonly loop: Loop;
  public readonly isDisjoint: boolean;

  public constructor(loop: Loop, tf: Transform, range: Range3d, params: DisplayParams, isDisjoint: boolean) {
    super(tf, range, params);
    this.loop = loop;
    this.isDisjoint = isDisjoint;
  }

  protected _getPolyfaces(facetOptions: StrokeOptions): PolyfacePrimitiveList | undefined {
    if (!this.loop.isAnyRegionType()) {
      return undefined;
    }

    // The following is good for single loop things according to Earlin.
    const contour = SweepContour.createForLinearSweep(this.loop);
    if (contour !== undefined) {
      const pfBuilder: PolyfaceBuilder = PolyfaceBuilder.create(facetOptions);
      contour.emitFacets(pfBuilder, facetOptions, false); // build facets and emit them to the builder
      const polyface = pfBuilder.claimPolyface();

      const wantEdges = DisplayParams.RegionEdgeType.Default === this.displayParams.regionEdgeType;
      const isPlanar = true;
      return new PolyfacePrimitiveList(PolyfacePrimitive.create(this.displayParams, polyface, wantEdges, isPlanar));
    } // ###TODO: this approach might not work with holes

    return undefined;
  }

  protected _getStrokes(facetOptions: StrokeOptions): StrokesPrimitiveList | undefined {
    return PrimitivePathGeometry.getStrokesForLoopOrPath(this.loop, facetOptions, this.displayParams, this.isDisjoint, this.transform);
  }
}

export class PrimitivePolyfaceGeometry extends Geometry {
  public readonly polyface: IndexedPolyface;

  public constructor(polyface: IndexedPolyface, tf: Transform, range: Range3d, params: DisplayParams) {
    super(tf, range, params);
    this.polyface = polyface;
  }

  protected _getPolyfaces(_facetOptions: StrokeOptions): PolyfacePrimitiveList | undefined {
    if (this.hasTexture) { // clear parameters
      if (this.polyface.data.param) {
        this.polyface.data.param = [];
      }
      if (this.polyface.data.paramIndex) {
        this.polyface.data.paramIndex = [];
      }
    }

    assert(this.transform.isIdentity());
    return new PolyfacePrimitiveList(PolyfacePrimitive.create(this.displayParams, this.polyface));
  }

  protected _getStrokes(_facetOptions: StrokeOptions): StrokesPrimitiveList | undefined { return undefined; }
}

export class GeometryList extends Iterable<Geometry> {
  constructor() { super(); }
  public get isEmpty(): boolean { return this._list.length === 0; }
  public push(geom: Geometry): number {
    return this._list.push(geom);
  }
  public append(src: GeometryList): GeometryList {
    this._list.push(...src._list);
    return this;
  }
  public clear(): void { this._list.length = 0; }
  public computeRange(): Range3d {
    const range: Range3d = Range3d.createNull();
    const extendRange = (geom: Geometry) => range.extendRange(geom.tileRange);
    this._list.forEach(extendRange);
    return range;
  }
  public computeQuantizationParams(): QParams3d { return QParams3d.fromRange(this.computeRange()); }
}

export class GeometryAccumulator {
  private _transform: Transform;
  private _surfacesOnly: boolean;

  public readonly tileRange: Range3d;
  public readonly geometries: GeometryList = new GeometryList();
  public readonly checkGlyphBoxes: boolean = false; // #TODO: obviously update when checkGlyphBoxes needs to be mutuable
  public readonly iModel: IModelConnection;
  public readonly system: RenderSystem;

  public get surfacesOnly(): boolean { return this._surfacesOnly; }
  public get transform(): Transform { return this._transform; }
  public get isEmpty(): boolean { return this.geometries.isEmpty; }
  public get haveTransform(): boolean { return !this._transform.isIdentity(); }

  public constructor(iModel: IModelConnection, system: RenderSystem, surfacesOnly: boolean = false, transform: Transform = Transform.createIdentity(), tileRange: Range3d = Range3d.createNull()) {
    this._surfacesOnly = surfacesOnly;
    this._transform = transform;
    this.iModel = iModel;
    this.system = system;
    this.tileRange = tileRange;
  }

  private getPrimitiveRange(pGeom: PrimitiveGeometryType): Range3d | undefined {
    const pRange: Range3d = new Range3d();
    pGeom.range(undefined, pRange);
    if (pRange.isNull())
      return undefined;
    return pRange;
  }

  private calculateTransform(transform: Transform, range: Range3d): void {
    const { _transform, haveTransform } = this;

    if (haveTransform) _transform.multiplyTransformTransform(transform, transform);
    transform.multiplyRange(range, range);
  }

  public addLoop(loop: Loop, displayParams: DisplayParams, transform: Transform, disjoint: boolean): boolean {
    const range: Range3d | undefined = this.getPrimitiveRange(loop);
    if (!range)
      return false;

    this.calculateTransform(transform, range);
    return this.addGeometry(Geometry.createFromLoop(loop, transform, range, displayParams, disjoint));
  }

  public addPath(path: Path, displayParams: DisplayParams, transform: Transform, disjoint: boolean): boolean {
    const range: Range3d | undefined = this.getPrimitiveRange(path);
    if (!range)
      return false;

    this.calculateTransform(transform, range);
    return this.addGeometry(Geometry.createFromPath(path, transform, range, displayParams, disjoint));
  }

  public addPolyface(ipf: IndexedPolyface, displayParams: DisplayParams, transform: Transform): boolean {
    const range: Range3d | undefined = this.getPrimitiveRange(ipf);
    if (!range)
      return false;

    this.calculateTransform(transform, range);
    return this.addGeometry(Geometry.createFromPolyface(ipf, transform, range, displayParams));
  }
  public addGeometry(geom: Geometry): boolean { this.geometries.push(geom); return true; }
  public clear() { this.geometries.clear(); }

  public reset(transform: Transform = Transform.createIdentity(), surfacesOnly: boolean = false) {
    this.clear();
    this._transform = transform;
    this._surfacesOnly = surfacesOnly;
  }

  /** removed featureTable, ViewContext */
  public toMeshBuilderMap(options: GeometryOptions, tolerance: number): MeshBuilderMap {
    const { geometries } = this;
    const range = geometries.computeRange();
    const is2d = !range.isNull() && range.isAlmostZeroZ();
    const builderMap = new MeshBuilderMap(tolerance, range, is2d);
    const areaTolerance = builderMap.facetAreaTolerance;
    let displayParams, key, type, isPlanar, builder, fillColor;

    if (geometries.isEmpty)
      return builderMap;

    // This ensures the builder map is organized in the same order as the geometry list, and no meshes are merged.
    // This is required to make overlay decorations render correctly.
    let order = 0;
    for (const geom of geometries) {
      // ###TODO verify this is equivalent to: geom->GetPolyfaces(tolerance, options.m_normalMode, context);
      const polyfaces = geom.getPolyfaces(StrokeOptions.createForFacets());

      if (polyfaces === undefined || polyfaces.length === 0)
        continue;

      for (const tilePolyface of polyfaces) {
        const polyface = tilePolyface.indexedPolyface;

        if (polyface.pointCount === 0) // (polyface.IsNull() || 0 == polyface->GetPointCount())
          continue;

        displayParams = tilePolyface.displayParams;
        const hasTexture = displayParams.isTextured;
        type = Mesh.PrimitiveType.Mesh;
        isPlanar = tilePolyface.isPlanar;
        key = new MeshBuilderMap.Key(displayParams, type, polyface.normalCount > 0, isPlanar);

        if (options.wantPreserveOrder)
          key.order = order++;

        builder = builderMap.get(key);
        if (undefined === builder) {
          builder = MeshBuilder.create({ displayParams, type, range, is2d, isPlanar, tolerance, areaTolerance });
          builderMap.set(key, builder);
        }

        // ###TODO ignore edges for now
        // const edgeOptions = (options.wantEdges && tilePolyface.displayEdges) ? MeshEdgeCreationOptions.Type.DefaultEdges : MeshEdgeCreationOptions.Type.NoEdges;
        // meshBuilder.beginPolyface(polyface, edgeOptions);

        fillColor = displayParams.fillColor.tbgr;
        const visitor = polyface.createVisitor();

        do {
          const mappedTexture = displayParams.textureMapping;
          const requireNormals = undefined !== visitor.normal;
          builder.addFromPolyfaceVisitor({ visitor, mappedTexture, includeParams: hasTexture, fillColor, requireNormals });
        } while (visitor.moveToNextFacet());

        builder.endPolyface();
      }

      if (!options.wantSurfacesOnly) {
        const tileStrokesArray = geom.getStrokes(StrokeOptions.createForFacets());
        if (undefined !== tileStrokesArray) {
          for (const tileStrokes of tileStrokesArray) {
            displayParams = tileStrokes.displayParams;
            type = tileStrokes.isDisjoint ? Mesh.PrimitiveType.Point : Mesh.PrimitiveType.Polyline;
            isPlanar = tileStrokes.isPlanar;
            key = new MeshBuilderMap.Key(displayParams, type, false, isPlanar);

            if (options.wantPreserveOrder)
              key.order = order++;

            builder = builderMap.get(key);
            if (undefined === builder) {
              builder = MeshBuilder.create({ displayParams, type, range, is2d, isPlanar, tolerance, areaTolerance });
              builderMap.set(key, builder);
            }

            fillColor = displayParams.lineColor.tbgr;
            for (const strokePoints of tileStrokes.strokes) {
              if (tileStrokes.isDisjoint)
                builder.addPointString(strokePoints.points, fillColor, strokePoints.startDistance);
              else
                builder.addPolyline(strokePoints.points, fillColor, strokePoints.startDistance);
            }
          }
        }
      }
    }
    return builderMap;
  }

  /** removed ViewContext */
  public toMeshes(options: GeometryOptions, tolerance: number): MeshList {
    const meshes = new MeshList();
    if (this.geometries.isEmpty)
      return meshes;
    const builderMap = this.toMeshBuilderMap(options, tolerance);

    for (const builder of builderMap.extractPairs()) {
      const mesh = builder.value.mesh;
      if (mesh.points.length !== 0)
        meshes.push(mesh);
    }

    return meshes;
  }

  /**
   * Populate a list of Graphic objects from the accumulated Geometry objects.
   * removed ViewContext
   */
  public saveToGraphicList(graphics: RenderGraphic[], options: GeometryOptions, tolerance: number): void {
    const meshes = this.toMeshes(options, tolerance);
    const args = new MeshGraphicArgs();
    for (const mesh of meshes) {
      const graphic = mesh.getGraphics(args);
      if (undefined !== graphic)
        graphics.push(graphic);
    }

  }
}

export abstract class GeometryListBuilder extends GraphicBuilder {
  public accum: GeometryAccumulator;
  public graphicParams: GraphicParams = new GraphicParams();

  public abstract finishGraphic(accum: GeometryAccumulator): RenderGraphic; // Invoked by _Finish() to obtain the finished RenderGraphic.

  public constructor(system: RenderSystem, params: GraphicBuilderCreateParams, accumulatorTf: Transform = Transform.createIdentity()) {
    super(params);
    this.accum = new GeometryAccumulator(params.iModel, system, undefined, accumulatorTf);
  }

  public _finish(): RenderGraphic | undefined {
    if (!this.isOpen) {
      assert(false);
      return undefined;
    }
    const graphic = this.finishGraphic(this.accum);
    this._isOpen = false;
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
    this._isOpen = true;
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
