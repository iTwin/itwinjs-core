/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
import { expect } from "chai";
import {
  IModelApp, RemoteBriefcaseConnection, SheetViewState,
} from "@bentley/imodeljs-frontend";
import { TestUsers } from "@bentley/oidc-signin-tool/lib/TestUsers";
import { TestUtility } from "./TestUtility";
import { testOnScreenViewport } from "../TestViewport";

describe("Sheet views (#integration)", () => {
  const projectName = "iModelJsIntegrationTest";
  let imodel: RemoteBriefcaseConnection;
  const sheetViewId = "0x96";
  const attachmentCategoryId = "0x93";

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

  it("loads view attachment info", async () => {
    const view = await imodel.views.load(sheetViewId) as SheetViewState;
    expect(view).instanceof(SheetViewState);

    const props = view.viewAttachmentProps;
    expect(props.length).to.equal(1);
    expect(props[0].category).to.equal(attachmentCategoryId);
  });

  it("clones view attachment info", async () => {
  });

  it("draws tiles from view attachments if so specified", async () => {
    await testOnScreenViewport(sheetViewId, imodel, 40, 30, async (vp) => {
      expect(vp.wantViewAttachments).to.be.true;
      vp.wantViewAttachments = true;
      await vp.waitForAllTilesToRender();
      const numTotalTiles = vp.numSelectedTiles;
      expect(numTotalTiles).least(2);

      vp.wantViewAttachments = false;
      await vp.waitForAllTilesToRender();
      const numSheetTiles = vp.numSelectedTiles;
      expect(numSheetTiles).least(1);
      expect(numSheetTiles).lessThan(numTotalTiles);

      vp.wantViewAttachments = true;
      await vp.waitForAllTilesToRender();
      expect(vp.numSelectedTiles).to.equal(numTotalTiles);

      expect(vp.sceneValid).to.be.true;
      vp.view.categorySelector.categories.delete(attachmentCategoryId);
      expect(vp.sceneValid).to.be.false;
      await vp.waitForAllTilesToRender();
      expect(vp.numSelectedTiles).to.equal(numSheetTiles);
    });
  });

  it("allocates attachments when attached to viewport and deallocates when detached", async () => {
  });
});
