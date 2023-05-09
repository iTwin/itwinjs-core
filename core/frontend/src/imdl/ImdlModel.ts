/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
/** @packageDocumentation
 * @module Tiles
 */

import { NonFunctionPropertiesOf, StructuredCloneableObject, UintArray } from "@itwin/core-bentley";
import { XYAndZ } from "@itwin/core-geometry";
import {
  ColorDefProps, FeatureIndexType, FillFlags, LinePixels, PolylineTypeFlags, QParams2dProps, QParams3dProps,
} from "@itwin/core-common";
import { EdgeTable } from "../render/primitives/EdgeParams";
import { SurfaceMaterialAtlas, SurfaceType } from "../render/primitives/SurfaceParams";
import { AuxChannelTable } from "../render/primitives/AuxChannelTable";

export namespace ImdlModel {
  export interface VertexTable extends StructuredCloneableObject {
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
    material: SurfaceMaterial;
    textureMapping?: {
      texture: string;
      alwaysDisplayed: boolean;
    };
  };

  export type AuxChannelTableParams = NonFunctionPropertiesOf<AuxChannelTable>;

  export interface MeshParams {
    vertices: VertexTable;
    surface: SurfaceParams
    edges?: EdgeParams;
    isPlanar: boolean;
    auxChannels?: AuxChannelTableParams;
  }

  export type PrimitiveParams = {
    params: MeshParams;
    viOrigin?: XYAndZ;
    type: "mesh";
  } | {
    params: PointStringParams;
    viOrigin: XYAndZ;
    type: "point";
  } | {
    params: PolylineParams;
    viOrigin?: XYAndZ;
    type: "polyline";
  };

  export interface BasicNode {
    primitives: PrimitiveParams[];
    animationNodeId?: never;
    animationId?: never;
    layerId?: never;
  }

  export interface AnimationNode {
    primitives: PrimitiveParams[];
    animationNodeId: number;
    animationId: string;
    layerId?: never;
  }

  export interface Layer {
    primitives: PrimitiveParams[];
    layerId: string;
    animationNodeId?: never;
    animationId?: never;
  }

  export type Node = BasicNode | AnimationNode | Layer;

  export interface SingleModelFeatureTable {
    multiModel: false;
    data: Uint32Array;
    numFeatures: number;
    animationNodeIds?: UintArray;
  }

  export interface MultiModelFeatureTable {
    multiModel: true;
    data: Uint32Array;
    numFeatures: number;
    numSubCategories: number;
  }

  export type FeatureTable = SingleModelFeatureTable | MultiModelFeatureTable;

  export interface Document {
    featureTable: FeatureTable;
    rtcCenter?: XYAndZ;
    nodes: Node[];
  }
}
