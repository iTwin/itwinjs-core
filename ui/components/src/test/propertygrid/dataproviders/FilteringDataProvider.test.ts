/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/

import { expect } from "chai";
import sinon from "sinon";
import * as moq from "typemoq";
import { ArrayValue, PropertyRecord } from "@bentley/ui-abstract";
import { IPropertyDataFilterer, PropertyFilterChangeEvent } from "../../../ui-components";
import { FilteringPropertyDataProvider } from "../../../ui-components/propertygrid/dataproviders/FilteringDataProvider";
import { IPropertyDataProvider, PropertyData, PropertyDataChangeEvent } from "../../../ui-components/propertygrid/PropertyDataProvider";
import { TestUtils } from "../../TestUtils";
import { FlatGridTestUtils } from "../component/internal/flat-items/FlatGridTestUtils";

describe("FilteringDataProvider", () => {
  let dataProvider: IPropertyDataProvider;
  let mockFilterer: moq.IMock<IPropertyDataFilterer>;
  let onFilterChanged: PropertyFilterChangeEvent;
  let onDataChanged: PropertyDataChangeEvent;
  let originalPropertyData: PropertyData;

  beforeEach(() => {
    mockFilterer = moq.Mock.ofType<IPropertyDataFilterer>();
    onFilterChanged = new PropertyFilterChangeEvent();
    mockFilterer.setup((x) => x.onFilterChanged).returns(() => onFilterChanged);
    originalPropertyData = {
      label: TestUtils.createPrimitiveStringProperty("Label", "Value"),
      description: "Test data",
      categories: [
        {
          name: "Cat1", label: "Category 1", expand: true, childCategories: [
            { name: "Cat1-1", label: "Category 1-1", expand: false },
            { name: "Cat1-2", label: "Category 1-2", expand: false },
            { name: "Cat1-3", label: "Category 1-3", expand: false },
          ],
        },
        { name: "Cat2", label: "Category 2", expand: true },
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
            }, false),
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
              ], false),
            }, false),
            TestUtils.createPrimitiveStringProperty("Property1-2-1-3", "V1"),
            TestUtils.createPrimitiveStringProperty("Property1-2-1-4", "V1"),
            TestUtils.createPrimitiveStringProperty("Property1-2-1-5", "V1"),
          ], false),
        ],
        "Cat2": [
          TestUtils.createStructProperty("Struct2", {
            "Property2-1": TestUtils.createPrimitiveStringProperty("Property2-1", "V1"),
            "Property2-2": TestUtils.createPrimitiveStringProperty("Property2-2", "V1"),
            "Array2-3": TestUtils.createArrayProperty("Array2-3", [
              TestUtils.createPrimitiveStringProperty("Property2-3-1", "V1"), // Match, do not expand to node
            ], false),
          }, false),
        ],
      },
    };

    onDataChanged = new PropertyDataChangeEvent();
    dataProvider = {
      onDataChanged,
      getData: async () => originalPropertyData,
    };
  });

  it("Should listen to onFilterChanged events and raise onDataChanged", () => {
    mockFilterer.setup((x) => x.isActive).returns(() => false);
    const filteringProvider = new FilteringPropertyDataProvider(dataProvider, mockFilterer.object);
    const spy = sinon.spy();
    filteringProvider.onDataChanged.addListener(spy);
    onFilterChanged.raiseEvent();
    expect(spy.callCount).to.be.equal(1);
  });

  it("Should listen to onDataChanged events and call and re-raise onDataChanged", () => {
    mockFilterer.setup((x) => x.isActive).returns(() => false);
    const filteringProvider = new FilteringPropertyDataProvider(dataProvider, mockFilterer.object);
    const changeSpy = sinon.spy();
    filteringProvider.onDataChanged.addListener(changeSpy);
    onDataChanged.raiseEvent();
    expect(changeSpy.callCount).to.be.equal(1);
  });

  describe("getData", () => {
    it("Should return original data if filter is not active", async () => {
      mockFilterer.setup((x) => x.isActive).returns(() => false);
      const filteringProvider = new FilteringPropertyDataProvider(dataProvider, mockFilterer.object);
      const propertyData = await filteringProvider.getData();
      expect(propertyData).to.be.equal(originalPropertyData);
    });

    it("Should return empty property data if filter is enabled and nothing matches it", async () => {
      mockFilterer.setup((x) => x.isActive).returns(() => true);
      mockFilterer.setup(async (x) => x.matchesFilter(moq.It.isAny(), moq.It.isAny())).returns(async () => ({ matchesFilter: false }));

      const filteringProvider = new FilteringPropertyDataProvider(dataProvider, mockFilterer.object);

      const propertyData = await filteringProvider.getData();

      expect(propertyData.label).to.deep.equal(originalPropertyData.label);
      expect(propertyData.description).to.equal(originalPropertyData.description);
      expect(propertyData.categories).to.deep.equal([]);
      expect(propertyData.records).to.deep.equal({});
    });

    function findRecord(records: PropertyRecord[], name: string): PropertyRecord | undefined {
      for (const record of records) {
        if (record.property.name === name)
          return record;

        const potentialMatch = findRecord(record.getChildrenRecords(), name);
        if (potentialMatch)
          return potentialMatch;
      };

      return undefined;
    }

    function findRecordFromPropertyData(name: string): PropertyRecord {
      for (const categoryName in originalPropertyData.records) {
        // istanbul ignore else
        if (originalPropertyData.records.hasOwnProperty(categoryName)) {
          const potentialMatch = findRecord(originalPropertyData.records[categoryName], name);
          if (potentialMatch)
            return potentialMatch;
        }
      }

      throw Error(`Property with name: ${name} not found. Check test data.`);
    }

    it("Should return expected filtered data if filter is enabled and there are matches", async () => {
      // eslint-disable-next-line @typescript-eslint/no-unused-vars
      const expectedFilteredData = {
        label: originalPropertyData.label,
        description: originalPropertyData.description,
        categories: [
          {
            name: "Cat1", label: "Category 1", expand: true, childCategories: [
              { name: "Cat1-1", label: "Category 1-1", expand: true, childCategories: [] },
              { name: "Cat1-2", label: "Category 1-2", expand: true, childCategories: [] },
            ],
          },
          { name: "Cat2", label: "Category 2", expand: true, childCategories: [] },
        ],
        records: {
          "Cat1": [],
          "Cat1-1": [
            TestUtils.createArrayProperty("Array1-1-1", [
              TestUtils.createStructProperty("Struct1-1-1-2", { // Matches, force include descendants, expand to node
                "Array1-1-1-2-1": TestUtils.createArrayProperty("Array1-1-1-2-1", [
                  TestUtils.createPrimitiveStringProperty("Property1-1-1-2-1-1", "V1", undefined, undefined, false),
                  TestUtils.createPrimitiveStringProperty("Property1-1-1-2-1-2", "V1", undefined, undefined, false),
                  TestUtils.createPrimitiveStringProperty("Property1-1-1-2-1-3", "V1", undefined, undefined, false),
                ], false),
              }, false),
              TestUtils.createPrimitiveStringProperty("Property1-1-1-3", "V1", undefined, undefined, false), // Match, expand to node
            ], true),
          ],
          "Cat1-2": [
            TestUtils.createArrayProperty("Array1-2-1", [
              TestUtils.createStructProperty("Struct1-2-1-2", {
                "Array1-2-1-2-1": TestUtils.createArrayProperty("Array1-2-1-2-1", [], false), // Matches, do not include descendants, expand to node
              }, true),
            ], true),
          ],
          "Cat2": [
            TestUtils.createStructProperty("Struct2", {
              "Property2-1": TestUtils.createPrimitiveStringProperty("Property2-1", "V1", undefined, undefined, false), // Match, do not expand to node
              "Property2-2": TestUtils.createPrimitiveStringProperty("Property2-2", "V1", undefined, undefined, false), // Match, expand to node
              "Array2-3": TestUtils.createArrayProperty("Array2-3", [
                TestUtils.createPrimitiveStringProperty("Property2-3-1", "V1", undefined, undefined, false), // Match, do not expand to node
              ], false),
            }, true),
          ],
        },
      };

      mockFilterer.setup((x) => x.isActive).returns(() => true);

      // Fix itemsTypeName since first child changed
      (findRecordFromPropertyData("Array1-1-1").value as ArrayValue).itemsTypeName = "struct";
      (findRecordFromPropertyData("Array1-2-1").value as ArrayValue).itemsTypeName = "struct";

      mockFilterer.setup(async (x) => x.matchesFilter(findRecordFromPropertyData("Struct1-1-1-2"), moq.It.isAny())).returns(async () => ({ matchesFilter: true, shouldForceIncludeDescendants: true, shouldExpandNodeParents: true }));
      mockFilterer.setup(async (x) => x.matchesFilter(findRecordFromPropertyData("Property1-1-1-3"), moq.It.isAny())).returns(async () => ({ matchesFilter: true, shouldExpandNodeParents: true }));
      mockFilterer.setup(async (x) => x.matchesFilter(findRecordFromPropertyData("Array1-2-1-2-1"), moq.It.isAny())).returns(async () => ({ matchesFilter: true, shouldExpandNodeParents: true }));
      mockFilterer.setup(async (x) => x.matchesFilter(findRecordFromPropertyData("Property2-1"), moq.It.isAny())).returns(async () => ({ matchesFilter: true }));
      mockFilterer.setup(async (x) => x.matchesFilter(findRecordFromPropertyData("Property2-2"), moq.It.isAny())).returns(async () => ({ matchesFilter: true, shouldExpandNodeParents: true }));
      mockFilterer.setup(async (x) => x.matchesFilter(findRecordFromPropertyData("Property2-3-1"), moq.It.isAny())).returns(async () => ({ matchesFilter: true }));
      mockFilterer.setup(async (x) => x.matchesFilter(moq.It.isAny(), moq.It.isAny())).returns(async () => ({ matchesFilter: false }));

      const filteringProvider = new FilteringPropertyDataProvider(dataProvider, mockFilterer.object);

      const filteredData = await filteringProvider.getData();

      FlatGridTestUtils.removeParentsFromCategories(filteredData.categories);

      expect(filteredData.label).to.deep.equal(expectedFilteredData.label);
      expect(filteredData.description).to.equal(expectedFilteredData.description);
      expect(filteredData.categories).to.deep.equal(expectedFilteredData.categories);
      expect(filteredData.records).to.deep.equal(expectedFilteredData.records);
    });
  });
});
