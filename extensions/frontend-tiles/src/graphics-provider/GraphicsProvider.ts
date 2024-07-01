/*---------------------------------------------------------------------------------------------
 * Copyright (c) Bentley Systems, Incorporated. All rights reserved.
 * See LICENSE.md in the project root for license terms and full copyright notice.
 *--------------------------------------------------------------------------------------------*/

import { createGeoscienceTileset } from "./tileset-creators/GeoscienceTileset";
import { createIModelTileset, createIModelTilesetAs3DTiles } from "./tileset-creators/IModelTileset";
import { getIModelTilesetUrlFromConnection } from "./url-providers/IModelUrlProvider";
import { createRealityModelTilesetFromUrl } from "./tileset-creators/RealityModelTileset";

/**
 * The GraphicsProvider class is responsible for providing graphics-related functionality.
 * @beta
 */
export class GraphicsProvider {

  private constructor() { /* Private constructor to prevent instantiation */ }

  // The URL of the iModel tileset.
  public static getIModelTilesetUrlFromConnection = getIModelTilesetUrlFromConnection;

  /** Creates the geoscience tileset.
   * @alpha
   */
  public static createGeoscienceTileset = createGeoscienceTileset;

  // Creates the iModel tiles.
  public static createIModelTileset = createIModelTileset;

  /** Creates the iModel tiles as 3D tiles.
   * @alpha
   */
  public static createIModelTilesetAs3DTiles = createIModelTilesetAs3DTiles;

  /** Creates the reality model tileset from a URL.
   * @alpha
   */
  public static createRealityModelTilesetFromUrl = createRealityModelTilesetFromUrl;
}
