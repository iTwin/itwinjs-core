/*---------------------------------------------------------------------------------------------
|  $Copyright: (c) 2018 Bentley Systems, Incorporated. All rights reserved. $
 *--------------------------------------------------------------------------------------------*/
import { Transform, Range3d, Loop, Path, IndexedPolyface } from "@bentley/geometry-core";
import { IModelConnection } from "../../../IModelConnection";
import { GeometryOptions } from "../Primitives";
import { RenderSystem, RenderGraphic } from "../../System";
import { DisplayParams } from "../DisplayParams";
import { MeshGraphicArgs, MeshList, MeshBuilderMap, Mesh, MeshBuilder } from "../Mesh";
import { Geometry, PrimitiveGeometryType } from "./GeometryPrimitives";
import { GeometryList } from "./GeometryList";

export class GeometryAccumulator {
  private _transform: Transform;
  private _surfacesOnly: boolean;

  public readonly tileRange: Range3d;
  public readonly geometries: GeometryList = new GeometryList();
  public readonly checkGlyphBoxes: boolean = false; // #TODO: obviously update when checkGlyphBoxes needs to be mutable
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
  public clear(): void { this.geometries.clear(); }

  public reset(transform: Transform = Transform.createIdentity(), surfacesOnly: boolean = false) {
    this.clear();
    this._transform = transform;
    this._surfacesOnly = surfacesOnly;
  }

  /**
   * Generates a MeshBuilderMap
   * native: GeometryAccumulator::ToMeshBuilderMap(GeometryOptionsCR options, double tolerance, FeatureTableP featureTable, ViewContextR context) const
   * note  : removed featureTable, ViewContext
   * @param tolerance should derive from Viewport.getPixelSizeAtPoint
   */
  public toMeshBuilderMap(options: GeometryOptions, tolerance: number): MeshBuilderMap {
    const { geometries } = this; // declare internal dependencies

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
      const polyfaces = geom.getPolyfaces(tolerance);

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
        const tileStrokesArray = geom.getStrokes(tolerance);
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
      const graphic = mesh.getGraphics(args, this.system, this.iModel);
      if (undefined !== graphic)
        graphics.push(graphic);
    }

  }
}
