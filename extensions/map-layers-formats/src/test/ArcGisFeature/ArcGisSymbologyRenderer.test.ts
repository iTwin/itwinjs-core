/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/

import * as sinon from "sinon";
import { NewYorkDataset } from "./NewYorkDataset";
import { ArcGisSymbologyRenderer, ArcGisUniqueValueSymbologyRenderer } from "../../ArcGisFeature/ArcGisSymbologyRenderer";
import { PhillyLandmarksDataset } from "./PhillyLandmarksDataset";
import { EsriPMS, EsriRenderer, EsriSFS, EsriSLS , EsriUniqueValueRenderer } from "../../ArcGisFeature/EsriSymbology";
import { NeptuneCoastlineDataset } from "./NeptuneCoastlineDataset";

import * as chai from "chai";
import * as chaiAsPromised from "chai-as-promised";
import { TestUtils } from "./TestUtils";
import { ArcGisFeatureProvider } from "../../map-layers-formats";
const expect = chai.expect;
chai.use(chaiAsPromised);

const getRefImageSrc = (markerSymbol: any) => `data:${markerSymbol.contentType};base64,${markerSymbol.imageData}`;

describe("ArcGisSymbologyRenderer", () => {

  const sandbox = sinon.createSandbox();

  afterEach(async () => {
    sandbox.restore();
  });

  it("should construct renderer from simple drawing info", async () => {
    const dataset = NewYorkDataset.streetsLayerCapabilities.drawingInfo.renderer;
    const simpleRenderer = EsriRenderer.fromJSON(dataset);
    const defaultSymb = ArcGisFeatureProvider.getDefaultSymbology("esriGeometryPolyline");
    const symbRender = ArcGisSymbologyRenderer.create(simpleRenderer, defaultSymb!);
    const ref = EsriSLS.fromJSON(dataset.symbol);
    expect(symbRender.symbol).to.deep.equals(ref);
  });

  it("should construct unique value renderer without metadata default symbol (", async () => {

    const dataset = NeptuneCoastlineDataset.uniqueValueSFSDrawingInfo;
    const renderer =  EsriUniqueValueRenderer.fromJSON(dataset.drawingInfo.renderer as any);
    const defaultSymb = ArcGisFeatureProvider.getDefaultSymbology("esriGeometryPolygon");
    const symbRender = ArcGisSymbologyRenderer.create(renderer, defaultSymb!);

    expect (symbRender.defaultSymbol).to.deep.equals(defaultSymb);
  });

  it("should construct unique value renderer with default symbol", async () => {

    const dataset = NewYorkDataset.uniqueValueDrawingInfo;
    const renderer =  EsriUniqueValueRenderer.fromJSON(dataset.drawingInfo.renderer as any);
    const defaultSymb = ArcGisFeatureProvider.getDefaultSymbology("esriGeometryPoint");
    const symbRender = ArcGisSymbologyRenderer.create(renderer, defaultSymb!);

    const test = EsriPMS.fromJSON(dataset.drawingInfo.renderer.defaultSymbol as any);

    expect (symbRender.defaultSymbol).to.deep.equals(test);

  });

  it("should construct with default symbol if invalid renderer type", async () => {
    const dataset = structuredClone(NewYorkDataset.uniqueValueDrawingInfo);
    const renderer =  EsriUniqueValueRenderer.fromJSON(dataset.drawingInfo.renderer as any);
    (renderer as any).type = "someBadType";
    const defaultSymb = ArcGisFeatureProvider.getDefaultSymbology("esriGeometryPoint");
    const symbRender = ArcGisSymbologyRenderer.create(renderer, defaultSymb!);
    expect (symbRender.defaultSymbol).to.deep.equals(defaultSymb);

  });

  it("should construct with default symbol if no renderer object", async () => {
    const defaultSymb = ArcGisFeatureProvider.getDefaultSymbology("esriGeometryPoint");
    const symbRender = ArcGisSymbologyRenderer.create(undefined, defaultSymb!);
    expect (symbRender.defaultSymbol).to.deep.equals(defaultSymb);

  });

  it("should provide fill color using simple renderer definition", async () => {

    const provider = TestUtils.createSymbologyRenderer("esriGeometryPolygon", PhillyLandmarksDataset.polygonDrawingInfo.drawingInfo.renderer) as ArcGisUniqueValueSymbologyRenderer;
    const fakeContext = {fillStyle: ""};
    provider.applyFillStyle(fakeContext as CanvasRenderingContext2D);

    const refSymbol = EsriSFS.fromJSON(PhillyLandmarksDataset.polygonDrawingInfo.drawingInfo.renderer.symbol as any);
    expect(fakeContext.fillStyle).to.eq(refSymbol.color!.toRgbaString());
  });

  it("should apply proper fill color using unique value SFS renderer definition", async () => {
    const rendererDef = NeptuneCoastlineDataset.uniqueValueSFSDrawingInfo.drawingInfo.renderer;
    const provider = TestUtils.createSymbologyRenderer("esriGeometryPolygon", rendererDef) as ArcGisUniqueValueSymbologyRenderer;

    const fakeContext = {fillStyle: ""};
    // Make sure default symbology is applied if 'setActiveFeatureAttributes' has never been called
    provider.applyFillStyle(fakeContext as CanvasRenderingContext2D);
    let refSymbol = provider.defaultSymbol as EsriSFS;
    expect(fakeContext.fillStyle).to.eq(refSymbol.color!.toRgbaString());

    // Now set proper attribute
    // eslint-disable-next-line quote-props, @typescript-eslint/naming-convention
    provider.setActiveFeatureAttributes({"LU_2014": "Urban/Built-up"});
    provider.applyFillStyle(fakeContext as CanvasRenderingContext2D);
    refSymbol = EsriSFS.fromJSON(rendererDef.uniqueValueInfos[1].symbol as any);
    expect(fakeContext.fillStyle).to.eq(refSymbol.color!.toRgbaString());

    // check that we fallback to default symbology if empty attributes are now set
    provider.setActiveFeatureAttributes({});
    fakeContext.fillStyle = "";
    provider.applyFillStyle(fakeContext as CanvasRenderingContext2D);
    refSymbol = provider.defaultSymbol as EsriSFS;
    expect(fakeContext.fillStyle).to.eq(refSymbol.color!.toRgbaString());
  });

  it("should apply proper stroke color using unique value SFS renderer definition", async () => {
    const rendererDef = NeptuneCoastlineDataset.uniqueValueSFSDrawingInfo.drawingInfo.renderer;
    const provider = TestUtils.createSymbologyRenderer("esriGeometryPolygon", rendererDef) as ArcGisUniqueValueSymbologyRenderer;

    const fakeContext = {strokeStyle: ""};
    // Make sure default symbology is applied if 'setActiveFeatureAttributes' has never been called
    provider.applyStrokeStyle(fakeContext as CanvasRenderingContext2D);
    let refSymbol = provider.defaultSymbol as EsriSFS;
    expect(fakeContext.strokeStyle).to.eq(refSymbol.outline!.color!.toRgbaString());

    // Now set proper attribute
    // eslint-disable-next-line quote-props, @typescript-eslint/naming-convention
    provider.setActiveFeatureAttributes({"LU_2014": "Urban/Built-up"});
    provider.applyStrokeStyle(fakeContext as CanvasRenderingContext2D);
    refSymbol = EsriSFS.fromJSON(rendererDef.uniqueValueInfos[1].symbol as any);
    expect(fakeContext.strokeStyle).to.eq(refSymbol.outline!.color!.toRgbaString());

    // check that we fallback to default symbology if empty attributes are now set
    provider.setActiveFeatureAttributes({});
    fakeContext.strokeStyle = "";
    provider.applyStrokeStyle(fakeContext as CanvasRenderingContext2D);
    refSymbol = (provider as any).defaultSymbol;
    expect(fakeContext.strokeStyle).to.eq(refSymbol.outline!.color!.toRgbaString());
  });

  it("should apply proper stroke color using unique value SLS renderer definition", async () => {
    const rendererDef = NeptuneCoastlineDataset.uniqueValueSLSDrawingInfo.drawingInfo.renderer;
    const provider = TestUtils.createSymbologyRenderer("esriGeometryLine", rendererDef) as ArcGisUniqueValueSymbologyRenderer;

    const fakeContext = {strokeStyle: ""};
    // Make sure default symbology is applied if 'setActiveFeatureAttributes' has never been called
    provider.applyStrokeStyle(fakeContext as CanvasRenderingContext2D);
    let refSymbol = provider.defaultSymbol as any;
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
    refSymbol = provider.defaultSymbol as any;
    expect(fakeContext.strokeStyle).to.eq(refSymbol.color!.toRgbaString());
  });

  it("should apply proper marker using unique value PMS renderer definition", async () => {
    const rendererDef = NewYorkDataset.uniqueValueDrawingInfo.drawingInfo.renderer;
    const provider = TestUtils.createSymbologyRenderer("esriGeometryPoint", rendererDef) as ArcGisUniqueValueSymbologyRenderer;

    sandbox.stub(HTMLImageElement.prototype, "addEventListener").callsFake(function _(_type: string, listener: EventListenerOrEventListenerObject, _options?: boolean | AddEventListenerOptions) {
      // Simple call the listener in order to resolved the wrapping promise (i.e. EsriRenderer.initialize() is non-blocking )
      (listener as any)();
    });
    await provider.renderer!.initialize();

    class FakeContext {
      public image: any;
      public drawImage(image: CanvasImageSource, _dx: number, _dy: number, _dw: number, _dh: number) {
        this.image = image;
      }
    }
    const fakeContext = new FakeContext();

    // Make sure default symbology is applied if 'setActiveFeatureAttributes' has never been called
    provider.drawPoint((fakeContext as unknown) as CanvasRenderingContext2D, 0 ,0);
    let refSymbol = provider.defaultSymbol;
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
    refSymbol = provider.defaultSymbol;
    expect(fakeContext.image.src).to.eq(getRefImageSrc(refSymbol));
  });

  it("should apply proper marker using unique value PMS renderer definition", async () => {
    const rendererDef = {...NewYorkDataset.uniqueValueDrawingInfo.drawingInfo.renderer, defaultSymbol: null};
    const provider = TestUtils.createSymbologyRenderer("esriGeometryPoint", rendererDef);

    sandbox.stub(HTMLImageElement.prototype, "addEventListener").callsFake(function _(_type: string, listener: EventListenerOrEventListenerObject, _options?: boolean | AddEventListenerOptions) {
      // Simple call the listener in order to resolved the wrapping promise (i.e. EsriRenderer.initialize() is non-blocking )
      (listener as any)();
    });
    await provider.renderer!.initialize();

    // When the renderer definition doesn't include its own default symbol we need to loadimage of the default symbol manually
    if (!rendererDef.defaultSymbol)
      await (provider.defaultSymbol as EsriPMS).loadImage();  // since default symbology is provided by

    class FakeContext {
      public image: any;
      public drawImage(image: CanvasImageSource, _dx: number, _dy: number, _dw: number, _dh: number) {
        this.image = image;
      }
    }
    const fakeContext = new FakeContext();

    // Make sure default symbology is applied if 'setActiveFeatureAttributes' has never been called
    provider.drawPoint((fakeContext as unknown) as CanvasRenderingContext2D, 0 ,0);
    const refSymbol = provider.defaultSymbol;
    expect(fakeContext.image.src).to.eq(getRefImageSrc(refSymbol));

  });
}); // end test suite
