/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
import { expect } from "chai";
import { PropertyRecord, PropertyValueFormat } from "@itwin/appui-abstract";
import { BreadcrumbTreeUtils } from "../../components-react/breadcrumb/BreadcrumbTreeUtils";
import type { CellItem, RowItem } from "../../components-react/table/TableDataProvider";
import type { ImmediatelyLoadedTreeNodeItem, TreeDataProvider } from "../../components-react/tree/TreeDataProvider";
import TestUtils from "../TestUtils";
import { mockInterfaceTreeDataProvider } from "./mockTreeDataProvider";

/* eslint-disable deprecation/deprecation */

describe("BreadcrumbTreeUtils", () => {
  before(async () => {
    await TestUtils.initializeUiComponents();
  });

  const getColFromRowByKey = async (row: RowItem, key: string): Promise<CellItem | undefined> => {
    for (const col of row.cells) {
      if (col.key === key) {
        return col;
      }
    }
    return undefined;
  };
  it("should flatten root nodes", async () => {
    const treeDataProvider: TreeDataProvider = [{ id: "1", icon: "icon-placeholder", label: PropertyRecord.fromString("Raw Node 1") }];
    const columns = [{ key: "icon", label: "", icon: true }, { key: "label", label: "Name" }];

    const table = BreadcrumbTreeUtils.aliasNodeListToTableDataProvider(treeDataProvider, columns, treeDataProvider);

    const row = await table.getRow(0);

    const icon = await getColFromRowByKey(row, "icon");
    expect(icon).to.exist;
    expect((icon!.record!.value as any).value).to.equal("icon-placeholder");
    expect(row.extendedData!.icon).to.equal("icon-placeholder");

    const label = await getColFromRowByKey(row, "label");
    expect(label).to.exist;
    expect((label!.record!.value as any).value).to.equal("Raw Node 1");
    expect(row.extendedData!.label).to.equal("Raw Node 1");
  });

  it("should pass description through when used", async () => {
    const treeDataProvider: TreeDataProvider = [{ label: PropertyRecord.fromString("Raw Node 1"), id: "1", description: "node 1 child" }];
    const columns = [
      { key: "icon", label: "", icon: true },
      { key: "label", label: "Name" },
      { key: "description", label: "Description" },
    ];
    const table = BreadcrumbTreeUtils.aliasNodeListToTableDataProvider(treeDataProvider, columns, treeDataProvider);

    const row = await table.getRow(0);

    const description = await getColFromRowByKey(row, "description");
    expect(description).to.exist;
    expect((description!.record!.value as any).value).to.equal("node 1 child");
  });

  it("should add children to extendedData", async () => {
    const treeDataProvider: TreeDataProvider = [
      {
        label: PropertyRecord.fromString("Raw Node 1"), id: "1", description: "node 1 child",
        children: [
          { label: PropertyRecord.fromString("Raw Node 1.1"), id: "1.1", parentId: "1", description: "node 1.1 child" },
        ] as ImmediatelyLoadedTreeNodeItem[],
      },
    ];
    const columns = [
      { key: "icon", label: "", icon: true },
      { key: "label", label: "Name" },
      { key: "description", label: "Description" },
    ];

    const table = BreadcrumbTreeUtils.aliasNodeListToTableDataProvider(treeDataProvider, columns, treeDataProvider);

    const row = await table.getRow(0);
    expect(row.extendedData!.children.length).to.equal(1);
  });

  it("should add hasChildren to extendedData for Interface TreeDataProvider", async () => {
    const rootNodes = await mockInterfaceTreeDataProvider.getNodes();
    const columns = [
      { key: "icon", label: "", icon: true },
      { key: "label", label: "Name" },
      { key: "description", label: "Description" },
    ];

    const table = BreadcrumbTreeUtils.aliasNodeListToTableDataProvider(rootNodes, columns, mockInterfaceTreeDataProvider);

    const row = await table.getRow(1);
    expect(row.extendedData!.hasChildren).to.be.true;
  });

  it("should count rows with getRowsCount", async () => {
    const treeDataProvider: TreeDataProvider = [{ label: PropertyRecord.fromString("Raw Node 1"), id: "1", description: "node 1 child" }];
    const columns = [
      { key: "icon", label: "", icon: true },
      { key: "label", label: "Name" },
      { key: "description", label: "Description" },
    ];

    const table = BreadcrumbTreeUtils.aliasNodeListToTableDataProvider(treeDataProvider, columns, treeDataProvider);
    expect(await table.getRowsCount()).to.equal(treeDataProvider.length);
  });

  it("should pass columns through to getColumns", async () => {
    const treeDataProvider: TreeDataProvider = [{ label: PropertyRecord.fromString("Raw Node 1"), id: "1", description: "node 1 child" }];
    const columns = [
      { key: "icon", label: "", icon: true },
      { key: "label", label: "Name" },
      { key: "description", label: "Description" },
    ];

    const table = BreadcrumbTreeUtils.aliasNodeListToTableDataProvider(treeDataProvider, columns, treeDataProvider);
    expect(await table.getColumns()).to.equal(columns);
  });

  it("should send blank row when getRow gets a rowIndex out of range", async () => {
    const treeDataProvider: TreeDataProvider = [{ label: PropertyRecord.fromString("Raw Node 1"), id: "1", description: "node 1 child" }];
    const columns = [
      { key: "icon", label: "", icon: true },
      { key: "label", label: "Name" },
      { key: "description", label: "Description" },
    ];

    const table = BreadcrumbTreeUtils.aliasNodeListToTableDataProvider(treeDataProvider, columns, treeDataProvider);
    const invalidRowLt = await table.getRow(-2);
    expect(invalidRowLt.key).to.equal("");

    const invalidRowGt = await table.getRow(2);
    expect(invalidRowGt.key).to.equal("");
  });

  describe("extendedData", async () => {
    const columns = [{ key: "icon", label: "", icon: true }, { key: "label", label: "Name" }, { key: "description", label: "Description" }];
    const treeDataProvider: TreeDataProvider = [
      {
        id: "1", icon: "icon-placeholder", label: PropertyRecord.fromString("Raw Node 1"), description: "node 1 child",
        extendedData: {
          testProp: new PropertyRecord(
            { value: "test prop", valueFormat: PropertyValueFormat.Primitive, displayValue: "test prop" },
            { name: "test", displayLabel: "Test", typename: "text" }),
          testStr: "TEST",
          testBool: false,
          testNum: 0,
        },
        style: {
          colorOverrides: { color: 0xfffff },
        },
      },
    ];
    it("should transfer PropertyRecord through, and add as a cell", async () => {
      const table = BreadcrumbTreeUtils.aliasNodeListToTableDataProvider(treeDataProvider, columns, treeDataProvider);

      const row = await table.getRow(0);
      const testProp = await getColFromRowByKey(row, "testProp");
      expect(testProp).to.exist;
      expect((testProp!.record!.value as any).value).to.equal("test prop");
      expect(row.extendedData!.testProp.value.value).to.equal("test prop");
    });
    it("should transfer string through, and add as a text cell", async () => {
      const table = BreadcrumbTreeUtils.aliasNodeListToTableDataProvider(treeDataProvider, columns, treeDataProvider);

      const row = await table.getRow(0);
      const testStr = await getColFromRowByKey(row, "testStr");
      expect(testStr).to.exist;
      expect((testStr!.record!.value as any).value).to.equal("TEST");
      expect(row.extendedData!.testStr).to.equal("TEST");
    });
    it("should transfer boolean through, and add as a text cell", async () => {
      const table = BreadcrumbTreeUtils.aliasNodeListToTableDataProvider(treeDataProvider, columns, treeDataProvider);

      const row = await table.getRow(0);
      const testBool = await getColFromRowByKey(row, "testBool");
      expect(testBool).to.exist;
      expect((testBool!.record!.value as any).value).to.equal("false");
      expect(row.extendedData!.testBool).to.equal(false);
    });
    it("should transfer number through, and add as a text cell", async () => {
      const table = BreadcrumbTreeUtils.aliasNodeListToTableDataProvider(treeDataProvider, columns, treeDataProvider);

      const row = await table.getRow(0);
      const testNum = await getColFromRowByKey(row, "testNum");
      expect(testNum).to.exist;
      expect((testNum!.record!.value as any).value).to.equal("0");
      expect(row.extendedData!.testNum).to.equal(0);
    });
  });
});
