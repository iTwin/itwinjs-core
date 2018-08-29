/*---------------------------------------------------------------------------------------------
|  $Copyright: (c) 2018 Bentley Systems, Incorporated. All rights reserved. $
 *--------------------------------------------------------------------------------------------*/
import * as chai from "chai";
import { ConnectClient } from "../ConnectClients";
import { ConnectSettingsClient } from "../SettingsClient";
import { SettingsStatus, SettingsResult } from "../SettingsAdmin";
import { AuthorizationToken, AccessToken } from "../Token";
import { TestConfig } from "./TestConfig";

chai.should();

describe("ConnectSettingsClient", () => {
  let accessToken: AccessToken;
  let authToken: AuthorizationToken;
  let projectId: string;
  let iModelId: string;
  let connectClient: ConnectClient;
  let settingsClient: ConnectSettingsClient;

  before(async function (this: Mocha.IHookCallbackContext) {
    if (TestConfig.enableMocks)
      return;

    TestConfig.deploymentEnv = "DEV";
    connectClient = new ConnectClient(TestConfig.deploymentEnv);
    settingsClient = new ConnectSettingsClient(TestConfig.deploymentEnv, "1001");
    authToken = await TestConfig.login();
    accessToken = await connectClient.getAccessToken(authToken);

    const { project, iModel } = await TestConfig.queryTestCase(accessToken, TestConfig.deploymentEnv, TestConfig.projectName, "test");

    projectId = project.wsgId;
    chai.expect(projectId);

    iModelId = iModel!.wsgId;
    chai.expect(iModelId);

  });

  it("should setup its URLs", async function (this: Mocha.ITestCallbackContext) {
    if (TestConfig.enableMocks)
      this.skip();

    const url: string = await settingsClient.getUrl();
    if ((TestConfig.deploymentEnv === "QA") || (TestConfig.deploymentEnv === "PERF"))
      chai.expect(url).equals("https://qa-connect-productsettingsservice.bentley.com");

    else if (TestConfig.deploymentEnv === "DEV")
      chai.expect(url).equals("https://dev-connect-productsettingsservice.bentley.com");

    else
      chai.expect(url).equals("https://connect-productsettingsservice.bentley.com");
  });

  it("should set and retrieve a User setting for this Application", async function (this: Mocha.ITestCallbackContext) {
    if (TestConfig.enableMocks)
      this.skip();

    const appUserSetting = { appString: "appString", appNumber: "appNumber", appArray: [1, 2, 3, 4] };

    // start by deleting all of the user settings of the type/version we're going to create.
    const deleteResult: SettingsResult = await settingsClient.deleteUserSetting("TestSettings", "AppUser", authToken, true);
    chai.expect(SettingsStatus.Success === deleteResult.status);

    const saveResult: SettingsResult = await settingsClient.saveUserSetting(appUserSetting, "TestSettings", "AppUser", authToken, true);
    chai.expect(SettingsStatus.Success === saveResult.status);

    const getResult: SettingsResult = await settingsClient.getUserSetting("TestSettings", "AppUser", authToken, true);
    chai.expect(SettingsStatus.Success === getResult.status);
    chai.expect(getResult.setting);
    chai.expect(getResult.setting.appString).equals(appUserSetting.appString);
    chai.expect(getResult.setting.appNumber === appUserSetting.appNumber);
    chai.expect(getResult.setting.length === appUserSetting.appArray.length);
    chai.expect(getResult.setting.appArray[0] === appUserSetting.appArray[0]);
  });
});
