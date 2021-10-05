/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
import { PropertyDescription, PropertyRecord, PropertyValue, PropertyValueFormat } from "@itwin/appui-abstract";
import { ColumnDescription, MutableTableDataProvider, RowItem, TableDataChangeEvent, TableDataProvider } from "@itwin/components-react";
import { SortDirection } from "@itwin/core-react";

const tableData: DemoMutableRow[] = [
  { id: "251125811780946", label: "Row 0", type: "row", description: "row 0 of mutable table", icon: "icon-placeholder" },
  { id: "687149942193408", label: "Row 1", type: "row", description: "row 1 of mutable table", icon: "icon-placeholder" },
  { id: "509787447498765", label: "Row 2", type: "row", description: "row 2 of mutable table", icon: "icon-placeholder" },
  { id: "961477382291915", label: "Row 3", type: "row", description: "row 3 of mutable table", icon: "icon-placeholder" },
  { id: "439325449223605", label: "Row 4", type: "row", description: "row 4 of mutable table", icon: "icon-placeholder" },
  { id: "210479889083739", label: "Row 5", type: "row", description: "row 5 of mutable table", icon: "icon-placeholder" },
  { id: "886768039684260", label: "Row 6", type: "row", description: "row 6 of mutable table", icon: "icon-placeholder" },
  { id: "249561029097088", label: "Row 7", type: "row", description: "row 7 of mutable table", icon: "icon-placeholder" },
  { id: "406061527213589", label: "Row 8", type: "row", description: "row 8 of mutable table", icon: "icon-placeholder" },
  { id: "036997900215046", label: "Row 9", type: "row", description: "row 9 of mutable table", icon: "icon-placeholder" },
  { id: "664700749515027", label: "Row 10", type: "row", description: "row 10 of mutable table", icon: "icon-placeholder" },
  { id: "336488208582203", label: "Row 11", type: "row", description: "row 11 of mutable table", icon: "icon-placeholder" },
  { id: "228583045451494", label: "Row 12", type: "row", description: "row 12 of mutable table", icon: "icon-placeholder" },
  { id: "279668137771930", label: "Row 13", type: "row", description: "row 13 of mutable table", icon: "icon-placeholder" },
  { id: "629001192536671", label: "Row 14", type: "row", description: "row 14 of mutable table", icon: "icon-placeholder" },
  { id: "923712658794860", label: "Row 15", type: "row", description: "row 15 of mutable table", icon: "icon-placeholder" },
  { id: "945656428150432", label: "Row 16", type: "row", description: "row 16 of mutable table", icon: "icon-placeholder" },
  { id: "683336990575872", label: "Row 17", type: "row", description: "row 17 of mutable table", icon: "icon-placeholder" },
  { id: "382219622980922", label: "Row 18", type: "row", description: "row 18 of mutable table", icon: "icon-placeholder" },
  { id: "723607060383624", label: "Row 19", type: "row", description: "row 19 of mutable table", icon: "icon-placeholder" },
];

const columns: ColumnDescription[] = [
  { key: "icon", label: "", icon: true },
  { key: "label", label: "label" },
  { key: "type", label: "type" },
  { key: "description", label: "description" },
];

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
  icon?: string;
}
function mutableRowToRowItem(row: DemoMutableRow, dataProvider: TableDataProvider): RowItem {
  const { id, label, type, icon, description } = row;
  return {
    key: id,
    extendedData: {
      id, label, type, description, icon, dataProvider, parentId: dataProvider,
    },
    cells: [
      { key: "icon", record: createPropertyRecord(icon ? icon : "", columns[0]) },
      { key: "label", record: createPropertyRecord(label, columns[1]) },
      { key: "type", record: createPropertyRecord(type, columns[2]) },
      { key: "description", record: createPropertyRecord(description, columns[3]) },
    ],
  };
}

function rowItemToMutableRow(rowItem: RowItem): DemoMutableRow {
  let label = "", type = "", description = "", icon = "";
  if (rowItem.extendedData) {
    label = rowItem.extendedData.label;
    type = rowItem.extendedData.type;
    description = rowItem.extendedData.description;
    icon = rowItem.extendedData.icon;
  }
  return { id: rowItem.key, label, type, description, icon };
}

function getCellContentByKey(row: DemoMutableRow, key: string) {
  const mapRow = (row as any) as { [k: string]: string };
  if (key in mapRow)
    return mapRow[key];
  return "";
}

export class DemoMutableTableDataProvider implements MutableTableDataProvider {
  public onColumnsChanged = new TableDataChangeEvent();
  public onRowsChanged = new TableDataChangeEvent();

  private _data: DemoMutableRow[];
  constructor(data: DemoMutableRow[]) {
    this._data = data;
  }

  public getColumns = async (): Promise<ColumnDescription[]> => {
    return columns;
  };
  public getRowsCount = async (): Promise<number> => {
    return this._data.length;
  };
  public getRow = async (rowIndex: number, unfiltered?: boolean): Promise<RowItem> => {
    if (rowIndex > this._data.length || this._data[rowIndex] === undefined) return { key: "", cells: [] };
    if (unfiltered && !unfiltered) // suppress warning, unfiltered unused
      return { key: "", cells: [] };
    return mutableRowToRowItem(this._data[rowIndex], this);
  };
  public sort = async (columnIndex: number, sortDirection: SortDirection): Promise<void> => {
    if (columnIndex && sortDirection) return;
    this._data.sort((row1: DemoMutableRow, row2: DemoMutableRow) => {
      const cell1 = getCellContentByKey(row1, columns[columnIndex].key);
      const cell2 = getCellContentByKey(row2, columns[columnIndex].key);
      if (cell1 < cell2)
        return -1;
      if (cell1 > cell2)
        return 1;
      return 0;
    });
    this.onRowsChanged.raiseEvent();
  };

  // Mutable methods
  public addRow = (rowItem: RowItem): number => {
    this._data.push(rowItemToMutableRow(rowItem));
    this.onRowsChanged.raiseEvent();
    return this._data.length - 1;
  };
  public insertRow = (rowItem: RowItem, index: number): number => {
    this._data.splice(index, 0, rowItemToMutableRow(rowItem));
    this.onRowsChanged.raiseEvent();
    return index;
  };
  public deleteRow = (rowItem: RowItem): void => {
    // eslint-disable-next-line @typescript-eslint/prefer-for-of
    for (let i = 0; i < this._data.length; i++) {
      if (this._data[i].id === rowItem.key) {
        this._data.splice(i, 1);
        this.onRowsChanged.raiseEvent();
        return;
      }
    }
  };
  public moveRow = (rowItem: RowItem, newIndex: number): number => {
    // eslint-disable-next-line @typescript-eslint/prefer-for-of
    for (let i = 0; i < this._data.length; i++) {
      const row = this._data[i];
      if (row.id === rowItem.key) {
        this._data.splice(newIndex, 0, row);
        if (newIndex < i) i++;
        this._data.splice(i, 1);
        this.onRowsChanged.raiseEvent();
        return newIndex;
      }
    }
    return -1;
  };
}

export const demoMutableTableDataProvider = new DemoMutableTableDataProvider(tableData);
