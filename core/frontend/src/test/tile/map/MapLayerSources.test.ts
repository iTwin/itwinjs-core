/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/

import { MapSubLayerSettings } from "@bentley/imodeljs-common/lib/MapLayerSettings";
import { expect } from "chai";
import { MapLayerSource } from "../../../tile/map/MapLayerSources";

describe("MapLayerSources", () => {

  it("should create MapLayerSettings from MapLayerSource", async () => {
    const sampleSource = MapLayerSource.fromJSON({
      formatId: "WMS",
      name: "testSource",
      url: "https://testserver/wms",
      userName: "testUser",
      password: "testPassword",
    });
    expect(sampleSource).to.not.undefined;
    if (!sampleSource)
      return;

    const sampleSubLayerSettings = MapSubLayerSettings.fromJSON({ name: "sampleSubLayer" });
    expect(sampleSubLayerSettings).to.not.undefined;
    if (!sampleSubLayerSettings)
      return;

    sampleSource.subLayers = [sampleSubLayerSettings];

    const settings = sampleSource?.toLayerSettings();
    expect(settings).to.not.undefined;
    if (!settings)
      return;

    expect(sampleSource.formatId).to.equals(settings.formatId);
    expect(sampleSource.name).to.equals(settings.name);
    expect(sampleSource.url).to.equals(settings.url);
    expect(sampleSource.userName).to.equals(settings.userName);
    expect(sampleSource.password).to.equals(settings.password);
    expect(sampleSource.subLayers).to.not.undefined;
    expect(settings.subLayers).to.not.undefined;
    expect(sampleSource.subLayers.length).to.equals(settings.subLayers.length);
    expect(sampleSource.subLayers[0].name).to.equals(settings.subLayers[0].name);
  });
});
