/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
import { expect } from "chai";
import { Id64 } from "@itwin/core-bentley";
import { IModelConnection, SnapshotConnection } from "@itwin/core-frontend";
import { TestUtility } from "../TestUtility.js";

describe("IModelConnection.Categories", () => {
  const c1 = "0x17";
  const s1 = "0x18";
  const c2 = "0x19"; // DrawingCategory -- the rest are SpatialCategory.
  const s2 = "0x1a";
  const c3 = "0x2d";
  const s3 = "0x2e";
  const c4 = "0x2f";
  const s41 = "0x30";
  const s42 = "0x33";
  const c5 = "0x31";
  const s5 = "0x32";

  const allCats = [c1, c2, c3, c4, c5];

  let imodel: IModelConnection;

  before(async () => {
    await TestUtility.startFrontend(undefined, true);
    imodel = await SnapshotConnection.openFile("test.bim");
  });

  after(async () => {
    await imodel.close();
    await TestUtility.shutdownFrontend();
  });

  function reset(): void {
    imodel.subcategories.clear();
  }

  afterEach(() => reset());

  function expectSubCategory(subcat: IModelConnection.Categories.SubCategoryInfo, id: string, categoryId: string): void {
    expect(subcat.id).to.equal(id);
    expect(subcat.categoryId).to.equal(categoryId);
  }

  function expectCategory(cat: IModelConnection.Categories.CategoryInfo, id: string, expectedSubCategoryIds: string | string[]): void {
    expect(cat.id).to.equal(id);
    if ("string" === typeof expectedSubCategoryIds)
      expectedSubCategoryIds = [expectedSubCategoryIds];

    expect(cat.subCategories.size).to.equal(expectedSubCategoryIds.length);
    for (const subcatId of expectedSubCategoryIds) {
      const subcat = cat.subCategories.get(subcatId)!;
      expect(subcat).not.to.be.undefined;
      expectSubCategory(subcat, subcatId, id);
    }
  }

  it("queries categories", async () => {
    let cats = await imodel.categories.getCategoryInfo(allCats);
    expect(cats.size).to.equal(5);
    expectCategory(cats.get(c1)!, c1, s1);
    expectCategory(cats.get(c2)!, c2, s2);
    expectCategory(cats.get(c3)!, c3, s3);
    expectCategory(cats.get(c4)!, c4, [s41, s42]);
    expectCategory(cats.get(c5)!, c5, s5);

    cats = await imodel.categories.getCategoryInfo(c4);
    expect(cats.size).to.equal(1);
    expectCategory(cats.get(c4)!, c4, [s41, s42]);
  });

  it("queries subcategories", async () => {
    const subcats = await imodel.categories.getSubCategoryInfo({ category: c4, subCategories: [s41, s42] });
    expect(subcats.size).to.equal(2);
    expectSubCategory(subcats.get(s41)!, s41, c4);
    expectSubCategory(subcats.get(s42)!, s42, c4);
  });

  it("produces no subcategories for invalid or non-existent Ids", async () => {
    const badIds = [Id64.invalid, "0xNotAnId", "", "0x12345678"];
    for (const catId of badIds) {
      const cats = await imodel.categories.getCategoryInfo(catId);
      expect(cats.size).to.equal(1);
      expectCategory(cats.get(catId)!, catId, []);

      let subcats = await imodel.categories.getSubCategoryInfo({ category: catId, subCategories: badIds });
      expect(subcats.size).to.equal(0);
      subcats = await imodel.categories.getSubCategoryInfo({ category: c1, subCategories: badIds });
      expect(subcats.size).to.equal(0);
      subcats = await imodel.categories.getSubCategoryInfo({ category: c1, subCategories: [...badIds, s1] });
      expect(subcats.size).to.equal(1);
      expect(subcats.get(s1)).not.to.be.undefined;
    }
  });

  it("omits subcategories that don't belong to specified category", async () => {
    const subcats = await imodel.categories.getSubCategoryInfo({ category: c1, subCategories: [s1, s2, s41, s42, s3] });
    expect(subcats.size).to.equal(1);
    expect(subcats.get(s1)).not.to.be.undefined;
  });

  it("ignores duplicate Ids", async () => {
    const cats = await imodel.categories.getCategoryInfo([...allCats, ...allCats]);
    expect(cats.size).to.equal(5);
    expect(Array.from(cats.keys()).sort()).to.deep.equal(allCats);

    const subcats = await imodel.categories.getSubCategoryInfo({ category: c4, subCategories: [s41, s42, s42, s41] });
    expect(subcats.size).to.equal(2);
    expect(subcats.get(s41)).not.to.be.undefined;
    expect(subcats.get(s42)).not.to.be.undefined;
  });
});
