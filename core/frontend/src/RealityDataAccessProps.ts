/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
/** @packageDocumentation
 * @module RealityData
 */

import { AuthorizedClientRequestContext } from "@bentley/itwin-client";

/**
 * All of the currently supported ProjectWise ContextShare reality data types
 * @beta
 */
export enum DefaultSupportedTypes {
  RealityMesh3dTiles = "RealityMesh3DTiles", // Web Ready Scalable Mesh
  OPC = "OPC", // Orbit Point Cloud
  Terrain3dTiles = "Terrain3DTiles", // Terrain3DTiles
  OMR = "OMR", // Mapping Resource
  Cesium3dTiles = "Cesium3DTiles" // Cesium 3dTiles
}

/** RealityData
 * This class implements a Reality Data stored in ProjectWise Context Share (Reality Data Service)
 * Data is accessed directly through methods of the reality data instance.
 * Access to the data required a properly entitled token though the access to the blob is controlled through
 * an Azure blob URL, the token may be required to obtain this Azure blob URL or refresh it.
 * The Azure blob URL is considered valid for an hour and is refreshed after 50 minutes.
 * In addition to the reality data properties, and Azure blob URL and internal states, a reality data also contains
 * the identification of the iTwin to identify the context(used for access permissions resolution)
 * @beta
 */
export interface RealityData {
  id?: string;
  rootDocument?: string;
  type?: string;

  getBlobUrl: (requestContext: AuthorizedClientRequestContext) => Promise<URL>;
  getTileContent: (requestContext: AuthorizedClientRequestContext, name: string) => Promise<any>;
  getTileJson: (requestContext: AuthorizedClientRequestContext, name: string) => Promise<any>;
}

/**
 * Client wrapper to Reality Data Service.
 * An instance of this class is used to extract reality data from the ProjectWise Context Share (Reality Data Service)
 * This class implements obtaining a specific reality data and extraction of the Azure blob address.
 * @beta
 */
export interface RealityDataAccess {
  getRealityData: (requestContext: AuthorizedClientRequestContext, iTwinId: string | undefined, tileId: string) => Promise<RealityData>;
  getRealityDataUrl: (iTwinId: string | undefined, tileId: string) => Promise<string>;
}
