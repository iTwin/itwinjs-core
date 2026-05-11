/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
/* eslint-disable @typescript-eslint/naming-convention */

import { ColorDef } from "@itwin/core-common";
import chai from "chai";
import chaiAsPromised from "chai-as-promised";
import sinon from "sinon";
import sinonChai from "sinon-chai";
import { DefaultArcGiSymbology } from "../../ArcGisFeature/ArcGisFeatureProvider.js";
import { ArcGisFeatureGeometryType } from "../../ArcGisFeature/ArcGisFeatureQuery.js";
import { ArcGisClassBreaksSymbologyRenderer, ArcGisDashLineStyle, ArcGisSymbologyCanvasRenderer, ArcGisUniqueValueSymbologyRenderer } from "../../ArcGisFeature/ArcGisSymbologyRenderer.js";
import { EsriPMS, EsriRenderer, EsriSFS, EsriSLS, EsriSMS, EsriUniqueValueRenderer } from "../../ArcGisFeature/EsriSymbology.js";
import { EarthquakeSince1970Dataset } from "./EarthquakeSince1970Dataset.js";
import { NeptuneCoastlineDataset } from "./NeptuneCoastlineDataset.js";
import { NewYorkDataset } from "./NewYorkDataset.js";
import { PhillyLandmarksDataset } from "./PhillyLandmarksDataset.js";
import { TestUtils } from "./TestUtils.js";

const expect = chai.expect;
chai.use(chaiAsPromised);
chai.use(sinonChai);

const getRefImageSrc = (markerSymbol: any) => `data:${markerSymbol.contentType};base64,${markerSymbol.imageData}`;

