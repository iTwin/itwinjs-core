/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
/** @packageDocumentation
 * @module Table
 */

import { RowItem } from "../TableDataProvider";
import {
  ColumnFilterDescriptor, CompositeFilterDescriptorCollection, FilterCompositionLogicalOperator, FilterDescriptorCollection,
} from "./ColumnFiltering";

/** Represents collection of FilterDescriptor objects composed together by a logical operator.
 * @internal
 */
export class TableFilterDescriptorCollection extends FilterDescriptorCollection implements CompositeFilterDescriptorCollection {
  private _logicalOperator = FilterCompositionLogicalOperator.And;

  public constructor() {
    super();
  }

  /** Gets/Sets the logical operator. */
  public get logicalOperator(): FilterCompositionLogicalOperator {
    return this._logicalOperator;
  }

  public set logicalOperator(value: FilterCompositionLogicalOperator) {
    if (this._logicalOperator !== value) {
      this._logicalOperator = value;
    }
  }

  /** Gets filter descriptors that will be used for composition.
   */
  public get filterDescriptorCollection(): FilterDescriptorCollection {
    return this;
  }

  /** Evaluates a row for filtering
   */
  public evaluateRow(row: RowItem): boolean {
    let passed: boolean = true;

    for (const fd of this.filterDescriptorCollection.descriptors) {
      if (!fd.isActive)
        continue;

      passed = fd.evaluateRow(row);

      if (passed && FilterCompositionLogicalOperator.Or === this.logicalOperator)
        return true;
      else if (!passed && FilterCompositionLogicalOperator.And === this.logicalOperator)
        return false;
    }

    return passed;
  }

  /** Determines if a filter is active for a particular column
   */
  public isColumnFilterActive(columnKey: string): boolean {
    const columnFilterDescriptor = this.getColumnFilterDescriptor(columnKey);
    return columnFilterDescriptor ? true : false;
  }

  /** Gets the filter for a particular column
   */
  public getColumnFilterDescriptor(columnKey: string): ColumnFilterDescriptor | undefined {
    for (const fd of this.filterDescriptorCollection.descriptors) {
      if (!fd.isActive)
        continue;

      if (fd.isFilterForColumn(columnKey))
        return fd as any as ColumnFilterDescriptor;
    }

    return undefined;
  }

  public getFilterExpression(): string {
    let result: string = "";
    for (let i = 0; i < this.filterDescriptorCollection.descriptors.length; i++) {
      if (!this.filterDescriptorCollection.descriptors[i].isActive)
        continue;

      if (i > 0 && result !== "") {
        switch (this.logicalOperator) {
          case FilterCompositionLogicalOperator.And:
            result += (" And ");
            break;
          case FilterCompositionLogicalOperator.Or:
            result += (" Or ");
            break;
        }
      }
      result += (`(${this.filterDescriptorCollection.descriptors[i].getFilterExpression()})`);
    }
    return result;
  }
}
