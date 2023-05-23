/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
/** @packageDocumentation
 * @module Rendering
 */

import { assert } from "@itwin/core-bentley";
import { IndexedPolyface, Loop, Path, Point3d, Range3d, SolidPrimitive, Transform } from "@itwin/core-geometry";
import { AnalysisStyleDisplacement, Feature, QPoint3dList } from "@itwin/core-common";
import { GraphicBranch } from "../../GraphicBranch";
import { RenderGraphic } from "../../RenderGraphic";
import { RenderSystem } from "../../RenderSystem";
import { DisplayParams } from "../../../common/render/primitives/DisplayParams";
import { MeshBuilderMap } from "../mesh/MeshBuilderMap";
import { MeshList } from "../mesh/MeshPrimitives";
import { GeometryOptions } from "../Primitives";
import { GeometryList } from "./GeometryList";
import { Geometry, PrimitiveGeometryType } from "./GeometryPrimitives";
import { IModelApp } from "../../../IModelApp";

/** @internal */
export class GeometryAccumulator {
  private _transform: Transform;
  private _surfacesOnly: boolean;
  private readonly _analysisDisplacement?: AnalysisStyleDisplacement;
  private readonly _viewIndependentOrigin?: Point3d;

  public readonly tileRange: Range3d;
  public readonly geometries: GeometryList = new GeometryList();
  public readonly system: RenderSystem;
  public currentFeature?: Feature;

  public get surfacesOnly(): boolean { return this._surfacesOnly; }
  public get transform(): Transform { return this._transform; }
  public get isEmpty(): boolean { return this.geometries.isEmpty; }
  public get haveTransform(): boolean { return !this._transform.isIdentity; }

  public constructor(options?: {
    system?: RenderSystem;
    surfacesOnly?: boolean;
    transform?: Transform;
    tileRange?: Range3d;
    analysisStyleDisplacement?: AnalysisStyleDisplacement;
    viewIndependentOrigin?: Point3d;
    feature?: Feature;
  }) {
    this.system = options?.system ?? IModelApp.renderSystem;
    this.tileRange = options?.tileRange ?? Range3d.createNull();
    this._surfacesOnly = true === options?.surfacesOnly;
    this._transform = options?.transform ?? Transform.createIdentity();
    this._analysisDisplacement = options?.analysisStyleDisplacement;
    this._viewIndependentOrigin = options?.viewIndependentOrigin;
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
  public toMeshBuilderMap(options: GeometryOptions, tolerance: number, pickable: { modelId?: string } | undefined): MeshBuilderMap {
    const { geometries } = this; // declare internal dependencies

    const range = geometries.computeRange();
    const is2d = !range.isNull && range.isAlmostZeroZ;

    return MeshBuilderMap.createFromGeometries(geometries, tolerance, range, is2d, options, pickable);
  }

  public toMeshes(options: GeometryOptions, tolerance: number, pickable: { modelId?: string } | undefined): MeshList {
    if (this.geometries.isEmpty)
      return new MeshList();

    const builderMap = this.toMeshBuilderMap(options, tolerance, pickable);
    return builderMap.toMeshes();
  }

  /**
   * Populate a list of Graphic objects from the accumulated Geometry objects.
   * removed ViewContext
   */
  public saveToGraphicList(graphics: RenderGraphic[], options: GeometryOptions, tolerance: number, pickable: { modelId?: string } | undefined): MeshList | undefined {
    const meshes = this.toMeshes(options, tolerance, pickable);
    if (0 === meshes.length)
      return undefined;

    // If the meshes contain quantized positions, they are all quantized to the same range. If that range is small relative to the distance
    // from the origin, quantization errors can produce display artifacts. Remove the translation from the quantization parameters and apply
    // it in the transform instead.
    //
    // If the positions are not quantized, they have already been transformed to be relative to the center of the meshes' range.
    // Apply the inverse translation to put them back into model space.
    const branch = new GraphicBranch(true);
    let transformOrigin: Point3d | undefined;
    let meshesRangeOffset = false;

    for (const mesh of meshes) {
      const verts = mesh.points;
      if (branch.isEmpty) {
        if (verts instanceof QPoint3dList) {
          transformOrigin = verts.params.origin.clone();
          verts.params.origin.setZero();
        } else {
          transformOrigin = verts.range.center;
          // In this case we need to modify the qOrigin of the graphic that will get created later since we have translated the origin.
          // We can't modify it directly, but if we temporarily modify the range of the mesh used to create it the qOrigin will get created properly.
          // Range is shared (not cloned) by all meshes and the mesh list itself, so modifying the range of the meshlist will modify it for all meshes.
          // We will then later add this offset back to the range once all of the graphics have been created because it is needed unmodified for locate.
          if (!meshesRangeOffset) {
            meshes.range?.low.subtractInPlace(transformOrigin);
            meshes.range?.high.subtractInPlace(transformOrigin);
            meshesRangeOffset = true;
          }
        }
      } else {
        assert(undefined !== transformOrigin);
        if (verts instanceof QPoint3dList) {
          assert(transformOrigin.isAlmostEqual(verts.params.origin));
          verts.params.origin.setZero();
        } else {
          assert(verts.range.center.isAlmostZero);
        }
      }

      const graphic = mesh.getGraphics(this.system, this._viewIndependentOrigin);
      if (undefined !== graphic)
        branch.add(graphic);
    }

    if (!branch.isEmpty) {
      assert(undefined !== transformOrigin);
      const transform = Transform.createTranslation(transformOrigin);
      graphics.push(this.system.createBranch(branch, transform));
      if (meshesRangeOffset) { // restore the meshes range that we modified earlier.
        meshes.range?.low.addInPlace(transformOrigin);
        meshes.range?.high.addInPlace(transformOrigin);
      }
    }

    return meshes;
  }
}
