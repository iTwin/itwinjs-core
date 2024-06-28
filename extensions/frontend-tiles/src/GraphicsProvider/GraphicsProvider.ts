/*---------------------------------------------------------------------------------------------
 * Copyright (c) Bentley Systems, Incorporated. All rights reserved.
 * See LICENSE.md in the project root for license terms and full copyright notice.
 *--------------------------------------------------------------------------------------------*/

import { initGeoscienceTileset } from './producers/GeoscienceTileset';
import { initIModelTiles, initIModelTilesAs3DTiles, obtainIModelTilesetUrl } from './producers/IModelTileset';

export { InitGeoscienceTilesArgs } from './producers/GeoscienceTileset';
export { ObtainIModelTilesetUrlArgs, InitIModelTilesArgs } from './producers/IModelTileset';

/**
 * The GraphicsProvider class is responsible for providing graphics-related functionality.
 * @beta
 */
export class GraphicsProvider {
  private static instance: GraphicsProvider;

  private constructor() { /* Private constructor to prevent instantiation */ }

  // The URL of the iModel tileset.
  public obtainIModelTilesetUrl = obtainIModelTilesetUrl;

  // Initializes the geoscience tileset.
  public initGeoscienceTileset = initGeoscienceTileset;

  // Initializes the iModel tiles.
  public initIModelTiles = initIModelTiles;

  // Initializes the iModel tiles as 3D tiles.
  public initIModelTilesAs3DTiles = initIModelTilesAs3DTiles;

  public static getInstance(): GraphicsProvider {
    if (!GraphicsProvider.instance) {
      GraphicsProvider.instance = new GraphicsProvider();
    }
    return GraphicsProvider.instance;
  }
}

export default GraphicsProvider.getInstance();
