/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
/** @packageDocumentation
 * @module Table
 */

import { ColumnDescription } from "../TableDataProvider";
import { ColumnFilterDescriptor, DistinctValueCollection, FilterableColumn, FilterableTable, FilterOperator } from "./ColumnFiltering";
import { TableColumnFilterDescriptor } from "./TableColumnFilterDescriptor";
import { TableFilterDescriptor } from "./TableFilterDescriptor";

/** Filterable Column base class.
 * @internal
 */
export abstract class FilterableColumnBase implements FilterableColumn {
  private _columnDescription: ColumnDescription;

  private _filterable: boolean = false;
  private _showFieldFilters: boolean;
  private _showDistinctValueFilters: boolean;
  private _filterCaseSensitive: boolean;

  private _filterableTable: FilterableTable;

  constructor(filterableTable: FilterableTable, description: ColumnDescription) {
    this._filterableTable = filterableTable;
    this._columnDescription = description;

    this._filterable = (description.filterable === undefined) ? false : description.filterable;
    this._showFieldFilters = (description.showFieldFilters === undefined) ? true : description.showFieldFilters;
    this._showDistinctValueFilters = (description.showDistinctValueFilters === undefined) ? true : description.showDistinctValueFilters;
    this._filterCaseSensitive = (description.filterCaseSensitive === undefined) ? false : description.filterCaseSensitive;

    if (!this._columnDescription.propertyDescription) {
      this._columnDescription.propertyDescription = {
        name: "",
        displayLabel: "",
        typename: "",
      };
    }
  }

  /** Indicates whether column is filterable.
   */
  public get filterable(): boolean {
    return this._filterable;
  }

  /** Gets the owning filterable Table.
   */
  public get filterableTable(): FilterableTable {
    return this._filterableTable;
  }

  /** Gets the Column Description.
   */
  public get columnDescription(): ColumnDescription {
    return this._columnDescription;
  }

  /** Gets the column filter descriptor.
   * @return A class implementing IColumnFilterDescriptor.
   */
  public get columnFilterDescriptor(): ColumnFilterDescriptor {
    let columnFilterDescriptor = this._filterableTable.filterDescriptors.getColumnFilterDescriptor(this.filterMemberKey);

    if (undefined === columnFilterDescriptor) {
      columnFilterDescriptor = this.createColumnFilterDescriptor();
      this._filterableTable.filterDescriptors.add(columnFilterDescriptor);
    }

    return columnFilterDescriptor;
  }

  /** Creates the column filter descriptor.
   * @return A new class implementing ColumnFilterDescriptor.
   */
  protected createColumnFilterDescriptor(): ColumnFilterDescriptor {
    return new TableColumnFilterDescriptor(this, this.filterMemberKey, this.filterMemberType);
  }

  /** Creates a basic filter descriptor for use .
   * @return A new FilterDescriptor.
   */
  public createSimpleFilterDescriptor(value: any, filterOperator: FilterOperator): TableFilterDescriptor {
    return new TableFilterDescriptor(this._filterableTable, this.filterMemberKey, this.filterMemberType, filterOperator, value, this._filterCaseSensitive);
  }

  /** Gets the filter member key.
   */
  public get filterMemberKey(): string {
    return this._columnDescription.key;
  }

  /** Gets the filter member type.
   */
  public get filterMemberType(): string {
    let memberType = "";
    // istanbul ignore else
    if (this._columnDescription.propertyDescription)
      memberType = this._columnDescription.propertyDescription.typename;
    return memberType;
  }

  /** Determines if a filter is active. */
  public get isFilterActive(): boolean {
    return this._filterableTable.filterDescriptors.isColumnFilterActive(this.filterMemberKey);
  }

  /** Determines if the filter should show distinct values as a filter option */
  public get showDistinctValueFilters(): boolean {
    return this._showDistinctValueFilters;
  }

  /** Determines if the filter should show field filter options */
  public get showFieldFilters(): boolean {
    return this._showFieldFilters;
  }

  /** Determines if the filter is case-sensitive */
  public get filterCaseSensitive(): boolean {
    return this._filterCaseSensitive;
  }

  /** Gets the distinct values for a column.
   * @return The distinct values.
   */
  public abstract getDistinctValues(maximumValueCount: number): Promise<DistinctValueCollection>;

}
