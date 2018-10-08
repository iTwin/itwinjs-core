/*---------------------------------------------------------------------------------------------
* Copyright (c) 2018 Bentley Systems, Incorporated. All rights reserved.
* Licensed under the MIT License. See LICENSE.md in the project root for license terms.
*--------------------------------------------------------------------------------------------*/
import { SortDirection } from "@bentley/ui-core";
import {
  TableDataProvider, MutableTableDataProvider,
  RowItem, TableDataChangeEvent, ColumnDescription,
  DropTargetArguments, DragSourceArguments, DropStatus, DropEffects, PropertyValue, PropertyDescription, PropertyRecord, PropertyValueFormat,
} from "@bentley/ui-components";

const data: DemoMutableRow[] = [
  { id: "251125811780946", label: "Row 0", type: "row", description: "row 0 of mutable table", iconPath: "icon-floor" },
  { id: "687149942193408", label: "Row 1", type: "row", description: "row 1 of mutable table", iconPath: "icon-pin" },
  { id: "509787447498765", label: "Row 2", type: "row", description: "row 2 of mutable table", iconPath: "icon-tag" },
  { id: "961477382291915", label: "Row 3", type: "row", description: "row 3 of mutable table", iconPath: "icon-trim" },
  { id: "439325449223605", label: "Row 4", type: "row", description: "row 4 of mutable table", iconPath: "icon-project" },
  { id: "210479889083739", label: "Row 5", type: "row", description: "row 5 of mutable table", iconPath: "icon-ifc" },
  { id: "886768039684260", label: "Row 6", type: "row", description: "row 6 of mutable table", iconPath: "icon-tools" },
  { id: "249561029097088", label: "Row 7", type: "row", description: "row 7 of mutable table", iconPath: "icon-ramp" },
  { id: "406061527213589", label: "Row 8", type: "row", description: "row 8 of mutable table", iconPath: "icon-arc" },
  { id: "036997900215046", label: "Row 9", type: "row", description: "row 9 of mutable table", iconPath: "icon-snaps" },
  { id: "664700749515027", label: "Row 10", type: "row", description: "row 10 of mutable table", iconPath: "icon-unlink" },
  { id: "336488208582203", label: "Row 11", type: "row", description: "row 11 of mutable table", iconPath: "icon-weight" },
  { id: "228583045451494", label: "Row 12", type: "row", description: "row 12 of mutable table", iconPath: "icon-circle" },
  { id: "279668137771930", label: "Row 13", type: "row", description: "row 13 of mutable table", iconPath: "icon-spaces" },
  { id: "629001192536671", label: "Row 14", type: "row", description: "row 14 of mutable table", iconPath: "icon-users" },
  { id: "923712658794860", label: "Row 15", type: "row", description: "row 15 of mutable table", iconPath: "icon-culvert" },
  { id: "945656428150432", label: "Row 16", type: "row", description: "row 16 of mutable table", iconPath: "icon-rail" },
  { id: "683336990575872", label: "Row 17", type: "row", description: "row 17 of mutable table", iconPath: "icon-attach" },
  { id: "382219622980922", label: "Row 18", type: "row", description: "row 18 of mutable table", iconPath: "icon-function" },
  { id: "723607060383624", label: "Row 19", type: "row", description: "row 19 of mutable table", iconPath: "icon-upgrade" },
];

const columns: ColumnDescription[] = [
  { key: "icon", label: "", icon: true },
  { key: "label", label: "label" },
  { key: "type", label: "type" },
  { key: "description", label: "description" },
];

const tableColumnDataChange = new TableDataChangeEvent();
const tableRowDataChange = new TableDataChangeEvent();

const createPropertyRecord = (value: string, column: ColumnDescription) => {
  const v: PropertyValue = {
    valueFormat: PropertyValueFormat.Primitive,
    value,
    displayValue: value,
  };
  const pd: PropertyDescription = {
    typename: column.icon ? "icon" : "text",
    name: column.key,
    displayLabel: column.label,
  };
  return new PropertyRecord(v, pd);
};

interface DemoMutableRow {
  id: string;
  label: string;
  type: string;
  description: string;
  iconPath?: string;
}
function mutableRowToRowItem(row: DemoMutableRow): RowItem {
  const { id, label, type, iconPath, description } = row;
  return {
    key: id,
    extendedData: {
      label, type, description, iconPath,
    },
    cells: [
      { key: "icon", record: createPropertyRecord(iconPath ? iconPath : "", columns[0]) },
      { key: "label", record: createPropertyRecord(label, columns[1]) },
      { key: "type", record: createPropertyRecord(type, columns[2]) },
      { key: "description", record: createPropertyRecord(description, columns[3]) },
    ],
  };
}

function rowItemToMutableRow(rowItem: RowItem): DemoMutableRow {
  let label = "", type = "", description = "", iconPath = "";
  if (rowItem.extendedData) {
    label = rowItem.extendedData.label;
    type = rowItem.extendedData.type;
    description = rowItem.extendedData.description;
    iconPath = rowItem.extendedData.iconPath;
  }
  return { id: rowItem.key, label, type, description, iconPath };
}

