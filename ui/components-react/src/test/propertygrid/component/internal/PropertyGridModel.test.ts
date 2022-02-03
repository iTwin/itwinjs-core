/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
import { config, expect } from "chai";
import sinon from "sinon";
import { PropertyRecord } from "@itwin/appui-abstract";
import type { IMutableGridItemFactory} from "../../../../components-react/propertygrid/internal/flat-items/MutableGridItemFactory";
import { MutableGridItemFactory } from "../../../../components-react/propertygrid/internal/flat-items/MutableGridItemFactory";
import { MutablePropertyGridModel } from "../../../../components-react/propertygrid/internal/PropertyGridModel";
import TestUtils from "../../../TestUtils";
import type { FlattenedProperty, GridModelLastItemData, PropertyGridModelTestData } from "./flat-items/FlatGridTestUtils";
import { FlatGridTestUtils as GridUtils } from "./flat-items/FlatGridTestUtils";

config.truncateThreshold = 0;

describe("MutablePropertyGridModel", () => {
  const testCases: Array<PropertyGridModelTestData & { unexistingItemKey: string }> = [
    {
      testName: "Single category",
      propertyData: {
        label: TestUtils.createPrimitiveStringProperty("Label", "Value"),
        categories: [
          { name: "Cat1", label: "Cat 1", expand: true },
        ],
        records: {
          Cat1: [],
        },
      },
      expectedLastItemData: {
        Cat1: { isLastInRootCategory: true, lastInNumberOfCategories: 0 },
      },
      unexistingItemKey: "does not exist",
    },
    {
      testName: "Multiple categories",
      propertyData: {
        label: TestUtils.createPrimitiveStringProperty("Label", "Value"),
        categories: [
          { name: "Cat1", label: "Cat 1", expand: true },
          { name: "Cat2", label: "Cat 2", expand: true },
          { name: "Cat3", label: "Cat 3", expand: true },
        ],
        records: {
          Cat1: [],
          Cat2: [],
          Cat3: [],
        },
      },
      expectedLastItemData: {
        Cat1: { isLastInRootCategory: true, lastInNumberOfCategories: 0 },
        Cat2: { isLastInRootCategory: true, lastInNumberOfCategories: 0 },
        Cat3: { isLastInRootCategory: true, lastInNumberOfCategories: 0 },
      },
      unexistingItemKey: "does not exist",
    },
    {
      testName: "Nested categories",
      propertyData: {
        label: TestUtils.createPrimitiveStringProperty("Label", "Value"),
        categories: [
          {
            name: "Cat1", label: "Cat 1", expand: true, childCategories: [
              {
                name: "Cat1-1", label: "Cat 1-1", expand: true, childCategories: [
                  { name: "Cat1-1-1", label: "Cat 1-1-1", expand: true },
                ],
              },
            ],
          },
        ],
        records: {
          Cat1: [],
          Cat2: [],
          Cat3: [],
        },
      },
      expectedLastItemData: {
        "Cat1_Cat1-1_Cat1-1-1": { isLastInRootCategory: true, lastInNumberOfCategories: 2 },
      },
      unexistingItemKey: "does not exist",
    },
    {
      testName: "Single category with property records",
      propertyData: {
        label: TestUtils.createPrimitiveStringProperty("Label", "Value"),
        categories: [
          { name: "Cat1", label: "Cat 1", expand: true },
        ],
        records: {
          Cat1: [
            TestUtils.createPrimitiveStringProperty("Prop", "V1", undefined, undefined, true),
            TestUtils.createArrayProperty("Array", [], true),
            TestUtils.createStructProperty("Struct", {}, true),
          ],
        },
      },
      expectedLastItemData: {
        Cat1_Struct: { isLastInRootCategory: true, lastInNumberOfCategories: 1 },
      },
      unexistingItemKey: "does not exist",
    },
    {
      testName: "Multiple categories with property records",
      propertyData: {
        label: TestUtils.createPrimitiveStringProperty("Label", "Value"),
        categories: [
          { name: "Cat1", label: "Cat 1", expand: true },
          { name: "Cat2", label: "Cat 2", expand: true },
          { name: "Cat3", label: "Cat 3", expand: true },
        ],
        records: {
          Cat1: [
            TestUtils.createPrimitiveStringProperty("Prop", "V1", undefined, undefined, true),
            TestUtils.createArrayProperty("Array", [], true),
            TestUtils.createStructProperty("Struct", {}, true),
          ],
          Cat2: [
            TestUtils.createPrimitiveStringProperty("Prop", "V1", undefined, undefined, true),
            TestUtils.createStructProperty("Struct", {}, true),
            TestUtils.createArrayProperty("Array", [], true),
          ],
          Cat3: [
            TestUtils.createStructProperty("Struct", {}, true),
            TestUtils.createArrayProperty("Array", [], true),
            TestUtils.createPrimitiveStringProperty("Prop", "V1", undefined, undefined, true),
          ],
        },
      },
      expectedLastItemData: {
        Cat1_Struct: { isLastInRootCategory: true, lastInNumberOfCategories: 1 },
        Cat2_Array: { isLastInRootCategory: true, lastInNumberOfCategories: 1 },
        Cat3_Prop: { isLastInRootCategory: true, lastInNumberOfCategories: 1 },
      },
      unexistingItemKey: "does not exist",
    },
    {
      testName: "Nested categories with property records",
      propertyData: {
        label: TestUtils.createPrimitiveStringProperty("Label", "Value"),
        categories: [
          {
            name: "Cat1", label: "Cat 1", expand: true, childCategories: [
              {
                name: "Cat1-1", label: "Cat 1-1", expand: true, childCategories: [
                  { name: "Cat1-1-1", label: "Cat 1-1-1", expand: true },
                ],
              },
            ],
          },
        ],
        records: {
          "Cat1": [
            TestUtils.createPrimitiveStringProperty("Prop", "V1", undefined, undefined, true),
            TestUtils.createArrayProperty("Array", [], true),
            TestUtils.createStructProperty("Struct", {}, true),
          ],
          "Cat1-1": [
            TestUtils.createPrimitiveStringProperty("Prop", "V1", undefined, undefined, true),
            TestUtils.createStructProperty("Struct", {}, true),
            TestUtils.createArrayProperty("Array", [], true),
          ],
          "Cat1-1-1": [
            TestUtils.createStructProperty("Struct", {}, true),
            TestUtils.createArrayProperty("Array", [], true),
            TestUtils.createPrimitiveStringProperty("Prop", "V1", undefined, undefined, true),
          ],
        },
      },
      expectedLastItemData: {
        "Cat1_Cat1-1_Cat1-1-1_Prop": { isLastInRootCategory: true, lastInNumberOfCategories: 3 },
      },
      unexistingItemKey: "does not exist",
    },
    {
      testName: "Nested categories with nested property records",
      propertyData: {
        label: TestUtils.createPrimitiveStringProperty("Label", "Value"),
        categories: [
          {
            name: "Cat1", label: "Category 1", expand: true, childCategories: [
              { name: "Cat1-1", label: "Category 1-1", expand: true },
            ],
          },
          {
            name: "Cat2", label: "Category 2", expand: true, childCategories: [
              {
                name: "Cat2-1", label: "Category 2-1", expand: true, childCategories: [
                  { name: "Cat2-1-1", label: "Category 2-1-1", expand: false },
                ],
              },
            ],
          },
        ],
        records: {
          "Cat1": [],
          "Cat1-1": [
            TestUtils.createArrayProperty("Array1-1-1", [
              TestUtils.createPrimitiveStringProperty("Property1-1-1-1", "V1", undefined, undefined, true),
              TestUtils.createStructProperty("Struct1-1-1-2", {
                "Array1-1-1-2-1": TestUtils.createArrayProperty("Array1-1-1-2-1", [], true),
              }, false),
            ], true),
          ],
          "Cat2": [
            TestUtils.createStructProperty("Struct2-1", {
              "Property2-1-1": TestUtils.createPrimitiveStringProperty("Property2-1-1", "V1"),
              "Property2-1-2": TestUtils.createPrimitiveStringProperty("Property2-1-2", "V1"),
              "Property2-1-3": TestUtils.createPrimitiveStringProperty("Property2-1-3", "V1"),
            }, true),
          ],
          "Cat2-1": [],
          "Cat2-1-1": [
            TestUtils.createPrimitiveStringProperty("Prop", "V1"),
            TestUtils.createArrayProperty("Array", [], true),
            TestUtils.createStructProperty("Struct", {}, true),
          ],
        },
      },
      expectedLastItemData: {
        "Cat1_Cat1-1_Array1-1-1_Struct1-1-1-2_1": { isLastInRootCategory: true, lastInNumberOfCategories: 2 },
        "Cat2_Cat2-1_Cat2-1-1": { isLastInRootCategory: true, lastInNumberOfCategories: 2 },
      },
      unexistingItemKey: "Cat2_Struct2-1_does not exist",
    },
    {
      testName: "Big nested categories with nested property records",
      propertyData: {
        label: TestUtils.createPrimitiveStringProperty("Label", "Value"),
        categories: [
          {
            name: "Cat1", label: "Category 1", expand: true, childCategories: [
              { name: "Cat1-1", label: "Category 1-1", expand: true },
              { name: "Cat1-2", label: "Category 1-2", expand: true },
              { name: "Cat1-3", label: "Category 1-3", expand: true },
            ],
          },
          {
            name: "Cat2", label: "Category 2", expand: true, childCategories: [
              {
                name: "Cat2-1", label: "Category 2-1", expand: true, childCategories: [
                  { name: "Cat2-1-1", label: "Category 2-1-1", expand: false },
                  { name: "Cat2-1-2", label: "Category 2-1-2", expand: true },
                  { name: "Cat2-1-3", label: "Category 2-1-3", expand: false },
                ],
              },
              {
                name: "Cat2-2", label: "Category 2-2", expand: false, childCategories: [
                  { name: "Cat2-2-1", label: "Category 2-2-1", expand: true },
                  { name: "Cat2-2-2", label: "Category 2-2-2", expand: true },
                  { name: "Cat2-2-3", label: "Category 2-2-3", expand: true },
                ],
              },
            ],
          },
        ],
        records: {
          "Cat1": [],
          "Cat1-1": [
            TestUtils.createArrayProperty("Array1-1-1", [
              TestUtils.createPrimitiveStringProperty("Property1-1-1-1", "V1"),
              TestUtils.createStructProperty("Struct1-1-1-2", {
                "Array1-1-1-2-1": TestUtils.createArrayProperty("Array1-1-1-2-1", [
                  TestUtils.createPrimitiveStringProperty("Property1-1-1-2-1-1", "V1"),
                  TestUtils.createPrimitiveStringProperty("Property1-1-1-2-1-2", "V1"),
                  TestUtils.createPrimitiveStringProperty("Property1-1-1-2-1-3", "V1"),
                ], false),
              }, true),
              TestUtils.createPrimitiveStringProperty("Property1-1-1-3", "V1"),
              TestUtils.createPrimitiveStringProperty("Property1-1-1-4", "V1"),
              TestUtils.createPrimitiveStringProperty("Property1-1-1-5", "V1"),
            ], true),
          ],
          "Cat1-2": [
            TestUtils.createArrayProperty("Array1-2-1", [
              TestUtils.createPrimitiveStringProperty("Property1-2-1-1", "V1"),
              TestUtils.createStructProperty("Struct1-2-1-2", {
                "Array1-2-1-2-1": TestUtils.createArrayProperty("Array1-2-1-2-1", [
                  TestUtils.createPrimitiveStringProperty("Property1-2-1-2-1-1", "V1"),
                  TestUtils.createPrimitiveStringProperty("Property1-2-1-2-1-2", "V1"),
                  TestUtils.createPrimitiveStringProperty("Property1-2-1-2-1-3", "V1"),
                ], true),
              }, false),
              TestUtils.createPrimitiveStringProperty("Property1-2-1-3", "V1"),
              TestUtils.createPrimitiveStringProperty("Property1-2-1-4", "V1"),
              TestUtils.createPrimitiveStringProperty("Property1-2-1-5", "V1"),
            ], true),
          ],
          "Cat1-3": [
            TestUtils.createArrayProperty("Array1-3-1", [
              TestUtils.createPrimitiveStringProperty("Property1-3-1-1", "V1"),
              TestUtils.createStructProperty("Struct1-3-1-2", {
                "Array1-3-1-2-1": TestUtils.createArrayProperty("Array1-3-1-2-1", [
                  TestUtils.createPrimitiveStringProperty("Property1-3-1-2-1-1", "V1"),
                  TestUtils.createPrimitiveStringProperty("Property1-3-1-2-1-2", "V1"),
                  TestUtils.createPrimitiveStringProperty("Property1-3-1-2-1-3", "V1"),
                ], false),
              }, true),
              TestUtils.createPrimitiveStringProperty("Property1-3-1-3", "V1"),
              TestUtils.createPrimitiveStringProperty("Property1-3-1-4", "V1"),
              TestUtils.createPrimitiveStringProperty("Property1-3-1-5", "V1"),
            ], false),
          ],
          "Cat2": [
            TestUtils.createStructProperty("Struct2", {
              "Property2-1": TestUtils.createPrimitiveStringProperty("Property2-1", "V1"),
              "Property2-2": TestUtils.createPrimitiveStringProperty("Property2-2", "V1"),
              "Property2-3": TestUtils.createPrimitiveStringProperty("Property2-3", "V1"),
            }, true),
          ],
          "Cat2-1": [],
          "Cat2-1-1": [
            TestUtils.createPrimitiveStringProperty("Prop", "V1"),
            TestUtils.createArrayProperty("Array", [], true),
            TestUtils.createStructProperty("Struct", {}, true),
          ],
          "Cat2-1-2": [
            TestUtils.createPrimitiveStringProperty("Prop", "V1"),
            TestUtils.createArrayProperty("Array", [], true),
            TestUtils.createStructProperty("Struct", {}, true),
          ],
          "Cat2-1-3": [
            TestUtils.createPrimitiveStringProperty("Prop", "V1"),
            TestUtils.createArrayProperty("Array", [], true),
            TestUtils.createStructProperty("Struct", {}, true),
          ],
          "Cat2-2": [],
          "Cat2-2-1": [
            TestUtils.createPrimitiveStringProperty("Prop", "V1"),
            TestUtils.createArrayProperty("Array", [], true),
            TestUtils.createStructProperty("Struct", {}, true),
          ],
          "Cat2-2-2": [
            TestUtils.createPrimitiveStringProperty("Prop", "V1"),
            TestUtils.createArrayProperty("Array", [], true),
            TestUtils.createStructProperty("Struct", {}, true),
          ],
          "Cat2-2-3": [
            TestUtils.createPrimitiveStringProperty("Prop", "V1"),
            TestUtils.createArrayProperty("Array", [], true),
            TestUtils.createStructProperty("Struct", {}, true),
          ],
        },
      },
      expectedLastItemData: {
        "Cat1_Cat1-1_Array1-1-1_Property1-1-1-5_4": { isLastInRootCategory: false, lastInNumberOfCategories: 1 },
        "Cat1_Cat1-2_Array1-2-1_Property1-2-1-5_4": { isLastInRootCategory: false, lastInNumberOfCategories: 1 },
        "Cat1_Cat1-3_Array1-3-1": { isLastInRootCategory: true, lastInNumberOfCategories: 2 },
        "Cat2_Cat2-1_Cat2-1-1": { isLastInRootCategory: false, lastInNumberOfCategories: 0 },
        "Cat2_Cat2-1_Cat2-1-2_Struct": { isLastInRootCategory: false, lastInNumberOfCategories: 1 },
        "Cat2_Cat2-1_Cat2-1-3": { isLastInRootCategory: false, lastInNumberOfCategories: 1 },
        "Cat2_Cat2-2": { isLastInRootCategory: true, lastInNumberOfCategories: 1 },
      },
      unexistingItemKey: "Cat2_Struct2_does not exist",
    },
  ];

  let factory: IMutableGridItemFactory;
  beforeEach(() => {
    factory = new MutableGridItemFactory();
  });

  describe("Initialize MutablePropertyGridModel correctly", () => {
    let createCategorySpy: sinon.SinonSpy<any, any>;
    let createPropertySpy: sinon.SinonSpy<any, any>;

    beforeEach(() => {
      createCategorySpy = sinon.spy(factory, "createGridCategory");
      createPropertySpy = sinon.spy(factory, "createCategorizedProperty");
    });

    for (const testCase of testCases) {
      it(testCase.testName, () => {
        new MutablePropertyGridModel(testCase.propertyData, factory);

        const expectedFlatProperties = GridUtils.getFlattenedPropertyData(testCase.propertyData);

        const expectedCategories = expectedFlatProperties.filter((property) => !(property.item instanceof PropertyRecord));
        const expectedRecords = expectedFlatProperties.filter((property) => property.item instanceof PropertyRecord);

        expect(createCategorySpy.callCount).to.be.equal(expectedCategories.length);
        expectedCategories.forEach((category) => expect(createCategorySpy.calledWith(category, testCase.propertyData.records, factory)));

        expect(createPropertySpy.callCount).to.be.equal(expectedRecords.length);
      });
    }
  });

  describe("getFlatGrid", () => {
    for (const testCase of testCases) {
      it(testCase.testName, () => {
        const gridModel = new MutablePropertyGridModel(testCase.propertyData, factory);

        const visibleGrid = gridModel.getFlatGrid();

        const expectedFlatGrid = GridUtils.getFlattenedPropertyData(testCase.propertyData, false);
        visibleGrid.forEach((gridItem, index) => {
          const expectedProperty = expectedFlatGrid[index];
          GridUtils.assertGridItem(gridItem, expectedProperty);
        });
      });
    }
  });

  describe("getVisibleFlatGrid", () => {
    for (const testCase of testCases) {
      it(testCase.testName, () => {
        const gridModel = new MutablePropertyGridModel(testCase.propertyData, factory);

        const visibleGrid = gridModel.getVisibleFlatGrid();

        const expectedFlatGrid = GridUtils.getFlattenedPropertyData(testCase.propertyData, true);
        visibleGrid.forEach((gridItem, index) => {
          const expectedProperty = expectedFlatGrid[index];
          GridUtils.assertGridItem(gridItem, expectedProperty);
        });
      });
    }
  });

  function assertGridModel(gridModel: MutablePropertyGridModel, expectedFlatGrid: FlattenedProperty[], lastItemData?: GridModelLastItemData) {
    expectedFlatGrid.forEach((expectedProperty) => {
      const gridItem = gridModel.getItem(expectedProperty.selectionKey);
      GridUtils.assertGridItem(gridItem, expectedProperty);

      if (lastItemData) {
        const expectedLastItemData = lastItemData[gridItem.selectionKey] ?? { isLastInRootCategory: false, lastInNumberOfCategories: 0 };

        expect(gridItem.lastInNumberOfCategories).to.be.equal(expectedLastItemData.lastInNumberOfCategories, `lastInNumberOfCategories does not match: ${gridItem.selectionKey}`);
        expect(gridItem.isLastInRootCategory).to.be.equal(expectedLastItemData.isLastInRootCategory, `isLastInRootCategory does not match: ${gridItem.selectionKey}`);
      }
    });
  }

  describe("getItem", () => {
    for (const testCase of testCases) {
      it(`Throws when getting item that does not exist: ${testCase.testName}`, () => {
        const gridModel = new MutablePropertyGridModel(testCase.propertyData, factory);
        expect(() => gridModel.getItem(testCase.unexistingItemKey)).to.throw(Error, `Grid item at provided key not found: ${testCase.unexistingItemKey}`);
      });

      it(`Gets visible items: ${testCase.testName}`, () => {
        const gridModel = new MutablePropertyGridModel(testCase.propertyData, factory);

        const expectedFlatGrid = GridUtils.getFlattenedPropertyData(testCase.propertyData, true);
        assertGridModel(gridModel, expectedFlatGrid, testCase.expectedLastItemData);
      });

      it(`Gets all items: ${testCase.testName}`, () => {
        const gridModel = new MutablePropertyGridModel(testCase.propertyData, factory);

        const expectedFlatGrid = GridUtils.getFlattenedPropertyData(testCase.propertyData, false);
        assertGridModel(gridModel, expectedFlatGrid);
      });
    }
  });

  describe("getRootCategories", () => {
    for (const testCase of testCases) {
      it(`${testCase.testName}`, () => {
        const gridModel = new MutablePropertyGridModel(testCase.propertyData, factory);

        const rootCategories = gridModel.getRootCategories();

        rootCategories.forEach((category, index) => GridUtils.assertCategoryEquals(category, testCase.propertyData.categories[index]));
      });
    }
  });
});
