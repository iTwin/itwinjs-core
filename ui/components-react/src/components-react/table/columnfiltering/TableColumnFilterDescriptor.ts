/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
/** @packageDocumentation
 * @module Table
 */

import type { RowItem } from "../TableDataProvider";
import type {
  ColumnFilterDescriptor, CompositeFilterDescriptor, DistinctValuesFilterDescriptor, FieldFilterDescriptor, FilterableColumn, OperatorValueFilterDescriptor,
  OperatorValueFilterDescriptorCollection} from "./ColumnFiltering";
import { DistinctValueCollection,
  FilterCompositionLogicalOperator, FilterDescriptorCollection, FilterOperator,
} from "./ColumnFiltering";

/** A ColumnFilterDescriptor for TableColumn.
 * @internal
 */
export class TableColumnFilterDescriptor implements ColumnFilterDescriptor {
  private _column: FilterableColumn;
  private _compositeFilter: CompositeFilterDescriptorImpl;
  private _distinctFilter: DistinctValuesFilterDescriptorImpl;
  private _fieldFilter: FieldFilterDescriptor;
  private _memberKey: string;
  private _memberType: string;

  /** Initializes a new instance of the ColumnFilterDescriptor class.
   * @param  column      The column.
   * @param  memberKey   The member (key).
   * @param  memberType  The member type.
   */
  public constructor(column: FilterableColumn, memberKey: string, memberType: string) {
    this._column = column;
    this._memberKey = memberKey;
    this._memberType = memberType;

    this._distinctFilter = new DistinctValuesFilterDescriptorImpl(column);
    this._fieldFilter = new FieldFilterDescriptorImpl(column);

    this._compositeFilter = new CompositeFilterDescriptorImpl();
    this._compositeFilter.logicalOperator = FilterCompositionLogicalOperator.And;
    this._compositeFilter.filterDescriptorCollection.add(this._distinctFilter);
    this._compositeFilter.filterDescriptorCollection.add(this._fieldFilter);
  }

  /** Gets the distinct values filter descriptor.
   */
  public get distinctFilter(): DistinctValuesFilterDescriptor {
    return this._distinctFilter;
  }

  /** Gets the field filter descriptor.
   */
  public get fieldFilter(): FieldFilterDescriptor {
    return this._fieldFilter;
  }

  /** Determines if the filter descriptor is active.
   */
  public get isActive(): boolean {
    return this._compositeFilter.isActive;
  }

  /** Gets the column.
   */
  public get column(): FilterableColumn {
    return this._column;
  }

  /** Clears the filter descriptor.
   */
  public clear(): void {
    this._distinctFilter.clear();
    this._fieldFilter.clear();

    // Do NOT call this._compositeFilter.clear() here. That removes the filters from the composite.
  }

  /** Evaluates a row for filtering
   */
  public evaluateRow(row: RowItem): boolean {
    return this._compositeFilter.evaluateRow(row);
  }

  /** Determines if this filter is for a particular column.
   */
  public isFilterForColumn(columnKey: string): boolean {
    return (this.isActive && this._column.filterMemberKey === columnKey);
  }

  public getFilterExpression(): string {
    return this._compositeFilter.getFilterExpression();
  }

  /** Gets the member (key).
   */
  public get memberKey(): string {
    return this._memberKey;
  }

  /** Sets the member (key).
   */
  public set memberKey(value: string) {
    if (value !== this.memberKey) {
      this._memberKey = value;

      this.distinctFilter.filterDescriptorCollection.descriptors.forEach((fd: OperatorValueFilterDescriptor) => fd.memberKey = value);
      this.fieldFilter.filterDescriptorCollection.descriptors.forEach((fd: OperatorValueFilterDescriptor) => fd.memberKey = value);
    }
  }

  /** Gets the member type.
   */
  public get memberType(): string {
    return this._memberType;
  }

  /** Sets the member type.
   */
  public set memberType(value: string) {
    if (value !== this.memberType) {
      this._memberType = value;

      this.distinctFilter.filterDescriptorCollection.descriptors.forEach((fd: OperatorValueFilterDescriptor) => fd.memberType = value);
      this.fieldFilter.filterDescriptorCollection.descriptors.forEach((fd: OperatorValueFilterDescriptor) => fd.memberType = value);
    }
  }
}

/** Filtering descriptor which serves as a container for one or more child filtering descriptors.
 * @internal
 */
