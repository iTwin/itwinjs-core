/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/

import { MapSubLayerSettings } from "@itwin/core-common";
import { expect } from "chai";
import { MapLayerSource, MapLayerSourceProps } from "../../../tile/map/MapLayerSources";

const sampleSourceJson = {
  formatId: "WMS",
  name: "testSource",
  url: "https://testserver/wms",
  transparentBackground: true,
  baseMap: true,
  queryParams: {testParam : "testValue"},
};

describe("MapLayerSources", () => {

  it("should create MapLayerSource with defaults", async () => {
    const testSourceProps: MapLayerSourceProps = {name: sampleSourceJson.name, url: sampleSourceJson.url};
    const sampleSource = MapLayerSource.fromJSON(testSourceProps);
    expect(sampleSource).to.not.undefined;
    expect(sampleSource!.formatId).to.equals("WMS");
    expect(sampleSource!.transparentBackground).to.equals(true);
    expect(sampleSource!.baseMap).to.equals(false);
    expect(sampleSource!.savedQueryParams).to.equals(undefined);
    expect(sampleSource!.unsavedQueryParams).to.equals(undefined);
  });

  it("should create MapLayerSource from MapLayerSourceProps", async () => {

    let sampleSource = MapLayerSource.fromJSON(sampleSourceJson);
    expect(sampleSource).to.not.undefined;
    expect(sampleSource!.formatId).to.equals(sampleSourceJson.formatId);
    expect(sampleSource!.name).to.equals(sampleSourceJson.name);
    expect(sampleSource!.url).to.equals(sampleSourceJson.url);
    expect(sampleSource!.transparentBackground).to.equals(sampleSourceJson.transparentBackground);
    expect(sampleSource!.baseMap).to.equals(sampleSourceJson.baseMap);
    expect(sampleSource!.savedQueryParams).to.equals(sampleSourceJson.queryParams);
    expect(sampleSource!.unsavedQueryParams).to.equals(undefined);

    // check baseMap false
    sampleSourceJson.baseMap = false;
    sampleSource = MapLayerSource.fromJSON(sampleSourceJson);
    expect(sampleSource).to.not.undefined;
    expect(sampleSource!.baseMap).to.equals(sampleSourceJson.baseMap);

    // We used to parse the "basemap" token in the URL to determine if baseMap flag should be turned on...
    // this should be no longer the case
    sampleSourceJson.url = "https://testserver/basemap/wms";
    sampleSource = MapLayerSource.fromJSON(sampleSourceJson);
    expect(sampleSource).to.not.undefined;
    expect(sampleSource!.baseMap).to.equals(false);
  });

  it("should create MapLayerSettings from MapLayerSource", async () => {
    const sampleSource = MapLayerSource.fromJSON(sampleSourceJson);

    // Save props not part of of props
    sampleSource!.userName = "testUser";
    sampleSource!.password = "testPassword";
    sampleSource!.unsavedQueryParams = {unsavedParam : "unsavedParamValue"};

    expect(sampleSource).to.not.undefined;
    if (!sampleSource)
      return;

    const sampleSubLayerSettings = MapSubLayerSettings.fromJSON({ name: "sampleSubLayer" });
    expect(sampleSubLayerSettings).to.not.undefined;
    if (!sampleSubLayerSettings)
      return;

    const subLayers = [sampleSubLayerSettings];
    const settings = sampleSource?.toLayerSettings(subLayers);
    expect(settings).to.not.undefined;
    if (!settings)
      return;

    expect(sampleSource.formatId).to.equals(settings.formatId);
    expect(sampleSource.name).to.equals(settings.name);
    expect(sampleSource.url).to.equals(settings.url);
    expect(sampleSource.userName).to.equals(settings.userName);
    expect(sampleSource.password).to.equals(settings.password);
    expect(JSON.stringify(sampleSource.savedQueryParams)).to.equals(JSON.stringify(settings.savedQueryParams));
    expect( JSON.stringify(sampleSource.unsavedQueryParams)).to.equals(JSON.stringify(settings.unsavedQueryParams));
    expect(settings.subLayers).to.not.undefined;
    expect(settings.subLayers.length).to.equals(subLayers.length);
    expect(settings.subLayers[0].name).to.equals(subLayers[0].name);
    expect(settings.subLayers[0].name).to.equals(subLayers[0].name);
  });

  it("should create MapLayerSourceProps from MapLayerSource", async () => {
    const sampleSource = MapLayerSource.fromJSON(sampleSourceJson);

    // Save props not part of of props (should have no impact on resulting JSON)
    sampleSource!.userName = "testUser";
    sampleSource!.password = "testPassword";
    sampleSource!.unsavedQueryParams = {unsavedParam : "unsavedParamValue"};

    const sourceProps = sampleSource!.toJSON();
    expect(sampleSourceJson.formatId).to.equals(sourceProps.formatId);
    expect(sampleSourceJson.name).to.equals(sourceProps.name);
    expect(sampleSourceJson.url).to.equals(sourceProps.url);
    expect(sampleSourceJson.transparentBackground).to.equals(sourceProps.transparentBackground);
    expect(sampleSourceJson.queryParams).to.equals(sourceProps.queryParams);

  });
});
