/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
/** @packageDocumentation
 * @module Tiles
 */
import { assert, IModelStatus } from "@itwin/core-bentley";
import { ImageMapLayerSettings, ServerError } from "@itwin/core-common";
import {
  MapLayerImageryProvider,
  MapLayerImageryProviderStatus,
  QuadId,
  WmsUtilities, WmtsCapabilities, WmtsCapability, WmtsConstants,
} from "../../../../tile/internal";

interface TileMatrixSetAndLimits { tileMatrixSet: WmtsCapability.TileMatrixSet, limits: WmtsCapability.TileMatrixSetLimits[] | undefined }

const tileMatrixSetToken = "{TileMatrixSet}";
const tileMatrixToken = "{TileMatrix}";
const tileColToken = "{TileCol}";
const tileRowToken = "{TileRow}";

export class WmtsMapLayerImageryProvider extends MapLayerImageryProvider {
  private _baseUrl: string;
  private _capabilities?: WmtsCapabilities;
  private _preferredLayerTileMatrixSet = new Map<string, TileMatrixSetAndLimits>();
  private _preferredLayerStyle = new Map<string, WmtsCapability.Style>();
  public displayedLayerName = "";
  private _resourceUrlTemplate?: string;
  private _maximumZoomLevel;
  public override get mutualExclusiveSubLayer(): boolean { return true; }

  constructor(settings: ImageMapLayerSettings) {
    super(settings, true);
    this._maximumZoomLevel = this.defaultMaximumZoomLevel;
    this._baseUrl = WmsUtilities.getBaseUrl(this._settings.url);
  }

  public override async initialize(): Promise<void> {
    try {
      this._capabilities = await WmtsCapabilities.create(this._baseUrl);
      this.initPreferredTileMatrixSet();
      this.initPreferredStyle();
      this.initDisplayedLayer();
      this.initCartoRange();
      this.initResourceUrl();

      if (this._preferredLayerTileMatrixSet.size === 0 || this._preferredLayerStyle.size === 0)
        throw new ServerError(IModelStatus.ValidationFailed, "");
    } catch (error: any) {
      // Don't throw error if unauthorized status:
      // We want the tile tree to be created, so that end-user can get feedback on which layer is missing credentials.
      // When credentials will be provided, a new provider will be created, and initialization should be fine.
      if (error?.status === 401) {
        this.setStatus(MapLayerImageryProviderStatus.RequireAuth);
      } else {
        throw new ServerError(IModelStatus.ValidationFailed, "");
      }
    }
  }

  public override get maximumZoomLevel(): number { return this._maximumZoomLevel; }

  private initDisplayedLayer() {
    const layers = this._capabilities?.contents?.layers;
    if (0 === this._settings.subLayers.length && layers && layers.length > 0) {
      // No sub-layers defined in settings, pick first layer from capabilities.
      this.displayedLayerName = layers[0].identifier;
      return;
    }

    // If sub-layers are defined in settings, pick the first one that is visible.
    const firstDisplayedLayer = this._settings.subLayers.find((subLayer) => subLayer.visible);
    this.displayedLayerName = firstDisplayedLayer ? firstDisplayedLayer.name : this._settings.subLayers[0].name;
  }


  private initResourceUrl() {
    const layersCapabilities = this._capabilities?.contents?.layers;
    if (undefined === layersCapabilities) {
      return;
    }

    const layerCapability  = layersCapabilities.find((layer) => layer.identifier === this.displayedLayerName);
    if (undefined === layerCapability) {
      return;
    }

    let resourceUrl = layerCapability.resourceUrls.find((url) => url.format.includes("png"));
    if (undefined === resourceUrl) {
      // If no PNG resource URL is found, try to find a JPEG one.
      resourceUrl = layerCapability.resourceUrls.find((url) => url.format.includes("jpeg") || url.format.includes("jpg"));
    }
    if (undefined !== resourceUrl
      && (resourceUrl.template.indexOf(tileMatrixToken) > 0
        && resourceUrl.template.indexOf(tileColToken) > 0
        && resourceUrl.template.indexOf(tileRowToken) > 0
      )
    ) {
      this._resourceUrlTemplate = resourceUrl.template;
    }
  }

  // Each layer can be served in multiple tile matrix set (i.e. TileTree).
  // We have to pick one for each layer: for now we look for a Google Maps compatible tile tree.
  private initPreferredTileMatrixSet() {
    const googleMapsTms = this._capabilities?.contents?.getGoogleMapsCompatibleTileMatrixSet();
    const wellGoogleKnownTms = googleMapsTms?.find((tms) => tms.wellKnownScaleSet?.toLowerCase().includes(WmtsConstants.GOOGLEMAPS_COMPATIBLE_WELLKNOWNNAME));

    this._capabilities?.contents?.layers.forEach((layer) => {
      let preferredTms: WmtsCapability.TileMatrixSet | undefined;

      if (wellGoogleKnownTms && layer.tileMatrixSetLinks.some((tmsl) => tmsl.tileMatrixSet === wellGoogleKnownTms.identifier)) {
        // Favor tile matrix set that was explicitly marked as GoogleMaps compatible
        preferredTms =  wellGoogleKnownTms;
      } else {

        // Search all compatible tile set matrix if previous attempt didn't work.
        // If more than one candidate is found, pick the tile set with the most LODs.
        let tileMatrixSets = googleMapsTms?.filter((tms) => {
          return layer.tileMatrixSetLinks.some((tmsl) => tmsl.tileMatrixSet === tms.identifier);
        });

        if (!tileMatrixSets || tileMatrixSets.length === 0) {
          const eps4326CompatibleTms = this._capabilities?.contents?.getEpsg4326CompatibleTileMatrixSet();
          tileMatrixSets = eps4326CompatibleTms?.filter((tms) => {
            return layer.tileMatrixSetLinks.some((tmsl) => tmsl.tileMatrixSet === tms.identifier);
          });
        }

        if (tileMatrixSets && tileMatrixSets.length === 1)
          preferredTms = tileMatrixSets[0];
        else if (tileMatrixSets && tileMatrixSets?.length > 1)
          preferredTms = tileMatrixSets.reduce((prev, current) => (prev.tileMatrix.length > current.tileMatrix.length) ? prev : current);

      }

      if (preferredTms !== undefined) {
        const tmsLink= layer.tileMatrixSetLinks.find((tmsl) => tmsl.tileMatrixSet === preferredTms.identifier);
        this._preferredLayerTileMatrixSet.set(layer.identifier, { tileMatrixSet: preferredTms, limits: tmsLink?.tileMatrixSetLimits } );
        this._maximumZoomLevel = Math.max(this._maximumZoomLevel, preferredTms.tileMatrix.length-1);
      }
    });
  }