class CompositeFilterDescriptorImpl implements CompositeFilterDescriptor {
  private _filterDescriptors?: FilterDescriptorCollection;
  private _logicalOperator: FilterCompositionLogicalOperator = FilterCompositionLogicalOperator.And;

  /** Gets the logical operator.
   */
  public get logicalOperator(): FilterCompositionLogicalOperator { return this._logicalOperator; }

  /** Sets the logical operator.
   */
  public set logicalOperator(value: FilterCompositionLogicalOperator) {
    if (this._logicalOperator !== value) {
      this._logicalOperator = value;
    }
  }

  /** Gets the filter descriptors that will be used for composition.
   */
  public get filterDescriptorCollection(): FilterDescriptorCollection {
    if (!this._filterDescriptors) {
      this._filterDescriptors = new FilterDescriptorCollection();
    }
    return this._filterDescriptors;
  }

  /** Determines if the filter descriptor is active.
   */
  public get isActive(): boolean {
    let active = false;
    // istanbul ignore else
    if (this._filterDescriptors)
      active = this._filterDescriptors.isActive;
    return active;
  }

  /** Clears the filter descriptor.
   */
  /* istanbul ignore next */
  public clear(): void {
    if (this._filterDescriptors)
      this._filterDescriptors.clear();
  }

