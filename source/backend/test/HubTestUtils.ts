/*---------------------------------------------------------------------------------------------
|  $Copyright: (c) 2018 Bentley Systems, Incorporated. All rights reserved. $
 *--------------------------------------------------------------------------------------------*/
import { TestConfig } from "./TestConfig";
import { ConnectClient, IModelHubClient, ImsActiveSecureTokenClient, ImsDelegationSecureTokenClient } from "@bentley/imodeljs-clients";
import { AuthorizationToken, AccessToken, UserProfile } from "@bentley/imodeljs-clients";
import { Project, IModel, Briefcase } from "@bentley/imodeljs-clients";
import { assert, expect } from "chai";

export class HubTestUtils {
  public accessToken: AccessToken;
  public hubClient: IModelHubClient;
  public testUserProfile: UserProfile;
  public testProject: Project;
  public testIModel: IModel;
  public testBriefcase: Briefcase;

  constructor() {
    this.hubClient = new IModelHubClient("QA");
  }

  public async initialize(): Promise<void> {
    const authToken: AuthorizationToken = await (new ImsActiveSecureTokenClient("QA")).getToken(TestConfig.email, TestConfig.password);
    this.accessToken = await (new ImsDelegationSecureTokenClient("QA")).getToken(authToken);

    this.testUserProfile = this.accessToken.getUserProfile()!;
    this.testProject = await this.getTestProject(this.accessToken);
    this.testIModel = await this.getTestIModel(this.accessToken, this.testProject);
    this.testBriefcase = await this.getTestBriefcase(this.accessToken, this.testIModel);
  }

  private async getTestProject(accessToken: AccessToken): Promise<Project> {
    const project = await (new ConnectClient("QA")).getProject(accessToken, {
      $select: "*",
      $filter: "Name+eq+'" + TestConfig.projectName + "'",
    });
    assert.isDefined(project.wsgId);
    assert.isAtLeast(project.wsgId.length, 1);

    return project;
  }

  private async getTestIModel(accessToken: AccessToken, project: Project): Promise<IModel> {
    const imodels = await this.hubClient.getIModels(accessToken, project.wsgId, {
      $select: "*",
      $filter: "Name+eq+'" + TestConfig.iModelName + "'",
    });

    const imodel = imodels[0];
    assert.isDefined(imodel.wsgId);
    assert.isAtLeast(imodel.wsgId.length, 1);

    return imodel;
  }

  private async getTestBriefcase(accessToken: AccessToken, iModel: IModel): Promise<Briefcase> {
    let briefcases = await this.hubClient.getBriefcases(accessToken, iModel.wsgId);
    if (briefcases.length === 0) {
      await this.hubClient.acquireBriefcase(accessToken, iModel.wsgId);
      briefcases = await this.hubClient.getBriefcases(accessToken, iModel.wsgId);
      assert(briefcases.length > 0);
    }

    const briefcase = briefcases[0];
    assert.isDefined(briefcase);
    assert.isDefined(briefcase.userId);
    assert.isAtLeast(briefcase.userId!.length, 1);
    expect(briefcase.userId).equals(this.testUserProfile.userId);

    return briefcase;
  }

}
