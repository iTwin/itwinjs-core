/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
/** @packageDocumentation
 * @module Tile
 */

/* The order of exports below is based on dependencies between the types in each file.
 * For example, IModelTileLoader derives from TileLoader, so TileLoader must be exported first.
 * No file inside imodeljs-frontend should import from *any* file in /tile/ *except* for this one.
 * e.g.:
 *  import { TileLoader } from "./tile/TileLoader"; // NO...
 *  import { TileLoader } from "./tile/internal"; // YES!
 * Failure to follow either of these two guidelines is very likely to produce difficult-to-debug run-time errors due
 * to circular dependencies.
 */

export * from "./MapCartoRectangle";
export * from "./QuadId";
export * from "./Tile";
export * from "./RealityTile";
export * from "./TileParams";
export * from "./TileContent";
export * from "./TileDrawArgs";
export * from "./RealityTileDrawArgs";
export * from "./GraphicsCollector";
export * from "./BatchedTileIdMap";
export * from "./TileTreeParams";
export * from "./TileTree";
export * from "./RealityTileTree";
export * from "./TileLoader";
export * from "./TileTreeSupplier";
export * from "./TileTreeOwner";
export * from "./TileTreeReference";
export * from "./TileAdmin";
export * from "./TileRequest";
export * from "./GltfReader";
export * from "./I3dmReader";
export * from "./B3dmReader";
export * from "./ImdlReader";
export * from "./A3xTile";
export * from "./A3xTileIO";
export * from "./ImageryProvider";
export * from "./MapTileTreeReference";
export * from "./MapTileTree";
export * from "./BackgroundMapTileTreeReference";
export * from "./BackgroundTerrainTileTree";
export * from "./ContextTileLoader";
export * from "./WebMapTileTree";
export * from "./BingElevation";
export * from "./CesiumWorldTerrainTileTree";
export * from "./IModelTileLoader";
export * from "./MapTilingScheme";
export * from "./MapTileAvailability";
export * from "./PntsReader";
export * from "./RealityModelTileTree";
export * from "./PrimaryTileTree";
export * from "./ClassifierTileTree";
export * from "./ViewAttachmentTileTree";
