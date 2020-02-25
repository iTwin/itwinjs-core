/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
/** @packageDocumentation
 * @module Table
 */

import { BeEvent } from "@bentley/bentleyjs-core";
import { PropertyRecord, PropertyDescription, Primitives } from "@bentley/ui-abstract";
import { SortDirection } from "@bentley/ui-core";
import { ItemColorOverrides, ItemStyle } from "../properties/ItemStyle";
import { DistinctValueCollection, CompositeFilterDescriptorCollection } from "./columnfiltering/ColumnFiltering";

/** Type for Horizontal Alignment
 * @public
 */
export type HorizontalAlignment = "left" | "center" | "right" | "justify";

/** Filter Renderer for a Table column
 * @beta
 */
export enum FilterRenderer {
  Numeric = 1,
  MultiSelect,
  SingleSelect,
  Text,
}

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
  icon?: boolean;                       /* Defaults to false */

  sortable?: boolean;                   /* Defaults to false */
  secondarySortColumn?: number;
  sortIgnoreCase?: boolean;             /* Defaults to false */

  filterable?: boolean;                 /* Defaults to false */
  /** @beta */
  filterRenderer?: FilterRenderer;

  // Not implemented yet
  alignment?: HorizontalAlignment;
  titleAlignment?: HorizontalAlignment;
  groupable?: boolean;                   /* Defaults to false */
  showFieldFilters?: boolean;            /* Defaults to true */
  showDistinctValueFilters?: boolean;    /* Defaults to true */
  filterCaseSensitive?: boolean;         /* Defaults to false */
  editorAlwaysOn?: boolean;              /* Defaults to false */
  pressSelectsRow?: boolean;             /* Defaults to true */
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

  /** Get the value from the cell for filtering purposes */
  getValueFromCell?: (columnKey: string) => any;
}

/** An interface table data change listeners
 * @public
 */
export declare type TableDataChangesListener = () => void;

/** An event broadcasted on table data changes
 * @public
 */
export class TableDataChangeEvent extends BeEvent<TableDataChangesListener> { }

/** Table Distinct Value for Table filtering purposes
 * @beta
 */
export interface TableDistinctValue {
  value: Primitives.Value;
  label: string;
}

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

  // Column Filtering methods

  /** Apply a filter descriptor collection
   * @beta
   */
  applyFilterDescriptors?: (filterDescriptors: CompositeFilterDescriptorCollection) => Promise<void>;

  /** Gets distinct values in a column
   * @beta
   */
  getDistinctValues?: (columnKey: string, maximumValueCount?: number) => Promise<DistinctValueCollection>;

  /** Gets property display value expression
   * @alpha
   */
  getPropertyDisplayValueExpression?: (property: string) => string;

  // Column Grouping methods

  // IsGrouped: boolean;
  // GetGroupCount(): Promise<number>;
  // GetRootGroups(): Promise<Array<IGroup>>;
  // ApplyGroupDescriptor(groupDescriptor: IGroupDescriptor): void;
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