describe("ArcGisSymbologyRenderer", () => {

  const sandbox = sinon.createSandbox();
  let contextMock: ReturnType<typeof stubCanvasRenderingContext>;
  let context: CanvasRenderingContext2D;

  function stubCanvasRenderingContext() {
    return {
      setLineDash: sinon.stub(),
      strokeStyle: undefined,
      fillStyle: undefined,
      drawImage: sinon.stub(),
      arc: sinon.stub(),
      rotate: sinon.stub(),
      translate: sinon.stub(),
      fillRect: sinon.stub(),
      fill: sinon.stub(),
      stroke: sinon.stub(),
      moveTo: sinon.stub(),
      lineTo: sinon.stub(),
      beginPath: sinon.stub(),    
      closePath: sinon.stub(),
      save: sinon.stub(),
      restore: sinon.stub(),
    };
  }

  // Make sure 'ArcGisSimpleSymbologyRenderer.applyStrokeStyle' apply the proper dashes number array for each style.
  const verifyLineDashes = async (refRenderer: any, lineSymbolObj: any, refColor: ColorDef, geometryType: ArcGisFeatureGeometryType) => {
    for (const key of Object.keys(ArcGisDashLineStyle.dashValues)) {
      lineSymbolObj.style = key;
      const provider = await TestUtils.createSymbologyRenderer(geometryType, refRenderer) as ArcGisUniqueValueSymbologyRenderer;
      provider.applyStrokeStyle(context);
      const expectedDashes = ArcGisDashLineStyle.dashValues[key as keyof typeof ArcGisDashLineStyle.dashValues];

      expect(contextMock.setLineDash).to.be.calledWith(expectedDashes);
      expect(contextMock.strokeStyle).to.eq(refColor.toRgbaString());
    }
  };

  beforeEach(async () => {
    sandbox.stub(HTMLImageElement.prototype, "addEventListener").callsFake(function _(_type: string, listener: EventListenerOrEventListenerObject, _options?: boolean | AddEventListenerOptions) {
      // Simple call the listener in order to resolved the wrapping promise (i.e. EsriRenderer.initialize() is non-blocking )
      (listener as any)();
    });
    contextMock = stubCanvasRenderingContext();
    context = contextMock as unknown as CanvasRenderingContext2D;
  });

  afterEach(async () => {
    sandbox.restore();
  });

  it("should construct renderer from simple drawing info", async () => {
    const dataset = NewYorkDataset.streetsLayerCapabilities.drawingInfo.renderer;
    const simpleRenderer = EsriRenderer.fromJSON(dataset);
    const defaultSymb = new DefaultArcGiSymbology();
    const symbRender = ArcGisSymbologyCanvasRenderer.create(simpleRenderer, defaultSymb);
    const ref = EsriSLS.fromJSON(dataset.symbol);
    expect(symbRender.symbol).to.deep.equals(ref);
  });

  it("should construct unique value renderer without metadata default symbol", async () => {
    const dataset = NeptuneCoastlineDataset.uniqueValueSFSDrawingInfo;
    const renderer =  EsriUniqueValueRenderer.fromJSON(dataset.drawingInfo.renderer as any);
    const defaultSymb = new DefaultArcGiSymbology();
    const symbRender = ArcGisSymbologyCanvasRenderer.create(renderer, defaultSymb);
    symbRender.activeGeometryType = "esriGeometryPolygon";
    expect (symbRender.defaultSymbol).to.deep.equals(DefaultArcGiSymbology.defaultSFS);
  });

  it("should construct unique value renderer with default symbol", async () => {
    const dataset = NewYorkDataset.uniqueValueDrawingInfo;
    const renderer =  EsriUniqueValueRenderer.fromJSON(dataset.drawingInfo.renderer as any);

    const symbRender = ArcGisSymbologyCanvasRenderer.create(renderer, new DefaultArcGiSymbology(), "esriGeometryPoint");

    const activeSymbol = symbRender.symbol as EsriPMS;
    const refSym = EsriPMS.fromJSON(dataset.drawingInfo.renderer.defaultSymbol as any);
    expect (activeSymbol.imageUrl).to.deep.equals(refSym.imageUrl);
  });

  it("should construct with default symbol if invalid renderer type", async () => {
    const dataset = structuredClone(NewYorkDataset.uniqueValueDrawingInfo);
    const renderer =  EsriUniqueValueRenderer.fromJSON(dataset.drawingInfo.renderer as any);
    (renderer as any).type = "someBadType";
    const symbRender = ArcGisSymbologyCanvasRenderer.create(renderer, new DefaultArcGiSymbology(), "esriGeometryPoint");
    expect (symbRender.defaultSymbol).to.deep.equals(DefaultArcGiSymbology.defaultPMS);
  });

  it("should construct with default symbol if no renderer object", async () => {
    const symbRender = ArcGisSymbologyCanvasRenderer.create(undefined, new DefaultArcGiSymbology(), "esriGeometryPoint");
    expect (symbRender.defaultSymbol).to.deep.equals(DefaultArcGiSymbology.defaultPMS);
  });

  it("should provide fill color using simple renderer definition", async () => {
    const provider = await TestUtils.createSymbologyRenderer("esriGeometryPolygon", PhillyLandmarksDataset.polygonDrawingInfo.drawingInfo.renderer) as ArcGisUniqueValueSymbologyRenderer;
    provider.applyFillStyle(context);

    const refSymbol = EsriSFS.fromJSON(PhillyLandmarksDataset.polygonDrawingInfo.drawingInfo.renderer.symbol as any);
    expect(contextMock.fillStyle).to.eq(refSymbol.color!.toRgbaString());
  });

  it("should apply line dash on poly outline  using simple renderer definition", async () => {
    const refRenderer =  PhillyLandmarksDataset.polygonDrawingInfo.drawingInfo.renderer;
    refRenderer.symbol.outline.style;
    const provider = await TestUtils.createSymbologyRenderer("esriGeometryPolygon", refRenderer) as ArcGisUniqueValueSymbologyRenderer;

    provider.applyFillStyle(context);

    const refColor = EsriSLS.fromJSON(refRenderer.symbol.outline as any);
    await verifyLineDashes(refRenderer, refRenderer.symbol.outline, refColor.color!, "esriGeometryPolygon");
  });

  it("should provide stroke style using simple renderer definition", async () => {
    const refRenderer = PhillyLandmarksDataset.lineDrawingInfo.drawingInfo.renderer;
    const provider = await TestUtils.createSymbologyRenderer("esriGeometryLine", refRenderer) as ArcGisUniqueValueSymbologyRenderer;

    const refColor = EsriSLS.fromJSON(refRenderer.symbol as any);
    provider.applyStrokeStyle(context);

    expect(contextMock.strokeStyle).to.eq(refColor.color!.toRgbaString());
    expect(contextMock.setLineDash).to.not.be.called;
  });

  it("should provide stroke style using simple renderer definition", async () => {
    const refRenderer = PhillyLandmarksDataset.lineDrawingInfo.drawingInfo.renderer;
    const refColor = EsriSLS.fromJSON(refRenderer.symbol as any);

    await verifyLineDashes(refRenderer, refRenderer.symbol, refColor.color!, "esriGeometryLine");
  });

  it("should apply proper fill color using unique value SFS renderer definition", async () => {
    const rendererDef = NeptuneCoastlineDataset.uniqueValueSFSDrawingInfo.drawingInfo.renderer;
    const provider = await TestUtils.createSymbologyRenderer("esriGeometryPolygon", rendererDef) as ArcGisUniqueValueSymbologyRenderer;

    // Make sure default symbology is applied if 'setActiveFeatureAttributes' has never been called
    provider.applyFillStyle(context);
    let refSymbol = provider.defaultSymbol as EsriSFS;
    expect(context.fillStyle).to.eq(refSymbol.color!.toRgbaString());

    // Now set proper attribute
    provider.setActiveFeatureAttributes({"LU_2014": "Urban/Built-up"});
    provider.applyFillStyle(context);
    refSymbol = EsriSFS.fromJSON(rendererDef.uniqueValueInfos[1].symbol as any);
    expect(context.fillStyle).to.eq(refSymbol.color!.toRgbaString());

    // check that we fallback to default symbology if empty attributes are now set
    provider.setActiveFeatureAttributes({});
    context.fillStyle = "";
    provider.applyFillStyle(context);
    refSymbol = provider.defaultSymbol as EsriSFS;
    expect(context.fillStyle).to.eq(refSymbol.color!.toRgbaString());
  });

  it("should apply proper stroke color using unique value SFS renderer definition", async () => {
    const rendererDef = NeptuneCoastlineDataset.uniqueValueSFSDrawingInfo.drawingInfo.renderer;
    const provider = await TestUtils.createSymbologyRenderer("esriGeometryPolygon", rendererDef) as ArcGisUniqueValueSymbologyRenderer;

    // Make sure default symbology is applied if 'setActiveFeatureAttributes' has never been called
    provider.applyStrokeStyle(context);
    let refSymbol = provider.defaultSymbol as EsriSFS;
    expect(context.strokeStyle).to.eq(refSymbol.outline!.color!.toRgbaString());

    // Now set proper attribute
    provider.setActiveFeatureAttributes({"LU_2014": "Urban/Built-up"});
    provider.applyStrokeStyle(context);
    refSymbol = EsriSFS.fromJSON(rendererDef.uniqueValueInfos[1].symbol as any);
    expect(context.strokeStyle).to.eq(refSymbol.outline!.color!.toRgbaString());

    // check that we fallback to default symbology if empty attributes are now set
    provider.setActiveFeatureAttributes({});
    context.strokeStyle = "";
    provider.applyStrokeStyle(context);
    refSymbol = (provider as any).defaultSymbol;
    expect(context.strokeStyle).to.eq(refSymbol.outline!.color!.toRgbaString());
  });

  it("should apply proper stroke color using unique value SLS renderer definition", async () => {
    const rendererDef = NeptuneCoastlineDataset.uniqueValueSLSDrawingInfo.drawingInfo.renderer;
    const provider = await TestUtils.createSymbologyRenderer("esriGeometryLine", rendererDef) as ArcGisUniqueValueSymbologyRenderer;

    // Make sure default symbology is applied if 'setActiveFeatureAttributes' has never been called
    provider.applyStrokeStyle(context);
    let refSymbol = provider.defaultSymbol as any;
    expect(context.strokeStyle).to.eq(refSymbol.color.toRgbaString());

    // Now set proper attribute
    provider.setActiveFeatureAttributes({"LU_2014": "Urban/Built-up"});
    provider.applyStrokeStyle(context);
    refSymbol = EsriSFS.fromJSON(rendererDef.uniqueValueInfos[1].symbol as any);
    expect(context.strokeStyle).to.eq(refSymbol.color!.toRgbaString());

    // check that we fallback to default symbology if empty attributes are now set
    provider.setActiveFeatureAttributes({});
    context.strokeStyle = "";
    provider.applyStrokeStyle(context);
    refSymbol = provider.defaultSymbol as any;
    expect(context.strokeStyle).to.eq(refSymbol.color!.toRgbaString());
  });

  it("should apply proper marker using unique value PMS renderer definition", async () => {
    const rendererDef = NewYorkDataset.uniqueValueDrawingInfo.drawingInfo.renderer;
    const provider = await TestUtils.createSymbologyRenderer("esriGeometryPoint", rendererDef) as ArcGisUniqueValueSymbologyRenderer;

    await provider.renderer!.initialize();

    // Make sure default symbology is applied if 'setActiveFeatureAttributes' has never been called
    provider.drawPoint(context, 0 ,0);
    let refSymbol = provider.defaultSymbol;
    expect(contextMock.drawImage).to.be.calledWith(sinon.match({ src: getRefImageSrc(refSymbol) }));
    contextMock.drawImage.resetHistory();

    // Now set proper attribute
    provider.setActiveFeatureAttributes({"WEAPON": "gun"});
    provider.drawPoint(context, 0 ,0);
    refSymbol = EsriPMS.fromJSON(rendererDef.uniqueValueInfos[2].symbol as any);
    expect(contextMock.drawImage).to.be.calledWith(sinon.match({ src: getRefImageSrc(refSymbol) }));
    contextMock.drawImage.resetHistory();

    // check that we fallback to default symbology if empty attributes are now set
    provider.setActiveFeatureAttributes({});
    provider.drawPoint(context, 0 ,0);
    refSymbol = provider.defaultSymbol;
    expect(contextMock.drawImage).to.be.calledWith(sinon.match({ src: getRefImageSrc(refSymbol) }));
  });

  it("should draw rotated marker using simple PMS renderer definition", async () => {
    // Clone renderer definition and make adjustments for the test purposes.
    const rendererDef = structuredClone(PhillyLandmarksDataset.phillySimplePointDrawingInfo.drawingInfo.renderer);
    const angle = 90;
    (rendererDef.symbol as any).angle = angle;
    const provider = await TestUtils.createSymbologyRenderer("esriGeometryPoint", rendererDef) as ArcGisUniqueValueSymbologyRenderer;

    await provider.renderer!.initialize();

    // Make sure appropriate context methods are called.
    provider.drawPoint(context, 0 ,0);
    const refSymbol = provider.symbol;
    const pms = refSymbol as EsriPMS;
    await pms.loadImage();
    expect(contextMock.rotate).to.be.calledWith(angle*Math.PI/180);
    expect(contextMock.translate).to.be.calledTwice;
    expect(contextMock.drawImage).to.be.calledWith(sinon.match((value: HTMLImageElement) => value.src === pms.image.src), sinon.match.number, sinon.match.number, sinon.match.number, sinon.match.number);
  });

  it("should draw rotated marker using unique value PMS renderer definition", async () => {
    // Clone renderer definition and make adjustments for the test purposes.
    const rendererDef = structuredClone(NewYorkDataset.uniqueValueDrawingInfo.drawingInfo.renderer);
    const angle = 90;
    // change 'gun' class angle property
    rendererDef.uniqueValueInfos[2].symbol.angle = angle;
    const provider = await TestUtils.createSymbologyRenderer("esriGeometryPoint", rendererDef) as ArcGisUniqueValueSymbologyRenderer;

    await provider.renderer!.initialize();

    // Now set proper attribute
    provider.setActiveFeatureAttributes({"WEAPON": "gun"});

    // Make sure appropriate context methods are called.
    provider.drawPoint(context, 0 ,0);
    const refSymbol = provider.symbol;
    const pms = refSymbol as EsriPMS;
    await pms.loadImage();
    expect(contextMock.rotate).to.be.calledWith(angle*Math.PI/180);
    expect(contextMock.translate).to.be.calledTwice;
    expect(contextMock.drawImage).to.be.calledWith(sinon.match((value: HTMLImageElement) => value.src === pms.image.src), sinon.match.number, sinon.match.number, sinon.match.number, sinon.match.number);
  });

  it("should draw rotated marker using simple SMS renderer definition", async () => {
    // Clone renderer definition and make adjustments for the test purposes.
    const rendererDef = structuredClone(PhillyLandmarksDataset.phillySimpleSMSDrawingInfo.drawingInfo.renderer);
    const angle = 90;
    (rendererDef.symbol as any).angle = angle;
    const provider = await TestUtils.createSymbologyRenderer("esriGeometryPoint", rendererDef) as ArcGisUniqueValueSymbologyRenderer;

    await provider.renderer!.initialize();

    const refSymbol = provider.symbol;
    const refSms = refSymbol as EsriSMS;

    // Make sure appropriate context methods are called.
    provider.drawPoint(context, 0 ,0);
    expect(contextMock.rotate).to.be.calledWith(angle*Math.PI/180);
    expect(contextMock.translate).to.be.calledTwice;
    expect(contextMock.arc).to.be.calledWith(sinon.match.number, sinon.match.number, sinon.match(refSms.size*0.5), 0, sinon.match(2*Math.PI));
  });

  it("should draw different markers using unique value SMS renderer definition", async () => {
    // Clone renderer definition and make adjustments for the test purposes.
    const rendererDef = NewYorkDataset.uniqueValueSMSDrawingInfo.drawingInfo.renderer;
    const provider = await TestUtils.createSymbologyRenderer("esriGeometryPoint", rendererDef) as ArcGisUniqueValueSymbologyRenderer;

    await provider.renderer!.initialize();

    // Make sure appropriate context methods are called.

    // Should take default symbology
    provider.drawPoint(context, 0 ,0);
    const refDefaultSymbol = rendererDef.defaultSymbol;
    expect(contextMock.arc).to.be.calledWith(sinon.match.number, sinon.match.number, sinon.match(refDefaultSymbol.size*0.5), sinon.match.number, sinon.match(2*Math.PI));

    // check esriSMSCross
    sinon.resetHistory();
    provider.setActiveFeatureAttributes({WEAPON: " "});
    provider.drawPoint(context, 0 ,0);
    expect(contextMock.moveTo).to.be.calledTwice;
    expect(contextMock.lineTo).to.be.calledTwice;
    expect(contextMock.beginPath).to.be.calledOnce;
    
    // check esriSMSDiamond
    sinon.resetHistory();
    provider.setActiveFeatureAttributes({WEAPON: "blunt_instrument"});
    provider.drawPoint(context, 0 ,0);
    expect(contextMock.moveTo).to.be.calledOnce;
    expect(contextMock.beginPath).to.be.calledOnce;
    expect(contextMock.closePath).to.be.calledOnce;
    expect(contextMock.lineTo).to.be.calledThrice;

    // check esriSMSSquare
    sinon.resetHistory();
    provider.setActiveFeatureAttributes({WEAPON: "gun"});
    provider.drawPoint(context, 0 ,0);
    expect(contextMock.fillRect).to.be.calledOnce;

    // check esriSMSTriangle
    sinon.resetHistory();
    provider.setActiveFeatureAttributes({WEAPON: "knife"});
    provider.drawPoint(context, 0 ,0);
    expect(contextMock.moveTo).to.be.calledOnce;
    expect(contextMock.beginPath).to.be.calledOnce;
    expect(contextMock.closePath).to.be.calledOnce;
    expect(contextMock.lineTo).to.be.calledTwice;

    // check esriSMSX
    sinon.resetHistory();
    provider.setActiveFeatureAttributes({WEAPON: "other"});
    provider.drawPoint(context, 0 ,0);
    expect(contextMock.moveTo).to.be.calledTwice;
    expect(contextMock.lineTo).to.be.calledTwice;
    expect(contextMock.beginPath).to.be.calledOnce;

    // check esriSMSCircle
    sinon.resetHistory();
    provider.setActiveFeatureAttributes({WEAPON: "dummy"});
    provider.drawPoint(context, 0 ,0);
    expect(contextMock.arc).to.be.calledOnce;
  });

  it("should apply proper marker using unique value PMS renderer definition", async () => {
    const rendererDef = {...NewYorkDataset.uniqueValueDrawingInfo.drawingInfo.renderer, defaultSymbol: null};
    const provider = await TestUtils.createSymbologyRenderer("esriGeometryPoint", rendererDef);

    await provider.renderer!.initialize();

    // When the renderer definition doesn't include its own default symbol we need to loadimage of the default symbol manually
    if (!rendererDef.defaultSymbol)
      await (provider.defaultSymbol as EsriPMS).loadImage();  // since default symbology is provided by

    // Make sure default symbology is applied if 'setActiveFeatureAttributes' has never been called
    provider.drawPoint(context, 0 ,0);
    const refSymbol = provider.defaultSymbol;
    expect(contextMock.drawImage).to.be.calledWith(sinon.match({ src: getRefImageSrc(refSymbol) }));
  });

  it("should pick the right class based of class breaks", async () => {
    // Clone renderer definition and make adjustments for the test purposes.
    const rendererDef = structuredClone(EarthquakeSince1970Dataset.Earthquakes1970LayerCapabilities.drawingInfo.renderer);
    const provider = await TestUtils.createSymbologyRenderer("esriGeometryPoint", rendererDef) as ArcGisClassBreaksSymbologyRenderer;

    // Now set proper attribute
    provider.setActiveFeatureAttributes({"magnitude": 5.1});

    let pms = provider.symbol as EsriPMS;

    // Make sure the right image was picked after setting the active feature attributes
    expect(pms.props.imageData).to.equals(EarthquakeSince1970Dataset.Earthquakes1970LayerCapabilities.drawingInfo.renderer.classBreakInfos[1].symbol.imageData);

    provider.setActiveFeatureAttributes({magnitude: 1.7});
    pms = provider.symbol as EsriPMS;
    expect(pms.props.imageData).to.equals(EarthquakeSince1970Dataset.Earthquakes1970LayerCapabilities.drawingInfo.renderer.classBreakInfos[0].symbol.imageData);

    provider.setActiveFeatureAttributes({magnitude: 0.5});
    pms = provider.symbol as EsriPMS;
    expect(pms.props.imageData).to.equals((provider.defaultSymbol as EsriPMS).imageData);

    provider.setActiveFeatureAttributes({magnitude: 10});
    pms = provider.symbol as EsriPMS;
    expect(pms.props.imageData).to.equals((provider.defaultSymbol as EsriPMS).imageData);

  });

  it("should pick the right class based of class breaks (classMinValue defined)", async () => {
    // Clone renderer definition and make adjustments for the test purposes.
    const rendererDef = structuredClone(EarthquakeSince1970Dataset.Earthquakes1970LayerCapabilities.drawingInfo.renderer);
    rendererDef.classBreakInfos[0].classMinValue = 3;
    const provider = await TestUtils.createSymbologyRenderer("esriGeometryPoint", rendererDef) as ArcGisClassBreaksSymbologyRenderer;

    // Now set proper attribute
    provider.setActiveFeatureAttributes({"magnitude": 5.1});

    let pms = provider.symbol as EsriPMS;

    // Make sure the right image was picked after setting the active feature attributes
    expect(pms.props.imageData).to.equals(EarthquakeSince1970Dataset.Earthquakes1970LayerCapabilities.drawingInfo.renderer.classBreakInfos[1].symbol.imageData);

    provider.setActiveFeatureAttributes({magnitude: 3.1});
    pms = provider.symbol as EsriPMS;
    expect(pms.props.imageData).to.equals(EarthquakeSince1970Dataset.Earthquakes1970LayerCapabilities.drawingInfo.renderer.classBreakInfos[0].symbol.imageData);

    provider.setActiveFeatureAttributes({magnitude: 2});
    pms = provider.symbol as EsriPMS;
    expect(pms.props.imageData).to.equals((provider.defaultSymbol as EsriPMS).imageData);
  });

}); // end test suite
