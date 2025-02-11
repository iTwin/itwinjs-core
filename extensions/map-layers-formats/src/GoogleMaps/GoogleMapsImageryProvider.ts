import { ImageMapLayerSettings, ImageSource } from "@itwin/core-common";
import { DecorateContext, IModelApp, MapCartoRectangle, MapLayerImageryProvider, MapLayerSourceStatus, MapLayerSourceValidation, MapTile, ScreenViewport, Tile, TileUrlImageryProvider } from "@itwin/core-frontend";
import { _internal, CreateSessionOptions, GoogleMapsSession, LayerTypes, MapTypes, ScaleFactors } from "./GoogleMaps";
import { BentleyError, BentleyStatus, Logger } from "@itwin/core-bentley";
import { GoogleMapsDecorator } from "./GoogleMapDecorator";
const loggerCategory = "MapLayersFormats.GoogleMaps";
const levelToken = "{level}";
const rowToken = "{row}";
const columnToken = "{column}";

const urlTemplate = `https://tile.googleapis.com/v1/2dtiles/${levelToken}/${columnToken}/${rowToken}`;

// eslint-disable-next-line @typescript-eslint/naming-convention
const GoogleMapsUtils = _internal;

/*
* Google Maps imagery provider
* @internal
*/
export class GoogleMapsImageryProvider extends MapLayerImageryProvider {

  private _decorator: GoogleMapsDecorator;
  private _hadUnrecoverableError = false;
  private _tileSize = 256
  constructor(settings: ImageMapLayerSettings) {
    super(settings, true);
    this._decorator = new GoogleMapsDecorator();
  }
  public static validateUrlTemplate(template: string): MapLayerSourceValidation {
    return { status: (template.indexOf(levelToken) > 0 && template.indexOf(columnToken) > 0 && template.indexOf(rowToken) > 0) ? MapLayerSourceStatus.Valid : MapLayerSourceStatus.InvalidUrl };
  }

  protected async createSession() : Promise<GoogleMapsSession|undefined> {
    const sessionOptions = this.createCreateSessionOptions();
    if (this._settings.accessKey ) {
      // Create session and store in query parameters
      const sessionObj = await GoogleMapsUtils.createSession(this._settings.accessKey.value, sessionOptions);
      this._settings.unsavedQueryParams = {session: sessionObj.session};
      return sessionObj;
    } else {
      Logger.logError(loggerCategory, `Missing GoogleMaps api key`);
      return undefined;
    }
  }
  public override get tileSize(): number { return this._tileSize; }

  public override async initialize(): Promise<void> {

    const layerPropertyKeys = this._settings.properties ? Object.keys(this._settings.properties) : undefined;
    if (layerPropertyKeys === undefined ||
        !layerPropertyKeys.includes("mapType") ||
        !layerPropertyKeys.includes("language") ||
        !layerPropertyKeys.includes("region")) {
      const msg = "Missing session options";
      Logger.logError(loggerCategory, msg);
      throw new BentleyError(BentleyStatus.ERROR, msg);
    }

    const session = await this.createSession();
    if (!session) {
      const msg = `Failed to create session`;
      Logger.logError(loggerCategory, msg);
      throw new BentleyError(BentleyStatus.ERROR, msg);
    }
    this._tileSize = session.tileWidth; // assuming here tiles are square

    const isActivated = await this._decorator.activate(this._settings.properties!.mapType as MapTypes);
    if (!isActivated) {
      const msg = `Failed to activate decorator`;
      Logger.logError(loggerCategory, msg);
      throw new BentleyError(BentleyStatus.ERROR, msg);
    }
  }

  private createCreateSessionOptions(): CreateSessionOptions {
    const layerPropertyKeys = this._settings.properties ? Object.keys(this._settings.properties) : undefined;
    if (layerPropertyKeys === undefined ||
        !layerPropertyKeys.includes("mapType") ||
        !layerPropertyKeys.includes("language") ||
        !layerPropertyKeys.includes("region")) {
      const msg = "Missing session options";
      Logger.logError(loggerCategory, msg);
      throw new BentleyError(BentleyStatus.ERROR, msg);
    }

    const createSessionOptions: CreateSessionOptions = {
      mapType: this._settings.properties!.mapType as MapTypes,
      region: this._settings.properties!.region as string,
      language: this._settings.properties!.language as string,
    }

    if (this._settings.properties?.layerTypes !== undefined) {
      createSessionOptions.layerTypes = this._settings.properties.layerTypes as LayerTypes[];
    }

    if (this._settings.properties?.scale !== undefined) {
      createSessionOptions.scale = this._settings.properties.scale as ScaleFactors;
    }

    if (this._settings.properties?.overlay !== undefined) {
      createSessionOptions.overlay = this._settings.properties.overlay as boolean;
    }
    return createSessionOptions;
  }

  // construct the Url from the desired Tile
  public async constructUrl(row: number, column: number, level: number): Promise<string> {
    const tmpUrl = urlTemplate.replace(levelToken, level.toString()).replace(columnToken, column.toString()).replace(rowToken, row.toString());
    const obj = new URL(tmpUrl);
    if (this._settings.accessKey ) {
      obj.searchParams.append("key", this._settings.accessKey.value);
    }

    // We assume the 'session' param to be already part of the query parameters (checked in initialize)
    return this.appendCustomParams(obj.toString());
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
      if (cartoRect) {
        try {
          const viewportInfo = await GoogleMapsUtils.getViewportInfo({
            rectangle: cartoRect,
            session: this._settings.collectQueryParams().session,
            key: this._settings.accessKey!.value,
            zoom});
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
    if (this._hadUnrecoverableError)
      return undefined;

    try {
      let tileUrl: string = await this.constructUrl(row, column, zoomLevel);
      let tileResponse: Response = await this.makeTileRequest(tileUrl);
      if (!tileResponse.ok) {
        if (tileResponse.headers.get("content-type")?.includes("application/json")) {
          // Session might have expired, lets try to re-new it.
          const isSessionCreated = await this.createSession();
          if (isSessionCreated) {
            tileUrl = await this.constructUrl(row, column, zoomLevel);
            tileResponse = await this.makeTileRequest(tileUrl);
            if (!tileResponse.ok) {
              if (tileResponse.headers.get("content-type")?.includes("application/json")) {
                await this.logJsonError(tileResponse);
              } else {
                Logger.logError(loggerCategory, `Error while loading tile: ${tileResponse.statusText}`);
              }
              this._hadUnrecoverableError = true;   // Prevent from doing more invalid requests
              return undefined;
            }
          } else {
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
    return IModelApp.tileAdmin.getTilesForUser(vp)?.selected
  }

  public override async addAttributions (cards: HTMLTableElement, vp: ScreenViewport): Promise<void> {
    let copyrightMsg = "";
    const tiles = this.getSelectedTiles(vp);
    if (tiles) {
      try {
        const attrList = await this.fetchAttributions(tiles);
        for (const attr of attrList) {
          attr.split(",").forEach((line) => {
            copyrightMsg += `${copyrightMsg.length===0 ? "": "<br"}${line}`;
        });
        }
      }
      catch (error: any) {
        Logger.logError(loggerCategory, `Error while loading attributions: ${error?.message??"Unknown error"}`);
      }
    }

    cards.appendChild(IModelApp.makeLogoCard({
      iconSrc: `${IModelApp.publicPath}images/google_on_white_hdpi.png`,
      heading: "Google Maps",
      notice: copyrightMsg }));
  }

}
