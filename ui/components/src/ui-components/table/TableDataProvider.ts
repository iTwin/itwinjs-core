/*---------------------------------------------------------------------------------------------
* Copyright (c) 2019 Bentley Systems, Incorporated. All rights reserved.
* Licensed under the MIT License. See LICENSE.md in the project root for license terms.
*--------------------------------------------------------------------------------------------*/
/** @module Table */

import { BeEvent } from "@bentley/bentleyjs-core";
import { PropertyRecord, PropertyDescription } from "@bentley/imodeljs-frontend";
import { SortDirection } from "@bentley/ui-core";
import { ItemColorOverrides, ItemStyle } from "../properties/ItemStyle";

/** Type for Horizontal Alignment
 * @public
 */
export type HorizontalAlignment = "left" | "center" | "right" | "justify";

/**
 * Column definition provided to Table.
 * @public
 */
export interface ColumnDescription {
  key: string;

  label: string;
  propertyDescription?: PropertyDescription;

  width?: number;

  editable?: boolean;                   /* Defaults to false */
  resizable?: boolean;                  /* Defaults to false */
  sortable?: boolean;                   /* Defaults to false */
  secondarySortColumn?: number;
  sortIgnoreCase?: boolean;             /* Defaults to false */

  alignment?: HorizontalAlignment;
  titleAlignment?: HorizontalAlignment;
  filterable?: boolean;                  /* Defaults to false */
  groupable?: boolean;                   /* Defaults to false */
  showFieldFilters?: boolean;            /* Defaults to true */
  showDistinctValueFilters?: boolean;    /* Defaults to true */
  filterCaseSensitive?: boolean;         /* Defaults to false */
  editorAlwaysOn?: boolean;              /* Defaults to false */
  pressSelectsRow?: boolean;             /* Defaults to true */
  icon?: boolean;                        /* Defaults to false */
}

/**
 * Cell definition provided to Table.
 * @public
 */
export interface CellItem {
  key: string;
  record?: PropertyRecord;

  isDisabled?: boolean;
  alignment?: HorizontalAlignment;

  style?: ItemStyle;
}

/**
 * Row definition provided to Table.
 * @public
 */
export interface RowItem {
  /**
   * **Must be unique.**
   */
  key: string;
  cells: CellItem[];
  isDisabled?: boolean;
  colorOverrides?: ItemColorOverrides;
  /**
   * A key-value pairs data structure that can be used by data provider
   * to store some custom data for this node item.
   */
  extendedData?: { [key: string]: any };
}

/** An interface table data change listeners
 * @public
 */
export declare type TableDataChangesListener = () => void;

/** An event broadcasted on table data changes
 * @public
 */
export class TableDataChangeEvent extends BeEvent<TableDataChangesListener> { }

/**
 * TableDataProvider provides data to the Table.
 * It also provides support for data Sorting & Filtering.
 * @public
 */
export interface TableDataProvider {
  onColumnsChanged: TableDataChangeEvent;
  onRowsChanged: TableDataChangeEvent;

  getColumns(): Promise<ColumnDescription[]>;
  getRowsCount(): Promise<number>;
  getRow(rowIndex: number, unfiltered?: boolean): Promise<RowItem>;
  sort(columnIndex: number, sortDirection: SortDirection): Promise<void>;

  // IsGrouped: boolean;
  // GetGroupCount(): Promise<number>;
  // GetRootGroups(): Promise<Array<IGroup>>;
  // ApplyGroupDescriptor(groupDescriptor: IGroupDescriptor): void;

  // ApplyFilter(filterText: string, caseSensitive: boolean): void;
  // ApplyFilterDescriptors(filterDescriptors: ICompositeFilterDescriptorCollection): void;
  // GetDistinctValues(columnIndex: number, maximumValueCount?: number): Promise<DistinctValueCollection>;
}

/**
 * MutableTableDataProvider provides mutation methods for data in the Table.
 * Useful for Drag & Drop processing.
 * @beta
 */
export interface MutableTableDataProvider extends TableDataProvider {
  addRow(rowItem: RowItem): number;
  insertRow(rowItem: RowItem, index: number): number;
  deleteRow(rowItem: RowItem): void;
  moveRow(rowItem: RowItem, newIndex: number): number;
}
