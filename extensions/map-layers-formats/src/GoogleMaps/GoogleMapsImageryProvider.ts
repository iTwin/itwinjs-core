import { ImageMapLayerSettings, ImageSource } from "@itwin/core-common";
import { DecorateContext, IModelApp, MapCartoRectangle, MapLayerImageryProvider, MapLayerSourceStatus, MapLayerSourceValidation, ScreenViewport, TileUrlImageryProvider } from "@itwin/core-frontend";
import { CreateGoogleMapsSessionOptions, GoogleMaps, LayerTypesType, MapTypesType } from "./GoogleMaps";
import { BentleyError, BentleyStatus, Logger } from "@itwin/core-bentley";
import { GoogleMapsDecorator } from "./GoogleMapDecorator";
const loggerCategory = "MapLayersFormats.GoogleMaps";
const levelToken = "{level}";
const rowToken = "{row}";
const columnToken = "{column}";

const urlTemplate = `https://tile.googleapis.com/v1/2dtiles/${levelToken}/${columnToken}/${rowToken}`;

/*
* Google Maps imagery provider
* @internal
*/
export class GoogleMapsImageryProvider extends MapLayerImageryProvider {

  private _decorator: GoogleMapsDecorator;
  private _hadUnrecoverableError = false;
  constructor(settings: ImageMapLayerSettings) {
    super(settings, true);
    this._decorator = new GoogleMapsDecorator();
  }
  public static validateUrlTemplate(template: string): MapLayerSourceValidation {
    return { status: (template.indexOf(levelToken) > 0 && template.indexOf(columnToken) > 0 && template.indexOf(rowToken) > 0) ? MapLayerSourceStatus.Valid : MapLayerSourceStatus.InvalidUrl };
  }

  protected async createSession() : Promise<boolean> {
    const sessionOptions = this.createCreateSessionOptions();
    if (this._settings.accessKey ) {
      // Create session and store in query parameters
      const sessionObj = await GoogleMaps.createSession(this._settings.accessKey.value, sessionOptions);
      this._settings.unsavedQueryParams = {session: sessionObj.session};
      return true;
    } else {
      Logger.logError(loggerCategory, `Missing GoogleMaps api key/`);
      return false;
    }
  }

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

    const isSessionCreated = await this.createSession();
    if (!isSessionCreated) {
      const msg = `Failed to create session`;
      Logger.logError(loggerCategory, msg);
      throw new BentleyError(BentleyStatus.ERROR, msg);
    }

    const isActivated = await this._decorator.activate(this._settings.properties!.mapType as MapTypesType);
    if (!isActivated) {
      const msg = `Failed to activate decorator`;
      Logger.logError(loggerCategory, msg);
      throw new BentleyError(BentleyStatus.ERROR, msg);
    }
  }

  private createCreateSessionOptions(): CreateGoogleMapsSessionOptions {
    const layerPropertyKeys = this._settings.properties ? Object.keys(this._settings.properties) : undefined;
    if (layerPropertyKeys === undefined ||
        !layerPropertyKeys.includes("mapType") ||
        !layerPropertyKeys.includes("language") ||
        !layerPropertyKeys.includes("region")) {
      const msg = "Missing session options";
      Logger.logError(loggerCategory, msg);
      throw new BentleyError(BentleyStatus.ERROR, msg);
    }

    const createSessionOptions: CreateGoogleMapsSessionOptions = {

      mapType: this._settings.properties!.mapType as MapTypesType,
      region: this._settings.properties!.region as string,
      language: this._settings.properties!.language as string,
    }

    if (this._settings.properties?.layerTypes !== undefined) {
      createSessionOptions.layerTypes = this._settings.properties!.layerTypes as LayerTypesType[];
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

  private async getAttributions(row: number, column: number, zoomLevel: number): Promise<string[]> {
    let attributions: string[] = [];
    const session = this._settings.collectQueryParams().session;
    const key = this._settings.accessKey?.value;
    if (!session || !key) {
      return attributions;
    }

    const extent = this.getEPSG4326Extent(row, column, zoomLevel);
    const range = MapCartoRectangle.fromDegrees(extent.longitudeLeft, extent.latitudeBottom, extent.longitudeRight, extent.latitudeTop);

    try {
      const viewportInfo = await GoogleMaps.getViewportInfo(range, zoomLevel, session, key);
      if (viewportInfo) {
        attributions = viewportInfo.copyright.split(",");
      }
    } catch {

    }
    return attributions;
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

  public override addLogoCards(cards: HTMLTableElement, _vp: ScreenViewport): void {
    const attributions: string[] = [];
    let copyrightMsg = "";
    for (let i = 0; i < attributions.length; ++i) {
      if (i > 0)
        copyrightMsg += "<br>";
      copyrightMsg += attributions[i];
    }

    cards.appendChild(IModelApp.makeLogoCard({ iconSrc: `${IModelApp.publicPath}images/google_on_white_hdpi.png`, heading: "Google Maps", notice: copyrightMsg }));
  }
}
