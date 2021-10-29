/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
import { expect } from "chai";
import * as faker from "faker";
import sinon from "sinon";
import { PropertyCategoryLabelFilterer } from "../../../../components-react/propertygrid/dataproviders/filterers/PropertyCategoryLabelFilterer";
import { FilteredType } from "../../../../components-react/propertygrid/dataproviders/filterers/PropertyDataFiltererBase";
import { PropertyCategory } from "../../../../components-react/propertygrid/PropertyDataProvider";

describe("PropertyCategoryLabelFilterer", () => {

  describe("When filter text not set", () => {
    const categoryToTest: PropertyCategory =
    {
      name: "Cat1", label: "Category 1", expand: true, childCategories: [
        { name: "Cat1-1", label: "Category 1-1", expand: true, childCategories: [] },
      ],
    };

    describe("[get] filterText", () => {
      it(`Should return empty string`, () => {
        const filterer = new PropertyCategoryLabelFilterer();
        expect(filterer.filterText).to.be.equal("");
      });

      it(`Should return string which was set in the constructor`, () => {
        const filterer = new PropertyCategoryLabelFilterer("test");
        expect(filterer.filterText).to.be.equal("test");
      });
    });

    it(`Should return filtering as disabled`, () => {
      const filterer = new PropertyCategoryLabelFilterer();
      expect(filterer.isActive).to.be.false;
    });

    it(`Should always return 'matchesFilter: true' when calling 'recordMatchesFilter'`, async () => {
      const filterer = new PropertyCategoryLabelFilterer();

      const matchResult = await filterer.recordMatchesFilter();
      expect(matchResult).to.deep.eq({ matchesFilter: true });
    });

    it(`Should always return 'matchesFilter: true' to any given category`, async () => {
      const filterer = new PropertyCategoryLabelFilterer();

      const matchResult = await filterer.categoryMatchesFilter(categoryToTest);
      const matchResult2 = await filterer.categoryMatchesFilter(categoryToTest.childCategories![0]);
      expect(matchResult).to.deep.eq({ matchesFilter: true });
      expect(matchResult2).to.deep.eq({ matchesFilter: true });
    });
  });

  describe("When filter text set", () => {
    it("Should return lowercase string", () => {
      const filterer = new PropertyCategoryLabelFilterer();

      const expectedText = faker.random.word();
      filterer.filterText = expectedText;

      expect(filterer.filterText).to.be.equal(expectedText.toLowerCase());
    });

    it("Should return filtering as enabled", () => {
      const filterer = new PropertyCategoryLabelFilterer();

      filterer.filterText = faker.random.word();

      expect(filterer.isActive).to.be.true;
    });

    it("Should not match when given empty label property category", async () => {
      const filterer = new PropertyCategoryLabelFilterer();
      const category = { name: "Cat", label: "", expand: true, childCategories: [] };

      filterer.filterText = "SomeFilter";
      const matchResult = await filterer.categoryMatchesFilter(category);
      expect(matchResult).to.deep.eq({ matchesFilter: false });
    });

    it("Should not match when calling `recordMatchesFilter`", async () => {
      const filterer = new PropertyCategoryLabelFilterer();

      filterer.filterText = "SomeFilter";
      const matchResult = await filterer.recordMatchesFilter();
      expect(matchResult).to.deep.eq({ matchesFilter: false });
    });

    it("Should not match when given non matching property category", async () => {
      const filterer = new PropertyCategoryLabelFilterer();
      const category = { name: "Cat", label: "label", expand: true, childCategories: [] };

      filterer.filterText = "SomeFilter";
      const matchResult = await filterer.categoryMatchesFilter(category);
      expect(matchResult).to.deep.eq({ matchesFilter: false });
    });

    it("Should match when given partially matching property category", async () => {
      const filterer = new PropertyCategoryLabelFilterer();
      const category = { name: "Cat", label: "someFilterName", expand: true, childCategories: [] };

      filterer.filterText = "someFilter";
      const matchResult = await filterer.categoryMatchesFilter(category);
      expect(matchResult).to.deep.eq({ matchesFilter: true, shouldForceIncludeDescendants: true, shouldExpandNodeParents: true, matchesCount: 1, filteredTypes: [FilteredType.Category] });
    });

    it("Should match when given fully matching property category", async () => {
      const filterer = new PropertyCategoryLabelFilterer();
      const category = { name: "Cat", label: "displaySomefilteredNaMe", expand: true, childCategories: [] };

      filterer.filterText = "displaySomefilteredNaMe";
      const matchResult = await filterer.categoryMatchesFilter(category);
      expect(matchResult).to.deep.eq({ matchesFilter: true, shouldForceIncludeDescendants: true, shouldExpandNodeParents: true, matchesCount: 1, filteredTypes: [FilteredType.Category] });
    });

    it("Should match several times when given property category with repeated filter pattern", async () => {
      const filterer = new PropertyCategoryLabelFilterer();
      const category = { name: "Cat", label: "displaySomefilteredNaMe", expand: true, childCategories: [] };

      filterer.filterText = "mE";
      const matchResult = await filterer.categoryMatchesFilter(category);
      expect(matchResult).to.deep.eq({ matchesFilter: true, shouldForceIncludeDescendants: true, shouldExpandNodeParents: true, matchesCount: 2, filteredTypes: [FilteredType.Category] });
    });
  });

  describe("raising `onFilterChanged` event", () => {

    const spy = sinon.spy();
    let filterer: PropertyCategoryLabelFilterer;

    beforeEach(() => {
      filterer = new PropertyCategoryLabelFilterer();
      filterer.onFilterChanged.addListener(spy);
    });

    it("doesn't raise event when filter doesn't change", () => {
      filterer.filterText = "";
      expect(spy).to.not.be.called;

      filterer.filterText = "    ";
      expect(spy).to.not.be.called;

      filterer.filterText = "AAA";
      spy.resetHistory();

      filterer.filterText = "AAA";
      expect(spy).to.not.be.called;

      filterer.filterText = "aaa";
      expect(spy).to.not.be.called;
    });

    it("raises event when filter changes", () => {
      filterer.filterText = "a";
      expect(spy).to.be.calledOnce;

      filterer.filterText = "b";
      expect(spy).to.be.calledTwice;
    });

  });

});
