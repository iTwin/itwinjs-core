/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
/** @packageDocumentation
 * @module Tiles
 */

import { UintArray } from "@itwin/core-bentley";
import { XYAndZ } from "@itwin/core-geometry";
import {
  ColorDefProps, FeatureIndexType, FillFlags, Gradient, LinePixels, PolylineTypeFlags, QParams2dProps, QParams3dProps,
} from "@itwin/core-common";
import { EdgeTable } from "../internal/render/EdgeParams";
import { SurfaceMaterialAtlas, SurfaceType } from "../internal/render/SurfaceParams";
import { AuxChannelTableProps } from "../internal/render/AuxChannelTable";
import { ImdlAreaPattern, ImdlDocument } from "./ImdlSchema";
import { InstancedGraphicProps } from "../render/InstancedGraphicParams";

/** Types comprising the parsed representation of an ImdlDocument, produced by [[parseImdlDocument]] and consumed by [[decodeImdlGraphics]].
 * All of the types are required to support [structured cloning](https://developer.mozilla.org/en-US/docs/Web/API/Web_Workers_API/Structured_clone_algorithm) so that they
 * can be passed between workers and the main JavaScript thread.
 * @internal
 */
export namespace ImdlModel {
  export interface VertexTable {
    data: Uint8Array;
    usesUnquantizedPositions?: boolean;
    qparams: QParams3dProps;
    width: number;
    height: number;
    hasTranslucency: boolean;
    uniformColor?: ColorDefProps;
    featureIndexType: FeatureIndexType;
    uniformFeatureID?: number;
    numVertices: number;
    numRgbaPerVertex: number;
    uvParams?: QParams2dProps;
  }

  export interface PointStringParams {
    vertices: VertexTable;
    indices: Uint8Array;
    weight: number;
  }

  export interface TesselatedPolyline {
    indices: Uint8Array;
    prevIndices: Uint8Array;
    nextIndicesAndParams: Uint8Array;
  }

  export interface PolylineParams {
    vertices: VertexTable;
    polyline: TesselatedPolyline;
    isPlanar: boolean;
    type: PolylineTypeFlags;
    weight: number;
    linePixels: LinePixels;
  }

  export interface SegmentEdgeParams {
    indices: Uint8Array;
    endPointAndQuadIndices: Uint8Array;
  }

  export interface SilhouetteParams extends SegmentEdgeParams {
    normalPairs: Uint8Array;
  }

  export interface IndexedEdgeParams {
    indices: Uint8Array;
    edges: EdgeTable;
  }

  export interface EdgeParams {
    weight: number;
    linePixels: LinePixels;
    segments?: SegmentEdgeParams;
    silhouettes?: SilhouetteParams;
    polylines?: TesselatedPolyline;
    indexed?: IndexedEdgeParams;
  }

  export interface SurfaceMaterialParams {
    alpha?: number;
    diffuse?: {
      color?: ColorDefProps;
      weight?: number;
    };
    specular?: {
      color?: ColorDefProps;
      weight?: number;
      exponent?: number;
    };
  }

  export interface SurfaceRenderMaterial {
    isAtlas: false;
    material: string | SurfaceMaterialParams;
  }

  export type SurfaceMaterial = SurfaceRenderMaterial | SurfaceMaterialAtlas;

  export interface SurfaceParams {
    type: SurfaceType;
    indices: Uint8Array;
    fillFlags: FillFlags;
    hasBakedLighting: boolean;
    material?: SurfaceMaterial;
    textureMapping?: {
      texture: string | Gradient.SymbProps;
      alwaysDisplayed: boolean;
    };
  }

  export interface MeshParams {
    vertices: VertexTable;
    surface: SurfaceParams;
    edges?: EdgeParams;
    isPlanar: boolean;
    auxChannels?: AuxChannelTableProps;
  }

  export interface Instances extends InstancedGraphicProps {
    type: "instances";
  }

  export interface ViewIndependentOrigin {
    type: "viewIndependentOrigin";
    origin: XYAndZ;
  }

  export type PrimitiveModifier = Instances | ViewIndependentOrigin;

  export type Primitive = {
    params: MeshParams;
    modifier?: PrimitiveModifier;
    type: "mesh";
  } | {
    params: PointStringParams;
    modifier?: PrimitiveModifier;
    type: "point";
  } | {
    params: PolylineParams;
    modifier?: PrimitiveModifier;
    type: "polyline";
  };

  export type AreaPatternParams = Omit<ImdlAreaPattern, "xyOffsets"> & {
    xyOffsets: Float32Array;
  };

  export type NodePrimitive = Primitive | {
    params: AreaPatternParams;
    modifier?: never;
    type: "pattern";
  };

