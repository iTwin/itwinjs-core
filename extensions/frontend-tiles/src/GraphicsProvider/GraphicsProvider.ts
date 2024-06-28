/*---------------------------------------------------------------------------------------------
 * Copyright (c) Bentley Systems, Incorporated. All rights reserved.
 * See LICENSE.md in the project root for license terms and full copyright notice.
 *--------------------------------------------------------------------------------------------*/

import { createGeoscienceTileset } from './tileset-creators/GeoscienceTileset';
import { createIModelTileset, createIModelTilesetAs3DTiles, getIModelTilesetUrlFromConnection } from './tileset-creators/IModelTileset';
import { createRealityModelTilesetFromUrl } from './tileset-creators/RealityModelTileset';

export { CreateGeoscienceTilesetArgs } from './tileset-creators/GeoscienceTileset';
export { GetIModelTilesetUrlFromConnectionArgs, createIModelTilesetArgs } from './tileset-creators/IModelTileset';

/**
 * The GraphicsProvider class is responsible for providing graphics-related functionality.
 * @beta
 */
export class GraphicsProvider {
  private static instance: GraphicsProvider;

  private constructor() { /* Private constructor to prevent instantiation */ }

  public static getInstance(): GraphicsProvider {
    if (!GraphicsProvider.instance) {
      GraphicsProvider.instance = new GraphicsProvider();
    }
    return GraphicsProvider.instance;
  }

  // The URL of the iModel tileset.
  public getIModelTilesetUrlFromConnection = getIModelTilesetUrlFromConnection;

  /** Creates the geoscience tileset.
   * @alpha
   */
  public createGeoscienceTileset = createGeoscienceTileset;

  // Creates the iModel tiles.
  public createIModelTileset = createIModelTileset;

  /** Creates the iModel tiles as 3D tiles.
   * @alpha
   */
  public createIModelTilesetAs3DTiles = createIModelTilesetAs3DTiles;

  /** Creates the reality model tileset from a URL.
   * @alpha
   */
  public createRealityModelTilesetFromUrl = createRealityModelTilesetFromUrl;
}

export default GraphicsProvider.getInstance();
