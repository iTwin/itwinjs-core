/*---------------------------------------------------------------------------------------------
|  $Copyright: (c) 2018 Bentley Systems, Incorporated. All rights reserved. $
 *--------------------------------------------------------------------------------------------*/
/** @module Rendering */

import { Transform, Range3d, Loop, Path, IndexedPolyface, Point3d } from "@bentley/geometry-core";
import { IModelConnection } from "../../../IModelConnection";
import { GeometryOptions } from "../Primitives";
import { RenderSystem, RenderGraphic, GraphicBranch } from "../../System";
import { DisplayParams } from "../DisplayParams";
import { MeshGraphicArgs, MeshList } from "../mesh/MeshPrimitives";
import { MeshBuilderMap } from "../mesh/MeshBuilderMap";
import { Geometry, PrimitiveGeometryType } from "./GeometryPrimitives";
import { GeometryList } from "./GeometryList";
import { Id64, assert } from "@bentley/bentleyjs-core";
import { FeatureTable } from "@bentley/imodeljs-common";

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
    if (this.haveTransform) this._transform.multiplyTransformTransform(transform, transform);
    transform.multiplyRange(range, range);
  }

  public addLoop(loop: Loop, displayParams: DisplayParams, transform: Transform, disjoint: boolean): boolean {
    const range: Range3d | undefined = this.getPrimitiveRange(loop);
    if (!range)
      return false;

    this.calculateTransform(transform, range);
    return this.addGeometry(Geometry.createFromLoop(loop, transform, range, displayParams, disjoint));
  }

  public addLineString(pts: Point3d[], displayParams: DisplayParams, transform: Transform): boolean {
    // Do this.getPrimitiveRange() manually, so there is no need to create a PointString3d object just to find the range
    const range = Range3d.createNull();
    range.extendArray(pts, undefined);
    if (range.isNull())
      return false;

    this.calculateTransform(transform, range);
    return this.addGeometry(Geometry.createFromLineString(pts, transform, range, displayParams));
  }

  public addPointString(pts: Point3d[], displayParams: DisplayParams, transform: Transform): boolean {
    // Do this.getPrimitiveRange() manually, so there is no need to create a PointString3d object just to find the range
    const range = Range3d.createNull();
    range.extendArray(pts, undefined);
    if (range.isNull())
      return false;

    this.calculateTransform(transform, range);
    return this.addGeometry(Geometry.createFromPointString(pts, transform, range, displayParams));
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
    if (undefined === range)
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
  public toMeshBuilderMap(options: GeometryOptions, tolerance: number, pickableId?: Id64): MeshBuilderMap {
    const { geometries } = this; // declare internal dependencies
    const { wantSurfacesOnly, wantPreserveOrder } = options;

    const range = geometries.computeRange();
    const is2d = !range.isNull() && range.isAlmostZeroZ();

    return MeshBuilderMap.createFromGeometries(geometries, tolerance, range, is2d, wantSurfacesOnly, wantPreserveOrder, pickableId);
  }

  public toMeshes(options: GeometryOptions, tolerance: number, pickableId?: Id64): MeshList {
    if (this.geometries.isEmpty)
      return new MeshList();

    const builderMap = this.toMeshBuilderMap(options, tolerance, pickableId);
    return builderMap.toMeshes();
  }

  /**
   * Populate a list of Graphic objects from the accumulated Geometry objects.
   * removed ViewContext
   */
  public saveToGraphicList(graphics: RenderGraphic[], options: GeometryOptions, tolerance: number, pickableId?: Id64): FeatureTable | undefined {
    const meshes = this.toMeshes(options, tolerance, pickableId);
    if (0 === meshes.length)
      return undefined;

    const args = new MeshGraphicArgs();

    // All of the meshes are quantized to the same range.
    // If that range is small relative to the distance from the origin, quantization errors can produce display artifacts.
    // Remove the translation from the quantization parameters and apply it in the transform instead.
    const branch = new GraphicBranch(true);
    const qorigin = new Point3d();

    for (const mesh of meshes) {
      const verts = mesh.points;
      if (branch.isEmpty) {
        qorigin.setFrom(verts.params.origin);
      } else {
        assert(verts.params.origin.isAlmostEqual(qorigin));
      }

      verts.params.origin.setZero();

      const graphic = mesh.getGraphics(args, this.system);
      if (undefined !== graphic)
        branch.add(graphic);
    }

    if (!branch.isEmpty) {
      const transform = Transform.createTranslationXYZ(qorigin.x, qorigin.y, qorigin.z);
      graphics.push(this.system.createBranch(branch, transform));
    }

    return meshes.features;
  }
}
