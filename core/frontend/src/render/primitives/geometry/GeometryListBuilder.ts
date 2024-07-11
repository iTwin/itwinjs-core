/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
/** @packageDocumentation
 * @module Rendering
 */

import {
  Arc3d, CurvePrimitive, IndexedPolyface, LineSegment3d, LineString3d, Loop, Path, Point2d, Point3d, Polyface, Range3d, SolidPrimitive, Transform,
} from "@itwin/core-geometry";
import { Feature, FeatureTable, Gradient, GraphicParams, PackedFeatureTable, QPoint3dList, RenderTexture } from "@itwin/core-common";
import { CustomGraphicBuilderOptions, GraphicBuilder, ViewportGraphicBuilderOptions } from "../../GraphicBuilder";
import { RenderGraphic } from "../../RenderGraphic";
import { RenderSystem } from "../../RenderSystem";
import { DisplayParams } from "../../../common/render/primitives/DisplayParams";
import { GeometryOptions } from "../Primitives";
import { GeometryAccumulator } from "./GeometryAccumulator";
import { Geometry } from "./GeometryPrimitives";
import { MeshList } from "../mesh/MeshPrimitives";
import { GraphicBranch } from "../../GraphicBranch";
import { assert } from "@itwin/core-bentley";

function copy2dTo3d(pts2d: Point2d[], depth: number): Point3d[] {
  const pts3d: Point3d[] = [];
  for (const point of pts2d)
    pts3d.push(Point3d.create(point.x, point.y, depth));
  return pts3d;
}

/** @internal */
export abstract class GeometryListBuilder extends GraphicBuilder {
  public accum: GeometryAccumulator;
  public readonly system: RenderSystem;
  public readonly graphicParams: GraphicParams = new GraphicParams();

  public abstract finishGraphic(accum: GeometryAccumulator): RenderGraphic; // Invoked by Finish() to obtain the finished RenderGraphic.

  public constructor(system: RenderSystem, options: ViewportGraphicBuilderOptions | CustomGraphicBuilderOptions, accumulatorTransform = Transform.identity) {
    super(options);
    this.accum = new GeometryAccumulator({
      transform: accumulatorTransform,
      analysisStyleDisplacement: this.analysisStyle?.displacement,
      viewIndependentOrigin: options.viewIndependentOrigin,
    });

    this.system = system;
    if (this.pickable)
      this.activateFeature(new Feature(this.pickable.id, this.pickable.subCategoryId, this.pickable.geometryClass));
  }

  public finish(): RenderGraphic {
    const graphic = this.finishGraphic(this.accum);
    this.accum.clear();
    return graphic;
  }

  public activateGraphicParams(graphicParams: GraphicParams): void {
    graphicParams.clone(this.graphicParams);
  }

  protected override _activateFeature(feature: Feature): void {
    this.accum.currentFeature = feature;
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
    if (isEllipse || filled) {
      curve = Loop.create(ellipse);
    } else {
      curve = Path.create(ellipse);
    }

    if (filled && !isEllipse && !ellipse.sweep.isFullCircle) {
      const gapSegment: CurvePrimitive = LineSegment3d.create(ellipse.startPoint(), ellipse.endPoint());
      (gapSegment as any).markerBits = 0x00010000; // Set the CURVE_PRIMITIVE_BIT_GapCurve marker bit
      curve.children.push(gapSegment);
    }
    const displayParams = curve.isAnyRegionType ? this.getMeshDisplayParams() : this.getLinearDisplayParams();
    if (curve instanceof Loop)
      this.accum.addLoop(curve, displayParams, this.placement, false);
    else
      this.accum.addPath(curve, displayParams, this.placement, false);
  }

  /** take ownership of input points and add as a line string to this builder */
  public addLineString(points: Point3d[]): void {
    if (2 === points.length && points[0].isAlmostEqual(points[1]))
      this.accum.addPointString(points, this.getLinearDisplayParams(), this.placement);
    else
      this.accum.addLineString(points, this.getLinearDisplayParams(), this.placement);
  }

  public addLineString2d(points: Point2d[], zDepth: number): void {
    const pts3d = copy2dTo3d(points, zDepth);
    this.addLineString(pts3d);
  }

  /** take ownership of input points and add as a point string to this builder */
  public addPointString(points: Point3d[]): void {
    this.accum.addPointString(points, this.getLinearDisplayParams(), this.placement);
  }

