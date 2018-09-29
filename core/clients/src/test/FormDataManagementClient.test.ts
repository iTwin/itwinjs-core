/*---------------------------------------------------------------------------------------------
* Copyright (c) 2018 - present Bentley Systems, Incorporated. All rights reserved.
* Licensed under the MIT License. See LICENSE.md in the project root for license terms.
*--------------------------------------------------------------------------------------------*/
import * as chai from "chai";
import { AuthorizationToken, AccessToken } from "../Token";
import { TestConfig } from "./TestConfig";
import { FormDataManagementClient, FormDefinition, FormInstanceData } from "../FormDataManagementClient";
import { UrlDiscoveryMock } from "./ResponseBuilder";
import { DeploymentEnv, UrlDescriptor } from "../Client";
import { ActivityLoggingContext } from "@bentley/bentleyjs-core";

chai.should();

export class FormDataManagemenUrlMock {
  private static readonly _urlDescriptor: UrlDescriptor = {
    DEV: "https://dev-formswsg-eus.cloudapp.net",
    QA: "https://qa-formswsg-eus.cloudapp.net",
    PROD: "https://connect-formswsg.bentley.com",
    PERF: "https://perf-formswsg-eus.cloudapp.net",
  };

  public static getUrl(env: DeploymentEnv): string {
    return this._urlDescriptor[env];
  }

  public static mockGetUrl(env: DeploymentEnv) {
    UrlDiscoveryMock.mockGetUrl(FormDataManagementClient.searchKey, env, this._urlDescriptor[env]);
  }
}

describe("FormDataManagementClient", () => {

  let accessToken: AccessToken;
  let actx: ActivityLoggingContext;
  const formDataManagementClient: FormDataManagementClient = new FormDataManagementClient("DEV");
  const projectId: string = "0f4cf9a5-5b69-4189-b7a9-60f6a5a369a7";

  before(async function (this: Mocha.IHookCallbackContext) {
    process.env.NODE_TLS_REJECT_UNAUTHORIZED = "0";
    const authToken: AuthorizationToken = await TestConfig.login();
    actx = new ActivityLoggingContext("");
    accessToken = await formDataManagementClient.getAccessToken(actx, authToken);
  });

  it("should setup its URLs", async () => {
    FormDataManagemenUrlMock.mockGetUrl("DEV");
    let url: string = await new FormDataManagementClient("DEV").getUrl(actx, true);
    chai.expect(url).equals("https://dev-formswsg-eus.cloudapp.net");

    FormDataManagemenUrlMock.mockGetUrl("QA");
    url = await new FormDataManagementClient("QA").getUrl(actx, true);
    chai.expect(url).equals("https://qa-formswsg-eus.cloudapp.net");

    FormDataManagemenUrlMock.mockGetUrl("PROD");
    url = await new FormDataManagementClient("PROD").getUrl(actx, true);
    chai.expect(url).equals("https://connect-formswsg.bentley.com");

    FormDataManagemenUrlMock.mockGetUrl("PERF");
    url = await new FormDataManagementClient("PERF").getUrl(actx, true);
    chai.expect(url).equals("https://perf-formswsg-eus.cloudapp.net");
  });

  it("should be able to retrieve Form Definitions", async function (this: Mocha.ITestCallbackContext) {
    const formDefinitions: FormDefinition[] = await formDataManagementClient.getFormDefinitions(accessToken, actx, projectId);
    chai.assert(formDefinitions);
  });

  it("should be able to retrieve Risk Issue Form Definitions", async function (this: Mocha.ITestCallbackContext) {
    const formDefinitions: FormDefinition[] = await formDataManagementClient.getRiskIssueFormDefinitions(accessToken, actx, projectId);
    chai.assert(formDefinitions);
  });

  it("should be able to create new Form Data", async function (this: Mocha.ITestCallbackContext) {

    const definitions: FormDefinition[] = await formDataManagementClient.getFormDefinitions(accessToken, actx, projectId);
    const formDef = definitions[0];
    const formId = formDef.formId!;

    const formData = {
      formId,
      properties: {
        _ContainerId: "CivilTest.imodel",
        _CreatedDate: "2015-07-28T06:07:34Z",
        _Description: "Test FeatureDescription",
        _ItemId: "f76bd999504568fd6b076977440d34859be4e1f8",
        _ModifiedDate: "2015-07-28T06:07:34Z",
        _Subject: "Test Feature",
        _Classification: "Punchlist",
        _Discipline: "Issue",
        ApprovedBy: "Test ApprovedBy",
        ApprovedById: "Test ApprovedById",
      },
    } as FormInstanceData;

    const newFromData: FormInstanceData = await formDataManagementClient.postFormData(accessToken, actx, formData, projectId, "Issue");
    chai.assert(newFromData);
  });

  it("should be able to create new Risk Issue Form Data", async function (this: Mocha.ITestCallbackContext) {

    const definitions: FormDefinition[] = await formDataManagementClient.getRiskIssueFormDefinitions(accessToken, actx, projectId);
    const formDef = definitions[0];

    const formId = formDef.formId!;
    const iModelId = "b702d44e-d8c0-4978-9a41-b6cdddcb5619";
    const elementId = "f76bd999504568fd6b076977440d34859be4e1f8";
    const properties: any = {
      _CreatedDate: "2015-07-28T06:07:34Z",
      _Description: "Test FeatureDescription",
      _ModifiedDate: "2015-07-28T06:07:34Z",
      _Subject: "Test Feature",
      AssignedTo: "Test AssignedTo",
      AssignedToId: "Test AssignedToId",
    };

    const newFromData: FormInstanceData = await formDataManagementClient.postRiskIssueFormData(accessToken, actx, properties, projectId, iModelId, elementId, formId, "Issue");
    chai.assert(newFromData);
  });

  it("should be able to retrieve Form Data", async function (this: Mocha.ITestCallbackContext) {
    const formData: FormInstanceData[] = await formDataManagementClient.getFormData(accessToken, actx, projectId, "Issue");
    chai.assert(formData);
  });

  it("should be able to retrieve Risk Issue Form Data", async function (this: Mocha.ITestCallbackContext) {
    const iModelId = "b702d44e-d8c0-4978-9a41-b6cdddcb5619";
    const formData: FormInstanceData[] = await formDataManagementClient.getRiskIssueFormData(accessToken, actx, projectId, iModelId, "Issue");
    chai.assert(formData);
  });

});
