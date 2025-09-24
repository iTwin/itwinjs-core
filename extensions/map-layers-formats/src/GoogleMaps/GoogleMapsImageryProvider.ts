/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
/** @packageDocumentation
 * @module MapLayersFormats
 */

import { BentleyError, BentleyStatus, Logger } from "@itwin/core-bentley";
import { ImageMapLayerSettings, ImageSource } from "@itwin/core-common";
import { DecorateContext, GoogleMapsDecorator, IModelApp, MapCartoRectangle, MapLayerImageryProvider, MapTile, QuadIdProps, ScreenViewport, Tile } from "@itwin/core-frontend";
import { GoogleMapsCreateSessionOptions, GoogleMapsLayerTypes, GoogleMapsMapTypes, GoogleMapsScaleFactors, GoogleMapsSession, GoogleMapsSessionManager, ViewportInfo } from "./GoogleMapsSession.js";
import { NativeGoogleMapsSessionManager } from "../internal/NativeGoogleMapsSession.js";
import { GoogleMapsUtils } from "../internal/GoogleMapsUtils.js";

const loggerCategory = "MapLayersFormats.GoogleMaps";

/*
* Google Maps imagery provider
* @beta
*/
export class GoogleMapsImageryProvider extends MapLayerImageryProvider {

  private _decorator: GoogleMapsDecorator;
  private _hadUnrecoverableError = false;
  private _tileSize = 256;
  private _sessionManager?: GoogleMapsSessionManager;
  private _sessionOptions: GoogleMapsCreateSessionOptions|undefined;
  private _activeSession?: GoogleMapsSession;
  constructor(settings: ImageMapLayerSettings, sessionManager?: GoogleMapsSessionManager) {
    super(settings, true);
    this._decorator = new GoogleMapsDecorator();
    this._sessionManager = sessionManager;
  }
  public override get tileSize(): number { return this._tileSize; }

  public override async initialize(): Promise<void> {
    this._sessionOptions = GoogleMapsUtils.getSessionOptionsFromMapLayer(this._settings);
    this._sessionManager = await this.getSessionManager();
    this._activeSession = await this._sessionManager.createSession(this._sessionOptions);;
    this._tileSize = this._activeSession.getTileSize();
    const isActivated = await this._decorator.activate(this._settings.properties!.mapType as GoogleMapsMapTypes);
    if (!isActivated) {
      const msg = `Failed to activate decorator`;
      Logger.logError(loggerCategory, msg);
      throw new BentleyError(BentleyStatus.ERROR, msg);
    }
  }

  protected async getSessionManager(): Promise<GoogleMapsSessionManager> {
    if (this._sessionManager)
      return this._sessionManager;

    if (this._settings.accessKey?.value) {
      return new NativeGoogleMapsSessionManager(this._settings.accessKey.value);
    } else {
      const msg = `Missing GoogleMaps api key`;
      Logger.logError(loggerCategory, msg);
      throw new BentleyError(BentleyStatus.ERROR, msg);
    }
  }

  protected createCreateSessionOptions(settings: ImageMapLayerSettings): GoogleMapsCreateSessionOptions {
    const layerPropertyKeys = settings.properties ? Object.keys(settings.properties) : undefined;
    if (layerPropertyKeys === undefined ||
        !layerPropertyKeys.includes("mapType") ||
        !layerPropertyKeys.includes("language") ||
        !layerPropertyKeys.includes("region")) {
      const msg = "Missing session options";
      Logger.logError(loggerCategory, msg);
      throw new BentleyError(BentleyStatus.ERROR, msg);
    }

    const createSessionOptions: GoogleMapsCreateSessionOptions = {
      mapType: settings.properties!.mapType as GoogleMapsMapTypes,
      region: this._settings.properties!.region as string,
      language: this._settings.properties!.language as string,
    }

    if (Array.isArray(this._settings.properties?.layerTypes) && this._settings.properties.layerTypes.length > 0) {
      createSessionOptions.layerTypes = this._settings.properties.layerTypes as GoogleMapsLayerTypes[];
    }

    if (this._settings.properties?.scale !== undefined) {
      createSessionOptions.scale = this._settings.properties.scale as GoogleMapsScaleFactors;
    }

    if (this._settings.properties?.overlay !== undefined) {
      createSessionOptions.overlay = this._settings.properties.overlay as boolean;
    }

    if (this._settings.properties?.apiOptions !== undefined) {
      createSessionOptions.apiOptions = this._settings.properties.apiOptions as string[];
    }
    return createSessionOptions;
  }

  // not used, see loadTile
  public async constructUrl(_row: number, _column: number, _level: number): Promise<string> {
    return "";
  }

  public async fetchViewportInfo(rectangle: MapCartoRectangle, zoomLevel: number): Promise<ViewportInfo> {
    if (!this._activeSession) {
      Logger.logError(loggerCategory, `Session is not initialized`);
      throw new BentleyError(BentleyStatus.ERROR, "Session is not initialized");
    }

    const req = this._activeSession.getViewportInfoRequest(rectangle, zoomLevel);
    const request = new Request(req.url, {method: "GET"});
    if (req.authorization) {
      request.headers.set("Authorization", req.authorization);
    }
    // Add the session token to the request
    const response = await fetch(request);
    if (!response.ok) {
      Logger.logError(loggerCategory, `Error while loading viewport info: ${response.statusText}`);
      throw new BentleyError(BentleyStatus.ERROR, `Error while loading viewport info: ${response.statusText}`);
    }
    return response.json() as Promise<ViewportInfo>;
  }

