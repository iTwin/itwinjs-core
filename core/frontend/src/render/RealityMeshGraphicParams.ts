/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
/** @packageDocumentation
 * @module Rendering
 */

import { assert } from "@itwin/core-bentley";
import { IndexedPolyface, Polyface, Transform } from "@itwin/core-geometry";
import { ColorDef, OctEncodedNormal, PackedFeatureTable, QParams2d, QParams3d, RenderTexture } from "@itwin/core-common";
import { GltfMeshData, MapCartoRectangle, MapTileProjection } from "../tile/internal";
import { RenderMemory } from "./RenderMemory";
import { MapLayerClassifiers,  RenderTerrainGeometry,  TerrainTexture } from "./RenderSystem";

/** @internal */
export interface RealityMeshGraphicParams {
  readonly realityMesh: RenderTerrainGeometry;
  readonly projection: MapTileProjection;
  readonly tileRectangle: MapCartoRectangle;
  readonly featureTable: PackedFeatureTable;
  readonly tileId: string | undefined;
  readonly baseColor: ColorDef | undefined;
  readonly baseTransparent: boolean;
  readonly textures?: TerrainTexture[];
  readonly layerClassifiers?: MapLayerClassifiers;
}