function getCellContentByKey(row: DemoMutableRow, key: string) {
  const mapRow = (row as any) as { [k: string]: string };
  if (key in mapRow)
    return mapRow[key];
  return "";
}

export const demoMutableTableDataProvider: TableDataProvider & MutableTableDataProvider = {
  onColumnsChanged: tableColumnDataChange,
  onRowsChanged: tableRowDataChange,

  getColumns: async (): Promise<ColumnDescription[]> => {
    return columns;
  },
  getRowsCount: async (): Promise<number> => {
    return data.length;
  },
  getRow: async (rowIndex: number, unfiltered?: boolean): Promise<RowItem> => {
    if (rowIndex > data.length || data[rowIndex] === undefined) return { key: "", cells: [] };
    if (unfiltered && !unfiltered) // surpress warning, unfiltered unused
      return { key: "", cells: [] };
    return mutableRowToRowItem(data[rowIndex]);
  },
  sort: async (columnIndex: number, sortDirection: SortDirection): Promise<void> => {
    if (columnIndex && sortDirection) return;
    data.sort((row1: DemoMutableRow, row2: DemoMutableRow) => {
      const cell1 = getCellContentByKey(row1, columns[columnIndex].key);
      const cell2 = getCellContentByKey(row2, columns[columnIndex].key);
      if (cell1 < cell2)
        return -1;
      if (cell1 > cell2)
        return 1;
      return 0;
    });
    tableRowDataChange.raiseEvent();
  },

  // Mutable methods
  addRow: (rowItem: RowItem): number => {
    data.push(rowItemToMutableRow(rowItem));
    tableRowDataChange.raiseEvent();
    return data.length - 1;
  },
  insertRow: (rowItem: RowItem, index: number): number => {
    data.splice(index, 0, rowItemToMutableRow(rowItem));
    tableRowDataChange.raiseEvent();
    return index;
  },
  deleteRow: (rowItem: RowItem): void => {
    // tslint:disable-next-line:prefer-for-of
    for (let i = 0; i < data.length; i++) {
      if (data[i].id === rowItem.key) {
        data.splice(i, 1);
        tableRowDataChange.raiseEvent();
        return;
      }
    }
  },
  moveRow: (rowItem: RowItem, newIndex: number): number => {
    // tslint:disable-next-line:prefer-for-of
    for (let i = 0; i < data.length; i++) {
      const row = data[i];
      if (row.id === rowItem.key) {
        data.splice(newIndex, 0, row);
        if (newIndex < i) i++;
        data.splice(i, 1);
        tableRowDataChange.raiseEvent();
        return newIndex;
      }
    }
    return -1;
  },
};
export const tableDropTargetDropCallback = (args: DropTargetArguments) => {
  if (args.dataObject && "type" in args.dataObject && "label" in args.dataObject && "description" in args.dataObject) {
    const { type, label, description, parentId, children, iconPath, ...rest } = args.dataObject;
    let id = "";
    if (args.dropEffect === DropEffects.Copy) {
      id = Math.round(Math.random() * 1e14) + "";
    } else if ((args.dropEffect === DropEffects.Move || args.dropEffect === DropEffects.Link) &&
      "id" in args.dataObject && args.dataObject.id !== undefined) {
      id = args.dataObject.id;
    }

    const dragRow: RowItem = {
      key: id,
      extendedData: {
        label, type, description, iconPath, ...rest,
      },
      cells: [
        { key: "label", record: label },
        { key: "type", record: type },
        { key: "description", record: description },
      ],
    };
    // if object has children, ie. is a non-leaf node of a tree, don't allow drop.
    if (children !== undefined && children.length > 0) {
      args.dropStatus = DropStatus.None;
      return args;
    }
    const treeId = args.dropLocation;
    if (args.row !== undefined) {
      if (parentId === treeId && args.dropEffect === DropEffects.Move) {
        demoMutableTableDataProvider.moveRow(dragRow, args.row);
        args.dropStatus = DropStatus.Drop;
        args.local = true;
      } else {
        demoMutableTableDataProvider.insertRow(dragRow, args.row);
        args.dropStatus = DropStatus.Drop;
      }
    } else if (parentId !== treeId) {
      demoMutableTableDataProvider.addRow(dragRow);
      args.dropStatus = DropStatus.Drop;
    }
  }
  return args;
};
export const tableDragSourceEndCallback = (args: DragSourceArguments) => {
  if (args.dataObject && "id" in args.dataObject && args.dataObject.id && args.dropStatus === DropStatus.Drop && args.dropEffect === DropEffects.Move && !args.local) {
    demoMutableTableDataProvider.deleteRow({ key: args.dataObject.id, cells: [] });
  }
};
export const tableCanDropTargetDropCallback = (args: DropTargetArguments) => {
  if (args.dataObject && "type" in args.dataObject && "label" in args.dataObject && "description" in args.dataObject) {
    const { parentId, children } = args.dataObject;
    // if object has children, ie. is a non-leaf node of a tree, don't allow drop.
    if (children !== undefined && children.length > 0) {
      return false;
    }
    const treeId = args.dropLocation;
    if (args.row !== undefined || parentId !== treeId) {
      return true;
    }
  }
  return false;
};
