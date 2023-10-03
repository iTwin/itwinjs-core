/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
import { expect } from "chai";
import { SubCategoryAppearance } from "@itwin/core-common";
import { IModelConnection, ScreenViewport, SnapshotConnection, ViewCreator3d} from "@itwin/core-frontend";
import { TestUtility } from "../TestUtility.js";

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

  it("should optionally enable display of all subcategories", async () => {
    // This test works by replacing subcategory appearances in the iModel's SubCategoriesCache to change the default visibility of a subcategory.
    // In a real scenario the visibility would be obtained from the persistent subcategory appearance - our test iModels don't contain any
    // invisible subcategories to test with.
    // The iModel contains one spatial category 0x17 with one subcategory 0x18. We're adding a second pretend subcategory 0x20.
    imodel.subcategories.add("0x17", "0x18", new SubCategoryAppearance());
    imodel.subcategories.add("0x17", "0x20", new SubCategoryAppearance());

    const creator = new ViewCreator3d(imodel);
    let view = await creator.createDefaultView();
    function expectVisible(subcat18Vis: boolean, subcat20Vis: boolean): void {
      expect(view.isSubCategoryVisible("0x18")).to.equal(subcat18Vis);
      expect(view.isSubCategoryVisible("0x20")).to.equal(subcat20Vis);
    }

    expect(Array.from(view.categorySelector.categories)).to.deep.equal(["0x17"]);
    expectVisible(true, true);

    const invisibleAppearance = new SubCategoryAppearance({ invisible: true });
    imodel.subcategories.add("0x17", "0x18", invisibleAppearance);

    view = await creator.createDefaultView();
    expectVisible(false, true);

    view = await creator.createDefaultView({ allSubCategoriesVisible: false });
    expectVisible(false, true);

    view = await creator.createDefaultView({ allSubCategoriesVisible: true });
    expectVisible(true, true);

    imodel.subcategories.add("0x17", "0x20", invisibleAppearance);
    view = await creator.createDefaultView({ allSubCategoriesVisible: true });
    expectVisible(true, true);

    view = await creator.createDefaultView();
    expectVisible(false, false);
  });
});

