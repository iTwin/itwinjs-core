/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
import { expect } from "chai";
import * as sinon from "sinon";
import { NewYorkDataset } from "./NewYorkDataset";
import { ArcGisSymbologyRenderer } from "../../ArcGisFeature/ArcGisSymbologyRenderer";
import { PhillyLandmarksDataset } from "./PhillyLandmarksDataset";
import { EsriPMS, EsriSFS, EsriSLS , EsriUniqueValueRenderer } from "../../ArcGisFeature/EsriSymbology";
import { NeptuneCoastlineDataset } from "./NeptuneCoastlineDataset";

describe("ArcGisSymbologyRenderer", () => {

  const sandbox = sinon.createSandbox();

  afterEach(async () => {
    sandbox.restore();
  });

  const comparePointSymbol = (symbol1: EsriPMS, symbol2: EsriPMS ) => {
    expect(symbol1.type).to.equals(symbol2.type);
    expect(symbol1.contentType).to.equals(symbol2.contentType);
    expect(symbol1.height).to.equals(symbol2.height);
    expect(symbol1.width).to.equals(symbol2.width);
    expect(symbol1.imageData).to.equals(symbol2.imageData);
  };

  const compareLineSymbol = (symbol1: EsriSLS, symbol2: EsriSLS ) => {
    expect(symbol1.type).to.equals(symbol2.type);
    expect(symbol1.color).to.equals(symbol2.color);
    expect(symbol1.width).to.equals(symbol2.width);
    expect(symbol1.style).to.equals(symbol2.style);
  };

  const comparePolySymbol = (symbol1: EsriSLS, symbol2: EsriSFS ) => {
    expect(symbol1.type).to.equals(symbol2.type);
    expect(symbol1.color).to.equals(symbol2.color);
    expect(symbol1.style).to.equals(symbol2.style);
  };

  it("should construct renderer from incomplete drawing info", async () => {
    let provider = new ArcGisSymbologyRenderer("esriGeometryPoint", NewYorkDataset.incompleteDrawingInfo.drawingInfo.renderer);
    comparePointSymbol((provider as any)._symbol, EsriPMS.fromJSON((ArcGisSymbologyRenderer as any).defaultPMS));

    provider = new ArcGisSymbologyRenderer("esriGeometryMultipoint", NewYorkDataset.incompleteDrawingInfo.drawingInfo.renderer);
    comparePointSymbol((provider as any)._symbol, EsriPMS.fromJSON((ArcGisSymbologyRenderer as any).defaultPMS));

    provider = new ArcGisSymbologyRenderer("esriGeometryPolyline", NewYorkDataset.incompleteDrawingInfo.drawingInfo.renderer);
    compareLineSymbol((provider as any)._symbol, EsriSLS.fromJSON((ArcGisSymbologyRenderer as any).defaultSLS));

    provider = new ArcGisSymbologyRenderer("esriGeometryLine", NewYorkDataset.incompleteDrawingInfo.drawingInfo.renderer);
    compareLineSymbol((provider as any)._symbol,  EsriSLS.fromJSON((ArcGisSymbologyRenderer as any).defaultSLS));

    provider = new ArcGisSymbologyRenderer("esriGeometryPolygon", NewYorkDataset.incompleteDrawingInfo.drawingInfo.renderer);
    comparePolySymbol((provider as any)._symbol, EsriSFS.fromJSON((ArcGisSymbologyRenderer as any).defaultSFS));

  });

  it("should construct renderer from unique value drawing info", async () => {
    const provider = new ArcGisSymbologyRenderer("esriGeometryPoint", NewYorkDataset.uniqueValueDrawingInfo.drawingInfo.renderer);
    comparePointSymbol((provider as any)._symbol, NewYorkDataset.uniqueValueDrawingInfo.drawingInfo.renderer.defaultSymbol as any);

  });

  it("should construct renderer from point symbology drawing info", async () => {

    let provider = new ArcGisSymbologyRenderer("esriGeometryPoint", PhillyLandmarksDataset.pointDrawingInfo.drawingInfo.renderer);
    comparePointSymbol((provider as any)._symbol, PhillyLandmarksDataset.pointDrawingInfo.drawingInfo.renderer.symbol as any);

    provider = new ArcGisSymbologyRenderer("esriGeometryPolyline", PhillyLandmarksDataset.lineDrawingInfo.drawingInfo.renderer);
    comparePointSymbol((provider as any)._symbol, PhillyLandmarksDataset.lineDrawingInfo.drawingInfo.renderer.symbol as any);

    provider = new ArcGisSymbologyRenderer("esriGeometryPolygon", PhillyLandmarksDataset.polygonDrawingInfo.drawingInfo.renderer);
    comparePointSymbol((provider as any)._symbol, PhillyLandmarksDataset.polygonDrawingInfo.drawingInfo.renderer.symbol as any);

  });

  it("should construct unique value renderer", async () => {

    const info = NeptuneCoastlineDataset.uniqueValueDrawingInfo;
    const renderer =  EsriUniqueValueRenderer.fromJSON(info.drawingInfo.renderer as any);
    expect(renderer.field1).equals(info.drawingInfo.renderer.field1);
    expect(renderer.field2).to.be.undefined;
    expect(renderer.field3).to.be.undefined;
    expect(renderer.type).equals(info.drawingInfo.renderer.type);
    expect(renderer.uniqueValueInfos.length).equals(info.drawingInfo.renderer.uniqueValueInfos.length);
    for (let i = 0 ; i < renderer.uniqueValueInfos.length; i++) {
      const lhs = renderer.uniqueValueInfos[i];
      const rhs = info.drawingInfo.renderer.uniqueValueInfos[i];
      expect(lhs.value).equals(rhs.value);
      expect(lhs.label).equals(rhs.label);
      expect(lhs.description).equals(rhs.description);
      expect(lhs.symbol.type).equals(rhs.symbol.type);
    }
  });

}); // end test suite
