/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
import * as chai from "chai";
import { Guid, GuidString } from "@bentley/bentleyjs-core";
import { AuthorizedClientRequestContext } from "@bentley/itwin-client";
import { TestFrontendAuthorizationClient, TestUsers } from "@bentley/oidc-signin-tool/lib/frontend";

import { TestUtility } from "./TestUtility";
import { IModelApp, IModelAppOptions, MapLayerSettingsService, MapLayerSource } from "@bentley/imodeljs-frontend";
import { SettingsResult, SettingsStatus } from "@bentley/product-settings-client";

chai.should();
describe("MapLayerSettingsService (#integration)", () => {
  let iTwinId: GuidString;
  let iModelId: GuidString;
  let requestContext: AuthorizedClientRequestContext;
  const testName: string = `test${Guid.createValue()}`;

  before(async () => {
    const authorizationClient = await TestUtility.initializeTestITwin(TestUtility.testITwinName, TestUsers.regular);
    requestContext = await TestUtility.getAuthorizedClientRequestContext(TestUsers.regular);

    new TestFrontendAuthorizationClient(requestContext.accessToken);
    const options: IModelAppOptions = {
      authorizationClient,
    };
    await IModelApp.shutdown();
    await IModelApp.startup(options);
    iTwinId = await TestUtility.queryITwinIdByName(TestUtility.testITwinName);
    chai.assert.isDefined(iTwinId);
    iModelId = await TestUtility.queryIModelIdbyName(iTwinId, TestUtility.testIModelNames.readOnly);
    chai.assert.isDefined(iModelId);
  });
  after(async () => {
    await IModelApp.shutdown();
  });

  it.skip("should store and retrieve layer", async () => {
    const layer = MapLayerSource.fromJSON({
      url: "test12345",
      name: testName,
      formatId: "test12345",
      transparentBackground: true,
    });
    chai.assert.isDefined(layer);
    let sources = await MapLayerSettingsService.getSourcesFromSettingsService(iTwinId, iModelId);
    let foundSource = sources.some((value) => { return value.name === testName; }); // expect not to find it bc we haven't stored yet.
    chai.expect(foundSource).to.be.false;
    const success = await MapLayerSettingsService.storeSourceInSettingsService(layer!, false, iTwinId, iModelId);
    chai.assert.isTrue(success);

    sources = await MapLayerSettingsService.getSourcesFromSettingsService(iTwinId, iModelId);
    foundSource = sources.some((value) => { return value.name === testName; });
    chai.expect(foundSource).to.be.true;
    const settingsResult: SettingsResult = await IModelApp.settings.deleteSharedSetting(requestContext, MapLayerSettingsService.SourceNamespace, testName, true, iTwinId);
    chai.expect(settingsResult.status).to.be.equal(SettingsStatus.Success);
  });

  it("should not be able to store model setting if same setting exists as iTwin setting", async () => {
    const layer = MapLayerSource.fromJSON({
      url: "test12345",
      name: testName,
      formatId: "test12345",
      transparentBackground: true,
    });
    let success = await MapLayerSettingsService.storeSourceInSettingsService(layer!, false, iTwinId, iModelId);
    chai.assert.isTrue(success);
    success = await MapLayerSettingsService.storeSourceInSettingsService(layer!, true, iTwinId, iModelId);
    chai.assert.isFalse(success); // cant store model setting that collides with a project setting expect a false
    const settingsResult: SettingsResult = await IModelApp.settings.deleteSharedSetting(requestContext, MapLayerSettingsService.SourceNamespace, testName, true, iTwinId);
    chai.expect(settingsResult.status).to.be.equal(SettingsStatus.Success);
  });

  it("should be able to store iTwin setting if same setting exists as iTwin setting", async () => {
    const layer = MapLayerSource.fromJSON({
      url: "test12345",
      name: testName,
      formatId: "test12345",
      transparentBackground: true,
    });
    let success = await MapLayerSettingsService.storeSourceInSettingsService(layer!, true, iTwinId, iModelId);
    chai.assert.isTrue(success);
    success = await MapLayerSettingsService.storeSourceInSettingsService(layer!, false, iTwinId, iModelId);
    chai.assert.isTrue(success);
    const settingsResult: SettingsResult = await IModelApp.settings.deleteSharedSetting(requestContext, MapLayerSettingsService.SourceNamespace, testName, true, iTwinId);
    chai.expect(settingsResult.status).to.be.equal(SettingsStatus.Success);
  });

  it("should be able to delete a mapSource stored on iTwin and imodel level", async () => {
    const layer = MapLayerSource.fromJSON({
      url: "test12345",
      name: testName,
      formatId: "test12345",
      transparentBackground: true,
    });
    let success = await MapLayerSettingsService.storeSourceInSettingsService(layer!, true, iTwinId, iModelId);
    chai.assert.isTrue(success);
    success = await MapLayerSettingsService.deleteSharedSettings(layer!, iTwinId, iModelId);
    chai.assert.isTrue(success);
    success = await MapLayerSettingsService.storeSourceInSettingsService(layer!, false, iTwinId, iModelId);
    chai.assert.isTrue(success);
    success = await MapLayerSettingsService.deleteSharedSettings(layer!, iTwinId, iModelId);
    chai.assert.isTrue(success);
  });
});
