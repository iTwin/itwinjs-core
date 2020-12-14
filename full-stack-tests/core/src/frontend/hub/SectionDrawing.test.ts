/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
import { expect } from "chai";
import {
  IModelApp,
  IModelConnection,
  RemoteBriefcaseConnection,
  SectionDrawingModelState,
} from "@bentley/imodeljs-frontend";
import { TestUsers } from "@bentley/oidc-signin-tool/lib/TestUsers";
import { TestUtility } from "./TestUtility";

describe("SectionDrawings (#integration)", () => {
  const projectName = "iModelJsIntegrationTest";
  let imodel: IModelConnection;

  before(async () => {
    await IModelApp.startup({
      authorizationClient: await TestUtility.initializeTestProject(projectName, TestUsers.regular),
      imodelClient: TestUtility.imodelCloudEnv.imodelClient,
      applicationVersion: "1.2.1.1",
    });

    const projectId = await TestUtility.getTestProjectId(projectName);
    const iModelId = await TestUtility.getTestIModelId(projectId, "SectionDrawingLocations");
    imodel = await RemoteBriefcaseConnection.open(projectId, iModelId);
  });

  after(async () => {
    if (imodel)
      await imodel.close();

    await IModelApp.shutdown();
  });

  it("instantiates a SectionDrawingModelState", async () => {
    const modelIds = [ "0x70", "0x72", "0xa1" ];
    await imodel.models.load(modelIds);
    for (const modelId of modelIds) {
      const model = imodel.models.getLoaded(modelId)!;
      expect(model).not.to.be.undefined;
      expect(model).instanceof(SectionDrawingModelState);
    }
  });
});
