/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
/** @packageDocumentation
 * @module Table
 */

// Matches how react-data-grid is exported
// https://github.com/Microsoft/TypeScript-Handbook/blob/master/pages/Modules.md#export--and-import--require
import ReactDataGrid = require("react-data-grid");

import { DistinctValueCollection, FilterableColumn, FilterableTable } from "../columnfiltering/ColumnFiltering";
import { FilterableColumnBase } from "../columnfiltering/FilterableColumnBase";
import { ColumnDescription, TableDataProvider } from "../TableDataProvider";

// cSpell:ignore columnfiltering

/** ReactDataGrid.Column with additional properties
 * @public
 */
export interface ReactDataGridColumn extends ReactDataGrid.Column<any> {
  /** Indicates whether the display value for the cell is treated as an icon spec. */
  icon?: boolean;
  /* Table column filtering info */
  filterableColumn?: FilterableColumn;
}

/** Table Column used by the [[Table]] component
 *  @internal
 */
export class TableColumn extends FilterableColumnBase {

  constructor(filterableTable: FilterableTable, columnDescription: ColumnDescription, public readonly reactDataGridColumn: ReactDataGridColumn) {
    super(filterableTable, columnDescription);
  }

  public get key(): string { return this.filterMemberKey; }

  public dataProvider?: TableDataProvider;

  public distinctValueCollection?: DistinctValueCollection;

  /** Gets the distinct values for a column.
   * @return The distinct values.
   */
  public async getDistinctValues(maximumValueCount?: number): Promise<DistinctValueCollection> {
    if (this.dataProvider && this.dataProvider.getDistinctValues)
      return this.dataProvider.getDistinctValues(this.key, maximumValueCount);
    return new DistinctValueCollection();
  }
}
