/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
/* eslint-disable no-console */
import { DecorateContext, Decorator, IModelApp, ScreenViewport } from "@bentley/imodeljs-frontend";
import { EsriFeatureJSON, TypedRenderGraphic } from "./EsriFeatureJSON";
import { request, RequestOptions } from "@bentley/itwin-client";
import { ClientRequestContext } from "@bentley/bentleyjs-core";
import { EsriFeatureQueryUrl } from "./EsriFeatureQueryUrl";
import { Range2d, Range3d } from "@bentley/geometry-core";
import { CartographicRange } from "@bentley/imodeljs-common";

export class EsriFeatureDecorator implements Decorator {
  public readonly useCachedDecorations = true;
  public readonly fetchAllDataOnce = true;
  public readonly cacheGraphics = false;

  // For simplicity, there is a single instance of this class in the application
  // We will need to revisit that later.
  private static _decorator: EsriFeatureDecorator;

  private _data: string|undefined;
  private _cachedGraphics: TypedRenderGraphic[]|undefined;
  private _prevRange: Range2d|undefined;
  private _loading = false;

  private _esriJsonFormat = new EsriFeatureJSON();

  public static get decorator(): EsriFeatureDecorator {

    if (this._decorator === undefined) {
      this._decorator = new EsriFeatureDecorator();
    }
    return this._decorator;
  }

  public async initialize() {
    /*
    const options: RequestOptions = {
      method: "GET",
      responseType: "text",
      timeout: { response: 20000 },
    };

    // Quebec province extent: (-8852112.424497, 5643192.737102) - (-7058565.172297, 6715441.241859)
    const url = new EsriFeatureQueryUrl("https://dtlgeoarcgis.adtl.com/server/rest/services/SampleWorldCities/FeatureServer",
      0,
      {
        envelopeFilter: new Range2d(-8852112.424497, 5643192.737102, -7058565.172297, 6715441.241859),
        userName: "test",
        password: "test",
      });
    const urlStr = await url.toString();
    const data = await request(new ClientRequestContext(""), urlStr, options);
    if (data.status === 200 && data.text !== undefined) {
      this._data = data.text;
    }
    */
  }

  protected getFrustumLonLatBBox(vp: ScreenViewport): CartographicRange | undefined {
    if (vp === undefined) {
      return undefined;
    }

    const view = vp.view;
    const ecef = vp.iModel.ecefLocation;
    if (!view.isSpatialView() || undefined === ecef) {
      return undefined;
    }

    const frustum = view.calculateFrustum();
    if (!frustum) {
      return undefined;
    }

    const viewRange = Range3d.createArray(frustum.points);
    return new CartographicRange(viewRange, ecef.getTransform());
  }

  protected async requestData(extent: CartographicRange|undefined): Promise<string|undefined> {
    const options: RequestOptions = {
      method: "GET",
      responseType: "text",
      timeout: { response: 20000 },
    };

    // Quebec province extent: (-8852112.424497, 5643192.737102) - (-7058565.172297, 6715441.241859)
    const url = new EsriFeatureQueryUrl("https://dtlgeoarcgis.adtl.com/server/rest/services/SampleWorldCities/FeatureServer",
      0,
      {
        // envelopeFilter: new Range2d(-8852112.424497, 5643192.737102, -7058565.172297, 6715441.241859),
        envelopeFilter: extent,
        userName: "test",
        password: "test",
      });
    const urlStr = await url.toString();
    const data = await request(new ClientRequestContext(""), urlStr, options);
    if (data.status === 200 && data.text !== undefined) {
      return data.text;
    }
    return undefined;
  }

  public decorate(context: DecorateContext): void {

    // Use previously generated graphics
    if (this.cacheGraphics && this._cachedGraphics !== undefined) {
      this._cachedGraphics?.forEach((graphic) => {
        context.addDecoration(graphic.type, graphic.graphic);
      });
      return;
    }

    // Re-use data previously fetched and re-create the graphics
    if (undefined !== this._data) {
      const graphics = this._esriJsonFormat.readRenderGraphics(this._data, context);

      if (this.cacheGraphics) {
        this._cachedGraphics = graphics;
      }
      graphics?.forEach((graphic) => {
        context.addDecoration(graphic.type, graphic.graphic);
      });

      // In the FetchAll data mode, the intial request loads all the data, and no further request is needed.
      if (this.fetchAllDataOnce)
        return;

    }

    if (this._loading) {
      return;
    }

    // Check view type, project extents is only applicable to show in spatial views.
    const vp = context.viewport;
    if (!vp.view.isSpatialView())
      return;

    const cartoRange = this.getFrustumLonLatBBox(vp);

    if (cartoRange === undefined)
      return;

    const curViewBbox = cartoRange.getLongitudeLatitudeBoundingBox();

    // console.log(`decorate view range ${curViewBbox.toJSON()}`);
    // console.log(`decorate prev range ${this._prevRange?.toJSON()}`);
    if (this._prevRange === undefined || !this.rangeAlmostEqual(curViewBbox, this._prevRange)) {

      this._loading = true;
      this._prevRange = curViewBbox;

      const extent = this.fetchAllDataOnce ? undefined : cartoRange;
      // eslint-disable-next-line @typescript-eslint/no-floating-promises
      this.requestData(extent).then(async (fetchedData)=> {
        this._data = fetchedData;
        this._loading = false;
        vp.invalidateDecorations();
      });

    }
  }

  public rangeAlmostEqual(range1: Range2d, range2: Range2d): boolean {
    return (range1.low.isAlmostEqual(range2.low, 0.01) && range1.high.isAlmostEqual(range2.high, 0.01))
      || (range1.isNull && range2.isNull);
  }
}
