/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
/** @packageDocumentation
 * @module Rendering
 */

import { IndexedPolyface, Loop, Path, Point3d, Range3d, SolidPrimitive, Transform } from "@itwin/core-geometry";
import { AnalysisStyleDisplacement, Feature } from "@itwin/core-common";
import { DisplayParams } from "./DisplayParams";
import { MeshBuilderMap } from "./MeshBuilderMap";
import { MeshList } from "./MeshPrimitives";
import { GeometryOptions } from "./Primitives";
import { GeometryList } from "./GeometryList";
import { Geometry, PrimitiveGeometryType } from "./GeometryPrimitives";

/** @internal */
export class GeometryAccumulator {
  private _transform: Transform;
  private _surfacesOnly: boolean;
  private readonly _analysisDisplacement?: AnalysisStyleDisplacement;

  public readonly tileRange: Range3d;
  public readonly geometries: GeometryList = new GeometryList();
  public currentFeature?: Feature;

  public get surfacesOnly(): boolean { return this._surfacesOnly; }
  public get transform(): Transform { return this._transform; }
  public get isEmpty(): boolean { return this.geometries.isEmpty; }
  public get haveTransform(): boolean { return !this._transform.isIdentity; }

  public constructor(options?: {
    surfacesOnly?: boolean;
    transform?: Transform;
    tileRange?: Range3d;
    analysisStyleDisplacement?: AnalysisStyleDisplacement;
    feature?: Feature;
  }) {
    this.tileRange = options?.tileRange ?? Range3d.createNull();
    this._surfacesOnly = true === options?.surfacesOnly;
    this._transform = options?.transform ?? Transform.createIdentity();
    this._analysisDisplacement = options?.analysisStyleDisplacement;
    this.currentFeature = options?.feature;
  }

  private getPrimitiveRange(geom: PrimitiveGeometryType): Range3d | undefined {
    const range = new Range3d();
    geom.range(undefined, range);
    return range.isNull ? undefined : range;
  }

  private calculateTransform(transform: Transform, range: Range3d): Transform {
    if (this.haveTransform)
      transform = this._transform.multiplyTransformTransform(transform);

    transform.multiplyRange(range, range);
    return transform;
  }

  public addLoop(loop: Loop, displayParams: DisplayParams, transform: Transform, disjoint: boolean): boolean {
    const range = this.getPrimitiveRange(loop);
    if (!range)
      return false;

    const xform = this.calculateTransform(transform, range);
    return this.addGeometry(Geometry.createFromLoop(loop, xform, range, displayParams, disjoint, this.currentFeature));
  }

  public addLineString(pts: Point3d[], displayParams: DisplayParams, transform: Transform): boolean {
    // Do this.getPrimitiveRange() manually, so there is no need to create a PointString3d object just to find the range
    const range = Range3d.createNull();
    range.extendArray(pts, undefined);
    if (range.isNull)
      return false;

    const xform = this.calculateTransform(transform, range);
    return this.addGeometry(Geometry.createFromLineString(pts, xform, range, displayParams, this.currentFeature));
  }

  public addPointString(pts: Point3d[], displayParams: DisplayParams, transform: Transform): boolean {
    // Do this.getPrimitiveRange() manually, so there is no need to create a PointString3d object just to find the range
    const range = Range3d.createNull();
    range.extendArray(pts, undefined);
    if (range.isNull)
      return false;

    const xform = this.calculateTransform(transform, range);
    return this.addGeometry(Geometry.createFromPointString(pts, xform, range, displayParams, this.currentFeature));
  }

  public addPath(path: Path, displayParams: DisplayParams, transform: Transform, disjoint: boolean): boolean {
    const range = this.getPrimitiveRange(path);
    if (!range)
      return false;

    const xform = this.calculateTransform(transform, range);
    return this.addGeometry(Geometry.createFromPath(path, xform, range, displayParams, disjoint, this.currentFeature));
  }

  public addPolyface(pf: IndexedPolyface, displayParams: DisplayParams, transform: Transform): boolean {
    // Adjust the mesh range based on displacements applied to vertices by analysis style, if applicable.
    let range;
    if (this._analysisDisplacement) {
      const channel = pf.data.auxData?.channels.find((x) => x.name === this._analysisDisplacement!.channelName);
      const displacementRange = channel?.computeDisplacementRange(this._analysisDisplacement.scale);
      if (displacementRange && !displacementRange.isNull) {
        range = Range3d.createNull();
        const pt = new Point3d();
        for (let i = 0; i < pf.data.point.length; i++) {
          pf.data.point.getPoint3dAtUncheckedPointIndex(i, pt);
          range.extendXYZ(pt.x + displacementRange.low.x, pt.y + displacementRange.low.y, pt.z + displacementRange.low.z);
          range.extendXYZ(pt.x + displacementRange.high.x, pt.y + displacementRange.high.y, pt.z + displacementRange.high.z);
        }
      }
    }

    if (!range && !(range = this.getPrimitiveRange(pf)))
      return false;

    const xform = this.calculateTransform(transform, range);
    return this.addGeometry(Geometry.createFromPolyface(pf, xform, range, displayParams, this.currentFeature));
  }

  public addSolidPrimitive(primitive: SolidPrimitive, displayParams: DisplayParams, transform: Transform): boolean {
    const range = this.getPrimitiveRange(primitive);
    if (!range)
      return false;

    const xform = this.calculateTransform(transform, range);
    return this.addGeometry(Geometry.createFromSolidPrimitive(primitive, xform, range, displayParams, this.currentFeature));
  }

  public addGeometry(geom: Geometry): boolean {
    this.geometries.push(geom);
    return true;
  }

  public clear(): void { this.geometries.clear(); }

  /**
   * Generates a MeshBuilderMap
   * native: GeometryAccumulator::ToMeshBuilderMap(GeometryOptionsCR options, double tolerance, FeatureTableP featureTable, ViewContextR context) const
   * note  : removed featureTable, ViewContext
   * @param tolerance should derive from Viewport.getPixelSizeAtPoint
   */
  public toMeshBuilderMap(options: GeometryOptions, tolerance: number, pickable: { isVolumeClassifier?: boolean, modelId?: string } | undefined): MeshBuilderMap {
    const { geometries } = this; // declare internal dependencies

    const range = geometries.computeRange();
    const is2d = !range.isNull && range.isAlmostZeroZ;

    return MeshBuilderMap.createFromGeometries(geometries, tolerance, range, is2d, options, pickable);
  }

  public toMeshes(options: GeometryOptions, tolerance: number, pickable: { isVolumeClassifier?: boolean, modelId?: string } | undefined): MeshList {
    if (this.geometries.isEmpty)
      return new MeshList();

    const builderMap = this.toMeshBuilderMap(options, tolerance, pickable);
    return builderMap.toMeshes();
  }
}
