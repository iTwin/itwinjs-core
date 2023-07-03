/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/

import * as sinon from "sinon";
import { NewYorkDataset } from "./NewYorkDataset";
import { ArcGisSymbologyRenderer } from "../../ArcGisFeature/ArcGisSymbologyRenderer";
import { PhillyLandmarksDataset } from "./PhillyLandmarksDataset";
import { EsriPMS, EsriSFS, EsriSLS , EsriUniqueValueRenderer } from "../../ArcGisFeature/EsriSymbology";
import { NeptuneCoastlineDataset } from "./NeptuneCoastlineDataset";

import * as chai from "chai";
import * as chaiAsPromised from "chai-as-promised";
const expect = chai.expect;
chai.use(chaiAsPromised);

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

    const info = NeptuneCoastlineDataset.uniqueValueSFSDrawingInfo;
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

  it("should provided fill color using simple renderer definition", async () => {

    const provider = new ArcGisSymbologyRenderer("esriGeometryPolygon", PhillyLandmarksDataset.polygonDrawingInfo.drawingInfo.renderer);
    const fakeContext = {fillStyle: ""};
    provider.applyFillStyle(fakeContext as CanvasRenderingContext2D);

    const refSymbol = EsriSFS.fromJSON(PhillyLandmarksDataset.polygonDrawingInfo.drawingInfo.renderer.symbol as any);
    expect(fakeContext.fillStyle).to.eq(refSymbol.color!.toRgbaString());
  });

  it("should apply proper fill color using unique value SFS renderer definition", async () => {
    const rendererDef = NeptuneCoastlineDataset.uniqueValueSFSDrawingInfo.drawingInfo.renderer;
    const provider = new ArcGisSymbologyRenderer("esriGeometryPolygon", rendererDef);

    const fakeContext = {fillStyle: ""};
    // Make sure default symbology is applied if 'setActiveFeatureAttributes' has never been called
    provider.applyFillStyle(fakeContext as CanvasRenderingContext2D);
    let refSymbol = (provider as any)._defaultSymbol;
    expect(fakeContext.fillStyle).to.eq(refSymbol.color.toRgbaString());

    // Now set proper attribute
    // eslint-disable-next-line quote-props, @typescript-eslint/naming-convention
    provider.setActiveFeatureAttributes({"LU_2014": "Urban/Built-up"});
    provider.applyFillStyle(fakeContext as CanvasRenderingContext2D);
    refSymbol = EsriSFS.fromJSON(rendererDef.uniqueValueInfos[1].symbol as any);
    expect(fakeContext.fillStyle).to.eq(refSymbol.color.toRgbaString());

    // check that we fallback to default symbology if empty attributes are now set
    provider.setActiveFeatureAttributes({});
    fakeContext.fillStyle = "";
    provider.applyFillStyle(fakeContext as CanvasRenderingContext2D);
    refSymbol = (provider as any)._defaultSymbol;
    expect(fakeContext.fillStyle).to.eq(refSymbol.color.toRgbaString());
  });

  it("should apply proper stroke color using unique value SFS renderer definition", async () => {
    const rendererDef = NeptuneCoastlineDataset.uniqueValueSFSDrawingInfo.drawingInfo.renderer;
    const provider = new ArcGisSymbologyRenderer("esriGeometryPolygon", rendererDef);

    const fakeContext = {strokeStyle: ""};
    // Make sure default symbology is applied if 'setActiveFeatureAttributes' has never been called
    provider.applyStrokeStyle(fakeContext as CanvasRenderingContext2D);
    let refSymbol = (provider as any)._defaultSymbol;
    expect(fakeContext.strokeStyle).to.eq(refSymbol.outline.color.toRgbaString());

    // Now set proper attribute
    // eslint-disable-next-line quote-props, @typescript-eslint/naming-convention
    provider.setActiveFeatureAttributes({"LU_2014": "Urban/Built-up"});
    provider.applyStrokeStyle(fakeContext as CanvasRenderingContext2D);
    refSymbol = EsriSFS.fromJSON(rendererDef.uniqueValueInfos[1].symbol as any);
    expect(fakeContext.strokeStyle).to.eq(refSymbol.outline.color!.toRgbaString());

    // check that we fallback to default symbology if empty attributes are now set
    provider.setActiveFeatureAttributes({});
    fakeContext.strokeStyle = "";
    provider.applyStrokeStyle(fakeContext as CanvasRenderingContext2D);
    refSymbol = (provider as any)._defaultSymbol;
    expect(fakeContext.strokeStyle).to.eq(refSymbol.outline.color!.toRgbaString());
  });

  it("should apply proper stroke color using unique value SLS renderer definition", async () => {
    const rendererDef = NeptuneCoastlineDataset.uniqueValueSLSDrawingInfo.drawingInfo.renderer;
    const provider = new ArcGisSymbologyRenderer("esriGeometryLine", rendererDef);

    const fakeContext = {strokeStyle: ""};
    // Make sure default symbology is applied if 'setActiveFeatureAttributes' has never been called
    provider.applyStrokeStyle(fakeContext as CanvasRenderingContext2D);
    let refSymbol = (provider as any)._defaultSymbol;
    expect(fakeContext.strokeStyle).to.eq(refSymbol.color.toRgbaString());

    // Now set proper attribute
    // eslint-disable-next-line quote-props, @typescript-eslint/naming-convention
    provider.setActiveFeatureAttributes({"LU_2014": "Urban/Built-up"});
    provider.applyStrokeStyle(fakeContext as CanvasRenderingContext2D);
    refSymbol = EsriSFS.fromJSON(rendererDef.uniqueValueInfos[1].symbol as any);
    expect(fakeContext.strokeStyle).to.eq(refSymbol.color!.toRgbaString());

    // check that we fallback to default symbology if empty attributes are now set
    provider.setActiveFeatureAttributes({});
    fakeContext.strokeStyle = "";
    provider.applyStrokeStyle(fakeContext as CanvasRenderingContext2D);
    refSymbol = (provider as any)._defaultSymbol;
    expect(fakeContext.strokeStyle).to.eq(refSymbol.color!.toRgbaString());
  });

  it.only("should apply proper marker using unique value PMS renderer definition", async () => {
    const rendererDef = NewYorkDataset.uniqueValueDrawingInfo.drawingInfo.renderer;
    const provider = new ArcGisSymbologyRenderer("esriGeometryPoint", rendererDef);

    class FakeContext {
      public image: any;
      public drawImage(image: CanvasImageSource, _dx: number, _dy: number, _dw: number, _dh: number) {
        this.image = image;
      }
    }
    const fakeContext = new FakeContext();

    const getRefImageSrc = (markerSymbol: any) => `data:${markerSymbol.contentType};base64,${markerSymbol.imageData}`;
    // Make sure default symbology is applied if 'setActiveFeatureAttributes' has never been called
    provider.drawPoint((fakeContext as unknown) as CanvasRenderingContext2D, 0 ,0);
    let refSymbol = (provider as any)._defaultSymbol;
    expect(fakeContext.image.src).to.eq(getRefImageSrc(refSymbol));

    // Now set proper attribute
    // eslint-disable-next-line quote-props, @typescript-eslint/naming-convention
    provider.setActiveFeatureAttributes({"WEAPON": "gun"});
    provider.drawPoint((fakeContext as unknown) as CanvasRenderingContext2D, 0 ,0);
    refSymbol = EsriPMS.fromJSON(rendererDef.uniqueValueInfos[2].symbol as any);
    expect(fakeContext.image.src).to.eq(getRefImageSrc(refSymbol));

    // check that we fallback to default symbology if empty attributes are now set
    provider.setActiveFeatureAttributes({});
    fakeContext.image = undefined;
    provider.drawPoint((fakeContext as unknown) as CanvasRenderingContext2D, 0 ,0);
    refSymbol = (provider as any)._defaultSymbol;
    expect(fakeContext.image.src).to.eq(getRefImageSrc(refSymbol));
  });

  it("should throw when creating a symbology renderer with invalid geometry type", async () => {

    const renderer = PhillyLandmarksDataset.phillySimplePointDrawingInfo.drawingInfo.renderer;
    expect(()=> new ArcGisSymbologyRenderer("esriGeometryAny", renderer)).to.throw( Error, "Could not determine default symbology: geometry type not supported");

  });

}); // end test suite
