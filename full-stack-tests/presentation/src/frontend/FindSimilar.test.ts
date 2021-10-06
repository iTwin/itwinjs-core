/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
import { expect } from "chai";
import { Id64String, using } from "@itwin/core-bentley";
import { IModelConnection, SnapshotConnection } from "@itwin/core-frontend";
import { InstanceKey, KeySet } from "@itwin/presentation-common";
import {
  DataProvidersFactory, DEFAULT_PROPERTY_GRID_RULESET, IPresentationTableDataProvider, PresentationPropertyDataProvider,
} from "@itwin/presentation-components";
import { PropertyRecord } from "@itwin/appui-abstract";
import { PropertyData, RowItem } from "@itwin/components-react";
import { initialize, terminate } from "../IntegrationTests";

describe("Find Similar", () => {

  let imodel: IModelConnection;

  before(async () => {
    await initialize();
    const testIModelName: string = "assets/datasets/Properties_60InstancesWithUrl2.ibim";
    imodel = await SnapshotConnection.openFile(testIModelName);
    expect(imodel).is.not.null;
  });

  after(async () => {
    await imodel.close();
    await terminate();
  });

  let propertiesDataProvider: PresentationPropertyDataProvider;
  let factory: DataProvidersFactory;

  beforeEach(async () => {
    propertiesDataProvider = new PresentationPropertyDataProvider({ imodel, ruleset: DEFAULT_PROPERTY_GRID_RULESET });
    propertiesDataProvider.isNestedPropertyCategoryGroupingEnabled = false;
    factory = new DataProvidersFactory();
  });

  const getPropertyRecordByLabel = (props: PropertyData, label: string): PropertyRecord | undefined => {
    for (const category of props.categories) {
      const record = props.records[category.name].find((r) => r.property.displayLabel === label);
      if (record)
        return record;
    }
    return undefined;
  };

  const getAllRows = async (provider: IPresentationTableDataProvider): Promise<RowItem[]> => {
    const rows: RowItem[] = [];
    const count = await provider.getRowsCount();
    for (let i = 0; i < count; ++i) {
      rows.push(await provider.getRow(i));
    }
    return rows;
  };

  const getAllRowsInstanceKeys = async (provider: IPresentationTableDataProvider): Promise<InstanceKey[]> => {
    return (await getAllRows(provider)).map((r) => InstanceKey.fromJSON(JSON.parse(r.key)));
  };

  const getAllRowsInstanceIds = async (provider: IPresentationTableDataProvider): Promise<Id64String[]> => {
    return (await getAllRowsInstanceKeys(provider)).map((k) => k.id);
  };

  it("creates a valid 'similar instances' data provider for primary instance primitive property", async () => {
    // get properties for one of the elements
    propertiesDataProvider.keys = new KeySet([{ className: "PCJ_TestSchema:TestClass", id: "0x38" }]);
    const propertyData = await propertiesDataProvider.getData();

    // find the property record to request similar instances for
    const record = getPropertyRecordByLabel(propertyData, "Country")!;

    // create a 'similar instances' data provider and validate
    await using(await factory.createSimilarInstancesTableDataProvider(propertiesDataProvider, record, {}), async (provider) => {
      expect(await provider.getRowsCount()).to.eq(10);
      expect(await getAllRowsInstanceKeys(provider)).to.deep.include.members([
        { className: "PCJ_TestSchema:TestClass", id: "0x38" },
        { className: "PCJ_TestSchema:TestClass", id: "0x39" },
        { className: "PCJ_TestSchema:TestClass", id: "0x3a" },
        { className: "PCJ_TestSchema:TestClass", id: "0x3b" },
        { className: "PCJ_TestSchema:TestClass", id: "0x3c" },
        { className: "PCJ_TestSchema:TestClass", id: "0x3d" },
        { className: "PCJ_TestSchema:TestClass", id: "0x3e" },
        { className: "PCJ_TestSchema:TestClass", id: "0x3f" },
        { className: "PCJ_TestSchema:TestClass", id: "0x40" },
        { className: "PCJ_TestSchema:TestClass", id: "0x6e" },
      ]);
    });
  });

  it("creates a valid 'similar instances' data provider for primary instance navigation property", async () => {
    // get properties for one of the elements
    propertiesDataProvider.keys = new KeySet([{ className: "PCJ_TestSchema:TestClass", id: "0x38" }]);
    const propertyData = await propertiesDataProvider.getData();

    // find the property record to request similar instances for
    const record = getPropertyRecordByLabel(propertyData, "Category")!;

    // create a 'similar instances' data provider and validate
    await using(await factory.createSimilarInstancesTableDataProvider(propertiesDataProvider, record, {}), async (provider) => {
      expect(await provider.getRowsCount()).to.eq(60);
      expect(await getAllRowsInstanceIds(provider)).to.deep.include.members([
        "0x38", "0x39", "0x3a", "0x3b", "0x3c", "0x3d", "0x3e", "0x3f", "0x40", "0x41",
        "0x42", "0x43", "0x44", "0x45", "0x46", "0x47", "0x48", "0x49", "0x4a", "0x4b",
        "0x4c", "0x4d", "0x4e", "0x4f", "0x50", "0x51", "0x52", "0x53", "0x54", "0x55",
        "0x56", "0x57", "0x58", "0x59", "0x5a", "0x5b", "0x5c", "0x5d", "0x5e", "0x5f",
        "0x60", "0x61", "0x62", "0x63", "0x64", "0x65", "0x66", "0x67", "0x68", "0x69",
        "0x6a", "0x6b", "0x6c", "0x6d", "0x6e", "0x6f", "0x70", "0x71", "0x72", "0x73",
      ]);
    });
  });

  it("creates a valid 'similar instances' data provider for related instance property", async () => {
    // get properties for one of the elements
    propertiesDataProvider.keys = new KeySet([{ className: "Generic:PhysicalObject", id: "0x74" }]);
    const propertyData = await propertiesDataProvider.getData();

    // find the property record to request similar instances for
    const record = getPropertyRecordByLabel(propertyData, "Angle")!;

    // create a 'similar instances' data provider and validate
    await using(await factory.createSimilarInstancesTableDataProvider(propertiesDataProvider, record, {}), async (provider) => {
      expect(await provider.getRowsCount()).to.eq(2);
      expect(await getAllRowsInstanceKeys(provider)).to.deep.include.members([
        { className: "Generic:PhysicalObject", id: "0x74" },
        { className: "Generic:PhysicalObject", id: "0x75" },
      ]);
    });
  });

});
