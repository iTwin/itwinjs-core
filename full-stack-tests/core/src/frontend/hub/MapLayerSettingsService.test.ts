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

const testProjectName = "iModelJsIntegrationTest";
const testIModelName = "ReadOnlyTest";

chai.should();
describe("MapLayerSettingsService (#integration)", () => {
  let projectId: GuidString;
  let iModelId: GuidString;
  let requestContext: AuthorizedClientRequestContext;
  const testName: string = `test${Guid.createValue()}`;

  before(async () => {
    const authorizationClient = await TestUtility.initializeTestProject(testProjectName, TestUsers.regular);
    requestContext = await TestUtility.getAuthorizedClientRequestContext(TestUsers.regular);

    new TestFrontendAuthorizationClient(requestContext.accessToken);
    const options: IModelAppOptions = {
      authorizationClient,
    };
    await IModelApp.shutdown();
    await IModelApp.startup(options);
    projectId = await TestUtility.getTestProjectId(testProjectName);
    chai.assert.isDefined(projectId);
    iModelId = await TestUtility.getTestIModelId(projectId, testIModelName);
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
      maxZoom: 1,
      transparentBackground: true,
    });
    chai.assert.isDefined(layer);
    let sources = await MapLayerSettingsService.getSourcesFromSettingsService(projectId, iModelId);
    let foundSource = sources.some((value) => { return value.name === testName; }); // expect not to find it bc we haven't stored yet.
    chai.expect(foundSource).to.be.false;
    const success = await MapLayerSettingsService.storeSourceInSettingsService(layer!, false, projectId, iModelId);
    chai.assert.isTrue(success);

    sources = await MapLayerSettingsService.getSourcesFromSettingsService(projectId, iModelId);
    foundSource = sources.some((value) => { return value.name === testName; });
    chai.expect(foundSource).to.be.true;
    const settingsResult: SettingsResult = await IModelApp.settings.deleteSharedSetting(requestContext, MapLayerSettingsService.SourceNamespace, testName, true, projectId);
    chai.expect(settingsResult.status).to.be.equal(SettingsStatus.Success);
  });

  it("should not be able to store model setting if same setting exists as project setting", async () => {
    const layer = MapLayerSource.fromJSON({
      url: "test12345",
      name: testName,
      formatId: "test12345",
      maxZoom: 1,
      transparentBackground: true,
    });
    let success = await MapLayerSettingsService.storeSourceInSettingsService(layer!, false, projectId, iModelId);
    chai.assert.isTrue(success);
    success = await MapLayerSettingsService.storeSourceInSettingsService(layer!, true, projectId, iModelId);
    chai.assert.isFalse(success); // cant store model setting that collides with a project setting expect a false
    const settingsResult: SettingsResult = await IModelApp.settings.deleteSharedSetting(requestContext, MapLayerSettingsService.SourceNamespace, testName, true, projectId);
    chai.expect(settingsResult.status).to.be.equal(SettingsStatus.Success);
  });
  it("should be able to store project setting if same setting exists as project setting", async () => {
    const layer = MapLayerSource.fromJSON({
      url: "test12345",
      name: testName,
      formatId: "test12345",
      maxZoom: 1,
      transparentBackground: true,
    });
    let success = await MapLayerSettingsService.storeSourceInSettingsService(layer!, true, projectId, iModelId);
    chai.assert.isTrue(success);
    success = await MapLayerSettingsService.storeSourceInSettingsService(layer!, false, projectId, iModelId);
    chai.assert.isTrue(success);
    const settingsResult: SettingsResult = await IModelApp.settings.deleteSharedSetting(requestContext, MapLayerSettingsService.SourceNamespace, testName, true, projectId);
    chai.expect(settingsResult.status).to.be.equal(SettingsStatus.Success);
  });

  it("should be able to delete setting by name for setting stored on project and imodel level", async () => {
    const layer = MapLayerSource.fromJSON({
      url: "test12345",
      name: testName,
      formatId: "test12345",
      maxZoom: 1,
      transparentBackground: true,
    });
    let success = await MapLayerSettingsService.storeSourceInSettingsService(layer!, true, projectId, iModelId);
    chai.assert.isTrue(success);
    success = await MapLayerSettingsService.deleteSharedSettingsByName(testName, projectId, iModelId);
    chai.assert.isTrue(success);
    success = await MapLayerSettingsService.storeSourceInSettingsService(layer!, false, projectId, iModelId);
    chai.assert.isTrue(success);
    success = await MapLayerSettingsService.deleteSharedSettingsByName(testName, projectId, iModelId);
    chai.assert.isTrue(success);
  });
});