  public addPointString2d(points: Point2d[], zDepth: number): void {
    const pts3d = copy2dTo3d(points, zDepth);
    this.addPointString(pts3d);
  }

  public addShape(points: Point3d[]): void {
    const loop = Loop.create(LineString3d.create(points));
    this.accum.addLoop(loop, this.getMeshDisplayParams(), this.placement, false);
  }

  public addShape2d(points: Point2d[], zDepth: number): void {
    const pts3d = copy2dTo3d(points, zDepth);
    this.addShape(pts3d);
  }

  public addPath(path: Path): void {
    this.accum.addPath(path, this.getLinearDisplayParams(), this.placement, false);
  }

  public addLoop(loop: Loop): void {
    this.accum.addLoop(loop, this.getMeshDisplayParams(), this.placement, false);
  }

  public addPolyface(meshData: Polyface): void {
    this.accum.addPolyface(meshData as IndexedPolyface, this.getMeshDisplayParams(), this.placement);
  }

  public addSolidPrimitive(primitive: SolidPrimitive): void {
    this.accum.addSolidPrimitive(primitive, this.getMeshDisplayParams(), this.placement);
  }

  public getGraphicParams(): GraphicParams { return this.graphicParams; }

  public getDisplayParams(type: DisplayParams.Type): DisplayParams { return DisplayParams.createForType(type, this.graphicParams); }
  public getMeshDisplayParams(): DisplayParams { return DisplayParams.createForMesh(this.graphicParams, !this.wantNormals, (grad) => this.resolveGradient(grad)); }
  public getLinearDisplayParams(): DisplayParams { return DisplayParams.createForLinear(this.graphicParams); }
  public get textDisplayParams(): DisplayParams { return DisplayParams.createForText(this.graphicParams); }

  public add(geom: Geometry): void { this.accum.addGeometry(geom); }

  private resolveGradient(gradient: Gradient.Symb): RenderTexture | undefined {
    return this.system.getGradientTexture(gradient, this.iModel);
  }
}

// Set to true to add a range box to every graphic produced by PrimitiveBuilder.
let addDebugRangeBox = false;

/** @internal */
export class PrimitiveBuilder extends GeometryListBuilder {
  public primitives: RenderGraphic[] = [];

  public finishGraphic(accum: GeometryAccumulator): RenderGraphic {
    let meshes: MeshList | undefined;
    let range: Range3d | undefined;
    let featureTable: FeatureTable | undefined;
    if (!accum.isEmpty) {
      // Overlay decorations don't test Z. Tools like to layer multiple primitives on top of one another; they rely on the primitives rendering
      // in that same order to produce correct results (e.g., a thin line rendered atop a thick line of another color).
      // No point generating edges for graphics that are always rendered in smooth shade mode.
      const options = GeometryOptions.createForGraphicBuilder(this);
      const tolerance = this.computeTolerance(accum);
      meshes = this.saveToGraphicList(this.primitives, options, tolerance, this.pickable);
      if (undefined !== meshes) {
        if (meshes.features?.anyDefined)
          featureTable = meshes.features;

        range = meshes.range;
      }
    }

    let graphic = (this.primitives.length !== 1) ? this.system.createGraphicList(this.primitives) : this.primitives.pop() as RenderGraphic;
    if (undefined !== featureTable) {
      const batchRange = range ?? new Range3d();
      const batchOptions = this._options.pickable;
      graphic = this.system.createBatch(graphic, PackedFeatureTable.pack(featureTable), batchRange, batchOptions);
    }

    if (addDebugRangeBox && range) {
      addDebugRangeBox = false;
      const builder = this.system.createGraphic({ ...this._options });
      builder.addRangeBox(range);
      graphic = this.system.createGraphicList([graphic, builder.finish()]);
      addDebugRangeBox = true;
    }

    return graphic;
  }

  public computeTolerance(accum: GeometryAccumulator): number {
    return this._computeChordTolerance({
      graphic: this,
      computeRange: () => accum.geometries.computeRange(),
    });
  }


  /**
   * Populate a list of Graphic objects from the accumulated Geometry objects.
   * removed ViewContext
   */
  public saveToGraphicList(graphics: RenderGraphic[], options: GeometryOptions, tolerance: number, pickable: { isVolumeClassifier?: boolean, modelId?: string } | undefined): MeshList | undefined {
    const meshes = this.accum.toMeshes(options, tolerance, pickable);
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

      const graphic = mesh.getGraphics(this.system, this.accum.viewIndependentOrigin);
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
