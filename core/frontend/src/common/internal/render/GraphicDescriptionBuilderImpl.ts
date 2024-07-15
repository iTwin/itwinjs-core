/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
/** @packageDocumentation
 * @module Rendering
 */

import { Point3d, Range3d, Range3dProps, Transform, TransformProps } from "@itwin/core-geometry";
import { ImdlModel, addPrimitiveTransferables } from "../../imdl/ImdlModel";
import { ComputeGraphicDescriptionChordToleranceArgs, FinishGraphicDescriptionArgs, GraphicDescription, GraphicDescriptionBuilder, GraphicDescriptionBuilderOptions, GraphicDescriptionConstraints } from "../../render/GraphicDescriptionBuilder";
import { GraphicType } from "../../render/GraphicType";
import { GraphicAssembler } from "../../render/GraphicAssembler";
import { PackedFeatureTable, QPoint3dList } from "@itwin/core-common";
import { BatchOptions } from "../../render/BatchOptions";
import { Id64String, assert } from "@itwin/core-bentley";
import { Mesh, MeshArgs, PolylineArgs } from "./MeshPrimitives";
import { createPointStringParams } from "./PointStringParams";
import { VertexTable } from "./VertexTable";
import { createPolylineParams } from "./PolylineParams";
import { createMeshParams } from "./VertexTableBuilder";
import { edgeParamsToImdl } from "../../imdl/ParseImdlDocument";

export type BatchDescription = Omit<BatchOptions, "tileId"> & {
  featureTable: ImdlModel.FeatureTable;
  range: Range3dProps;
  isVolumeClassifier?: boolean;
  modelId: Id64String;
}

export interface GraphicDescriptionImpl extends GraphicDescription {
  type: GraphicType;
  primitives: ImdlModel.Primitive[];
  transform?: TransformProps;
  batch?: BatchDescription;
}

export class GraphicDescriptionBuilderImpl extends GraphicAssembler implements GraphicDescriptionBuilder {
  private readonly _computeChordTolerance: (args: ComputeGraphicDescriptionChordToleranceArgs) => number;
  private readonly _constraints: GraphicDescriptionConstraints;
  
  public constructor(options: GraphicDescriptionBuilderOptions) {
    const type = options.type;
    const placement = options.placement ?? Transform.createIdentity();
    const wantEdges = options.generateEdges ?? type === GraphicType.Scene;
    const wantNormals = wantEdges || type === GraphicType.Scene;
    const preserveOrder = type === GraphicType.ViewOverlay || type === GraphicType.WorldOverlay || type === GraphicType.ViewBackground;

    super({ ...options, type, placement, wantEdges, wantNormals, preserveOrder });

    this._computeChordTolerance = options.computeChordTolerance;
    this._constraints = options.constraints;
  }

  public finish(args: FinishGraphicDescriptionArgs): GraphicDescriptionImpl {
    const description: GraphicDescriptionImpl = { type: this.type, primitives: [] };
    if (this.accum.isEmpty) {
      return description;
    }


    const tolerance = this._computeChordTolerance({ builder: this, computeRange: () => this.accum.geometries.computeRange() });
    const meshes = this.accum.toMeshes(this, tolerance, this.pickable);
    if (meshes.length === 0) {
      return description;
    }

    let featureTable = this.pickable && meshes.features?.anyDefined ? meshes.features : undefined;
    if (featureTable) {
      const features = PackedFeatureTable.pack(featureTable);
      const range = meshes.range ?? new Range3d();
      description.batch = {
        ...this.pickable,
        range: range.toJSON(),
        modelId: featureTable.modelId,
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
        const origin = args.viewIndependentOrigin;
        if (origin) {
          primitive.modifier = {
            type: "viewIndependentOrigin",
            origin: { x: origin.x, y: origin.y, z: origin.z },
          };
        } else if (args.instances) {
          primitive.modifier = {
            ...args.instances,
            type: "instances",
            transformCenter: { x: args.instances.transformCenter.x, y: args.instances.transformCenter.y, z: args.instances.transformCenter.z },
            range: args.instances.range ? {
              low: { x: args.instances.range.low.x, y: args.instances.range.low.y, z: args.instances.range.low.z },
              high: { x: args.instances.range.high.x, y: args.instances.range.high.y, z: args.instances.range.high.z },
            } : undefined,
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
      
    this.accum.clear();
    if (transformOrigin) {
      description.transform = Transform.createTranslation(transformOrigin).toJSON();
    }

    return description;
  }

  private createPrimitive(mesh: Mesh): ImdlModel.Primitive | undefined {
    const meshArgs = mesh.toMeshArgs();
    if (meshArgs) {
      return this.createMeshPrimitive(meshArgs)
    }

    const polylineArgs = mesh.toPolylineArgs();
    if (!polylineArgs) {
      return undefined;
    }

    return polylineArgs.flags.isDisjoint ? this.createPointStringPrimitive(polylineArgs) : this.createPolylinePrimitive(polylineArgs);
  }

  private createMeshPrimitive(args: MeshArgs): ImdlModel.Primitive | undefined {
    const params = createMeshParams(args, this._constraints.maxTextureSize, true);
    
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
          // ###TODO support materials and textures.
          material: undefined,
          textureMapping: undefined,
        },
      },
    };
  }

  private createPolylinePrimitive(args: PolylineArgs): ImdlModel.Primitive | undefined {
    const params = createPolylineParams(args, this._constraints.maxTextureSize);
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
    const params = createPointStringParams(args, this._constraints.maxTextureSize);
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
  
  protected override resolveGradient() {
    // ###TODO support textures and materials.
    return undefined;
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
  const descr = description as any;
  if ("object" !== typeof descr || !Array.isArray(descr.primitives)) {
    return false;
  }

  switch (descr.type) {
    case GraphicType.ViewBackground:
    case GraphicType.Scene:
    case GraphicType.WorldDecoration:
    case GraphicType.WorldOverlay:
    case GraphicType.ViewOverlay:
      return true;
    default:
      return false;
  }
}

export function collectGraphicDescriptionTransferables(description: GraphicDescription): Transferable[] {
  if (!isGraphicDescription(description)) {
    throw new Error("Invalid GraphicDescription");
  }

  const xfers = new Set<Transferable>();
  for (const primitive of description.primitives) {
    addPrimitiveTransferables(xfers, primitive);
  }

  return Array.from(xfers);
}

