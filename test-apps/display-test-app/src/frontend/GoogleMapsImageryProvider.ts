import { ImageMapLayerSettings, ImageSource } from "@itwin/core-common";
import { IModelApp, MapCartoRectangle, MapLayerImageryProvider, MapLayerSourceStatus, MapLayerSourceValidation, MapTile, QuadId, ScreenViewport, Tile, TileUrlImageryProvider } from "@itwin/core-frontend";
import { Angle } from "@itwin/core-geometry";
import { GoogleMaps } from "./GoogleMaps";

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

    if (this._settings.subLayers.length === 0) {
      return;
    }
    const subLayer = this._settings.subLayers[0];
    this._subLayerName = subLayer.name;
    if (subLayer.title === undefined) {
      console.log(`Missing subLayer title`);
      return;
    }
    if (GoogleMapsImageryProvider._sessions[this._subLayerName] !== undefined) {
      console.log(`Session already exists for layer ${this._subLayerName}`);
    }

    const opts = JSON.parse(subLayer.title);
    GoogleMapsImageryProvider._sessions[subLayer.name] = (await GoogleMaps.createSession(GoogleMaps.apiKey, opts)).session;
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
    const sessionId = GoogleMapsImageryProvider._sessions[this._subLayerName];
    if (sessionId && GoogleMaps.apiKey ) {
      obj.searchParams.append("session", sessionId);
      obj.searchParams.append("key", GoogleMaps.apiKey);
    } else {
      console.log(`Missing apiKey or sessionId`);
    }

    return this.appendCustomParams(obj.toString());
  }

  private async getAttributions(row: number, column: number, zoomLevel: number): Promise<string[]> {
    let attributions: string[] = [];
    const queryParams = this._settings.collectQueryParams();

    const key = GoogleMaps.apiKey;
    const session = GoogleMapsImageryProvider._sessions[this._subLayerName];
    if (session === undefined || key === undefined) {
      console.log(`Missing apiKey or sessionId`);
      return attributions;
    }

    const extent = this.getEPSG4326Extent(row, column, zoomLevel);
    const range = MapCartoRectangle.fromDegrees(extent.longitudeLeft, extent.latitudeBottom, extent.longitudeRight, extent.latitudeTop);

    if (!session) {

      return attributions;
    }
    try {
      const viewportInfo = await GoogleMaps.getViewportInfo(range, zoomLevel, session, key);
      if (viewportInfo) {
        attributions = viewportInfo.copyright.split(",");
      }
    } catch (err: any) {

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
