/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
/** @packageDocumentation
 * @module Rendering
 */

import { Point3d, Range3d, Transform } from "@itwin/core-geometry";
import { FeatureTable, Gradient, PackedFeatureTable, QPoint3dList, RenderTexture } from "@itwin/core-common";
import { CustomGraphicBuilderOptions, GraphicBuilder, ViewportGraphicBuilderOptions } from "../../render/GraphicBuilder";
import { RenderGraphic } from "../../render/RenderGraphic";
import { RenderSystem } from "../../render/RenderSystem";
import { GeometryOptions } from "../../common/internal/render/Primitives";
import { GeometryAccumulator } from "../../common/internal/render/GeometryAccumulator";
import { Mesh, MeshList } from "../../common/internal/render/MeshPrimitives";
import { GraphicBranch } from "../../render/GraphicBranch";
import { assert } from "@itwin/core-bentley";
import { _accumulator, _implementationProhibited, _nodes } from "../../common/internal/Symbols";
import { GraphicTemplate } from "../../render/GraphicTemplate";
import { RenderGeometry } from "./RenderGeometry";
import { createMeshParams } from "../../common/internal/render/VertexTableBuilder";
import { IModelApp } from "../../IModelApp";
import { createPointStringParams } from "../../common/internal/render/PointStringParams";
import { createPolylineParams } from "../../common/internal/render/PolylineParams";

// Set to true to add a range box to every graphic produced by PrimitiveBuilder.
let addDebugRangeBox = false;

/** @internal */
export class PrimitiveBuilder extends GraphicBuilder {
  public readonly [_implementationProhibited] = undefined;
  public readonly system: RenderSystem;
  public primitives: RenderGraphic[] = [];
  private readonly _options: CustomGraphicBuilderOptions | ViewportGraphicBuilderOptions;
  private readonly _viewIndependentOrigin?: Point3d;

  public constructor(system: RenderSystem, options: ViewportGraphicBuilderOptions | CustomGraphicBuilderOptions) {
    super(options);
    this.system = system;
    this._options = options;
    this._viewIndependentOrigin = options.viewIndependentOrigin?.clone();
  }

  public override finish(): RenderGraphic {
    const graphic = this.finishGraphic(this[_accumulator]);
    this[_accumulator].clear();
    return graphic;
  }

  private finishGraphic(accum: GeometryAccumulator): RenderGraphic {
    let meshes: MeshList | undefined;
    let range: Range3d | undefined;
    let featureTable: FeatureTable | undefined;
    if (!accum.isEmpty) {
      // Overlay decorations don't test Z. Tools like to layer multiple primitives on top of one another; they rely on the primitives rendering
      // in that same order to produce correct results (e.g., a thin line rendered atop a thick line of another color).
      // No point generating edges for graphics that are always rendered in smooth shade mode.
      const tolerance = this.computeTolerance(accum);
      meshes = this.saveToGraphicList(this.primitives, this, tolerance, this.pickable);
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

  public override finishTemplate(): GraphicTemplate {
    const accum = this[_accumulator];
    const tolerance = this.computeTolerance(accum);
    const result = this.saveToTemplate(this, tolerance, this.pickable);
    accum.clear();

    return result?.template ?? {
      [_implementationProhibited]: undefined,
      [_nodes]: [],
      isInstanceable: true,
    };
  }

  public computeTolerance(accum: GeometryAccumulator): number {
    return this._computeChordTolerance({
      graphic: this,
      computeRange: () => accum.geometries.computeRange(),
    });
  }

  protected override resolveGradient(gradient: Gradient.Symb): RenderTexture | undefined {
    return this.system.getGradientTexture(gradient, this.iModel);
  }

  /**
   * Populate a list of Graphic objects from the accumulated Geometry objects.
   * removed ViewContext
   */
  public saveToGraphicList(graphics: RenderGraphic[], options: GeometryOptions, tolerance: number, pickable: { isVolumeClassifier?: boolean, modelId?: string } | undefined): MeshList | undefined {
    const meshes = this[_accumulator].toMeshes(options, tolerance, pickable);
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

      const graphic = this.system.createMeshGraphics(mesh, this._viewIndependentOrigin);
      if (graphic)
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

  private saveToTemplate(options: GeometryOptions, tolerance: number, pickable: { isVolumeClassifier?: boolean, modelId?: string } | undefined): { meshes: MeshList, template: GraphicTemplate } | undefined {
    const meshes = this[_accumulator].toMeshes(options, tolerance, pickable);
    if (0 === meshes.length)
      return undefined;

    // If the meshes contain quantized positions, they are all quantized to the same range. If that range is small relative to the distance
    // from the origin, quantization errors can produce display artifacts. Remove the translation from the quantization parameters and apply
    // it in the transform instead.
    //
    // If the positions are not quantized, they have already been transformed to be relative to the center of the meshes' range.
    // Apply the inverse translation to put them back into model space.
    let transformOrigin: Point3d | undefined;
    let meshesRangeOffset = false;
    const geometry: RenderGeometry[] = [];

    let isInstanceable = undefined === this._viewIndependentOrigin;
    for (const mesh of meshes) {
      const verts = mesh.points;
      if (!transformOrigin){
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
        if (verts instanceof QPoint3dList) {
          assert(transformOrigin.isAlmostEqual(verts.params.origin));
          verts.params.origin.setZero();
        } else {
          assert(verts.range.center.isAlmostZero);
        }
      }

      const geom = createGeometryFromMesh(mesh, this.system, this._viewIndependentOrigin);
      if (geom) {
        geom.noDispose = true;
        geometry.push(geom);
        if (!geom.isInstanceable) {
          isInstanceable = false;
        }
      }
    }

    let transform;
    if (transformOrigin) {
      transform = Transform.createTranslation(transformOrigin);
      if (meshesRangeOffset) { // restore the meshes range that we modified earlier.
        meshes.range?.low.addInPlace(transformOrigin);
        meshes.range?.high.addInPlace(transformOrigin);
      }
    }
      
    return {
      meshes,
      template: {
        [_implementationProhibited]: undefined,
        isInstanceable,
        [_nodes]: [{
          geometry,
          transform,
        }],
      }
    }
  }
}

function createGeometryFromMesh(mesh: Mesh, system: RenderSystem, viOrigin: Point3d | undefined): RenderGeometry | undefined {
  const meshArgs = mesh.toMeshArgs();
  if (meshArgs) {
    const meshParams = createMeshParams(meshArgs, system.maxTextureSize, IModelApp.tileAdmin.edgeOptions.type !== "non-indexed");
    return system.createMeshGeometry(meshParams, viOrigin);
  }

  const plArgs = mesh.toPolylineArgs();
  if (!plArgs) {
    return undefined;
  }

  if (plArgs.flags.isDisjoint) {
    const psParams = createPointStringParams(plArgs, system.maxTextureSize);
    return psParams ? system.createPointStringGeometry(psParams, viOrigin) : undefined;
  }

  const plParams = createPolylineParams(plArgs, system.maxTextureSize);
  return plParams ? system.createPolylineGeometry(plParams, viOrigin) : undefined;
}
