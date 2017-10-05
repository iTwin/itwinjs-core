/*---------------------------------------------------------------------------------------------
|  $Copyright: (c) 2017 Bentley Systems, Incorporated. All rights reserved. $
 *--------------------------------------------------------------------------------------------*/
import { IModelDb } from "../backend/IModelDb";
import { BisCore } from "../BisCore";
import { OpenMode } from "@bentley/bentleyjs-core/lib/BeSQLite";
import { AuthorizationToken, AccessToken, ImsActiveSecureTokenClient, ImsDelegationSecureTokenClient } from "@bentley/imodeljs-clients";
import { ConnectClient, Project, ChangeSet } from "@bentley/imodeljs-clients";
import { IModelHubClient } from "@bentley/imodeljs-clients";
import { Briefcase } from "@bentley/imodeljs-clients";
import { BriefcaseManager } from "../backend/BriefcaseManager";
import { IModelTestUtils } from "./IModelTestUtils";
import { expect, assert } from "chai";
import { IModelVersion } from "../IModelVersion";
import * as fs from "fs";
import * as path from "path";

declare const __dirname: string;

describe("BriefcaseManager", () => {
  let accessToken: AccessToken;
  let projectId: string;
  let iModelId: string;
  const hubClient = new IModelHubClient("QA");
  let changeSets: ChangeSet[];
  let iModelLocalPath: string;
  let shouldDeleteAllBriefcases: boolean = false;

  before(async () => {
    BisCore.registerSchema();

    const authToken: AuthorizationToken|undefined = await (new ImsActiveSecureTokenClient("QA")).getToken(IModelTestUtils.user.email, IModelTestUtils.user.password);
    expect(authToken);

    const token = await (new ImsDelegationSecureTokenClient("QA")).getToken(authToken!);
    expect(token);
    accessToken = token!;

    const projectName = "NodeJsTestProject";
    const project: Project | undefined = await (new ConnectClient("QA")).getProject(accessToken, {
      $select: "*",
      $filter: "Name+eq+'" + projectName + "'",
    });
    expect(project);

    projectId = project.wsgId;
    expect(projectId);

    const iModelName = "MyTestModel";
    iModelId = await getIModelId(iModelName);

    changeSets = await hubClient.getChangeSets(accessToken, iModelId, false);
    expect(changeSets.length).greaterThan(2);

    iModelLocalPath = path.join(__dirname, "../assets/imodels/", iModelId);

    // Recreate briefcases if it's a TMR. todo: Figure a better way to prevent bleeding briefcase ids
    shouldDeleteAllBriefcases = !fs.existsSync(BriefcaseManager.rootPath);
    if (shouldDeleteAllBriefcases)
      await deleteAllBriefcases(iModelId);
  });

  const getIModelId = async (iModelName: string) => {
    const iModels = await hubClient.getIModels(accessToken, projectId, {
      $select: "*",
      $filter: "Name+eq+'" + iModelName + "'",
    });
    expect(iModels.length > 0);

    const id = iModels[0].wsgId;
    expect(!!id);

    return id;
  };

  const deleteAllBriefcases = async (id: string) => {
    const promises = new Array<Promise<void>>();
    const briefcases = await hubClient.getBriefcases(accessToken, id);
    briefcases.forEach((briefcase: Briefcase) => {
      promises.push(hubClient.deleteBriefcase(accessToken, id, briefcase.briefcaseId));
    });
    await Promise.all(promises);
  };

  it("should be able to open an IModel from the Hub", async () => {
    const iModel: IModelDb = await IModelDb.open(accessToken, iModelId);
    assert.exists(iModel);

    expect(fs.existsSync(iModelLocalPath));
    const files = fs.readdirSync(iModelLocalPath);
    expect(files.length).greaterThan(0);

    await iModel.close(accessToken);
  });

  it("should reuse closed briefcases in ReadWrite mode", async () => {
    const files = fs.readdirSync(iModelLocalPath);

    const iModel: IModelDb = await IModelDb.open(accessToken, iModelId);
    assert.exists(iModel);
    await iModel.close(accessToken);

    const files2 = fs.readdirSync(iModelLocalPath);
    expect(files2.length).equals(files.length);
    const diff = files2.filter((item) => files.indexOf(item) < 0);
    expect(diff.length).equals(0);
  });

  it("should reuse open briefcases in Readonly mode", async () => {
    const briefcases = fs.readdirSync(iModelLocalPath);
    expect(briefcases.length).greaterThan(0);

    const iModels = new Array<IModelDb>();
    for (let ii = 0; ii < 5; ii++) {
      const iModel: IModelDb = await IModelDb.open(accessToken, iModelId, OpenMode.Readonly);
      assert.exists(iModel);
      iModels.push(iModel);
    }

    const briefcases2 = fs.readdirSync(iModelLocalPath);
    expect(briefcases2.length).equals(briefcases.length);
    const diff = briefcases2.filter((item) => briefcases.indexOf(item) < 0);
    expect(diff.length).equals(0);
  });

  it("should open a briefcase of a specific version in Readonly mode", async () => {
    const iModel: IModelDb = await IModelDb.open(accessToken, iModelId, OpenMode.Readonly, IModelVersion.afterChangeSet(changeSets[1].wsgId));
    assert.exists(iModel);

    const iModel2: IModelDb = await IModelDb.open(accessToken, iModelId, OpenMode.Readonly, IModelVersion.withName("SecondVersion"));
    assert.exists(iModel2);

    expect(iModel.briefcaseKey!.pathname).equals(iModel2.briefcaseKey!.pathname);
  });

  it("should open a briefcase of an iModel with no versions", async () => {
    const iModelId2 = await getIModelId("NoVersionsTest");

    if (shouldDeleteAllBriefcases)
      await deleteAllBriefcases(iModelId2);

    const iModel: IModelDb = await IModelDb.open(accessToken, iModelId2, OpenMode.Readonly);
    assert.exists(iModel);
  });

  // readme cases should always use standalone briefcase
  // should keep previously downloaded seed files and change sets
  // should not reuse open briefcases in ReadWrite mode
  // should not reuse open briefcases for different versions in Readonly mode
  // should reuse closed briefcases for newer versions
  // should not reuse closed briefcases for older versions
  // should delete closed briefcases if necessary
  // should reuse briefcases between users in readonly mode
  // should not reuse briefcases between users in readwrite mode
});
