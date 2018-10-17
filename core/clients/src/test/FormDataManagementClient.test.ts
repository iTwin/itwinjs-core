/*---------------------------------------------------------------------------------------------
* Copyright (c) 2018 Bentley Systems, Incorporated. All rights reserved.
* Licensed under the MIT License. See LICENSE.md in the project root for license terms.
*--------------------------------------------------------------------------------------------*/
import * as chai from "chai";
import { AuthorizationToken, AccessToken } from "../Token";
import { TestConfig } from "./TestConfig";
import { FormDataManagementClient, FormDefinition, FormInstanceData } from "../FormDataManagementClient";
import { ActivityLoggingContext } from "@bentley/bentleyjs-core";

chai.should();

describe.skip("FormDataManagementClient", () => {

  let accessToken: AccessToken;
  let actx: ActivityLoggingContext;
  const formDataManagementClient: FormDataManagementClient = new FormDataManagementClient();
  const projectId: string = "0f4cf9a5-5b69-4189-b7a9-60f6a5a369a7";

  before(async function (this: Mocha.IHookCallbackContext) {

    this.enableTimeouts(false);
    actx = new ActivityLoggingContext("");
    if (TestConfig.enableMocks)
      return;

    process.env.NODE_TLS_REJECT_UNAUTHORIZED = "0";
    const authToken: AuthorizationToken = await TestConfig.login();
    accessToken = await formDataManagementClient.getAccessToken(actx, authToken);
  });

  it("should be able to retrieve Form Definitions (#integration)", async function (this: Mocha.ITestCallbackContext) {
    const formDefinitions: FormDefinition[] = await formDataManagementClient.getFormDefinitions(accessToken, actx, projectId);
    chai.assert(formDefinitions);
  });

  it("should be able to retrieve Risk Issue Form Definitions (#integration)", async function (this: Mocha.ITestCallbackContext) {
    if (TestConfig.enableMocks)
      this.skip();

    const formDefinitions: FormDefinition[] = await formDataManagementClient.getRiskIssueFormDefinitions(accessToken, actx, projectId);
    chai.assert(formDefinitions);
  });

  it("should be able to create new Form Data (#integration)", async function (this: Mocha.ITestCallbackContext) {
    if (TestConfig.enableMocks)
      this.skip();

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

  it("should be able to create new Risk Issue Form Data (#integration)", async function (this: Mocha.ITestCallbackContext) {
    if (TestConfig.enableMocks)
      this.skip();

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

  it("should be able to retrieve Form Data (#integration)", async function (this: Mocha.ITestCallbackContext) {
    if (TestConfig.enableMocks)
      this.skip();

    const formData: FormInstanceData[] = await formDataManagementClient.getFormData(accessToken, actx, projectId, "Issue");
    chai.assert(formData);
  });

  it("should be able to retrieve Risk Issue Form Data (#integration)", async function (this: Mocha.ITestCallbackContext) {
    if (TestConfig.enableMocks)
      this.skip();

    const iModelId = "b702d44e-d8c0-4978-9a41-b6cdddcb5619";
    const formData: FormInstanceData[] = await formDataManagementClient.getRiskIssueFormData(accessToken, actx, projectId, iModelId, "Issue");
    chai.assert(formData);
  });

});