  export interface BasicNode {
    primitives: NodePrimitive[];
    animationNodeId?: never;
    animationId?: never;
    layerId?: never;
    groupId?: never;
  }

  export interface AnimationNode {
    primitives: NodePrimitive[];
    animationNodeId: number;
    animationId?: string;
    layerId?: never;
    groupId?: never;
  }

  export interface Layer {
    primitives: NodePrimitive[];
    layerId: string;
    groupId?: never;
    animationNodeId?: never;
    animationId?: never;
  }

  /** Nodes that contain primitives. */
  export type PrimitivesNode = BasicNode | AnimationNode | Layer;

  /** A grouping node that contains other nodes. These don't nest. */
  export interface GroupNode {
    groupId: number;
    nodes: PrimitivesNode[];
    primitives?: never;
    animationNodeId?: never;
    animationId?: never;
    layerId?: never;
  }

  export type Node = PrimitivesNode | GroupNode;

  export interface SingleModelFeatureTable {
    multiModel: false;
    data: Uint32Array;
    numFeatures: number;
    animationNodeIds?: UintArray;
    numSubCategories?: never;
  }

  export interface MultiModelFeatureTable {
    multiModel: true;
    data: Uint32Array;
    numFeatures: number;
    numSubCategories: number;
    animationNodeIds?: UintArray;
  }

  export type FeatureTable = SingleModelFeatureTable | MultiModelFeatureTable;

  export interface Document {
    featureTable: FeatureTable;
    nodes: Node[];
    patterns: Map<string, Primitive[]>;
    rtcCenter?: XYAndZ;
    binaryData: Uint8Array;
    json: ImdlDocument;
  }
}

function addTransferable(xfers: Set<Transferable>, array: UintArray | Float32Array | undefined): void {
  if (array) {
    xfers.add(array.buffer);
  }
}

/** @internal */
export function addPrimitiveTransferables(xfers: Set<Transferable>, primitive: ImdlModel.NodePrimitive): void {
  if (primitive.type === "pattern") {
    addTransferable(xfers, primitive.params.xyOffsets);
    return;
  }

  addTransferable(xfers, primitive.params.vertices.data);

  if (primitive.modifier?.type === "instances") {
    addTransferable(xfers, primitive.modifier.transforms);
    addTransferable(xfers, primitive.modifier.featureIds);
    addTransferable(xfers, primitive.modifier.symbologyOverrides);
  }

  switch (primitive.type) {
    case "point":
      addTransferable(xfers, primitive.params.indices);
      break;
    case "polyline":
      addTransferable(xfers, primitive.params.polyline.indices);
      addTransferable(xfers, primitive.params.polyline.prevIndices);
      addTransferable(xfers, primitive.params.polyline.nextIndicesAndParams);
      break;
    case "mesh":
      addTransferable(xfers, primitive.params.surface.indices);
      const edges = primitive.params.edges;
      if (edges) {
        addTransferable(xfers, edges.segments?.indices);
        addTransferable(xfers, edges.segments?.endPointAndQuadIndices);
        addTransferable(xfers, edges.silhouettes?.indices);
        addTransferable(xfers, edges.silhouettes?.endPointAndQuadIndices);
        addTransferable(xfers, edges.silhouettes?.normalPairs);
        addTransferable(xfers, edges.polylines?.indices);
        addTransferable(xfers, edges.polylines?.prevIndices);
        addTransferable(xfers, edges.polylines?.nextIndicesAndParams);
        addTransferable(xfers, edges.indexed?.indices);
        addTransferable(xfers, edges.indexed?.edges.data);
      }

      break;
  }
}

/** Collect an array of all the [transferable objects](https://developer.mozilla.org/en-US/docs/Web/API/Web_Workers_API/Transferable_objects)
 * within the specified document.
 * @internal
 */
export function collectTransferables(document: ImdlModel.Document): Transferable[] {
  const xfers = new Set<Transferable>();
  const add = (array: UintArray | Float32Array | undefined) => {
    if (array)
      xfers.add(array.buffer);
  };

  add(document.binaryData);
  add(document.featureTable.data);
  add(document.featureTable.animationNodeIds);

  for (const node of document.nodes) {
    if (undefined !== node.groupId) {
      for (const primNode of node.nodes)
        for (const primitive of primNode.primitives)
          addPrimitiveTransferables(xfers, primitive);
    } else {
      for (const primitive of node.primitives)
        addPrimitiveTransferables(xfers, primitive);
    }
  }

  for (const primitives of document.patterns.values())
    for (const primitive of primitives)
      addPrimitiveTransferables(xfers, primitive);

  return Array.from(xfers);
}