  private async fetchAttributions(tiles: Set<Tile>): Promise<string[]> {
    const zooms = new Set<number>();
    const matchingAttributions: string[] = [];

    // Viewport info requests must be made for a specific zoom level
    tiles.forEach((tile) => zooms.add(tile.depth));

    for (const zoom of zooms) {
      let cartoRect: MapCartoRectangle|undefined;
      for (const tile of tiles) {
        if (tile.depth === zoom && tile instanceof MapTile) {
          const extent = this.getEPSG4326Extent(tile.quadId.row, tile.quadId.column, tile.depth);
          const rect = MapCartoRectangle.fromDegrees(extent.longitudeLeft, extent.latitudeBottom, extent.longitudeRight, extent.latitudeTop)
          if (cartoRect)
            cartoRect.union(rect);
          else
            cartoRect = rect;
        }
      }
      if (cartoRect && this._activeSession) {
        try {
          const viewportInfo = await this.fetchViewportInfo(cartoRect, zoom);
          if (viewportInfo?.copyright) {
            matchingAttributions.push(viewportInfo.copyright);
          }
        } catch (error:any) {
          Logger.logError(loggerCategory, `Error while loading viewport info: ${error?.message??"Unknown error"}`);
        }
      }
    }

    return matchingAttributions;
  }
  private async logJsonError(tileResponse: Response) {
    try {
      const error = await tileResponse.json();
      Logger.logError(loggerCategory, `Error while loading tile: ${error?.message}`);
    } catch {
      Logger.logError(loggerCategory, `Error while loading tile: ${tileResponse.statusText}`);
    }
  }

  public override async loadTile(row: number, column: number, zoomLevel: number): Promise<ImageSource | undefined> {
    const tilePos: QuadIdProps = {row, column, level: zoomLevel};
    if (this._hadUnrecoverableError)
      return undefined;

    if (this._activeSession === undefined || this._sessionOptions === undefined) {
      Logger.logError(loggerCategory, `Session manager is not initialized`);
      return undefined;
    }

    try {
      let tileRequest = this._activeSession.getTileRequest(tilePos);
      let tileResponse: Response = await this.makeTileRequest(tileRequest.url.toString(), undefined, tileRequest.authorization);
      if (!tileResponse.ok) {
        if (tileResponse.headers.get("content-type")?.includes("application/json") && this._sessionManager) {
          try {
            // Session might have expired, lets try to refresh it
            this._activeSession = await this._sessionManager.createSession(this._sessionOptions);
            tileRequest = this._activeSession.getTileRequest(tilePos);
            tileResponse = await this.makeTileRequest(tileRequest.url.toString(), undefined, tileRequest.authorization);
            if (!tileResponse.ok) {
              if (tileResponse.headers.get("content-type")?.includes("application/json")) {
                await this.logJsonError(tileResponse);
              } else {
                Logger.logError(loggerCategory, `Error while loading tile: ${tileResponse.statusText}`);
              }
              this._hadUnrecoverableError = true;   // Prevent from doing more invalid requests
              return undefined;
            }
          }
          catch {
            await this.logJsonError(tileResponse);
          }
        } else {
          Logger.logError(loggerCategory, `Error while loading tile: ${tileResponse.statusText}`);
          return undefined;
        }
      }
      return await this.getImageFromTileResponse(tileResponse, zoomLevel);
    } catch (error: any) {
      if (error?.code === 401) {
        Logger.logError(loggerCategory, `Authorize to load tile: ${error.message}`);
      } else {
        Logger.logError(loggerCategory, `Error while loading tile: ${error.message}`);
      }
      return undefined;
    }
  }

  public override decorate(context: DecorateContext): void {
    this._decorator.decorate(context);
  }

  private getSelectedTiles(vp: ScreenViewport) {
    return IModelApp.tileAdmin.getTilesForUser(vp)?.selected;
  }

  public override async addAttributions(cards: HTMLTableElement, vp: ScreenViewport): Promise<void> {
    let copyrightMsg = "";
    const tiles = this.getSelectedTiles(vp);
    if (tiles) {
      try {
        const attrList = await this.fetchAttributions(tiles);
        for (const attr of attrList) {
          attr.split(",").forEach((line) => {
            // Attempt to reduce duplicates, since if there are multiple zoom levels sometimes the same info is returned
            if (!copyrightMsg.includes(line)) {
              copyrightMsg += `${copyrightMsg.length === 0 ? "": "<br>"}${line}`;
            }
          });
        }
      }
      catch (error: any) {
        Logger.logError(loggerCategory, `Error while loading attributions: ${error?.message??"Unknown error"}`);
      }
    }

    const iconSrc = document.createElement("img");
    iconSrc.src = `${IModelApp.publicPath}images/GoogleMaps_Logo_Gray.svg`;
    iconSrc.style.padding = "10px 10px 5px 10px";

    cards.appendChild(IModelApp.makeLogoCard({
      iconSrc,
      heading: "Google Maps",
      notice: copyrightMsg
    }));
  }
}
