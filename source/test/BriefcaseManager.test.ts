/*---------------------------------------------------------------------------------------------
|  $Copyright: (c) 2017 Bentley Systems, Incorporated. All rights reserved. $
 *--------------------------------------------------------------------------------------------*/
import { IModelConnection, IModelConnectionElements, IModelConnectionModels } from "../frontend/IModelConnection";
import { Id64 } from "@bentley/bentleyjs-core/lib/Id";
import { OpenMode } from "@bentley/bentleyjs-core/lib/BeSQLite";
import { AccessToken } from "@bentley/imodeljs-clients";
import { ChangeSet } from "@bentley/imodeljs-clients";
import { BriefcaseManager } from "../backend/BriefcaseManager";
import { IModelTestUtils } from "./IModelTestUtils";
import { expect, assert } from "chai";
import { Category } from "../Category";
import { CodeSpec, CodeSpecNames } from "../Code";
import { ElementProps } from "../ElementProps";
import { IModelVersion } from "../IModelVersion";
import { ModelProps } from "../ModelProps";
import * as fs from "fs";
import * as path from "path";

declare const __dirname: string;

describe("BriefcaseManager", () => {
  let accessToken: AccessToken;
  let testProjectId: string;
  let testIModelId: string;
  let testChangeSets: ChangeSet[];
  let iModelLocalPath: string;
  let shouldDeleteAllBriefcases: boolean = false;

  before(async () => {
    accessToken = await IModelTestUtils.getTestUserAccessToken();
    testProjectId = await IModelTestUtils.getTestProjectId(accessToken, "NodeJsTestProject");
    testIModelId = await IModelTestUtils.getTestIModelId(accessToken, testProjectId, "MyTestModel");

    testChangeSets = await IModelTestUtils.hubClient.getChangeSets(accessToken, testIModelId, false);
    expect(testChangeSets.length).greaterThan(2);

    iModelLocalPath = path.join(__dirname, "../assets/imodels/", testIModelId);

    // Recreate briefcases if it's a TMR. todo: Figure a better way to prevent bleeding briefcase ids
    shouldDeleteAllBriefcases = !fs.existsSync(BriefcaseManager.rootPath);
    if (shouldDeleteAllBriefcases)
      await IModelTestUtils.deleteAllBriefcases(accessToken, testIModelId);
  });

  it("should be able to open an IModel from the Hub", async () => {
    const iModel: IModelConnection = await IModelConnection.open(accessToken, testIModelId);
    assert.exists(iModel);

    expect(fs.existsSync(iModelLocalPath));
    const files = fs.readdirSync(iModelLocalPath);
    expect(files.length).greaterThan(0);

    await iModel.close(accessToken);
  });

  it("should reuse closed briefcases in ReadWrite mode", async () => {
    const files = fs.readdirSync(iModelLocalPath);

    const iModel: IModelConnection = await IModelConnection.open(accessToken, testIModelId);
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

    const iModels = new Array<IModelConnection>();
    for (let ii = 0; ii < 5; ii++) {
      const iModel: IModelConnection = await IModelConnection.open(accessToken, testIModelId, OpenMode.Readonly);
      assert.exists(iModel);
      iModels.push(iModel);
    }

    const briefcases2 = fs.readdirSync(iModelLocalPath);
    expect(briefcases2.length).equals(briefcases.length);
    const diff = briefcases2.filter((item) => briefcases.indexOf(item) < 0);
    expect(diff.length).equals(0);
  });

  it("should open briefcases of specific versions in Readonly mode", async () => {
    const versionNames = ["FirstVersion", "SecondVersion", "ThirdVersion"];

    for (const [changeSetIndex, versionName] of versionNames.entries()) {
      const iModelFromVersion: IModelConnection = await IModelConnection.open(accessToken, testIModelId, OpenMode.Readonly, IModelVersion.afterChangeSet(testChangeSets[changeSetIndex].wsgId));
      assert.exists(iModelFromVersion);

      const iModelFromChangeSet: IModelConnection = await IModelConnection.open(accessToken, testIModelId, OpenMode.Readonly, IModelVersion.withName(versionName));
      assert.exists(iModelFromChangeSet);

      expect(iModelFromVersion.iModelToken.pathname).equals(iModelFromChangeSet.iModelToken.pathname);
    }
  });

  it("should open a briefcase of an iModel with no versions", async () => {
    const iModelNoVerId = await IModelTestUtils.getTestIModelId(accessToken, testProjectId, "NoVersionsTest");

    if (shouldDeleteAllBriefcases)
      await IModelTestUtils.deleteAllBriefcases(accessToken, iModelNoVerId);

    const iModelNoVer: IModelConnection = await IModelConnection.open(accessToken, iModelNoVerId, OpenMode.Readonly);
    assert.exists(iModelNoVer);
  });

  it("should be able to get elements and models from an IModelConnection", async () => {
    const iModel: IModelConnection = await IModelConnection.open(accessToken, testIModelId);
    assert.exists(iModel);
    assert.isTrue(iModel instanceof IModelConnection);
    assert.exists(iModel.models);
    assert.isTrue(iModel.models instanceof IModelConnectionModels);
    assert.exists(iModel.elements);
    assert.isTrue(iModel.elements instanceof IModelConnectionElements);

    const elementIds: Id64[] = [iModel.elements.rootSubjectId];
    const elements: ElementProps[] = await iModel.elements.getElements(elementIds);
    assert.equal(elements.length, elementIds.length);
    assert.isTrue(iModel.elements.rootSubjectId.equals(new Id64(elements[0].id)));
    assert.isTrue(iModel.models.repositoryModelId.equals(new Id64(elements[0].model)));

    const queryElementIds: Id64[] = await iModel.elements.queryElementIds({ from: Category.sqlName, limit: 20, offset: 0 });
    assert.isAtLeast(queryElementIds.length, 1);
    assert.isTrue(queryElementIds[0] instanceof Id64);

    const formatObjs: any[] = await iModel.elements.formatElements(queryElementIds);
    assert.isAtLeast(formatObjs.length, 1);

    const modelIds: Id64[] = [iModel.models.repositoryModelId];
    const models: ModelProps[] = await iModel.models.getModels(modelIds);
    assert.exists(models);
    assert.equal(models.length, modelIds.length);
    assert.isTrue(iModel.models.repositoryModelId.equals(new Id64(models[0].id)));

    const rows: any[] = await iModel.executeQuery("SELECT CodeValue AS code FROM BisCore.Category");
    assert.isAtLeast(rows.length, 1);
    assert.exists(rows[0].code);
    assert.equal(rows.length, queryElementIds.length);

    const codeSpecByName: CodeSpec = await iModel.codeSpecs.getCodeSpecByName(CodeSpecNames.SpatialCategory());
    assert.exists(codeSpecByName);
    const codeSpecById: CodeSpec = await iModel.codeSpecs.getCodeSpecById(codeSpecByName.id);
    assert.exists(codeSpecById);

    await iModel.close(accessToken);
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