  // Each layer can be published different style.  We look for a style flagged as 'Default'.
  private initPreferredStyle() {
    this._capabilities?.contents?.layers.forEach((layer) => {
      let preferredStyle: WmtsCapability.Style | undefined;
      if (layer.styles.length === 1)
        preferredStyle = layer.styles[0];
      else if (layer.styles.length > 1) {
        // If more than style is available, takes the default one, otherwise the first one.
        const defaultStyle = layer.styles.find((style) => style.isDefault);
        if (defaultStyle)
          preferredStyle = defaultStyle;
        else
          preferredStyle = layer.styles[0];
      }

      if (preferredStyle)
        this._preferredLayerStyle.set(layer.identifier, preferredStyle);
    });
  }

  private initCartoRange() {
    const activeLayer = this._capabilities?.contents?.layers.find((layer)=>layer.identifier === this.displayedLayerName);

    if (activeLayer?.wsg84BoundingBox) {
      if (this.cartoRange)
        this.cartoRange.extendRange(activeLayer.wsg84BoundingBox);
      else
        this.cartoRange = activeLayer.wsg84BoundingBox.clone();
    }

  }

  private getDisplayedTileMatrixSetAndLimits(): TileMatrixSetAndLimits | undefined {
    return  this._preferredLayerTileMatrixSet.get(this.displayedLayerName);
  }

  protected override _generateChildIds(quadId: QuadId, resolveChildren: (childIds: QuadId[]) => void) {
    const childIds = this.getPotentialChildIds(quadId);
    const matrixSetAndLimits = this.getDisplayedTileMatrixSetAndLimits();
    if (!matrixSetAndLimits) {
      assert(false);    // Must always hava a matrix set.
      return;
    }
    const childLevel = quadId.level + 1;
    const childMatrixId = matrixSetAndLimits.tileMatrixSet.tileMatrix.length > childLevel
      ? matrixSetAndLimits.tileMatrixSet.tileMatrix[childLevel].identifier
      : undefined;
    const limits = childMatrixId !== undefined
      ? matrixSetAndLimits.limits?.find((l) => l.tileMatrix === childMatrixId)?.limits
      : undefined;
    if (!limits) {
      resolveChildren(childIds);
      return;
    }

    const availableChildIds = [];
    for (const childId of childIds)
      if (limits.containsXY(childId.column, childId.row))
        availableChildIds.push(childId);

    resolveChildren(availableChildIds);
  }
  public override get useGeographicTilingScheme(): boolean {
    const matrixSetAndLimits = this.getDisplayedTileMatrixSetAndLimits();
    return matrixSetAndLimits ? (matrixSetAndLimits?.tileMatrixSet.identifier?.includes("4326") || matrixSetAndLimits?.tileMatrixSet.supportedCrs?.includes("4326")) : false;
  }

  public async constructUrl(row: number, column: number, zoomLevel: number): Promise<string> {

    const matrixSetAndLimits = this.getDisplayedTileMatrixSetAndLimits();
    const style = this._preferredLayerStyle.get(this.displayedLayerName);

    // Matrix identifier might be something other than standard 0..n zoom level,
    // so lookup the matrix identifier just in case.
    let tileMatrix;
    if (matrixSetAndLimits && matrixSetAndLimits.tileMatrixSet.tileMatrix.length > zoomLevel)
      tileMatrix = matrixSetAndLimits.tileMatrixSet.tileMatrix[zoomLevel].identifier;

    if (this._resourceUrlTemplate) {
      const tmpUrl = this._resourceUrlTemplate
      .replace(tileMatrixSetToken, matrixSetAndLimits?.tileMatrixSet.identifier??"")
      .replace(tileMatrixToken, tileMatrix??zoomLevel.toString())
      .replace(tileColToken, column.toString())
      .replace(tileRowToken, row.toString());
      return this.appendCustomParams(tmpUrl);
    }

    const styleParam = (style?.identifier === undefined ? "" : `&style=${style.identifier}`);
    if (tileMatrix !== undefined && matrixSetAndLimits !== undefined) {
      const tmpUrl = `${this._baseUrl}?Service=WMTS&Version=1.0.0&Request=GetTile&Format=image%2Fpng&layer=${this.displayedLayerName}${styleParam}&TileMatrixSet=${matrixSetAndLimits.tileMatrixSet.identifier}&TileMatrix=${tileMatrix}&TileCol=${column}&TileRow=${row}`;
      return this.appendCustomParams(tmpUrl);
    }
    return "";
  }
}
