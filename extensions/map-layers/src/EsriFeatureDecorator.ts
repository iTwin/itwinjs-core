/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
/* eslint-disable no-console */
import { DecorateContext, Decorator, GraphicPrimitive, GraphicType, IModelApp, ScreenViewport } from "@bentley/imodeljs-frontend";
import { EsriFeatureJSON } from "./EsriFeatureJSON";
import { request, RequestOptions } from "@bentley/itwin-client";
import { ClientRequestContext } from "@bentley/bentleyjs-core";
import { EsriFeatureQueryUrl } from "./EsriFeatureQueryUrl";
import { Range2d, Range3d } from "@bentley/geometry-core";
import { CartographicRange, ColorDef } from "@bentley/imodeljs-common";

export class EsriFeatureDecorator implements Decorator {
  public serverUrl:string|undefined;
  public userName:string|undefined;
  public password:string|undefined;
  public layerId:number|undefined;
  public readonly useCachedDecorations = true;
  public fetchAllDataOnce = true;
  public cacheGraphics = false;

  // For simplicity, there is a single instance of this class in the application
  // We will need to revisit that later.
  private static _decorator: EsriFeatureDecorator;

  // private _data: string|undefined;
  private _loading = false;
  private _cachedPrimitives: GraphicPrimitive[]|undefined;
  private _prevRange: Range2d|undefined;

  private _esriJsonFormat = new EsriFeatureJSON();

  public static get decorator(): EsriFeatureDecorator {

    if (this._decorator === undefined) {
      this._decorator = new EsriFeatureDecorator();
    }
    return this._decorator;
  }

  protected constructor() {

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
    if (this.serverUrl == undefined || this.layerId == undefined) {
      return;
    }

    const options: RequestOptions = {
      method: "GET",
      responseType: "text",
      timeout: { response: 20000 },
    };

    const url = new EsriFeatureQueryUrl(this.serverUrl,
      this.layerId,
      {
        envelopeFilter: extent,
        userName: this.userName,
        password: this.password,
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
    if (this._cachedPrimitives !== undefined) {

    this.loadPrimitives(context);

    // In the FetchAll data mode, the initial request loads all the data, and no further request is needed.
    if (this.fetchAllDataOnce)
          return;
    }

    if (!this._loading) {
      // don't fetch data again if already fetching
      this.fetchData(context);
    }
  }

  protected fetchData(context: DecorateContext) {
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

      //this._data = undefined;
      this._prevRange = curViewBbox;

      const extent = this.fetchAllDataOnce ? undefined : cartoRange;
      // eslint-disable-next-line @typescript-eslint/no-floating-promises
      this._loading = true;
      this.requestData(extent).then(async (fetchedData)=> {
        this._loading = false;
        if (fetchedData != undefined) {
          //this._data = fetchedData;
          this._cachedPrimitives  = this._esriJsonFormat.readPrimitives(fetchedData, context);

        }

        vp.invalidateDecorations();
      });

    }
  }

  protected loadPrimitives(context: DecorateContext) {
    if (this._cachedPrimitives === undefined) {
      return;
    }

    const builder = context.createGraphicBuilder(GraphicType.WorldDecoration);
    builder.setSymbology(ColorDef.blue, ColorDef.blue, 15 /* lineWidth */);

    const nbDuplicate = 0;  // for testing performance
    for (let i=0; i<=nbDuplicate; ++i) {
      for (const primitive of this._cachedPrimitives ) {
        builder.addPrimitive(primitive);
      }
    }
    context.addDecoration(builder.type, builder.finish());
  }

  protected rangeAlmostEqual(range1: Range2d, range2: Range2d): boolean {
    return (range1.low.isAlmostEqual(range2.low, 0.01) && range1.high.isAlmostEqual(range2.high, 0.01))
      || (range1.isNull && range2.isNull);
  }
}
