/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
/** @packageDocumentation
 * @module Rendering
 */

import { Point3d, Range3d, Range3dProps, Transform, XYAndZ } from "@itwin/core-geometry";
import { addPrimitiveTransferables, ImdlModel } from "../../imdl/ImdlModel";
import {
  ComputeGraphicDescriptionChordToleranceArgs, GraphicDescription, GraphicDescriptionBuilder, GraphicDescriptionBuilderOptions,
} from "../../render/GraphicDescriptionBuilder";
import { GraphicType } from "../../render/GraphicType";
import { GraphicAssembler } from "../../render/GraphicAssembler";
import { Gradient, PackedFeatureTable, QPoint3dList } from "@itwin/core-common";
import { BatchOptions } from "../../render/BatchOptions";
import { assert, Id64String, TransientIdSequence } from "@itwin/core-bentley";
import { Mesh } from "./MeshPrimitives";
import { createPointStringParams } from "./PointStringParams";
import { VertexTable } from "./VertexTable";
import { createPolylineParams } from "./PolylineParams";
import { createMeshParams } from "./VertexTableBuilder";
import { edgeParamsToImdl } from "../../imdl/ParseImdlDocument";
import { _accumulator, _implementationProhibited } from "../Symbols";
import { WorkerGraphicDescriptionContextImpl, WorkerMaterial, WorkerTexture } from "./GraphicDescriptionContextImpl";
import { GraphicDescriptionContext } from "../../render/GraphicDescriptionContext";
import { MeshArgs } from "../../../render/MeshArgs";
import { PolylineArgs } from "../../../render/PolylineArgs";

export type BatchDescription = Omit<BatchOptions, "tileId"> & {
  featureTable: ImdlModel.FeatureTable;
  range: Range3dProps;
  isVolumeClassifier?: boolean;
  modelId: Id64String;
};

export interface GraphicDescriptionImpl extends GraphicDescription {
  type: GraphicType;
  primitives: ImdlModel.Primitive[];
  translation?: XYAndZ;
  batch?: BatchDescription;
  /** Initialized the first time createGraphicFromDescription remaps the description in-place using a GraphicDescriptionContext.
   * Subsequently attempting to remap using same context should be a no-op.
   * Attempting to remap using a different context is an error.
   */
  remapContext?: GraphicDescriptionContext;
}

export class GraphicDescriptionBuilderImpl extends GraphicAssembler implements GraphicDescriptionBuilder {
  public readonly [_implementationProhibited] = undefined;
  private readonly _computeChordTolerance: (args: ComputeGraphicDescriptionChordToleranceArgs) => number;
  private readonly _context: WorkerGraphicDescriptionContextImpl;
  private readonly _viewIndependentOrigin?: Point3d;

  public constructor(options: GraphicDescriptionBuilderOptions) {
    const type = options.type;
    const placement = options.placement ?? Transform.createIdentity();
    const wantEdges = options.generateEdges ?? type === GraphicType.Scene;
    const wantNormals = wantEdges || type === GraphicType.Scene;
    const preserveOrder = type === GraphicType.ViewOverlay || type === GraphicType.WorldOverlay || type === GraphicType.ViewBackground;

    super({
      ...options,
      [_implementationProhibited]: undefined,
      type,
      placement,
      wantEdges,
      wantNormals,
      preserveOrder,
    });

    this._computeChordTolerance = options.computeChordTolerance;
    this._viewIndependentOrigin = options.viewIndependentOrigin?.clone();

    this._context = options.context as WorkerGraphicDescriptionContextImpl;
    if (!(this._context.transientIds instanceof TransientIdSequence)) {
      throw new Error("Invalid WorkerGraphicDescriptionContext");
    }
  }

