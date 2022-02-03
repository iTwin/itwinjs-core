/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
import { expect } from "chai";
import TestUtils from "../../../../TestUtils";
import type { IMutableCategorizedPropertyItem, IMutableFlatGridItem, IMutableGridCategoryItem } from "../../../../../components-react/propertygrid/internal/flat-items/MutableFlatGridItem";
import { FlatGridItemType } from "../../../../../components-react/propertygrid/internal/flat-items/MutableFlatGridItem";
import { FlatGridTestUtils as GridUtils } from "./FlatGridTestUtils";
import sinon from "sinon";
import { PropertyRecord } from "@itwin/appui-abstract";
import { MutableGridItemFactory } from "../../../../../components-react/propertygrid/internal/flat-items/MutableGridItemFactory";
import { MutableGridCategory } from "../../../../../components-react/propertygrid/internal/flat-items/MutableGridCategory";
import type { PropertyCategory } from "../../../../../components-react/propertygrid/PropertyDataProvider";
import type { GridCategoryItem } from "../../../../../components-react/propertygrid/internal/flat-items/FlatGridItem";

describe("GridCategory", () => {
  describe("GridCategory Mocked", () => {
    let factoryStub: sinon.SinonStubbedInstance<MutableGridItemFactory>;
    beforeEach(() => {
      factoryStub = sinon.createStubInstance(MutableGridItemFactory);
    });

    describe("Should correctly initialize grid category", () => {
      it("Should correctly initialize categorized array property", () => {
        const category = { name: "Cat1", label: "Cat 1", expand: false };
        const recordsDict = GridUtils.constructCategoryRecordsDict([category]);

        expect(() => new MutableGridCategory(category, recordsDict, factoryStub, "Cat0", -1)).to.throw(Error, "Depth cannot be negative");
      });

      it("Should correctly initialize grid category with no children", () => {
        const category = { name: "Cat1", label: "Cat 1", expand: false };
        const recordsDict = GridUtils.constructCategoryRecordsDict([category]);

        const gridCategory = new MutableGridCategory(category, recordsDict, factoryStub);

        expect(factoryStub.createCategorizedProperty.callCount).to.be.equal(0);
        expect(factoryStub.createGridCategory.callCount).to.be.equal(0);

        expect(gridCategory.parentSelectionKey).to.be.undefined;
        expect(gridCategory.parentCategorySelectionKey).to.be.undefined;

        GridUtils.assertCategoryEquals(gridCategory, category);
        expect(gridCategory.depth).to.be.equal(0);
      });

      it("Should correctly initialize grid category with no children and parent", () => {
        const category = { name: "Cat1", label: "Cat 1", expand: false };
        const recordsDict = GridUtils.constructCategoryRecordsDict([category]);

        const gridCategory = new MutableGridCategory(category, recordsDict, factoryStub, "Cat0", 1);

        expect(factoryStub.createCategorizedProperty.callCount).to.be.equal(0);
        expect(factoryStub.createGridCategory.callCount).to.be.equal(0);

        expect(gridCategory.parentSelectionKey).to.be.equal("Cat0");
        expect(gridCategory.parentCategorySelectionKey).to.be.equal("Cat0");

        GridUtils.assertCategoryEquals(gridCategory, category);
        expect(gridCategory.depth).to.be.equal(1);
      });

      it("Should correctly initialize grid category with children categories", () => {
        const category: PropertyCategory = {
          name: "Cat1", label: "Cat 1", expand: false, childCategories: [
            { name: "Cat1_1", label: "Cat 1_1", expand: false },
            { name: "Cat1_1", label: "Cat 1_1", expand: false },
          ],
        };
        const expectedRecordsDict = GridUtils.constructCategoryRecordsDict([category]);

        GridUtils.createGridCategoryStub(category, factoryStub);

        new MutableGridCategory(category, expectedRecordsDict, factoryStub);

        const children = category.childCategories!;
        expect(factoryStub.createGridCategory.callCount).to.be.equal(children.length);
        expect(factoryStub.createCategorizedProperty.callCount).to.be.equal(0);

        factoryStub.createGridCategory.args.forEach((args, index) => {
          const [childCategory, recordsDict, parentCategorySelectionKey, depth] = args;
          const expectedCategory = children[index];

          expect(childCategory).to.be.equal(expectedCategory);
          expect(recordsDict).to.be.equal(expectedRecordsDict);
          expect(depth).to.be.equal(1);
          expect(parentCategorySelectionKey).to.be.equal("Cat1");
        });
      });

      it("Should correctly initialize grid category with record children", () => {
        const category: PropertyCategory = { name: "Cat1", label: "Cat 1", expand: false };
        const expectedRecordsDict = GridUtils.constructCategoryRecordsDict([category]);
        const recordChildren = [
          TestUtils.createPrimitiveStringProperty("CADID1_1", "V1"),
          TestUtils.createStructProperty("CADID1_2"),
          TestUtils.createArrayProperty("CADID1_3"),
        ];
        expectedRecordsDict[category.name] = recordChildren;

        GridUtils.createCategorizedPropertyStub(recordChildren, factoryStub);

        new MutableGridCategory(category, expectedRecordsDict, factoryStub);

        expect(factoryStub.createGridCategory.callCount).to.be.equal(0);
        expect(factoryStub.createCategorizedProperty.callCount).to.be.equal(recordChildren.length);

        factoryStub.createCategorizedProperty.args.forEach((args, index) => {
          const [record, parentSelectionKey, parentCategorySelectionKey, depth] = args;
          const expectedRecord = recordChildren[index];

          expect(parentSelectionKey).to.be.equal("Cat1");
          expect(parentCategorySelectionKey).to.be.equal("Cat1");
          expect(depth).to.be.equal(0);
          expect(record).to.be.equal(expectedRecord);
        });
      });
    });

    describe("isExpanded", () => {
      function testIsExpanded(expectedIsExpanded: boolean) {
        it(`isExpanded should return ${expectedIsExpanded} when PropertyCategory expand: ${expectedIsExpanded}`, () => {
          const category: PropertyCategory = { name: "Cat1", label: "Cat 1", expand: expectedIsExpanded };
          const expectedRecordsDict = GridUtils.constructCategoryRecordsDict([category]);

          const gridCategory = new MutableGridCategory(category, expectedRecordsDict, factoryStub);

          expect(gridCategory.isExpanded).to.be.equal(expectedIsExpanded);
        });

        it(`isExpanded should return ${expectedIsExpanded} when isExpanded is set to: ${expectedIsExpanded}`, () => {
          const category: PropertyCategory = { name: "Cat1", label: "Cat 1", expand: !expectedIsExpanded };
          const expectedRecordsDict = GridUtils.constructCategoryRecordsDict([category]);

          const gridCategory = new MutableGridCategory(category, expectedRecordsDict, factoryStub);

          gridCategory.isExpanded = expectedIsExpanded;
          expect(gridCategory.isExpanded).to.be.equal(expectedIsExpanded);
        });
      }

      testIsExpanded(false);
      testIsExpanded(true);
    });

    describe("getSelf", () => {
      it("Should return self when getSelf called on grid category", () => {
        const category: PropertyCategory = { name: "Cat1", label: "Cat 1", expand: false };
        const recordsDict = GridUtils.constructCategoryRecordsDict([category]);

        const gridCategory = new MutableGridCategory(category, recordsDict, factoryStub);

        const self = gridCategory.getSelf();

        expect(self).to.be.equal(gridCategory);
      });
    });

    describe("Grid category parent-child tests", () => {
      let childRecords: PropertyRecord[];
      let childCategories: PropertyCategory[];
      beforeEach(() => {
        childCategories = [
          { name: "Cat1_1", label: "Cat 1_1", expand: false },
          { name: "Cat1_1", label: "Cat 1_1", expand: false },
        ];

        childRecords = [
          TestUtils.createPrimitiveStringProperty("CADID1_1", "V1"),
          TestUtils.createStructProperty("CADID1_2"),
          TestUtils.createArrayProperty("CADID1_3"),
        ];
      });

      describe("getChildren", () => {
        it("Should return empty array when grid category has no children", () => {
          const category: PropertyCategory = { name: "Cat1", label: "Cat 1", expand: false };
          const recordsDict = GridUtils.constructCategoryRecordsDict([category]);

          GridUtils.createGridCategoryStub(category, factoryStub);
          GridUtils.createCategorizedPropertyStub([], factoryStub);

          const gridCategory = new MutableGridCategory(category, recordsDict, factoryStub);

          const children = gridCategory.getChildren();

          expect(children).to.deep.equal([]);
        });

        it("Should return expected array of children when grid category has child categories", () => {
          const category: PropertyCategory = { name: "Cat1", label: "Cat 1", expand: false, childCategories };
          const recordsDict = GridUtils.constructCategoryRecordsDict([category]);

          const expectedCategories = GridUtils.createGridCategoryStub(category, factoryStub);
          GridUtils.createCategorizedPropertyStub([], factoryStub);

          const gridCategory = new MutableGridCategory(category, recordsDict, factoryStub);

          const children = gridCategory.getChildren();

          expect(children).to.deep.equal(expectedCategories);
        });

        it("Should return expected array of children when grid category has child records", () => {
          const category: PropertyCategory = { name: "Cat1", label: "Cat 1", expand: false };
          const recordsDict = GridUtils.constructCategoryRecordsDict([category]);
          recordsDict[category.name] = childRecords;

          GridUtils.createGridCategoryStub(category, factoryStub);
          const expectedProperties = GridUtils.createCategorizedPropertyStub(childRecords, factoryStub);

          const gridCategory = new MutableGridCategory(category, recordsDict, factoryStub);

          const children = gridCategory.getChildren();

          expect(children).to.deep.equal(expectedProperties);
        });

        it("Should return expected array of children when grid category has child records and categories", () => {
          const category: PropertyCategory = { name: "Cat1", label: "Cat 1", expand: false, childCategories };
          const recordsDict = GridUtils.constructCategoryRecordsDict([category]);
          recordsDict[category.name] = childRecords;

          const expectedCategories = GridUtils.createGridCategoryStub(category, factoryStub);
          const expectedProperties = GridUtils.createCategorizedPropertyStub(childRecords, factoryStub);

          const gridCategory = new MutableGridCategory(category, recordsDict, factoryStub);

          const children = gridCategory.getChildren();

          expect(children).to.deep.equal([...expectedProperties, ...expectedCategories]);
        });
      });

      describe("getDescendantsAndSelf", () => {
        it("Should return empty array when grid category has no children", () => {
          const category: PropertyCategory = { name: "Cat1", label: "Cat 1", expand: false };
          const recordsDict = GridUtils.constructCategoryRecordsDict([category]);

          GridUtils.createGridCategoryStub(category, factoryStub);
          GridUtils.createCategorizedPropertyStub([], factoryStub);

          const gridCategory = new MutableGridCategory(category, recordsDict, factoryStub);

          expect(gridCategory.getDescendantsAndSelf()).to.deep.equal([gridCategory]);
        });

        it("Should return descendants when getDescendantsAndSelf called on grid category with children", () => {
          const category: PropertyCategory = { name: "Cat1", label: "Cat 1", expand: false, childCategories };
          const recordsDict = GridUtils.constructCategoryRecordsDict([category]);
          recordsDict[category.name] = childRecords;

          const expectedCategories = GridUtils.createGridCategoryStub(category, factoryStub);
          const expectedProperties = GridUtils.createCategorizedPropertyStub(childRecords, factoryStub);

          const { expectedDescendants } = GridUtils.setupExpectedDescendants([...expectedProperties, ...expectedCategories], [
            { type: FlatGridItemType.Struct, isVisible: true },
            { type: FlatGridItemType.Array, isVisible: false },
            { type: FlatGridItemType.Primitive, isVisible: false },
            { type: FlatGridItemType.Primitive, isVisible: true },
          ]);

          const gridCategory = new MutableGridCategory(category, recordsDict, factoryStub);

          expect(gridCategory.getDescendantsAndSelf()).to.deep.equal([gridCategory, ...expectedDescendants]);
        });

        it("Should return descendants when getDescendantsAndSelf called on grid category with children", () => {
          const category: PropertyCategory = { name: "Cat1", label: "Cat 1", expand: false, childCategories };
          const recordsDict = GridUtils.constructCategoryRecordsDict([category]);
          recordsDict[category.name] = childRecords;

          const expectedCategories = GridUtils.createGridCategoryStub(category, factoryStub);
          const expectedProperties = GridUtils.createCategorizedPropertyStub(childRecords, factoryStub);

          const { expectedDescendants } = GridUtils.setupExpectedDescendants([...expectedProperties, ...expectedCategories], [
            { type: FlatGridItemType.Struct, isVisible: true },
            { type: FlatGridItemType.Array, isVisible: false },
            { type: FlatGridItemType.Primitive, isVisible: false },
            { type: FlatGridItemType.Primitive, isVisible: true },
          ]);

          const gridCategory = new MutableGridCategory(category, recordsDict, factoryStub);

          gridCategory.isExpanded = false;
          expect(gridCategory.getDescendantsAndSelf()).to.deep.equal([gridCategory, ...expectedDescendants]);

          gridCategory.isExpanded = true;
          expect(gridCategory.getDescendantsAndSelf()).to.deep.equal([gridCategory, ...expectedDescendants]);
        });
      });

      describe("getVisibleDescendantsAndSelf", () => {
        it("Should return self when called on grid category with no children", () => {
          const category: PropertyCategory = { name: "Cat1", label: "Cat 1", expand: false };
          const recordsDict = GridUtils.constructCategoryRecordsDict([category]);

          GridUtils.createGridCategoryStub(category, factoryStub);
          GridUtils.createCategorizedPropertyStub([], factoryStub);

          const gridCategory = new MutableGridCategory(category, recordsDict, factoryStub);

          gridCategory.isExpanded = false;
          expect(gridCategory.getVisibleDescendantsAndSelf()).to.deep.equal([gridCategory]);

          gridCategory.isExpanded = true;
          expect(gridCategory.getVisibleDescendantsAndSelf()).to.deep.equal([gridCategory]);
        });

        it("Should return self when grid category not expanded and has children", () => {
          const category: PropertyCategory = { name: "Cat1", label: "Cat 1", expand: false, childCategories };
          const recordsDict = GridUtils.constructCategoryRecordsDict([category]);
          recordsDict[category.name] = childRecords;

          const expectedCategories = GridUtils.createGridCategoryStub(category, factoryStub);
          const expectedProperties = GridUtils.createCategorizedPropertyStub(childRecords, factoryStub);

          GridUtils.setupExpectedDescendants([...expectedProperties, ...expectedCategories], [
            { type: FlatGridItemType.Struct, isVisible: true },
            { type: FlatGridItemType.Array, isVisible: false },
            { type: FlatGridItemType.Primitive, isVisible: false },
            { type: FlatGridItemType.Primitive, isVisible: true },
          ]);

          const gridCategory = new MutableGridCategory(category, recordsDict, factoryStub);

          gridCategory.isExpanded = false;
          expect(gridCategory.getVisibleDescendantsAndSelf()).to.deep.equal([gridCategory]);
        });

        it("Should return visible descendants when grid category expanded and has children without descendants", () => {
          const category: PropertyCategory = { name: "Cat1", label: "Cat 1", expand: false, childCategories };
          const recordsDict = GridUtils.constructCategoryRecordsDict([category]);
          recordsDict[category.name] = childRecords;

          const expectedCategories = GridUtils.createGridCategoryStub(category, factoryStub);
          const expectedProperties = GridUtils.createCategorizedPropertyStub(childRecords, factoryStub);

          const { expectedVisibleDescendants } = GridUtils.setupExpectedDescendants([...expectedProperties, ...expectedCategories], []);

          const gridCategory = new MutableGridCategory(category, recordsDict, factoryStub);

          gridCategory.isExpanded = true;
          expect(gridCategory.getVisibleDescendantsAndSelf()).to.deep.equal([gridCategory, ...expectedVisibleDescendants]);
        });

        it("Should return visible descendants when grid category expanded and has children with descendants", () => {
          const category: PropertyCategory = { name: "Cat1", label: "Cat 1", expand: false, childCategories };
          const recordsDict = GridUtils.constructCategoryRecordsDict([category]);
          recordsDict[category.name] = childRecords;

          const expectedCategories = GridUtils.createGridCategoryStub(category, factoryStub);
          const expectedProperties = GridUtils.createCategorizedPropertyStub(childRecords, factoryStub);

          const { expectedVisibleDescendants } = GridUtils.setupExpectedDescendants([...expectedProperties, ...expectedCategories], [
            { type: FlatGridItemType.Struct, isVisible: true },
            { type: FlatGridItemType.Array, isVisible: false },
            { type: FlatGridItemType.Primitive, isVisible: false },
            { type: FlatGridItemType.Primitive, isVisible: true },
          ]);

          const gridCategory = new MutableGridCategory(category, recordsDict, factoryStub);

          gridCategory.isExpanded = true;
          expect(gridCategory.getVisibleDescendantsAndSelf()).to.deep.equal([gridCategory, ...expectedVisibleDescendants]);
        });
      });

      describe("getLastVisibleDescendantOrSelf", () => {
        it("Should return self when called on grid category with no children", () => {
          const category: PropertyCategory = { name: "Cat1", label: "Cat 1", expand: false };
          const recordsDict = GridUtils.constructCategoryRecordsDict([category]);

          GridUtils.createGridCategoryStub(category, factoryStub);
          GridUtils.createCategorizedPropertyStub([], factoryStub);

          const gridCategory = new MutableGridCategory(category, recordsDict, factoryStub);

          gridCategory.isExpanded = false;
          expect(gridCategory.getLastVisibleDescendantOrSelf()).to.deep.equal(gridCategory);

          gridCategory.isExpanded = true;
          expect(gridCategory.getLastVisibleDescendantOrSelf()).to.deep.equal(gridCategory);
        });

        it("Should return self when grid category not expanded and has children", () => {
          const category: PropertyCategory = { name: "Cat1", label: "Cat 1", expand: false, childCategories };
          const recordsDict = GridUtils.constructCategoryRecordsDict([category]);
          recordsDict[category.name] = childRecords;

          const expectedCategories = GridUtils.createGridCategoryStub(category, factoryStub);
          const expectedProperties = GridUtils.createCategorizedPropertyStub(childRecords, factoryStub);

          GridUtils.setupExpectedDescendants([...expectedProperties, ...expectedCategories], [
            { type: FlatGridItemType.Struct, isVisible: true },
            { type: FlatGridItemType.Array, isVisible: false },
            { type: FlatGridItemType.Primitive, isVisible: false },
            { type: FlatGridItemType.Primitive, isVisible: true },
          ]);

          const gridCategory = new MutableGridCategory(category, recordsDict, factoryStub);

          gridCategory.isExpanded = false;
          expect(gridCategory.getLastVisibleDescendantOrSelf()).to.deep.equal(gridCategory);
        });

        it("Should return last visible descendant when grid category expanded and has children without descendants", () => {
          const category: PropertyCategory = { name: "Cat1", label: "Cat 1", expand: false, childCategories };
          const recordsDict = GridUtils.constructCategoryRecordsDict([category]);
          recordsDict[category.name] = childRecords;

          const expectedCategories = GridUtils.createGridCategoryStub(category, factoryStub);
          const expectedProperties = GridUtils.createCategorizedPropertyStub(childRecords, factoryStub);

          const { expectedLastVisibleDescendant } = GridUtils.setupExpectedDescendants([...expectedProperties, ...expectedCategories], []);

          const gridCategory = new MutableGridCategory(category, recordsDict, factoryStub);

          gridCategory.isExpanded = true;
          expect(gridCategory.getLastVisibleDescendantOrSelf()).to.deep.equal(expectedLastVisibleDescendant);
        });

        it("Should return last visible descendant when grid category expanded and has children with descendants", () => {
          const category: PropertyCategory = { name: "Cat1", label: "Cat 1", expand: false, childCategories };
          const recordsDict = GridUtils.constructCategoryRecordsDict([category]);
          recordsDict[category.name] = childRecords;

          const expectedCategories = GridUtils.createGridCategoryStub(category, factoryStub);
          const expectedProperties = GridUtils.createCategorizedPropertyStub(childRecords, factoryStub);

          const { expectedLastVisibleDescendant } = GridUtils.setupExpectedDescendants([...expectedProperties, ...expectedCategories], [
            { type: FlatGridItemType.Struct, isVisible: true },
            { type: FlatGridItemType.Array, isVisible: false },
            { type: FlatGridItemType.Primitive, isVisible: false },
            { type: FlatGridItemType.Primitive, isVisible: true },
          ]);

          const gridCategory = new MutableGridCategory(category, recordsDict, factoryStub);

          gridCategory.isExpanded = true;
          expect(gridCategory.getLastVisibleDescendantOrSelf()).to.deep.equal(expectedLastVisibleDescendant);
        });
      });
    });
  });

  describe("GridCategory Integration", () => {
    let gridItemFactory: MutableGridItemFactory;
    beforeEach(() => {
      gridItemFactory = new MutableGridItemFactory();
    });

    describe("Should correctly initialize grid category", () => {
      const categoriesToTest: PropertyCategory[] = [
        { name: "Category1", label: "Category 1", expand: false },
        { name: "C", label: "Cat 1", expand: true },
        { name: "Selected", label: "$élêçtèd Ítêm(s)", expand: true },
        { name: "1", label: "1", expand: false },
      ];

      for (const propertyCategory of categoriesToTest) {
        const categoryStr = `Name: ${propertyCategory.name}, Label ${propertyCategory.label}, Expand: ${propertyCategory.expand}`;
        it(`Should correctly initialize grid category from property category: (${categoryStr})`, () => {
          const categoryRecords = GridUtils.constructCategoryRecordsDict([propertyCategory]);

          const gridCategory = new MutableGridCategory(propertyCategory, categoryRecords, gridItemFactory);

          GridUtils.assertCategoryEquals(gridCategory, propertyCategory);
          expect(gridCategory.depth).to.be.equal(0);
          expect(gridCategory.isRootCategory).to.be.equal(true);
          expect(gridCategory.isExpanded).to.be.equal(propertyCategory.expand);
          expect(gridCategory.derivedCategory.expand).to.be.equal(propertyCategory.expand);
          expect(gridCategory.parentSelectionKey).to.be.equal(undefined);
          expect(gridCategory.parentCategorySelectionKey).to.be.equal(undefined);
        });

        it(`Should correctly initialize grid category with parent: (${categoryStr})`, () => {
          const parentPropertyCategory = { name: "Category0", label: "Category 0", expand: true };
          const categoryRecords = GridUtils.constructCategoryRecordsDict([propertyCategory, parentPropertyCategory]);

          const gridCategory = new MutableGridCategory(propertyCategory, categoryRecords, gridItemFactory, "ParentCategory", 1);

          GridUtils.assertCategoryEquals(gridCategory, propertyCategory);
          expect(gridCategory.depth).to.be.equal(1);
          expect(gridCategory.isRootCategory).to.be.equal(false);
          expect(gridCategory.isExpanded).to.be.equal(propertyCategory.expand);
          expect(gridCategory.derivedCategory.expand).to.be.equal(propertyCategory.expand);
          expect(gridCategory.parentSelectionKey).to.be.equal("ParentCategory");
          expect(gridCategory.parentCategorySelectionKey).to.be.equal("ParentCategory");
        });
      }
    });

    it(`Should correctly set isExpanded property`, () => {
      const propertyCategory = { name: "Category1", label: "Category 1", expand: false };
      const categoryRecords = GridUtils.constructCategoryRecordsDict([propertyCategory]);
      const gridCategory = new MutableGridCategory(propertyCategory, categoryRecords, gridItemFactory);

      const expectedExpand = !gridCategory.isExpanded;
      gridCategory.isExpanded = expectedExpand;

      expect(gridCategory.isExpanded).to.be.equal(expectedExpand);
      expect(gridCategory.derivedCategory.expand).to.be.equal(expectedExpand);
    });

    function assertParentChildCategoryRelationship(gridCategory: IMutableGridCategoryItem, propertyCategory: PropertyCategory, parentSelectionKey?: string, expectedDepth: number = 0) {
      // Test current gridCategory against propertyCategory
      GridUtils.assertCategoryEquals(gridCategory, propertyCategory);
      expect(gridCategory.depth).to.be.equal(expectedDepth);
      expect(gridCategory.isRootCategory).to.be.equal(expectedDepth === 0);
      expect(gridCategory.parentSelectionKey).to.be.equal(parentSelectionKey);
      expect(gridCategory.parentCategorySelectionKey).to.be.equal(parentSelectionKey);

      // Test current gridCategory descendants against flattened propertyCategory
      const descendants = gridCategory.getDescendantCategoriesAndSelf();
      const flattenedPropertyCategories = GridUtils.flattenPropertyCategories([propertyCategory], {});
      expect(descendants.length).to.be.equal(flattenedPropertyCategories.length);
      descendants.forEach((descendant, index) => GridUtils.assertCategoryEquals(descendant, flattenedPropertyCategories[index].item as PropertyCategory));

      // Test current gridCategory children parent-child category relationship (recursive)
      const childCategories = gridCategory.getChildCategories();
      const childPropertyCategories = propertyCategory.childCategories ?? [];
      expect(childCategories.length).to.be.equal(childPropertyCategories.length);
      childCategories.forEach((childCategory, index) => assertParentChildCategoryRelationship(childCategory, childPropertyCategories[index], gridCategory.selectionKey, expectedDepth + 1));
    }

    describe("Should correctly handle category to category parent-child relationship", () => {
      it(`Should correctly handle single child category`, () => {
        const propertyCategory: PropertyCategory = {
          name: "Category1", label: "Category 1", expand: true, childCategories: [
            { name: "Category2", label: "Category 2", expand: false },
          ],
        };

        const categoryRecords = GridUtils.constructCategoryRecordsDict([propertyCategory]);

        const gridCategory = new MutableGridCategory(propertyCategory, categoryRecords, gridItemFactory);

        const childCategories = gridCategory.getChildCategories();
        expect(gridCategory.getChildren()).to.deep.equal(childCategories);
        expect(gridCategory.getDescendantCategoriesAndSelf()).to.deep.equal([gridCategory, ...childCategories]);
        expect(gridCategory.getDescendantsAndSelf()).to.deep.equal([gridCategory, ...childCategories]);

        assertParentChildCategoryRelationship(gridCategory, propertyCategory);
      });

      it(`Should correctly handle multiple child categories`, () => {
        const propertyCategory: PropertyCategory = {
          name: "Category0", label: "Category 0", expand: true, childCategories: [
            { name: "Category0_0", label: "Category 0_0", expand: false },
            { name: "Category0_1", label: "Category 0_1", expand: true },
            { name: "Category0_2", label: "Category 0_2", expand: false },
          ],
        };

        const categoryRecords = GridUtils.constructCategoryRecordsDict([propertyCategory]);

        const gridCategory = new MutableGridCategory(propertyCategory, categoryRecords, gridItemFactory);

        const childCategories = gridCategory.getChildCategories();
        expect(gridCategory.getChildren()).to.deep.equal(childCategories);
        expect(gridCategory.getDescendantCategoriesAndSelf()).to.deep.equal([gridCategory, ...childCategories]);
        expect(gridCategory.getDescendantsAndSelf()).to.deep.equal([gridCategory, ...childCategories]);

        assertParentChildCategoryRelationship(gridCategory, propertyCategory);
      });

      it(`Should correctly handle deeply nested child categories`, () => {
        const propertyCategory: PropertyCategory = {
          name: "Category0", label: "Category 0", expand: true, childCategories: [
            {
              name: "Category0_0", label: "Category 0_0", expand: false, childCategories: [
                {
                  name: "Category0_0_0", label: "Category 0_0_0", expand: true, childCategories: [
                    { name: "Category0_0_0_0", label: "Category 0_0_0_0", expand: false },
                    { name: "Category0_0_0_1", label: "Category 0_0_0_1", expand: false },
                    { name: "Category0_0_0_2", label: "Category 0_0_0_2", expand: false },
                    { name: "Category0_0_0_3", label: "Category 0_0_0_3", expand: false },
                  ],
                },
                {
                  name: "Category0_0_1", label: "Category 0_0_1", expand: true, childCategories: [
                    { name: "Category0_0_1_0", label: "Category 0_0_1_0", expand: false },
                    { name: "Category0_0_1_1", label: "Category 0_0_1_1", expand: false },
                    { name: "Category0_0_1_2", label: "Category 0_0_1_2", expand: false },
                    { name: "Category0_0_1_3", label: "Category 0_0_1_3", expand: false },
                  ],
                },
              ],
            },
          ],
        };

        const categoryRecords = GridUtils.constructCategoryRecordsDict([propertyCategory]);

        const gridCategory = new MutableGridCategory(propertyCategory, categoryRecords, gridItemFactory);

        assertParentChildCategoryRelationship(gridCategory, propertyCategory);
      });
    });

    function assertCategorizedProperties(categorizedProperties: IMutableCategorizedPropertyItem[], expectedPropertyRecords: PropertyRecord[]) {
      expect(categorizedProperties.length).to.be.equal(expectedPropertyRecords.length);
      categorizedProperties.forEach((categorizedProperty, index) => GridUtils.assertPropertyEquals(categorizedProperty, expectedPropertyRecords[index]));
    }

    function assertCategoryCategorizedProperties(gridCategory: IMutableGridCategoryItem, records: PropertyRecord[]) {
      // Compare category children records
      const categorizedProperties = GridUtils.filterProperties(gridCategory.getChildren());
      assertCategorizedProperties(categorizedProperties, records);

      // Compare category descendant records
      const descendants = GridUtils.filterProperties(gridCategory.getDescendantsAndSelf());
      const flatRecords = GridUtils.flattenPropertyRecords(records, gridCategory.selectionKey).map((record) => record.item);
      assertCategorizedProperties(descendants, flatRecords);
    }

    describe("Should correctly handle single category categorized property parent-child relationship", () => {
      it(`Should correctly handle primitive categorized properties`, () => {
        const propertyCategory: PropertyCategory = { name: "Category1", label: "Category 1", expand: true };
        const categoryRecords = GridUtils.constructCategoryRecordsDict([propertyCategory]);

        const records = [
          TestUtils.createPrimitiveStringProperty("CADID1", "0000 0005 00E0 02D8"),
          TestUtils.createPrimitiveStringProperty("CADID2", "0000 0005 00E0 02D8"),
        ];
        categoryRecords[propertyCategory.name] = records;

        const gridCategory = new MutableGridCategory(propertyCategory, categoryRecords, gridItemFactory);

        assertCategoryCategorizedProperties(gridCategory, records);
      });

      it(`Should correctly handle struct categorized properties`, () => {
        const propertyCategory: PropertyCategory = { name: "Category1", label: "Category 1", expand: true };
        const categoryRecords = GridUtils.constructCategoryRecordsDict([propertyCategory]);

        const records = [
          TestUtils.createStructProperty("Struct1", { CADID1: TestUtils.createPrimitiveStringProperty("CADID1", "0000 0005 00E0 02D8") }),
          TestUtils.createStructProperty("Struct2", { CADID2: TestUtils.createPrimitiveStringProperty("CADID2", "0000 0005 00E0 02D8") }),
        ];
        categoryRecords[propertyCategory.name] = records;

        const gridCategory = new MutableGridCategory(propertyCategory, categoryRecords, gridItemFactory);

        assertCategoryCategorizedProperties(gridCategory, records);
      });

      it(`Should correctly handle array categorized properties`, () => {
        const propertyCategory: PropertyCategory = { name: "Category1", label: "Category 1", expand: true };
        const categoryRecords = GridUtils.constructCategoryRecordsDict([propertyCategory]);

        const records = [
          TestUtils.createArrayProperty("Array1", []),
          TestUtils.createArrayProperty("Array2", [
            TestUtils.createPrimitiveStringProperty("CADID1", "0000 0005 00E0 02D8"),
            TestUtils.createPrimitiveStringProperty("CADID2", "0000 0005 00E0 02D8"),
          ]),
        ];

        categoryRecords[propertyCategory.name] = records;

        const gridCategory = new MutableGridCategory(propertyCategory, categoryRecords, gridItemFactory);

        assertCategoryCategorizedProperties(gridCategory, records);
      });

      it(`Should correctly handle mixed categorized properties`, () => {
        const propertyCategory: PropertyCategory = { name: "Category1", label: "Category 1", expand: true };
        const categoryRecords = GridUtils.constructCategoryRecordsDict([propertyCategory]);

        const records = [
          TestUtils.createPrimitiveStringProperty("CADID1", "0000 0005 00E0 02D8"),
          TestUtils.createPrimitiveStringProperty("CADID2", "0000 0005 00E0 02D8"),
          TestUtils.createArrayProperty("Array0", []),
          TestUtils.createArrayProperty("Array1", [
            TestUtils.createPrimitiveStringProperty("CADID3", "0000 0005 00E0 02D8"),
            TestUtils.createPrimitiveStringProperty("CADID4", "0000 0005 00E0 02D8"),
          ]),
          TestUtils.createStructProperty("Struct1", {
            CADID5: TestUtils.createPrimitiveStringProperty("CADID5", "0000 0005 00E0 02D8"),
            CADID6: TestUtils.createPrimitiveStringProperty("CADID6", "0000 0005 00E0 02D8"),
            CADID7: TestUtils.createPrimitiveStringProperty("CADID7", "0000 0005 00E0 02D8"),
            Array2: TestUtils.createArrayProperty("Array2", [
              TestUtils.createPrimitiveStringProperty("CADID8", "0000 0005 00E0 02D8"),
              TestUtils.createStructProperty("Struct2", {}),
            ]),
          }),
          TestUtils.createStructProperty("Struct3", {}),
        ];

        categoryRecords[propertyCategory.name] = records;

        const gridCategory = new MutableGridCategory(propertyCategory, categoryRecords, gridItemFactory);

        assertCategoryCategorizedProperties(gridCategory, records);
      });
    });

    describe("Should correctly handle getting visible descendants", () => {
      it(`Should return self when getVisibleDescendantsAndSelf called and category not expanded`, () => {
        const propertyCategory: PropertyCategory = { name: "Category1", label: "Category 1", expand: true };
        const categoryRecords = GridUtils.constructCategoryRecordsDict([propertyCategory]);

        const records = [
          TestUtils.createPrimitiveStringProperty("CADID1", "0000 0005 00E0 02D8"),
          TestUtils.createArrayProperty("Array1", [
            TestUtils.createPrimitiveStringProperty("CADID2", "0000 0005 00E0 02D8"),
            TestUtils.createPrimitiveStringProperty("CADID3", "0000 0005 00E0 02D8"),
          ], true),
          TestUtils.createStructProperty("Struct1", {
            CADID5: TestUtils.createPrimitiveStringProperty("CADID4", "0000 0005 00E0 02D8"),
            CADID6: TestUtils.createPrimitiveStringProperty("CADID5", "0000 0005 00E0 02D8"),
            CADID7: TestUtils.createPrimitiveStringProperty("CADID6", "0000 0005 00E0 02D8"),
          }, true),
        ];

        categoryRecords[propertyCategory.name] = records;

        const gridCategory = new MutableGridCategory(propertyCategory, categoryRecords, gridItemFactory);

        gridCategory.isExpanded = false;
        expect(gridCategory.getVisibleDescendantsAndSelf()).to.be.deep.equal([gridCategory]);
      });

      it(`Should correctly handle no children visible descendants`, () => {
        const propertyCategory: PropertyCategory = { name: "Category1", label: "Category 1", expand: true };
        const categoryRecords = GridUtils.constructCategoryRecordsDict([propertyCategory]);

        const gridCategory = new MutableGridCategory(propertyCategory, categoryRecords, gridItemFactory);

        gridCategory.isExpanded = true;
        expect(gridCategory.getVisibleDescendantsAndSelf()).to.be.deep.equal([gridCategory]);
      });

      it(`Should correctly handle primitive visible descendants`, () => {
        const propertyCategory: PropertyCategory = { name: "Category1", label: "Category 1", expand: false };
        const categoryRecords = GridUtils.constructCategoryRecordsDict([propertyCategory]);

        const records = [
          TestUtils.createPrimitiveStringProperty("CADID1", "0000 0005 00E0 02D8"),
          TestUtils.createPrimitiveStringProperty("CADID2", "0000 0005 00E0 02D8"),
        ];
        categoryRecords[propertyCategory.name] = records;

        const gridCategory = new MutableGridCategory(propertyCategory, categoryRecords, gridItemFactory);

        gridCategory.isExpanded = true;
        const visibleDescendants = GridUtils.filterProperties(gridCategory.getVisibleDescendantsAndSelf());
        const flatRecords = GridUtils.flattenPropertyRecords(records, gridCategory.selectionKey, true).map((record) => record.item);
        assertCategorizedProperties(visibleDescendants, flatRecords);
      });

      it(`Should correctly handle non-nested struct visible descendants`, () => {
        const propertyCategory: PropertyCategory = { name: "Category1", label: "Category 1", expand: false };
        const categoryRecords = GridUtils.constructCategoryRecordsDict([propertyCategory]);

        const records = [TestUtils.createStructProperty("Struct1"), TestUtils.createStructProperty("Struct2")];
        categoryRecords[propertyCategory.name] = records;

        const gridCategory = new MutableGridCategory(propertyCategory, categoryRecords, gridItemFactory);

        gridCategory.isExpanded = true;
        const visibleDescendants = GridUtils.filterProperties(gridCategory.getVisibleDescendantsAndSelf());
        const flatRecords = GridUtils.flattenPropertyRecords(records, gridCategory.selectionKey, true).map((record) => record.item);
        assertCategorizedProperties(visibleDescendants, flatRecords);
      });

      it(`Should correctly handle nested struct visible descendants`, () => {
        const propertyCategory: PropertyCategory = { name: "Category1", label: "Category 1", expand: false };
        const categoryRecords = GridUtils.constructCategoryRecordsDict([propertyCategory]);

        const records = [
          TestUtils.createStructProperty("Struct1", {
            CADID3: TestUtils.createPrimitiveStringProperty("CADID1", "0000 0005 00E0 02D8"),
            CADID4: TestUtils.createPrimitiveStringProperty("CADID2", "0000 0005 00E0 02D8"),
          }, false),
          TestUtils.createStructProperty("Struct2", {
            CADID3: TestUtils.createPrimitiveStringProperty("CADID3", "0000 0005 00E0 02D8"),
            CADID4: TestUtils.createPrimitiveStringProperty("CADID4", "0000 0005 00E0 02D8"),
            Struct3: TestUtils.createStructProperty("Struct3"),
          }, true),
        ];
        categoryRecords[propertyCategory.name] = records;

        const gridCategory = new MutableGridCategory(propertyCategory, categoryRecords, gridItemFactory);

        gridCategory.isExpanded = true;
        const visibleDescendants = GridUtils.filterProperties(gridCategory.getVisibleDescendantsAndSelf());
        const flatRecords = GridUtils.flattenPropertyRecords(records, gridCategory.selectionKey, true).map((record) => record.item);
        assertCategorizedProperties(visibleDescendants, flatRecords);
      });

      it(`Should correctly handle non-nested array visible descendants`, () => {
        const propertyCategory: PropertyCategory = { name: "Category1", label: "Category 1", expand: false };
        const categoryRecords = GridUtils.constructCategoryRecordsDict([propertyCategory]);

        const records = [
          TestUtils.createArrayProperty("Array1"),
          TestUtils.createArrayProperty("Array2"),
        ];
        categoryRecords[propertyCategory.name] = records;

        const gridCategory = new MutableGridCategory(propertyCategory, categoryRecords, gridItemFactory);

        gridCategory.isExpanded = true;
        const visibleDescendants = GridUtils.filterProperties(gridCategory.getVisibleDescendantsAndSelf());
        const flatRecords = GridUtils.flattenPropertyRecords(records, gridCategory.selectionKey, true).map((record) => record.item);
        assertCategorizedProperties(visibleDescendants, flatRecords);
      });

      it(`Should correctly handle nested array visible descendants`, () => {
        const propertyCategory: PropertyCategory = { name: "Category1", label: "Category 1", expand: false };
        const categoryRecords = GridUtils.constructCategoryRecordsDict([propertyCategory]);

        const records = [
          TestUtils.createArrayProperty("Array1", [
            TestUtils.createPrimitiveStringProperty("CADID1", "0000 0005 00E0 02D8"),
            TestUtils.createPrimitiveStringProperty("CADID2", "0000 0005 00E0 02D8"),
          ], false),
          TestUtils.createArrayProperty("Array2", [
            TestUtils.createPrimitiveStringProperty("CADID3", "0000 0005 00E0 02D8"),
            TestUtils.createArrayProperty("Array3"),
          ], true),
        ];
        categoryRecords[propertyCategory.name] = records;

        const gridCategory = new MutableGridCategory(propertyCategory, categoryRecords, gridItemFactory);

        gridCategory.isExpanded = true;
        const visibleDescendants = GridUtils.filterProperties(gridCategory.getVisibleDescendantsAndSelf());
        const flatRecords = GridUtils.flattenPropertyRecords(records, gridCategory.selectionKey, true).map((record) => record.item);
        assertCategorizedProperties(visibleDescendants, flatRecords);
      });

      it(`Should correctly handle mixed categorized properties visible descendants`, () => {
        const propertyCategory: PropertyCategory = { name: "Category1", label: "Category 1", expand: true };
        const categoryRecords = GridUtils.constructCategoryRecordsDict([propertyCategory]);

        const records = [
          TestUtils.createPrimitiveStringProperty("CADID1", "0000 0005 00E0 02D8"),
          TestUtils.createArrayProperty("Array1", [
            TestUtils.createPrimitiveStringProperty("CADID2", "0000 0005 00E0 02D8"),
            TestUtils.createPrimitiveStringProperty("CADID3", "0000 0005 00E0 02D8"),
          ], true),
          TestUtils.createStructProperty("Struct1", {
            CADID5: TestUtils.createPrimitiveStringProperty("CADID4", "0000 0005 00E0 02D8"),
            CADID6: TestUtils.createPrimitiveStringProperty("CADID5", "0000 0005 00E0 02D8"),
            CADID7: TestUtils.createPrimitiveStringProperty("CADID6", "0000 0005 00E0 02D8"),
          }, true),
        ];
        categoryRecords[propertyCategory.name] = records;

        const gridCategory = new MutableGridCategory(propertyCategory, categoryRecords, gridItemFactory);

        gridCategory.isExpanded = true;
        const visibleDescendants = GridUtils.filterProperties(gridCategory.getVisibleDescendantsAndSelf());
        const flatRecords = GridUtils.flattenPropertyRecords(records, gridCategory.selectionKey, true).map((record) => record.item);
        assertCategorizedProperties(visibleDescendants, flatRecords);
      });

      function assertPropertyAndGridItemEquality(gridItems: IMutableFlatGridItem[], records: Array<PropertyCategory | PropertyRecord>) {
        GridUtils.callPropertyAndGridItemAsserts(gridItems, records, GridUtils.assertCategoryEquals, GridUtils.assertPropertyEquals);
      }

      it(`Should correctly handle visible descendants with child categories`, () => {
        const propertyCategory: PropertyCategory = {
          name: "Category1", label: "Category 1", expand: true, childCategories: [
            { name: "Category1_1", label: "Category 1_1", expand: false },
            { name: "Category1_2", label: "Category 1_2", expand: false },
          ],
        };
        const categoryRecords = GridUtils.constructCategoryRecordsDict([propertyCategory]);

        const records = [
          TestUtils.createPrimitiveStringProperty("CADID1", "0000 0005 00E0 02D8"),
          TestUtils.createArrayProperty("Array1"),
          TestUtils.createStructProperty("Struct1")];
        categoryRecords[propertyCategory.name] = records;

        const gridCategory = new MutableGridCategory(propertyCategory, categoryRecords, gridItemFactory);

        gridCategory.isExpanded = true;
        const descendants = gridCategory.getVisibleDescendantsAndSelf();
        const flatProperties = GridUtils.flattenPropertyCategories([propertyCategory], categoryRecords, true).map((property) => property.item);

        assertPropertyAndGridItemEquality(descendants, flatProperties);
      });

      it(`Should correctly handle last visible descendants with mix of child categories and property records`, () => {
        const propertyCategory: PropertyCategory = {
          name: "Category1", label: "Category 1", expand: true, childCategories: [
            { name: "Category1_1", label: "Category 1_1", expand: false },
            { name: "Category1_2", label: "Category 1_2", expand: true },
          ],
        };
        const categoryRecords = GridUtils.constructCategoryRecordsDict([propertyCategory]);

        categoryRecords[propertyCategory.name] = [
          TestUtils.createPrimitiveStringProperty("CADID1", "0000 0005 00E0 02D8"),
          TestUtils.createArrayProperty("Array1"),
          TestUtils.createStructProperty("Struct1"),
        ];

        categoryRecords[propertyCategory.childCategories![0].name] = [
          TestUtils.createPrimitiveStringProperty("CADID2", "0000 0005 00E0 02D8"),
          TestUtils.createArrayProperty("Array2"),
          TestUtils.createStructProperty("Struct2"),
        ];

        categoryRecords[propertyCategory.childCategories![1].name] = [
          TestUtils.createPrimitiveStringProperty("CADID3", "0000 0005 00E0 02D8"),
          TestUtils.createArrayProperty("Array3"),
          TestUtils.createStructProperty("Struct3"),
        ];

        const gridCategory = new MutableGridCategory(propertyCategory, categoryRecords, gridItemFactory);

        gridCategory.isExpanded = true;
        const descendants = gridCategory.getVisibleDescendantsAndSelf();

        const flatRecords = GridUtils.flattenPropertyCategories([propertyCategory], categoryRecords, true).map((property) => property.item);
        assertPropertyAndGridItemEquality(descendants, flatRecords);
      });
    });

    function assertLastVisibleDescendant(
      gridCategory: IMutableGridCategoryItem,
      expectedLastDescendant: PropertyRecord | PropertyCategory,
    ) {
      const lastDescendant = gridCategory.getLastVisibleDescendantOrSelf();

      if (expectedLastDescendant instanceof PropertyRecord) {
        GridUtils.assertPropertyEquals(lastDescendant as IMutableCategorizedPropertyItem, expectedLastDescendant);
      } else {
        GridUtils.assertCategoryEquals(lastDescendant as GridCategoryItem, expectedLastDescendant);
      }
    }

    describe("Should correctly handle getting last visible descendant", () => {
      it(`Should correctly handle no children last visible descendant`, () => {
        const propertyCategory: PropertyCategory = { name: "Category1", label: "Category 1", expand: false };
        const categoryRecords = GridUtils.constructCategoryRecordsDict([propertyCategory]);

        const gridCategory = new MutableGridCategory(propertyCategory, categoryRecords, gridItemFactory);

        gridCategory.isExpanded = false;
        expect(gridCategory.getLastVisibleDescendantOrSelf()).to.be.equal(gridCategory);
        gridCategory.isExpanded = true;
        expect(gridCategory.getLastVisibleDescendantOrSelf()).to.be.equal(gridCategory);
      });

      it(`Should correctly always return self when not expanded`, () => {
        const propertyCategory: PropertyCategory = { name: "Category1", label: "Category 1", expand: false };
        const categoryRecords = GridUtils.constructCategoryRecordsDict([propertyCategory]);

        categoryRecords[propertyCategory.name] = [
          TestUtils.createPrimitiveStringProperty("CADID1", "0000 0005 00E0 02D8"),
          TestUtils.createArrayProperty("Array2", [
            TestUtils.createPrimitiveStringProperty("CADID2", "0000 0005 00E0 02D8"),
            TestUtils.createPrimitiveStringProperty("CADID3", "0000 0005 00E0 02D8"),
          ], true),
          TestUtils.createStructProperty("Struct1", {
            CADID5: TestUtils.createPrimitiveStringProperty("CADID4", "0000 0005 00E0 02D8"),
            CADID6: TestUtils.createPrimitiveStringProperty("CADID5", "0000 0005 00E0 02D8"),
            CADID7: TestUtils.createPrimitiveStringProperty("CADID6", "0000 0005 00E0 02D8"),
          }, true),
        ];

        const gridCategory = new MutableGridCategory(propertyCategory, categoryRecords, gridItemFactory);

        expect(gridCategory.getLastVisibleDescendantOrSelf()).to.be.equal(gridCategory);
      });

      it(`Should correctly handle primitive last visible descendant`, () => {
        const propertyCategory: PropertyCategory = { name: "Category1", label: "Category 1", expand: true };
        const categoryRecords = GridUtils.constructCategoryRecordsDict([propertyCategory]);

        const records = [
          TestUtils.createPrimitiveStringProperty("CADID1", "0000 0005 00E0 02D8"),
          TestUtils.createPrimitiveStringProperty("CADID2", "0000 0005 00E0 02D8"),
        ];
        categoryRecords[propertyCategory.name] = records;

        const gridCategory = new MutableGridCategory(propertyCategory, categoryRecords, gridItemFactory);

        const flatProperties = GridUtils.flattenPropertyCategories([propertyCategory], categoryRecords, true);
        const lastDescendantProperty = GridUtils.getLast(flatProperties)!;

        assertLastVisibleDescendant(gridCategory, lastDescendantProperty.item);
      });

      it(`Should correctly handle non-nested struct last visible descendant`, () => {
        const propertyCategory: PropertyCategory = { name: "Category1", label: "Category 1", expand: true };
        const categoryRecords = GridUtils.constructCategoryRecordsDict([propertyCategory]);

        categoryRecords[propertyCategory.name] = [TestUtils.createStructProperty("Struct1"), TestUtils.createStructProperty("Struct2")];

        const gridCategory = new MutableGridCategory(propertyCategory, categoryRecords, gridItemFactory);

        const flatProperties = GridUtils.flattenPropertyCategories([propertyCategory], categoryRecords, true);
        const lastDescendantProperty = GridUtils.getLast(flatProperties)!;

        assertLastVisibleDescendant(gridCategory, lastDescendantProperty.item);
      });

      it(`Should correctly handle nested struct last visible descendant`, () => {
        const propertyCategory: PropertyCategory = { name: "Category1", label: "Category 1", expand: true };
        const categoryRecords = GridUtils.constructCategoryRecordsDict([propertyCategory]);

        const records = [
          TestUtils.createStructProperty("Struct1", {
            CADID3: TestUtils.createPrimitiveStringProperty("CADID1", "0000 0005 00E0 02D8"),
            CADID4: TestUtils.createPrimitiveStringProperty("CADID2", "0000 0005 00E0 02D8"),
          }, false),
          TestUtils.createStructProperty("Struct2", {
            CADID3: TestUtils.createPrimitiveStringProperty("CADID3", "0000 0005 00E0 02D8"),
            CADID4: TestUtils.createPrimitiveStringProperty("CADID4", "0000 0005 00E0 02D8"),
            Struct3: TestUtils.createStructProperty("Struct3"),
          }, true),
        ];
        categoryRecords[propertyCategory.name] = records;

        const gridCategory = new MutableGridCategory(propertyCategory, categoryRecords, gridItemFactory);

        const flatProperties = GridUtils.flattenPropertyCategories([propertyCategory], categoryRecords, true);
        const lastDescendantProperty = GridUtils.getLast(flatProperties)!;

        assertLastVisibleDescendant(gridCategory, lastDescendantProperty.item);
      });

      it(`Should correctly handle non-nested array last visible descendant`, () => {
        const propertyCategory: PropertyCategory = { name: "Category1", label: "Category 1", expand: true };
        const categoryRecords = GridUtils.constructCategoryRecordsDict([propertyCategory]);

        categoryRecords[propertyCategory.name] = [
          TestUtils.createArrayProperty("Array1"),
          TestUtils.createArrayProperty("Array2"),
        ];

        const gridCategory = new MutableGridCategory(propertyCategory, categoryRecords, gridItemFactory);

        const flatProperties = GridUtils.flattenPropertyCategories([propertyCategory], categoryRecords, true);
        const lastDescendantProperty = GridUtils.getLast(flatProperties)!;

        assertLastVisibleDescendant(gridCategory, lastDescendantProperty.item);
      });

      it(`Should correctly handle nested array last visible descendant`, () => {
        const propertyCategory: PropertyCategory = { name: "Category1", label: "Category 1", expand: true };
        const categoryRecords = GridUtils.constructCategoryRecordsDict([propertyCategory]);

        categoryRecords[propertyCategory.name] = [
          TestUtils.createArrayProperty("Array1"),
          TestUtils.createArrayProperty("Array2", [
            TestUtils.createPrimitiveStringProperty("CADID1", "0000 0005 00E0 02D8"),
            TestUtils.createArrayProperty("Array3"),
          ], true),
        ];

        const gridCategory = new MutableGridCategory(propertyCategory, categoryRecords, gridItemFactory);

        const flatProperties = GridUtils.flattenPropertyCategories([propertyCategory], categoryRecords, true);
        const lastDescendantProperty = GridUtils.getLast(flatProperties)!;

        assertLastVisibleDescendant(gridCategory, lastDescendantProperty.item);
      });

      it(`Should correctly handle mixed categorized properties last visible descendant`, () => {
        const propertyCategory: PropertyCategory = { name: "Category1", label: "Category 1", expand: true };
        const categoryRecords = GridUtils.constructCategoryRecordsDict([propertyCategory]);

        categoryRecords[propertyCategory.name] = [
          TestUtils.createPrimitiveStringProperty("CADID1", "0000 0005 00E0 02D8"),
          TestUtils.createArrayProperty("Array2", [
            TestUtils.createPrimitiveStringProperty("CADID2", "0000 0005 00E0 02D8"),
            TestUtils.createPrimitiveStringProperty("CADID3", "0000 0005 00E0 02D8"),
          ], true),
          TestUtils.createStructProperty("Struct1", {
            CADID5: TestUtils.createPrimitiveStringProperty("CADID4", "0000 0005 00E0 02D8"),
            CADID6: TestUtils.createPrimitiveStringProperty("CADID5", "0000 0005 00E0 02D8"),
            CADID7: TestUtils.createPrimitiveStringProperty("CADID6", "0000 0005 00E0 02D8"),
          }, true),
        ];

        const gridCategory = new MutableGridCategory(propertyCategory, categoryRecords, gridItemFactory);

        const flatProperties = GridUtils.flattenPropertyCategories([propertyCategory], categoryRecords, true);
        const lastDescendantProperty = GridUtils.getLast(flatProperties)!;

        assertLastVisibleDescendant(gridCategory, lastDescendantProperty.item);
      });

      it(`Should always return last child category as last visible descendant when last category has no children`, () => {
        const propertyCategory: PropertyCategory = {
          name: "Category1", label: "Category 1", expand: true, childCategories: [
            { name: "Category1_1", label: "Category 1_1", expand: false },
            { name: "Category1_2", label: "Category 1_2", expand: false },
          ],
        };
        const categoryRecords = GridUtils.constructCategoryRecordsDict([propertyCategory]);

        categoryRecords[propertyCategory.name] = [
          TestUtils.createPrimitiveStringProperty("CADID1", "0000 0005 00E0 02D8"),
          TestUtils.createArrayProperty("Array1"),
          TestUtils.createStructProperty("Struct1"),
        ];

        const gridCategory = new MutableGridCategory(propertyCategory, categoryRecords, gridItemFactory);

        const flatProperties = GridUtils.flattenPropertyCategories([propertyCategory], categoryRecords, true);
        const lastDescendantProperty = GridUtils.getLast(flatProperties)!;

        assertLastVisibleDescendant(gridCategory, lastDescendantProperty.item);
      });

      it(`Should always return child categories last visible descendant as last visible descendant when child category has children`, () => {
        const lastCategory = { name: "Category1_2", label: "Category 1_2", expand: true };
        const propertyCategory: PropertyCategory = {
          name: "Category1", label: "Category 1", expand: true, childCategories: [
            { name: "Category1_1", label: "Category 1_1", expand: false },
            lastCategory,
          ],
        };
        const categoryRecords = GridUtils.constructCategoryRecordsDict([propertyCategory]);

        categoryRecords[propertyCategory.name] = [
          TestUtils.createPrimitiveStringProperty("CADID1", "0000 0005 00E0 02D8"),
          TestUtils.createArrayProperty("Array1"),
          TestUtils.createStructProperty("Struct1"),
        ];
        categoryRecords[lastCategory.name] = [
          TestUtils.createPrimitiveStringProperty("CADID2", "0000 0005 00E0 02D8"),
          TestUtils.createArrayProperty("Array2"),
          TestUtils.createStructProperty("Struct2"),
        ];

        const gridCategory = new MutableGridCategory(propertyCategory, categoryRecords, gridItemFactory);

        const flatProperties = GridUtils.flattenPropertyCategories([propertyCategory], categoryRecords, true);
        const lastDescendantProperty = GridUtils.getLast(flatProperties)!;

        assertLastVisibleDescendant(gridCategory, lastDescendantProperty.item);
      });
    });
  });
});
