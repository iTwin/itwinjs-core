/*---------------------------------------------------------------------------------------------
 * Copyright (c) Bentley Systems, Incorporated. All rights reserved.
 * See LICENSE.md in the project root for license terms and full copyright notice.
 *--------------------------------------------------------------------------------------------*/

import { MapSubLayerSettings } from "@itwin/core-common";
import { describe, expect, it } from "vitest";
import { MapLayerSource, MapLayerSourceProps } from "../../../tile/map/MapLayerSources";

const sampleSourceJson = {
  formatId: "WMS",
  name: "testSource",
  url: "https://testserver/wms",
  transparentBackground: true,
  baseMap: true,
  queryParams: { testParam: "testValue" },
};

describe("MapLayerSources", () => {
  it("should create MapLayerSource with defaults", async () => {
    const testSourceProps: MapLayerSourceProps = { name: sampleSourceJson.name, url: sampleSourceJson.url };
    const sampleSource = MapLayerSource.fromJSON(testSourceProps);
    expect(sampleSource).toBeDefined();
    expect(sampleSource!.formatId).toEqual("WMS");
    expect(sampleSource!.transparentBackground).toEqual(true);
    expect(sampleSource!.baseMap).toEqual(false);
    expect(sampleSource!.savedQueryParams).toEqual(undefined);
    expect(sampleSource!.unsavedQueryParams).toEqual(undefined);
  });

  it("should create MapLayerSource from MapLayerSourceProps", async () => {
    let sampleSource = MapLayerSource.fromJSON(sampleSourceJson);
    expect(sampleSource).toBeDefined();
    expect(sampleSource!.formatId).toEqual(sampleSourceJson.formatId);
    expect(sampleSource!.name).toEqual(sampleSourceJson.name);
    expect(sampleSource!.url).toEqual(sampleSourceJson.url);
    expect(sampleSource!.transparentBackground).toEqual(sampleSourceJson.transparentBackground);
    expect(sampleSource!.baseMap).toEqual(sampleSourceJson.baseMap);
    expect(sampleSource!.savedQueryParams).toEqual(sampleSourceJson.queryParams);
    expect(sampleSource!.unsavedQueryParams).toEqual(undefined);

    // check baseMap false
    sampleSourceJson.baseMap = false;
    sampleSource = MapLayerSource.fromJSON(sampleSourceJson);
    expect(sampleSource).toBeDefined();
    expect(sampleSource!.baseMap).toEqual(sampleSourceJson.baseMap);

    // We used to parse the "basemap" token in the URL to determine if baseMap flag should be turned on...
    // this should be no longer the case
    sampleSourceJson.url = "https://testserver/basemap/wms";
    sampleSource = MapLayerSource.fromJSON(sampleSourceJson);
    expect(sampleSource).toBeDefined();
    expect(sampleSource!.baseMap).toEqual(false);
  });

  it("should create MapLayerSettings from MapLayerSource", async () => {
    const sampleSource = MapLayerSource.fromJSON(sampleSourceJson);

    // Save props not part of of props
    sampleSource!.userName = "testUser";
    sampleSource!.password = "testPassword";
    sampleSource!.unsavedQueryParams = { unsavedParam: "unsavedParamValue" };

    expect(sampleSource).toBeDefined();
    if (!sampleSource)
      return;

    const sampleSubLayerSettings = MapSubLayerSettings.fromJSON({ name: "sampleSubLayer" });
    expect(sampleSubLayerSettings).toBeDefined();
    if (!sampleSubLayerSettings)
      return;

    const subLayers = [sampleSubLayerSettings];
    const settings = sampleSource?.toLayerSettings(subLayers);
    expect(settings).toBeDefined();
    if (!settings)
      return;

    expect(sampleSource.formatId).toEqual(settings.formatId);
    expect(sampleSource.name).toEqual(settings.name);
    expect(sampleSource.url).toEqual(settings.url);
    expect(sampleSource.userName).toEqual(settings.userName);
    expect(sampleSource.password).toEqual(settings.password);
    expect(JSON.stringify(sampleSource.savedQueryParams)).toEqual(JSON.stringify(settings.savedQueryParams));
    expect(JSON.stringify(sampleSource.unsavedQueryParams)).toEqual(JSON.stringify(settings.unsavedQueryParams));
    expect(settings.subLayers).toBeDefined();
    expect(settings.subLayers.length).toEqual(subLayers.length);
    expect(settings.subLayers[0].name).toEqual(subLayers[0].name);
    expect(settings.subLayers[0].name).toEqual(subLayers[0].name);
  });

  it("should create MapLayerSourceProps from MapLayerSource", async () => {
    const sampleSource = MapLayerSource.fromJSON(sampleSourceJson);

    // Save props not part of of props (should have no impact on resulting JSON)
    sampleSource!.userName = "testUser";
    sampleSource!.password = "testPassword";
    sampleSource!.unsavedQueryParams = { unsavedParam: "unsavedParamValue" };

    const sourceProps = sampleSource!.toJSON();
    expect(sampleSourceJson.formatId).toEqual(sourceProps.formatId);
    expect(sampleSourceJson.name).toEqual(sourceProps.name);
    expect(sampleSourceJson.url).toEqual(sourceProps.url);
    expect(sampleSourceJson.transparentBackground).toEqual(sourceProps.transparentBackground);
    expect(sampleSourceJson.queryParams).toEqual(sourceProps.queryParams);
  });
});
