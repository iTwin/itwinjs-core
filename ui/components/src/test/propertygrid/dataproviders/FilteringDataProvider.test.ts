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
    const dataSpy = sinon.spy();
    filteringProvider.onDataChanged.addListener(dataSpy);
    onDataChanged.raiseEvent();
    expect(dataSpy.callCount).to.be.equal(1);
  });

  it("Should dispose listeners when component is disposed", () => {
    mockFilterer.setup((x) => x.isActive).returns(() => false);
    const filteringProvider = new FilteringPropertyDataProvider(dataProvider, mockFilterer.object);

    const dataSpy = sinon.spy();
    filteringProvider.onDataChanged.addListener(dataSpy);

    filteringProvider.dispose();

    expect(onDataChanged.numberOfListeners).to.be.equal(0);
    expect(onFilterChanged.numberOfListeners).to.be.equal(0);
  });

  describe("getData", () => {
    it("Should return original data if filter is not active", async () => {
      mockFilterer.setup((x) => x.isActive).returns(() => false);
      const filteringProvider = new FilteringPropertyDataProvider(dataProvider, mockFilterer.object);
      const propertyData = await filteringProvider.getData();
      expect(propertyData).to.be.equal(originalPropertyData);
    });

    it("Should return empty property data and matchesCount equal to 0 if filter is enabled and nothing matches it", async () => {
      mockFilterer.setup((x) => x.isActive).returns(() => true);
      mockFilterer.setup(async (x) => x.matchesFilter(moq.It.isAny(), moq.It.isAny())).returns(async () => ({ matchesFilter: false }));

      const filteringProvider = new FilteringPropertyDataProvider(dataProvider, mockFilterer.object);

      const propertyData = await filteringProvider.getData();

      expect(propertyData.label).to.deep.equal(originalPropertyData.label);
      expect(propertyData.description).to.equal(originalPropertyData.description);
      expect(propertyData.categories).to.deep.equal([]);
      expect(propertyData.records).to.deep.equal({});
      expect(propertyData.matchesCount).to.deep.equal(0);
    });

    function findRecord(records: PropertyRecord[], name: string): PropertyRecord | undefined {
      for (const record of records) {
        if (record.property.name === name)
          return record;

        const potentialMatch = findRecord(record.getChildrenRecords(), name);
        if (potentialMatch)
          return potentialMatch;
      }

      return undefined;
    }

    function findRecordFromPropertyData(name: string, propertyData: PropertyData): PropertyRecord {
      for (const categoryName in propertyData.records) {
        // istanbul ignore else
        if (propertyData.records.hasOwnProperty(categoryName)) {
          const potentialMatch = findRecord(propertyData.records[categoryName], name);
          if (potentialMatch)
            return potentialMatch;
        }
      }

      throw Error(`Property with name: ${name} not found. Check test data.`);
    }

    const createPropertyData = (records: PropertyRecord[]) => {
      const data = {
        label: TestUtils.createPrimitiveStringProperty("Label", "Value"),
        description: "Test data",
        categories: [{ name: "Cat1", label: "Category 1", expand: true, childCategories: [] }],
        records: {
          Cat1: records,
        },
      };

      return data;
    };

    const createDataProvider = (data: PropertyData) => {
      return {
        onDataChanged: new PropertyDataChangeEvent(),
        getData: async () => data,
      };
    };

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
      (findRecordFromPropertyData("Array1-1-1", originalPropertyData).value as ArrayValue).itemsTypeName = "struct";
      (findRecordFromPropertyData("Array1-2-1", originalPropertyData).value as ArrayValue).itemsTypeName = "struct";

      mockFilterer.setup(async (x) => x.matchesFilter(findRecordFromPropertyData("Struct1-1-1-2", originalPropertyData), moq.It.isAny())).returns(async () => ({ matchesFilter: true, shouldForceIncludeDescendants: true, shouldExpandNodeParents: true, matchesCount: { label: 3, value: 5 } }));
      mockFilterer.setup(async (x) => x.matchesFilter(findRecordFromPropertyData("Property1-1-1-3", originalPropertyData), moq.It.isAny())).returns(async () => ({ matchesFilter: true, shouldExpandNodeParents: true, matchesCount: { label: 2, value: 4 } }));
      mockFilterer.setup(async (x) => x.matchesFilter(findRecordFromPropertyData("Array1-2-1-2-1", originalPropertyData), moq.It.isAny())).returns(async () => ({ matchesFilter: true, shouldExpandNodeParents: true, matchesCount: { label: 1, value: 5 } }));
      mockFilterer.setup(async (x) => x.matchesFilter(findRecordFromPropertyData("Property2-1", originalPropertyData), moq.It.isAny())).returns(async () => ({ matchesFilter: true, matchesCount: { label: 2, value: 0 } }));
      mockFilterer.setup(async (x) => x.matchesFilter(findRecordFromPropertyData("Property2-2", originalPropertyData), moq.It.isAny())).returns(async () => ({ matchesFilter: true, shouldExpandNodeParents: true, matchesCount: { label: 1, value: 3 } }));
      mockFilterer.setup(async (x) => x.matchesFilter(findRecordFromPropertyData("Property2-3-1", originalPropertyData), moq.It.isAny())).returns(async () => ({ matchesFilter: true }));
      mockFilterer.setup(async (x) => x.matchesFilter(moq.It.isAny(), moq.It.isAny())).returns(async () => ({ matchesFilter: false }));

      const filteringProvider = new FilteringPropertyDataProvider(dataProvider, mockFilterer.object);

      const filteredData = await filteringProvider.getData();

      FlatGridTestUtils.removeParentsFromCategories(filteredData.categories);

      expect(filteredData.label).to.deep.equal(expectedFilteredData.label);
      expect(filteredData.description).to.equal(expectedFilteredData.description);
      expect(filteredData.categories).to.deep.equal(expectedFilteredData.categories);
      expect(filteredData.records).to.deep.equal(expectedFilteredData.records);
      expect(filteredData.matchesCount).to.deep.equal(26);
      expect(filteredData.getMatchByIndex).to.exist;
    });

    it("Should return expected active match when getActiveMatch() is called", async () => {
      const records: PropertyRecord[] = [
        TestUtils.createPrimitiveStringProperty("Property1", "V1"),
        TestUtils.createPrimitiveStringProperty("Property2", "V2"),
      ];

      const propertyData = createPropertyData(records);
      const dataProv = createDataProvider(propertyData);

      mockFilterer.setup((x) => x.isActive).returns(() => true);

      mockFilterer.setup(async (x) => x.matchesFilter(findRecordFromPropertyData("Property1", propertyData), moq.It.isAny())).returns(async () => ({ matchesFilter: true, matchesCount: { label: 3, value: 5 } }));
      mockFilterer.setup(async (x) => x.matchesFilter(findRecordFromPropertyData("Property2", propertyData), moq.It.isAny())).returns(async () => ({ matchesFilter: true, matchesCount: { label: 2, value: 4 } }));

      const filteringProvider = new FilteringPropertyDataProvider(dataProv, mockFilterer.object);

      const filteredData = await filteringProvider.getData();
      let activeMatch;
      if (filteredData.getMatchByIndex)
        activeMatch = filteredData.getMatchByIndex(9);

      expect(activeMatch).to.deep.equal({ propertyName: "Property2", matchIndex: 0, matchCounts: { label: 2, value: 4 } });
    });

    it("Should return expected active match when getActiveMatch() is called and only label matches count are provided", async () => {
      const records: PropertyRecord[] = [
        TestUtils.createPrimitiveStringProperty("Property1", "V1"),
        TestUtils.createPrimitiveStringProperty("Property2", "V2"),
      ];

      const propertyData = createPropertyData(records);
      const dataProv = createDataProvider(propertyData);

      mockFilterer.setup((x) => x.isActive).returns(() => true);

      mockFilterer.setup(async (x) => x.matchesFilter(findRecordFromPropertyData("Property1", propertyData), moq.It.isAny())).returns(async () => ({ matchesFilter: true, matchesCount: { label: 3 } }));
      mockFilterer.setup(async (x) => x.matchesFilter(findRecordFromPropertyData("Property2", propertyData), moq.It.isAny())).returns(async () => ({ matchesFilter: true, matchesCount: { label: 2 } }));

      const filteringProvider = new FilteringPropertyDataProvider(dataProv, mockFilterer.object);

      const filteredData = await filteringProvider.getData();
      let activeMatch;
      if (filteredData.getMatchByIndex)
        activeMatch = filteredData.getMatchByIndex(4);

      expect(activeMatch).to.deep.equal({ propertyName: "Property2", matchIndex: 0, matchCounts: { label: 2, value: 0 } });
    });

    it("Should return expected active match when getActiveMatch() is called and only value matches count are provided", async () => {
      const records: PropertyRecord[] = [
        TestUtils.createPrimitiveStringProperty("Property1", "V1"),
        TestUtils.createPrimitiveStringProperty("Property2", "V2"),
      ];

      const propertyData = createPropertyData(records);
      const dataProv = createDataProvider(propertyData);

      mockFilterer.setup((x) => x.isActive).returns(() => true);

      mockFilterer.setup(async (x) => x.matchesFilter(findRecordFromPropertyData("Property1", propertyData), moq.It.isAny())).returns(async () => ({ matchesFilter: true, matchesCount: { value: 3 } }));
      mockFilterer.setup(async (x) => x.matchesFilter(findRecordFromPropertyData("Property2", propertyData), moq.It.isAny())).returns(async () => ({ matchesFilter: true, matchesCount: { value: 2 } }));

      const filteringProvider = new FilteringPropertyDataProvider(dataProv, mockFilterer.object);

      const filteredData = await filteringProvider.getData();
      let activeMatch;
      if (filteredData.getMatchByIndex)
        activeMatch = filteredData.getMatchByIndex(4);

      expect(activeMatch).to.deep.equal({ propertyName: "Property2", matchIndex: 0, matchCounts: { label: 0, value: 2 } });
    });

    it("Should return activeMatch as undefined if provided index is <=0 ", async () => {
      const records: PropertyRecord[] = [
        TestUtils.createPrimitiveStringProperty("Property1", "V1"),
      ];

      const propertyData = createPropertyData(records);
      const dataProv = createDataProvider(propertyData);

      mockFilterer.setup((x) => x.isActive).returns(() => true);

      const filteringProvider = new FilteringPropertyDataProvider(dataProv, mockFilterer.object);

      mockFilterer.setup(async (x) => x.matchesFilter(moq.It.isAny(), moq.It.isAny())).returns(async () => ({ matchesFilter: false }));

      const filteredData = await filteringProvider.getData();
      let activeMatch;
      if (filteredData.getMatchByIndex)
        activeMatch = filteredData.getMatchByIndex(-1);

      expect(activeMatch).to.be.undefined;
    });

    it("Should return the same getData object and filter data only once if no dataChange event was fired", async () => {
      const records: PropertyRecord[] = [
        TestUtils.createPrimitiveStringProperty("Property1", "V1"),
      ];

      const propertyData = createPropertyData(records);
      const dataProv = createDataProvider(propertyData);

      mockFilterer.setup((x) => x.isActive).returns(() => true).verifiable(moq.Times.once());
      mockFilterer.setup(async (x) => x.matchesFilter(findRecordFromPropertyData("Property1", propertyData), moq.It.isAny())).returns(async () => ({ matchesFilter: true, matchesCount: { label: 3, value: 5 } }));

      const filteringProvider = new FilteringPropertyDataProvider(dataProv, mockFilterer.object);

      const filteredData = await filteringProvider.getData();
      const filteredData2 = await filteringProvider.getData();

      expect(filteredData === filteredData2).to.be.true;
      mockFilterer.verifyAll();
    });

    it("Should return different getData objects and filter data more than once if dataChange event was fired", async () => {
      const records: PropertyRecord[] = [
        TestUtils.createPrimitiveStringProperty("Property1", "V1"),
      ];

      const propertyData = createPropertyData(records);
      const dataProv = createDataProvider(propertyData);

      mockFilterer.setup((x) => x.isActive).returns(() => true).verifiable(moq.Times.exactly(2));
      mockFilterer.setup(async (x) => x.matchesFilter(findRecordFromPropertyData("Property1", propertyData), moq.It.isAny())).returns(async () => ({ matchesFilter: true, matchesCount: { label: 3, value: 5 } }));

      const filteringProvider = new FilteringPropertyDataProvider(dataProv, mockFilterer.object);

      const filteredDataPromise = filteringProvider.getData();
      dataProv.onDataChanged.raiseEvent();
      const filteredDataPromise2 = filteringProvider.getData();

      const filteredData = await filteredDataPromise;
      const filteredData2 = await filteredDataPromise2;

      expect(filteredData !== filteredData2).to.be.true;
      mockFilterer.verifyAll();

    });

    it("Should return different getData objects and filter data more than once if onFilterChanged event was raised", async () => {
      const records: PropertyRecord[] = [
        TestUtils.createPrimitiveStringProperty("Property1", "V1"),
      ];

      const propertyData = createPropertyData(records);
      const dataProv = createDataProvider(propertyData);

      mockFilterer.setup((x) => x.isActive).returns(() => true).verifiable(moq.Times.exactly(2));

      mockFilterer.setup(async (x) => x.matchesFilter(findRecordFromPropertyData("Property1", propertyData), moq.It.isAny())).returns(async () => ({ matchesFilter: true, matchesCount: { label: 3, value: 5 } }));

      const filteringProvider = new FilteringPropertyDataProvider(dataProv, mockFilterer.object);

      const filteredDataPromise = filteringProvider.getData();
      onFilterChanged.raiseEvent();
      const filteredDataPromise2 = filteringProvider.getData();

      const filteredData = await filteredDataPromise;
      const filteredData2 = await filteredDataPromise2;

      expect(filteredData !== filteredData2).to.be.true;
      mockFilterer.verifyAll();
    });
  });
});
