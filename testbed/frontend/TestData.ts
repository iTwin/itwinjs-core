/*---------------------------------------------------------------------------------------------
|  $Copyright: (c) 2018 Bentley Systems, Incorporated. All rights reserved. $
 *--------------------------------------------------------------------------------------------*/
import { assert } from "chai";
import { AuthorizationToken, AccessToken, ImsActiveSecureTokenClient, ImsDelegationSecureTokenClient, Briefcase } from "@bentley/imodeljs-clients";
import { ConnectClient, Project, IModelHubClient, IModelQuery } from "@bentley/imodeljs-clients";

export class TestData {
  public static user = {
    email: "Regular.IModelJsTestUser@mailinator.com",
    password: "Regular@iMJs",
  };

  public static connectClient = new ConnectClient("QA");
  public static hubClient = new IModelHubClient("QA");
  public static accessToken: AccessToken;
  public static testProjectId: string;
  public static testIModelId: string;
  public static testChangeSetId: string;

  private static async purgeAcquiredBriefcases(accessToken: AccessToken, iModelId: string, acquireThreshold: number = 16): Promise<void> {
    const briefcases: Briefcase[] = await TestData.hubClient.Briefcases().get(accessToken, iModelId);
    if (briefcases.length > acquireThreshold) {
      console.log(`Reached limit of maximum number of briefcases for ${iModelId}. Purging all briefcases.`); // tslint:disable-line:no-console
      const promises = new Array<Promise<void>>();
      briefcases.forEach((briefcase: Briefcase) => {
        promises.push(TestData.hubClient.Briefcases().delete(accessToken, iModelId, briefcase.briefcaseId!));
      });
      await Promise.all(promises);
    }
  }

  public static async load() {
    TestData.accessToken = await TestData.getTestUserAccessToken();
    TestData.testProjectId = await TestData.getTestProjectId(TestData.accessToken, "iModelJsTest");
    TestData.testIModelId = await TestData.getTestIModelId(TestData.accessToken, TestData.testProjectId, "ConnectionReadTest");
    await TestData.purgeAcquiredBriefcases(TestData.accessToken, TestData.testIModelId);
  }

  public static async getTestUserAccessToken(): Promise<AccessToken> {
    const authToken: AuthorizationToken = await (new ImsActiveSecureTokenClient("QA")).getToken(TestData.user.email, TestData.user.password);
    assert(authToken);

    const accessToken = await (new ImsDelegationSecureTokenClient("QA")).getToken(authToken!);
    assert(accessToken);

    return accessToken;
  }

  public static async getTestProjectId(accessToken: AccessToken, projectName: string): Promise<string> {
    const project: Project = await TestData.connectClient.getProject(accessToken, {
      $select: "*",
      $filter: "Name+eq+'" + projectName + "'",
    });
    assert(project && project.wsgId);
    return project.wsgId;
  }

  public static async getTestIModelId(accessToken: AccessToken, projectId: string, iModelName: string): Promise<string> {
    const iModels = await TestData.hubClient.IModels().get(accessToken, projectId, new IModelQuery().byName(iModelName));
    assert(iModels.length > 0);
    assert(iModels[0].wsgId);

    return iModels[0].wsgId;
  }

}
