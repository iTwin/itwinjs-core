import { ImageMapLayerSettings, ImageSource } from "@itwin/core-common";
import { DecorateContext, IModelApp, MapCartoRectangle, MapLayerImageryProvider, MapLayerSourceStatus, MapLayerSourceValidation, ScreenViewport, TileUrlImageryProvider } from "@itwin/core-frontend";
import { CreateGoogleMapsSessionOptions, GoogleMaps, GoogleMapsMapType } from "./GoogleMaps";
import { BentleyError, BentleyStatus, Logger } from "@itwin/core-bentley";
const loggerCategory = "MapLayersFormats.GoogleMaps";
const levelToken = "{level}";
const rowToken = "{row}";
const columnToken = "{column}";

/** Number of load tile requests before we have to refresh the attributions data  */
const attributionsRefreshCount = 40;

export class GoogleMapsImageryProvider extends MapLayerImageryProvider {

  private static _sessions: {[layerName: string]: string} = {};
  private _attributions: string[]|undefined;
  private _loadTileCounter = 0;
  private _subLayerName = "";
  constructor(settings: ImageMapLayerSettings) {
    super(settings, true);
  }
  public static validateUrlTemplate(template: string): MapLayerSourceValidation {
    return { status: (template.indexOf(levelToken) > 0 && template.indexOf(columnToken) > 0 && template.indexOf(rowToken) > 0) ? MapLayerSourceStatus.Valid : MapLayerSourceStatus.InvalidUrl };
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

    const sessionOptions = this.createCreateSessionOptions();
    if (this._settings.accessKey ) {
      // Create session and store in query parameters
      const sessionObj = await GoogleMaps.createSession(this._settings.accessKey.value, sessionOptions);
      this._settings.unsavedQueryParams = {session: sessionObj.session};
    } else {
      Logger.logError(loggerCategory, `Missing GoogleMaps api key/`);
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

      mapType: this._settings.properties!.mapType as GoogleMapsMapType,
      region: this._settings.properties!.region as string,
      language: this._settings.properties!.language as string,
    }
    if (this._settings.properties?.orientation !== undefined) {
      createSessionOptions.orientation = this._settings.properties!.orientation as number;
    }

    if (this._settings.properties?.layerTypes !== undefined) {
      createSessionOptions.layerTypes = this._settings.properties!.layerTypes as string[];
    }
    return createSessionOptions;

    }

  // construct the Url from the desired Tile
  public async constructUrl(row: number, column: number, level: number): Promise<string> {
    let url = this._settings.url;
    if (TileUrlImageryProvider.validateUrlTemplate(url).status !== MapLayerSourceStatus.Valid) {
      if (url.lastIndexOf("/") !== url.length - 1)
        url = `${url}/`;
      url = `${url}{level}/{column}/{row}.png`;
    }

    const tmpUrl = url.replace(levelToken, level.toString()).replace(columnToken, column.toString()).replace(rowToken, row.toString());
    const obj = new URL(tmpUrl);
    if (this._settings.accessKey ) {
      obj.searchParams.append("key", this._settings.accessKey.value);
    }

    // We 'session' param to be already part of the query parameters
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

  public override async loadTile(row: number, column: number, zoomLevel: number): Promise<ImageSource | undefined> {
    // This is a hack until 'addLogoCards' is made async
    if ((this._loadTileCounter++%attributionsRefreshCount  === 0)) {
      this._attributions = await this.getAttributions(row, column, zoomLevel);
    }

    return super.loadTile(row, column, zoomLevel);
  }

  public override decorate(context: DecorateContext): void {
    context.viewport.invalidateDecorations();
    console.log("GoogleMapsImageryProvider.decorate");
  }

  public override addLogoCards(cards: HTMLTableElement, _vp: ScreenViewport): void {
    // const tiles = IModelApp.tileAdmin.getTilesForUser(vp)?.selected;
    // const matchingAttributions = this.getMatchingAttributions(tiles);
    // const copyrights: string[] = [];
    // for (const match of matchingAttributions)
    //   copyrights.push(match.copyrightMessage);

    // let copyrightMsg = "";
    // for (let i = 0; i < copyrights.length; ++i) {
    //   if (i > 0)
    //     copyrightMsg += "<br>";
    //   copyrightMsg += copyrights[i];
    // }
    // const tiles = IModelApp.tileAdmin.getTilesForUser(vp)?.selected;
    // const attributions = await this.getAttributions(tiles);
    if (!this._attributions)
      return;

    const attributions = this._attributions;
    let copyrightMsg = "";
    for (let i = 0; i < attributions.length; ++i) {
      if (i > 0)
        copyrightMsg += "<br>";
      copyrightMsg += attributions[i];
    }

    cards.appendChild(IModelApp.makeLogoCard({ iconSrc: `${IModelApp.publicPath}images/google_on_white_hdpi.png`, heading: "Google Maps", notice: copyrightMsg }));
  }
}
