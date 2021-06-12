/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/

import { expect } from "chai";
import sinon from "sinon";
import { MutableCustomGridCategory } from "../../../../../ui-components/propertygrid/internal/flat-items/MutableCustomGridCategory";
import { MutableGridItemFactory } from "../../../../../ui-components/propertygrid/internal/flat-items/MutableGridItemFactory";
import { PropertyCategory } from "../../../../../ui-components/propertygrid/PropertyDataProvider";
import { FlatGridTestUtils } from "./FlatGridTestUtils";

describe("MutableCustomGridCategory", () => {
  function createCategory(name: string, childCategories: string[]): PropertyCategory {
    return { name, label: name, expand: false, childCategories: childCategories.map((n) => createCategory(n, [])) };
  }

  const category = createCategory("test_category", ["nested_category"]);
  const recordsDict = FlatGridTestUtils.constructCategoryRecordsDict([category]);

  let factoryStub: sinon.SinonStubbedInstance<MutableGridItemFactory>;

  beforeEach(() => {
    factoryStub = sinon.createStubInstance(MutableGridItemFactory);
  });

  describe("constructor", () => {
    it("uses parentSelectionKey to construct a new selectionKey", () => {
      const categoryItem = new MutableCustomGridCategory(category, recordsDict, factoryStub, "parent", 0);
      expect(categoryItem.selectionKey).to.be.equal("parent_test_category");
    });

    it("successfully creates instance when category name is not present in `recordsDict`", () => {
      const emptyRecordsDict = FlatGridTestUtils.constructCategoryRecordsDict([]);
      const categoryItem = new MutableCustomGridCategory(category, emptyRecordsDict, factoryStub, "parent", 0);
      expect(categoryItem.getChildren()).to.be.empty;
    });
  });

  describe("isRootCategory", () => {
    it("is `true` when at depth 0", () => {
      const categoryItem = new MutableCustomGridCategory(category, recordsDict, factoryStub, undefined, 0);
      expect(categoryItem.isRootCategory).to.be.true;
    });

    it("is `false` when not at depth 0", () => {
      const categoryItem = new MutableCustomGridCategory(category, recordsDict, factoryStub, undefined, 1);
      expect(categoryItem.isRootCategory).to.be.false;
    });
  });

  describe("getSelf", () => {
    it("returns same object", () => {
      const categoryItem = new MutableCustomGridCategory(category, recordsDict, factoryStub, undefined, 0);
      expect(categoryItem.getSelf()).to.be.equal(categoryItem);
    });
  });

  describe("getChildCategories", () => {
    it("returns empty array", () => {
      const categoryItem = new MutableCustomGridCategory(category, recordsDict, factoryStub, undefined, 0);
      expect(categoryItem.getChildCategories()).to.be.empty;
    });
  });

  describe("getDescendantCategoriesAndSelf", () => {
    it("returns array containing only this object", () => {
      const categoryItem = new MutableCustomGridCategory(category, recordsDict, factoryStub, undefined, 0);
      expect(categoryItem.getDescendantCategoriesAndSelf()).to.be.deep.equal([categoryItem]);
    });
  });
});
