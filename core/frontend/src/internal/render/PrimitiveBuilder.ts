/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
/** @packageDocumentation
 * @module Rendering
 */

import { Point3d, Range3d, Transform } from "@itwin/core-geometry";
import { Gradient, PackedFeatureTable, QPoint3dList, RenderTexture } from "@itwin/core-common";
import { CustomGraphicBuilderOptions, GraphicBuilder, ViewportGraphicBuilderOptions } from "../../render/GraphicBuilder";
import { RenderGraphic } from "../../render/RenderGraphic";
import { RenderSystem } from "../../render/RenderSystem";
import { GeometryOptions } from "../../common/internal/render/Primitives";
import { GeometryAccumulator } from "../../common/internal/render/GeometryAccumulator";
import { Mesh, MeshList } from "../../common/internal/render/MeshPrimitives";
import { GraphicBranch } from "../../render/GraphicBranch";
import { assert } from "@itwin/core-bentley";
import { _accumulator, _createGraphicFromTemplate, _implementationProhibited } from "../../common/internal/Symbols";
import { GraphicTemplate, GraphicTemplateBatch, createGraphicTemplate } from "../../render/GraphicTemplate";
import { RenderGeometry } from "./RenderGeometry";
import { createMeshParams } from "../../common/internal/render/VertexTableBuilder";
import { IModelApp } from "../../IModelApp";
import { createPointStringParams } from "../../common/internal/render/PointStringParams";
import { createPolylineParams } from "../../common/internal/render/PolylineParams";

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
    const template = this.finishTemplate();
    const graphic = this.system[_createGraphicFromTemplate](template);
    return graphic ?? this.system.createGraphicList([]);
  }

  public override finishTemplate(): GraphicTemplate {
    const accum = this[_accumulator];
    const tolerance = this.computeTolerance(accum);
    const result = this.saveToTemplate(this, tolerance, this.pickable);
    accum.clear();

    return result ?? createGraphicTemplate({ nodes: [] });
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

  private saveToTemplate(options: GeometryOptions, tolerance: number, pickable: { isVolumeClassifier?: boolean, modelId?: string } | undefined): GraphicTemplate | undefined {
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
        geometry.push(geom);
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
      
    let batch: GraphicTemplateBatch | undefined;
    if (meshes.features?.anyDefined) {
      batch = {
        featureTable: PackedFeatureTable.pack(meshes.features),
        range: meshes.range ?? new Range3d(),
        options: this._options.pickable,
      };
    }

    return createGraphicTemplate({
      batch,
      nodes: [{ geometry, transform }],
    });
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
