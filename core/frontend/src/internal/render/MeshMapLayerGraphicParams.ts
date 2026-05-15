/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
/** @packageDocumentation
 * @module Rendering
 */

import { ColorDef, PackedFeatureTable } from "@itwin/core-common";
import { MapCartoRectangle, MapTileProjection } from "../../tile/internal";
import { RenderTerrainGeometry, TerrainTexture } from "./RenderTerrain";
import { RenderPlanarClassifier } from "./RenderPlanarClassifier";

export type MapLayerClassifiers = Map<number, RenderPlanarClassifier>;

export interface MeshMapLayerGraphicParams {
  readonly realityMesh?: RenderTerrainGeometry;
  readonly projection: MapTileProjection;
  readonly tileRectangle: MapCartoRectangle;
  readonly featureTable?: PackedFeatureTable;
  readonly tileId: string | undefined;
  readonly baseColor: ColorDef | undefined;
  readonly baseTransparent: boolean;
  readonly textures?: TerrainTexture[];
  readonly layerClassifiers?: MapLayerClassifiers;
  readonly disableClipStyle?: true;
}
