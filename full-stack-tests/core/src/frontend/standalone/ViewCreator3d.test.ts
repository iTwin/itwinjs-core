/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
import { expect } from "chai";
import { IModelConnection, ScreenViewport, SnapshotConnection, ViewCreator3d} from "@itwin/core-frontend";
import { TestUtility } from "../TestUtility";

describe("ViewCreator3d", async () => {
  let imodel: IModelConnection;

  before(async () => {
    await TestUtility.startFrontend();
    imodel = await SnapshotConnection.openFile("mirukuru.ibim");
  });

  after(async () => {
    await imodel?.close();
    await TestUtility.shutdownFrontend();
  });

  it("should generate tiles when using a viewstate created by viewcreator3d", async () => {
    const div = document.createElement("div");
    div.style.width = div.style.height = "20px";
    document.body.appendChild(div);
    const viewcreator3d = new ViewCreator3d(imodel);
    const viewState = await viewcreator3d.createDefaultView();
    expect(viewState).to.exist.and.be.not.empty;
    viewState.viewFlags = viewState.viewFlags.with("backgroundMap", false);

    const testVp: ScreenViewport = ScreenViewport.create(div, viewState);
    await testVp.waitForSceneCompletion();

    expect(testVp.numReadyTiles).to.equal(1);
    expect(testVp.numSelectedTiles).to.equal(1);
  });
});

