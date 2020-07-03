/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
import { expect } from "chai";
import { CategoryDescription } from "../../presentation-common/content/Category";
import { createRandomCategory, createRandomCategoryJSON } from "../_helpers/random";

describe("CategoryDescription", () => {

  describe("toJSON", () => {

    it("returns valid JSON for category without parent", () => {
      const category = { ...createRandomCategory(), parent: undefined };
      expect(CategoryDescription.toJSON(category)).to.deep.eq({
        ...category,
      });
    });

    it("returns valid JSON for category with parent", () => {
      const category = { ...createRandomCategory(), parent: createRandomCategory() };
      expect(CategoryDescription.toJSON(category)).to.deep.eq({
        ...category,
        parent: category.parent.name,
      });
    });

  });

  describe("listFromJSON", () => {

    it("creates categories and sets up correct parent-child relationships", () => {
      const r1 = { ...createRandomCategoryJSON(), name: "r1", parent: undefined };
      const c11 = { ...createRandomCategoryJSON(), name: "c11", parent: "r1" };
      const c12 = { ...createRandomCategoryJSON(), name: "c12", parent: "r1" };
      const c121 = { ...createRandomCategoryJSON(), name: "c121", parent: "c12" };
      const r2 = { ...createRandomCategoryJSON(), name: "r2", parent: undefined };
      const list = [r1, r2, c121, c11, c12]; // put them in random order
      const categories = CategoryDescription.listFromJSON(list);
      expect(categories.length).to.eq(5);

      const map: { [id: string]: CategoryDescription } = {};
      categories.forEach((c) => map[c.name] = c);

      expect(map.r1.parent).to.be.undefined;
      expect(map.r2.parent).to.be.undefined;
      expect(map.c11.parent).to.eq(map.r1);
      expect(map.c12.parent).to.eq(map.r1);
      expect(map.c121.parent).to.eq(map.c12);
    });

  });

});
