/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/

import * as sinon from "sinon";
import { expect } from "chai";
import { MapLayerFeatureInfo } from "@itwin/core-frontend";
import { OgcFeaturesReader, ReadOgcFeaturesInfoOptions } from "../../OgcFeatures/OgcFeaturesReader";
import { PhillyDataset } from "./PhillyDataset";
import { FakeSymbGeomRenderer, MockFeatureSymbologyRenderer, MockGeometryRenderer, MockGraphicsRenderer } from "./Mocks";
import { GeoJSONGeometryReader } from "../../GeoJSON/GeoJSONGeometryReader";
import { ImageMapLayerSettings } from "@itwin/core-common";
import { CountriesDataset } from "./CountriesDataset";

describe("OgcFeaturesReader", () => {
  const sandbox = sinon.createSandbox();

  const testFeatureInfo = async (reader:OgcFeaturesReader, opts: ReadOgcFeaturesInfoOptions, infos: MapLayerFeatureInfo[]) {
    await reader.readFeatureInfo(opts, infos);
    expect(infos.length).to.eqls(1);
    expect(infos[0].subLayerInfos?.length).to.eqls(1);
    const subLayer = infos[0].subLayerInfos![0];
    expect(subLayer.features.length).to.eqls(1);
    const feature = subLayer.features[0];
    expect(feature.attributes.length).to.eqls(Object.keys(CountriesDataset.queryables.properties).length - 1); // -1 bec
  }
  afterEach(async () => {
    sandbox.restore();
  });

  it("should read multi features", async () => {

    const reader = new OgcFeaturesReader();
    const renderPathSpy = sandbox.spy(GeoJSONGeometryReader.prototype, "readGeometry");
    await reader.readAndRender(PhillyDataset.multiItemPoint as any, new MockGeometryRenderer());
    expect(renderPathSpy.getCalls().length).to.equals(PhillyDataset.multiItemPoint.features.length);

  });

  it("should read features and update the symbology renderer", async () => {
    const reader = new OgcFeaturesReader();
    const fakeGeomRenderer = new FakeSymbGeomRenderer();
    const mockSymbRenderer = fakeGeomRenderer.symbolRenderer as MockFeatureSymbologyRenderer;
    mockSymbRenderer.rendererFields = ["gid", "objectid"];
    await reader.readAndRender(PhillyDataset.multiItemPoint as any, fakeGeomRenderer);
    expect(mockSymbRenderer.activeGeometryType).to.eqls("Point");
    const lastIdx = PhillyDataset.multiItemPoint.features.length -1;
    expect(mockSymbRenderer.activeFeatureAttributes.gid).to.eqls(PhillyDataset.multiItemPoint.features[lastIdx].properties.gid);
    expect(mockSymbRenderer.activeFeatureAttributes.objectid).to.eqls(PhillyDataset.multiItemPoint.features[lastIdx].properties.objectid);
  });

  it("should read features info", async () => {

    const reader = new OgcFeaturesReader();
    const layerSettings = ImageMapLayerSettings.fromJSON({
      name: "test",
      url: "",
      formatId: "OgcFeatures",
    });
    const geomRenderer = new MockGraphicsRenderer();
    const opts: ReadOgcFeaturesInfoOptions = {
      collection: CountriesDataset.singleItem as any,
      layerSettings,
      queryables: CountriesDataset.queryables,
      geomRenderer,
    };
    const readGeometrySpy = sinon.spy(GeoJSONGeometryReader.prototype, "readGeometry");
    const moveGraphicsSpy = sinon.spy(geomRenderer, "moveGraphics");
    const infos: MapLayerFeatureInfo[] = [];

    await testFeatureInfo(reader, opts, infos);
    expect(readGeometrySpy.called).to.be.true;
    expect(moveGraphicsSpy.called).to.be.true;
  });

  it("should read features info without geometry renderer", async () => {

    const reader = new OgcFeaturesReader();
    const layerSettings = ImageMapLayerSettings.fromJSON({
      name: "test",
      url: "",
      formatId: "OgcFeatures",
    });
    const opts: ReadOgcFeaturesInfoOptions = {
      collection: CountriesDataset.singleItem as any,
      layerSettings,
      queryables: CountriesDataset.queryables,
    };
    const infos: MapLayerFeatureInfo[] = [];
    await testFeatureInfo(reader, opts, infos);
  });
});