  /** Evaluates a row for filtering
   */
  public evaluateRow(row: RowItem): boolean {
    let passed: boolean = true;

    for (const fd of this.filterDescriptorCollection.descriptors) {
      /* istanbul ignore next */
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

  /** Determines if this filter is for a particular column.
   */
  public isFilterForColumn(columnKey: string): boolean {
    for (const fd of this.filterDescriptorCollection.descriptors) {
      /* istanbul ignore next */
      if (!fd.isActive)
        continue;

      if (fd.isFilterForColumn(columnKey))
        return true;
    }

    return false;
  }

  /** Returns filter as ECExpression */
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

/** The default implementation of DistinctValuesFilterDescriptor.
 * @internal
 */
class DistinctValuesFilterDescriptorImpl implements DistinctValuesFilterDescriptor {
  private _column: FilterableColumn;
  private _compositeFilter: CompositeFilterDescriptorImpl;
  private _distinctValuesComparisonOperator: FilterOperator = FilterOperator.IsEqualTo;

  public constructor(column: FilterableColumn) {
    this._column = column;

    this._compositeFilter = new CompositeFilterDescriptorImpl();
    this._compositeFilter.logicalOperator = FilterCompositionLogicalOperator.Or;
  }

  /** Gets the distinct values from the collection as an Array.
   */
  public get distinctValues(): DistinctValueCollection {
    const distinctValues = new DistinctValueCollection();

    for (const fd of this.filterDescriptorCollection.descriptors) {
      distinctValues.values.push(fd.value);
    }

    return distinctValues;
  }

  /** Gets the collection of distinct values.
   */
  public get filterDescriptorCollection(): OperatorValueFilterDescriptorCollection {
    return this._compositeFilter.filterDescriptorCollection as OperatorValueFilterDescriptorCollection;
  }

  /** Determines if the filter descriptor is active.
   */
  public get isActive(): boolean {
    return this.filterDescriptorCollection.descriptors.some((fd: OperatorValueFilterDescriptor) => fd.isActive);
  }

  /** Tries to find a distinct value in the collection.
   */
  public tryFindDescriptor(distinctValue: any): OperatorValueFilterDescriptor | undefined {
    return this.filterDescriptorCollection.descriptors.find((fd: OperatorValueFilterDescriptor) => fd.value === distinctValue);
  }

  /** Adds a distinct value to the collection.
   */
  public addDistinctValue(distinctValue: any): void {
    const existing = this.tryFindDescriptor(distinctValue);

    if (existing) {
      return;
    }

    const newFilterDescriptor = this._column.createSimpleFilterDescriptor(distinctValue, this.distinctValuesComparisonOperator);
    newFilterDescriptor.isCaseSensitive = true;
    this.filterDescriptorCollection.add(newFilterDescriptor);
  }

  /** Removes a distinct value from the collection.
   */
  public removeDistinctValue(distinctValue: any): boolean {
    const existing = this.tryFindDescriptor(distinctValue);

    if (existing) {
      return this.filterDescriptorCollection.remove(existing);
    }

    return false;
  }

  /** Clears the filter descriptor.
   */
  public clear(): void {
    this.filterDescriptorCollection.clear();
  }

  /** Gets the distinct values comparison operator.
   */
  public get distinctValuesComparisonOperator(): FilterOperator { return this._distinctValuesComparisonOperator; }

  /** Sets the distinct values comparison operator.
   */
  public set distinctValuesComparisonOperator(value: FilterOperator) {
    // istanbul ignore else
    if (this._distinctValuesComparisonOperator !== value) {
      this._distinctValuesComparisonOperator = value;
    }
  }

  /** Evaluates a row for filtering
   */
  public evaluateRow(row: RowItem): boolean {
    return this._compositeFilter.evaluateRow(row);
  }

  /** Determines if this filter is for a particular column.
   */
  public isFilterForColumn(columnKey: string): boolean {
    return this._compositeFilter.isFilterForColumn(columnKey);
  }

  public getFilterExpression(): string {
    return this._compositeFilter.getFilterExpression();
  }
}

/** The default implementation of IFieldFilterDescriptor.
 * @internal
 */
class FieldFilterDescriptorImpl implements FieldFilterDescriptor {
  private _column: FilterableColumn;
  private _compositeFilter: CompositeFilterDescriptorImpl;

  public constructor(column: FilterableColumn) {
    this._column = column;

    this._compositeFilter = new CompositeFilterDescriptorImpl();
    this._compositeFilter.logicalOperator = FilterCompositionLogicalOperator.Or;
  }

  /** Gets the logical operator.
   */
  public get logicalOperator(): FilterCompositionLogicalOperator {
    return this._compositeFilter.logicalOperator;
  }

  /** Sets the logical operator.
   */
  public set logicalOperator(value: FilterCompositionLogicalOperator) {
    this._compositeFilter.logicalOperator = value;
  }

  /** Determines if the filter descriptor is active.
   */
  public get isActive(): boolean {
    return this.filterDescriptorCollection.descriptors.some((fd: OperatorValueFilterDescriptor) => fd.isActive);
  }

  /** Gets the collection of distinct values.
   */
  public get filterDescriptorCollection(): OperatorValueFilterDescriptorCollection {
    return this._compositeFilter.filterDescriptorCollection as OperatorValueFilterDescriptorCollection;
  }

  /** Tries to find a field value in the collection.
   */
  public tryFindDescriptor(fieldValue: any, operator: FilterOperator): OperatorValueFilterDescriptor | undefined {
    return this.filterDescriptorCollection.descriptors.find((fd: OperatorValueFilterDescriptor) => {
      return fd.value === fieldValue && fd.operator === operator;
    });
  }

  /** Adds a field value to the collection.
   */
  public addFieldValue(fieldValue: any, operator: FilterOperator, isCaseSensitive: boolean = false): void {
    const existing = this.tryFindDescriptor(fieldValue, operator);

    if (existing) {
      return;
    }

    const newFilterDescriptor = this._column.createSimpleFilterDescriptor(fieldValue, operator);
    newFilterDescriptor.isCaseSensitive = isCaseSensitive;
    this.filterDescriptorCollection.add(newFilterDescriptor);
  }

  /** Removes a distinct value from the collection.
   */
  public removeFieldValue(fieldValue: any, operator: FilterOperator): boolean {
    const existing = this.tryFindDescriptor(fieldValue, operator);

    if (existing) {
      return this.filterDescriptorCollection.remove(existing);
    }

    return false;
  }

  /** Clears the filter descriptor.
   */
  public clear(): void {
    this.logicalOperator = FilterCompositionLogicalOperator.And;

    this.filterDescriptorCollection.clear();
  }

  /** Evaluates a row for filtering
   */
  public evaluateRow(row: RowItem): boolean {
    let result = true;

    for (const fd of this.filterDescriptorCollection.descriptors) {
      /* istanbul ignore next */
      if (!fd.isActive)
        continue;

      result = fd.evaluateRow(row);
      if (result && this.logicalOperator === FilterCompositionLogicalOperator.Or)
        return true;
      else if (!result && this.logicalOperator === FilterCompositionLogicalOperator.And)
        return false;
    }

    return result;
  }

  /** Determines if this filter is for a particular column.
   */
  public isFilterForColumn(columnKey: string): boolean {
    return (this.isActive && this._column.filterMemberKey === columnKey);
  }

  public getFilterExpression(): string {
    return this._compositeFilter.getFilterExpression();
  }
}