  public finish(): GraphicDescriptionImpl {
    const description: GraphicDescriptionImpl = {
      [_implementationProhibited]: undefined,
      type: this.type,
      primitives: [],
    };

    if (this[_accumulator].isEmpty) {
      return description;
    }

    const tolerance = this._computeChordTolerance({ builder: this, computeRange: () => this[_accumulator].geometries.computeRange() });
    const meshes = this[_accumulator].toMeshes(this, tolerance, this.pickable);
    if (meshes.length === 0) {
      return description;
    }

    const featureTable = this.pickable && meshes.features?.anyDefined ? meshes.features : undefined;
    if (featureTable) {
      assert(undefined !== this.pickable);
      const features = PackedFeatureTable.pack(featureTable);
      const range = meshes.range ?? new Range3d();
      description.batch = {
        ...this.pickable,
        range: range.toJSON(),
        modelId: this.pickable.modelId ?? this.pickable.id,
        featureTable: {
          multiModel: false,
          data: features.data,
          numFeatures: features.numFeatures,
          animationNodeIds: features.animationNodeIds,
        },
      };
    }

    // If the meshes contain quantized positions, they are all quantized to the same range. If that range is small relative to the distance
    // from the origin, quantization errors can produce display artifacts. Remove the translation from the quantization parameters and apply
    // it in the transform instead.
    // If the positions are not quantized, they have already been transformed to be relative to the center of the meshes' range.
    // Apply the inverse translation to put them back into model space.
    let transformOrigin: Point3d | undefined;
    let meshesRangeOffset = false;

    for (const mesh of meshes) {
      const verts = mesh.points;
      if (!transformOrigin) {
        // This is the first mesh we've processed.
        if (verts instanceof QPoint3dList) {
          transformOrigin = verts.params.origin.clone();
          verts.params.origin.setZero();
        } else {
          // In this case we need to modify the qOrigin of the graphic that will get created later since we have translated the origin.
          // We can't modify it directly, but if we temporarily modify the range of the mesh used to create it the qOrigin will get created properly.
          // Range is shared (not cloned) by all meshes and the mesh list itself, so modifying the range of the meshlist will modify it for all meshes.
          // We will then later add this offset back to the range once all of the graphics have been created because it is needed unmodified for locate.
          transformOrigin = verts.range.center;
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

      const primitive = this.createPrimitive(mesh);
      if (primitive) {
        const origin = this._viewIndependentOrigin;
        if (origin) {
          primitive.modifier = {
            type: "viewIndependentOrigin",
            origin: { x: origin.x, y: origin.y, z: origin.z },
          };
        }

        description.primitives.push(primitive);
      }
    }

    // Restore the meshes range if we modified it above.
    if (meshesRangeOffset) {
      assert(undefined !== transformOrigin);
      meshes.range?.low.addInPlace(transformOrigin);
      meshes.range?.high.addInPlace(transformOrigin);
    }

    this[_accumulator].clear();
    if (transformOrigin) {
      description.translation = { x: transformOrigin.x, y: transformOrigin.y, z: transformOrigin.z };
    }

    return description;
  }

  private createPrimitive(mesh: Mesh): ImdlModel.Primitive | undefined {
    const meshArgs = mesh.toMeshArgs();
    if (meshArgs) {
      return this.createMeshPrimitive(meshArgs);
    }

    const polylineArgs = mesh.toPolylineArgs();
    if (!polylineArgs) {
      return undefined;
    }

    return polylineArgs.flags.isDisjoint ? this.createPointStringPrimitive(polylineArgs) : this.createPolylinePrimitive(polylineArgs);
  }

  private createMeshPrimitive(args: MeshArgs): ImdlModel.Primitive | undefined {
    const params = createMeshParams(args, this._context.constraints.maxTextureSize, true);

    let material;
    const mat = params.surface.material;
    if (mat) {
      assert(mat.isAtlas === false && mat.material instanceof WorkerMaterial);
      material = mat.material.toImdl();
    }

    let textureMapping;
    const tex = params.surface.textureMapping;
    if (tex) {
      assert(tex.texture instanceof WorkerTexture);
      textureMapping = { alwaysDisplayed: false, texture: tex.texture.index.toString(10) };
    }

    return {
      type: "mesh",
      params: {
        ...params,
        vertices: convertVertexTable(params.vertices),
        auxChannels: params.auxChannels?.toJSON(),
        edges: params.edges ? edgeParamsToImdl(params.edges) : undefined,
        surface: {
          ...params.surface,
          indices: params.surface.indices.data,
          material,
          textureMapping,
        },
      },
    };
  }

  private createPolylinePrimitive(args: PolylineArgs): ImdlModel.Primitive | undefined {
    const params = createPolylineParams(args, this._context.constraints.maxTextureSize);
    if (!params) {
      return undefined;
    }

    return {
      type: "polyline",
      params: {
        ...params,
        vertices: convertVertexTable(params.vertices),
        polyline: {
          indices: params.polyline.indices.data,
          prevIndices: params.polyline.prevIndices.data,
          nextIndicesAndParams: params.polyline.nextIndicesAndParams,
        },
      },
    };
  }

  private createPointStringPrimitive(args: PolylineArgs): ImdlModel.Primitive | undefined {
    const params = createPointStringParams(args, this._context.constraints.maxTextureSize);
    if (!params) {
      return undefined;
    }

    return {
      type: "point",
      params: {
        indices: params.indices.data,
        vertices: convertVertexTable(params.vertices),
        weight: params.weight,
      },
    };
  }

  protected override resolveGradient(gradient: Gradient.Symb) {
    return this._context.createGradientTexture(gradient);
  }
}

function convertVertexTable(src: VertexTable): ImdlModel.VertexTable {
  return {
    ...src,
    qparams: src.qparams.toJSON(),
    uvParams: src.uvParams?.toJSON(),
    uniformColor: src.uniformColor?.toJSON(),
  };
}

export function isGraphicDescription(description: GraphicDescription): description is GraphicDescriptionImpl {
  const descr = description as GraphicDescriptionImpl;
  return "object" === typeof descr && Array.isArray(descr.primitives) && "number" === typeof descr.type;
}

export function collectGraphicDescriptionTransferables(xfers: Set<Transferable>, description: GraphicDescription): void {
  if (!isGraphicDescription(description)) {
    throw new Error("Invalid GraphicDescription");
  }

  for (const primitive of description.primitives) {
    addPrimitiveTransferables(xfers, primitive);
  }
}

