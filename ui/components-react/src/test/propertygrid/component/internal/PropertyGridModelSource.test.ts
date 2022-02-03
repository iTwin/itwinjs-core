/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
import { expect } from "chai";
import sinon from "sinon";
import type { IMutableGridItemFactory} from "../../../../components-react/propertygrid/internal/flat-items/MutableGridItemFactory";
import { MutableGridItemFactory } from "../../../../components-react/propertygrid/internal/flat-items/MutableGridItemFactory";
import type { IPropertyGridModel } from "../../../../components-react/propertygrid/internal/PropertyGridModel";
import { PropertyGridModelSource } from "../../../../components-react/propertygrid/internal/PropertyGridModelSource";
import { TestUtils } from "../../../TestUtils";
import type { PropertyGridModelTestData } from "./flat-items/FlatGridTestUtils";
import { FlatGridTestUtils as GridUtils } from "./flat-items/FlatGridTestUtils";

describe("PropertyGridModelSource", () => {
  let factory: IMutableGridItemFactory;
  beforeEach(() => {
    factory = new MutableGridItemFactory();
  });

  describe("modifyModel", () => {
    interface RecalculateGridModelChanges {
      before: PropertyGridModelTestData;
      changedPropertyKey: string;
      after: PropertyGridModelTestData;
    }

    const testData: RecalculateGridModelChanges = {
      before: {
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
              name: "Cat2", label: "Category 2", expand: false, childCategories: [
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
                TestUtils.createPrimitiveStringProperty("Property1-1-1-1", "V1"),
                TestUtils.createStructProperty("Struct1-1-1-2", {
                  "Array1-1-1-2-1": TestUtils.createArrayProperty("Array1-1-1-2-1"),
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
              TestUtils.createArrayProperty("Array"),
              TestUtils.createStructProperty("Struct"),
            ],
          },
        },
        expectedLastItemData: {
          "Cat1_Cat1-1_Array1-1-1_Struct1-1-1-2_1": { isLastInRootCategory: true, lastInNumberOfCategories: 2 },
          "Cat2": { isLastInRootCategory: true, lastInNumberOfCategories: 0 },
        },
      },
      changedPropertyKey: "Cat2",
      after: {
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
                TestUtils.createPrimitiveStringProperty("Property1-1-1-1", "V1"),
                TestUtils.createStructProperty("Struct1-1-1-2", {
                  "Array1-1-1-2-1": TestUtils.createArrayProperty("Array1-1-1-2-1"),
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
              TestUtils.createArrayProperty("Array"),
              TestUtils.createStructProperty("Struct"),
            ],
          },
        },
        expectedLastItemData: {
          "Cat1_Cat1-1_Array1-1-1_Struct1-1-1-2_1": { isLastInRootCategory: true, lastInNumberOfCategories: 2 },
          "Cat2_Cat2-1_Cat2-1-1": { isLastInRootCategory: true, lastInNumberOfCategories: 2 },
        },
      },
    };

    it(`Should not call modify model callback when property data not set: ${testData.before.testName}`, () => {
      const gridModelSource = new PropertyGridModelSource(factory);

      gridModelSource.modifyModel(() => {
        throw new Error("Callback called when model data not set");
      });
    });

    it(`Should correctly modify model: ${testData.before.testName}`, () => {
      const gridModelSource = new PropertyGridModelSource(factory);

      gridModelSource.setPropertyData(testData.before.propertyData);

      const expectedFlatGridBefore = GridUtils.getFlattenedPropertyData(testData.before.propertyData, true);
      GridUtils.assertGridModel(gridModelSource.getModel()!, expectedFlatGridBefore, testData.before.expectedLastItemData);

      gridModelSource.modifyModel((model) => {
        const itemToChange = model.getItem(testData.changedPropertyKey);
        itemToChange.isExpanded = !itemToChange.isExpanded;
      });

      const expectedFlatGridAfter = GridUtils.getFlattenedPropertyData(testData.after.propertyData, true);
      GridUtils.assertGridModel(gridModelSource.getModel()!, expectedFlatGridAfter, testData.after.expectedLastItemData);
    });

    it(`Should correctly raise event when model set or modified: ${testData.before.testName}`, () => {
      const gridModelSource = new PropertyGridModelSource(factory);
      const eventSpy = sinon.spy();

      gridModelSource.onModelChanged.addListener(eventSpy);
      gridModelSource.setPropertyData(testData.before.propertyData);
      expect(eventSpy.callCount).to.be.equal(1);

      gridModelSource.modifyModel((model) => {
        const itemToChange = model.getItem(testData.changedPropertyKey);
        itemToChange.isExpanded = !itemToChange.isExpanded;
      });

      expect(eventSpy.callCount).to.be.equal(2);
    });

    it(`Should correctly map old state to new state: ${testData.before.testName}`, () => {
      const gridModelSource = new PropertyGridModelSource(factory);
      gridModelSource.setPropertyData(testData.before.propertyData);

      const expectedIsExpand = !(gridModelSource.getModel()!.getItem(testData.changedPropertyKey).isExpanded);
      gridModelSource.modifyModel((model) => {
        const itemToChange = model.getItem(testData.changedPropertyKey);
        itemToChange.isExpanded = expectedIsExpand;
      });

      // Reset same property data
      gridModelSource.setPropertyData({ ...testData.before.propertyData, reusePropertyDataState: true });
      expect(gridModelSource.getModel()!.getItem(testData.changedPropertyKey).isExpanded).to.equal(expectedIsExpand);
    });

    it(`Should not map old state when parent selection key is changed: ${testData.before.testName}`, () => {
      const gridModelSource = new PropertyGridModelSource(factory);

      gridModelSource.setPropertyData(testData.before.propertyData);

      const changedKey = "Cat2_Cat2-1_Cat2-1-1_Array";
      const originalExpand = gridModelSource.getModel()!.getItem(changedKey).isExpanded;
      gridModelSource.modifyModel((model) => {
        const itemToChange = model.getItem(changedKey);
        itemToChange.isExpanded = !itemToChange.isExpanded;
      });

      const modifiedPropertyData = { ...testData.before.propertyData };
      modifiedPropertyData.categories[1].childCategories![0].name = "Cat2_DiffCat2-1";

      // Reset same property data
      gridModelSource.setPropertyData(modifiedPropertyData);

      expect(gridModelSource.getModel()!.getItem(testData.changedPropertyKey).isExpanded).to.equal(originalExpand);
    });
  });

  describe("Updated model should keep model integrity", () => {
    const propertyData = {
      label: TestUtils.createPrimitiveStringProperty("Label", "Value"),
      categories: [
        {
          name: "Cat1", label: "Category 1", expand: true, childCategories: [
            { name: "Cat1-1", label: "Category 1-1", expand: true },
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
      },
    };

    it("Updated model should have same expand state no matter how you traverse to item", () => {
      const gridModelSource = new PropertyGridModelSource(factory);

      gridModelSource.setPropertyData(propertyData);

      const itemToSelectKey = "Cat1_Cat1-1_Array1-1-1_Struct1-1-1-2_1_Array1-1-1-2-1";
      const verifyModelIntegrity = (model: IPropertyGridModel, expectedExpand: boolean) => {
        expect(model.getFlatGrid()[5].isExpanded).to.be.equal(expectedExpand);
        expect(model.getVisibleFlatGrid()[5].isExpanded).to.be.equal(expectedExpand);
        expect(model.getItem(itemToSelectKey).isExpanded).to.be.equal(expectedExpand);
        expect(model.getItem("Cat1").getDescendantsAndSelf()[5].isExpanded).to.be.equal(expectedExpand);
      };

      const oldModel = gridModelSource.getModel()!;
      verifyModelIntegrity(oldModel, false);

      gridModelSource.modifyModel((model) => {
        const arrProp = model.getItem(itemToSelectKey);
        arrProp.isExpanded = true;
      });

      const newModel = gridModelSource.getModel()!;
      verifyModelIntegrity(newModel, true);
    });
  });
});
