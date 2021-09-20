/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
import * as chai from "chai";
import * as sinon from "sinon";
import { Guid, GuidString } from "@bentley/bentleyjs-core";

import { MapLayerSettingsService } from "../../../tile/map/MapLayerSettings";
import { MapLayerSource } from "../../../tile/map/MapLayerSources";
import { IModelApp } from "../../../IModelApp";
import { setup, restore } from "./UserPreferencesMock.test";

chai.should();
describe.only("MapLayerSettingsService", () => {
  const contextId: GuidString = Guid.createValue();
  const iModelId: GuidString = Guid.createValue();
  const testName: string = `test${Guid.createValue()}`;

  before(async () => {
    setup();
  });
  after(async () => {
    sinon.restore();
    restore();
  });

  it("should store and retrieve layer", async () => {
    const layer = MapLayerSource.fromJSON({
      url: "test12345",
      name: testName,
      formatId: "test12345",
      transparentBackground: true,
    });
    chai.assert.isDefined(layer);
    let sources = await MapLayerSettingsService.getSources(contextId, iModelId);
    let foundSource = sources.some((value) => { return value.name === testName; });
    chai.assert.isFalse(foundSource, "expect not to find the source as it has not been stored yet");
    const success = await MapLayerSettingsService.storeSource(layer!, false, contextId, iModelId);
    chai.assert.isTrue(success);

    sources = await MapLayerSettingsService.getSources(contextId, iModelId);
    foundSource = sources.some((value) => { return value.name === testName; });
    chai.assert.isTrue(foundSource);
    await IModelApp.userPreferences.delete({
      key: `${(MapLayerSettingsService as any).SourceNamespace}.${testName}`,
      iTwinId: contextId,
    });

    const val = await IModelApp.userPreferences.get({
      key: `${(MapLayerSettingsService as any).SourceNamespace}.${testName}`,
      iTwinId: contextId,
    });
    chai.assert.isUndefined(val, "the map layer should no longer exist");
  });

  it("should not be able to store model setting if same setting exists as project setting", async () => {
    const layer = MapLayerSource.fromJSON({
      url: "test12345",
      name: testName,
      formatId: "test12345",
      transparentBackground: true,
    });
    let success = await MapLayerSettingsService.storeSource(layer!, false, contextId, iModelId);
    chai.assert.isTrue(success);
    success = await MapLayerSettingsService.storeSource(layer!, true, contextId, iModelId);
    chai.assert.isFalse(success, "cannot store the iModel setting that conflicts with an iTwin setting");
    await IModelApp.userPreferences.delete({
      key: `${(MapLayerSettingsService as any).SourceNamespace}.${testName}`,
      iTwinId: contextId,
    });

    const val = await IModelApp.userPreferences.get({
      key: `${(MapLayerSettingsService as any).SourceNamespace}.${testName}`,
      iTwinId: contextId,
    });
    chai.assert.isUndefined(val, "the map layer should no longer exist");
  });

  it("should be able to store project setting if same setting exists as project setting", async () => {
    const layer = MapLayerSource.fromJSON({
      url: "test12345",
      name: testName,
      formatId: "test12345",
      transparentBackground: true,
    });
    let success = await MapLayerSettingsService.storeSource(layer!, true, contextId, iModelId);
    chai.assert.isTrue(success);
    success = await MapLayerSettingsService.storeSource(layer!, false, contextId, iModelId);
    chai.assert.isTrue(success);
    await IModelApp.userPreferences.delete({
      key: `${(MapLayerSettingsService as any).SourceNamespace}.${testName}`,
      iTwinId: contextId,
    });

    const val = await IModelApp.userPreferences.get({
      key: `${(MapLayerSettingsService as any).SourceNamespace}.${testName}`,
      iTwinId: contextId,
    });
    chai.assert.isUndefined(val, "the map layer should no longer exist");
  });

  it("should be able to delete a mapSource stored on project and imodel level", async () => {
    const layer = MapLayerSource.fromJSON({
      url: "test12345",
      name: testName,
      formatId: "test12345",
      transparentBackground: true,
    });

    chai.assert.isDefined(layer);

    chai.assert.isTrue(await MapLayerSettingsService.storeSource(layer!, true, contextId, iModelId));
    await MapLayerSettingsService.deleteByName(layer!, contextId, iModelId);
    chai.assert.isUndefined(MapLayerSettingsService.getByUrl(layer!.url, contextId, iModelId));

    chai.assert.isTrue(await MapLayerSettingsService.storeSource(layer!, false, contextId, iModelId));
    await MapLayerSettingsService.deleteByName(layer!, contextId, iModelId);
    chai.assert.isUndefined(MapLayerSettingsService.getByUrl(layer!.url, contextId, iModelId));
  });
});
