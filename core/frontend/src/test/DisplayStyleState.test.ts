/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
import { expect } from "chai";
import { Point3d } from "@bentley/geometry-core";
import { BackgroundMapType, MapLayerSettings } from "@bentley/imodeljs-common";
import { IModelConnection } from "../IModelConnection";
import { IModelApp } from "../IModelApp";
import { SpatialViewState } from "../SpatialViewState";
import { createBlankConnection } from "./createBlankConnection";

describe("DisplayStyleState", () => {
  let imodel: IModelConnection;

  before(async () => {
    await IModelApp.startup();
    imodel = createBlankConnection();
  });

  after(async () => {
    await imodel.close();
    await IModelApp.shutdown();
  });

  // ###TODO @rbbentley
  it.skip("synchronizes BackgroundMapSettings and MapImagerySettings", () => {
    const style = SpatialViewState.createBlank(imodel, new Point3d(0, 0, 0), new Point3d(1, 1, 1)).displayStyle;
    const settings = style.settings;
    expect(settings.backgroundMap.providerName).to.equal("BingProvider");
    expect(settings.backgroundMap.mapType).to.equal(BackgroundMapType.Hybrid);

    let base = settings.mapImagery.backgroundBase as MapLayerSettings;
    expect(base).instanceOf(MapLayerSettings);
    expect(base.formatId).to.equal("BingMaps");
    expect(base.url.indexOf("AerialWithLabels")).least(1);

    settings.backgroundMap = settings.backgroundMap.clone({ providerName: "MapBoxProvider", providerData: { mapType: BackgroundMapType.Street } });
    base = settings.mapImagery.backgroundBase as MapLayerSettings;
    expect(base.formatId).to.equal("MapboxImagery");
    expect(base.url.indexOf("mapbox.streets/")).least(1);

    settings.mapImagery.backgroundBase = MapLayerSettings.fromMapSettings(settings.backgroundMap.clone({ providerData: { mapType: BackgroundMapType.Aerial } }));
    base = settings.mapImagery.backgroundBase;
    expect(base.formatId).to.equal("MapboxImagery");
    expect(base.url.indexOf("mapbox.satellite/")).least(1);
    expect(settings.backgroundMap.providerName).to.equal("MapBoxProvider");
    expect(settings.backgroundMap.mapType).to.equal(BackgroundMapType.Aerial);
  });

  it("changeBackgroundMapProps synchronizes MapImagerySettings", () => {
    const style = SpatialViewState.createBlank(imodel, new Point3d(0, 0, 0), new Point3d(1, 1, 1)).displayStyle;
    const settings = style.settings;
    expect(settings.backgroundMap.providerName).to.equal("BingProvider");
    expect(settings.backgroundMap.mapType).to.equal(BackgroundMapType.Hybrid);

    let base = settings.mapImagery.backgroundBase as MapLayerSettings;
    expect(base).instanceOf(MapLayerSettings);
    expect(base.formatId).to.equal("BingMaps");
    expect(base.url.indexOf("AerialWithLabels")).least(1);

    style.changeBackgroundMapProps({ providerName: "MapBoxProvider", providerData: { mapType: BackgroundMapType.Street } });
    base = style.settings.mapImagery.backgroundBase as MapLayerSettings;
    expect(base).instanceof(MapLayerSettings);
    expect(base.formatId).to.equal("MapboxImagery");
    expect(base.url.indexOf("mapbox.streets/")).least(1);
  });

  it("changeBaseMapProps synchronizes BackgroundMapSettings", () => {
    const style = SpatialViewState.createBlank(imodel, new Point3d(0, 0, 0), new Point3d(1, 1, 1)).displayStyle;
    const settings = style.settings;
    expect(settings.backgroundMap.providerName).to.equal("BingProvider");
    expect(settings.backgroundMap.mapType).to.equal(BackgroundMapType.Hybrid);

    let base = settings.mapImagery.backgroundBase as MapLayerSettings;
    expect(base).instanceOf(MapLayerSettings);
    expect(base.formatId).to.equal("BingMaps");
    expect(base.url.indexOf("AerialWithLabels")).least(1);

    const layerProps = MapLayerSettings.fromMapSettings(settings.backgroundMap.clone({ providerName: "MapBoxProvider", providerData: { mapType: BackgroundMapType.Street } })).toJSON();
    style.changeBaseMapProps(layerProps);
    base = settings.mapImagery.backgroundBase as MapLayerSettings;
    expect(base.formatId).to.equal("MapboxImagery");
    expect(base.url.indexOf("mapbox.streets/")).least(1);
    expect(settings.backgroundMap.providerName).to.equal("MapBoxProvider");
    expect(settings.backgroundMap.mapType).to.equal(BackgroundMapType.Street);
  });
});
