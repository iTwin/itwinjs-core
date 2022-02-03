/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
/** @packageDocumentation
 * @module Table
 */

import { Logger } from "@itwin/core-bentley";
import { StandardTypeNames } from "@itwin/appui-abstract";
import type { StringOperatorProcessor } from "../../converters/StringTypeConverter";
import { BooleanTypeConverter } from "../../converters/BooleanTypeConverter";
import type { LessGreaterOperatorProcessor, NullableOperatorProcessor } from "../../converters/TypeConverter";
import { TypeConverterManager } from "../../converters/TypeConverterManager";
import { UiComponents } from "../../UiComponents";
import type { RowItem } from "../TableDataProvider";
import type { FilterableTable, OperatorValueFilterDescriptor } from "./ColumnFiltering";
import { FilterOperator } from "./ColumnFiltering";
import { ColumnFilteringUtilities } from "./ColumnFilteringUtilities";
import type { NumericRangeData } from "./DataGridFilterParser";

/** Represents a filtering descriptor.
 * @internal
 */
export class TableFilterDescriptor implements OperatorValueFilterDescriptor {
  private _filterableTable: FilterableTable;
  private _memberKey: string = "";
  private _memberType: string = "";
  private _typeConverterName?: string;
  private _operator: FilterOperator = FilterOperator.IsEqualTo;
  private _value: any;
  private _caseSensitive: boolean = false;

  public static unsetValue: string = "UNSET";

  /** Initializes a new instance of the FilterDescriptor class.
   * @param filterableTable The owning Table.
   * @param memberKey       The member (key).
   * @param memberType      The Type of the member.
   * @param filterOperator  The filter operator.
   * @param filterValue     The filter value.
   * @param caseSensitive   Indicates that this filter descriptor will be case sensitive.
   * @param typeConverterName The Type of the member.
   *
   */
  public constructor(filterableTable: FilterableTable,
    memberKey: string,
    memberType: string,
    filterOperator: FilterOperator = FilterOperator.IsEqualTo,
    filterValue: any = TableFilterDescriptor.unsetValue,
    caseSensitive: boolean = false,
    typeConverterName?: string,
  ) {
    this._filterableTable = filterableTable;
    this.memberKey = memberKey;
    this.operator = filterOperator;
    this.value = filterValue;
    this.isCaseSensitive = caseSensitive;
    this.memberType = memberType;
    this._typeConverterName = typeConverterName;
  }

  /** Gets the member (key).
   */
  public get memberKey(): string {
    return this._memberKey;
  }

  /** Sets the member (key).
   */
  public set memberKey(value: string) {
    this._memberKey = value;
  }

  /** Gets the member type.
   */
  public get memberType(): string {
    return this._memberType;
  }

  /** Sets the member type.
   */
  public set memberType(value: string) {
    this._memberType = value;
  }

  /** Gets the type Converter Name.
   */
  public get typeConverterName(): string | undefined {
    return this._typeConverterName;
  }

  /** Sets the member type.
   */
  public set typeConverterName(value: string | undefined) {
    this._typeConverterName = value;
  }

  /** Gets the operator.
   */
  public get operator(): FilterOperator {
    return this._operator;
  }

  /** Sets the operator.
   */
  public set operator(operator: FilterOperator) {
    this._operator = operator;
  }

  /** Gets the value.
   */
  public get value(): any {
    return this._value;
  }

  /** Sets the value.
   */
  public set value(value: any) {
    this._value = value;
  }

  /** Gets whether the filter is case sensitive.
   */
  public get isCaseSensitive(): boolean {
    return this._caseSensitive;
  }

  /** Sets whether the filter is case sensitive.
   */
  public set isCaseSensitive(caseSensitive: boolean) {
    this._caseSensitive = caseSensitive;
  }

  /** Clears the filter descriptor.
   */
  public clear(): void {
    this.value = TableFilterDescriptor.unsetValue;
  }

  /** Determines if the filter descriptor is active.
   */
  public get isActive(): boolean {
    if (!this._memberKey) {
      return false;
    }

    if (this.isOperatorUnary(this.operator)) {
      return true;
    }

    return this.value !== TableFilterDescriptor.unsetValue;
  }

  /** Evaluates a row for filtering
   */
  public evaluateRow(row: RowItem): boolean {
    if (this._memberKey) {
      let cellValue: any;

      if (row.getValueFromCell !== undefined)
        cellValue = row.getValueFromCell(this._memberKey);
      else
        cellValue = ColumnFilteringUtilities.getValueFromCell(row, this._memberKey);

      return this.processFilterOperator(cellValue);
    }

    return true;
  }

  /** Determines if this filter is for a particular column.
   */
  public isFilterForColumn(columnKey: string): boolean {
    return this._memberKey === columnKey;
  }

  private getJulianDaysFromValue(isUpperBound: boolean): number {
    // istanbul ignore next
    if (this._value.constructor.name !== "Date") {
      this._value = new Date(this._value);
      this._value.setMilliseconds(0);
    }

    // Credits : https://stackoverflow.com/a/11760121/7797060
    const dayLengthInMilliseconds = 86400000;
    const daysCountFromJulianDayToUnixEpoch = 2440587.5;
    const dayLengthInMinutes = 1440;
    if (isUpperBound)
      this._value.setSeconds(this._value.getSeconds() + 1);
    return (this._value.getTime() / dayLengthInMilliseconds) - (this._value.getTimezoneOffset() / dayLengthInMinutes) + daysCountFromJulianDayToUnixEpoch;
  }

  private constructComparisonFilterExpression(filterOperator: string): string {
    if (this._value == null)
      return "";

    if (this.memberType === StandardTypeNames.DateTime)
      return `(${this.memberKey} ${filterOperator}${this.getJulianDaysFromValue(false)})`;
    return `${this.memberKey} ${filterOperator} "${this._value.toString()}"`;
  }

  private constructRangeExpression(rangeData: NumericRangeData): string {
    return `(${rangeData.begin.toString()} <= ${this.memberKey}) AND (${this.memberKey} <= ${rangeData.end.toString()})`;
  }

  private getEqualsExpression(inverse: boolean): string {
    let prefix: string = "";
    let operator: string = " = ";
    if (inverse) {
      prefix = "NOT ";
      operator = " <> ";
    }

    switch (this.memberType) {
      case StandardTypeNames.DateTime: {
        if (this._value == null)
          return `${this.memberKey + operator} Null`;
        return `${prefix}(${this.memberKey} >= ${this.getJulianDaysFromValue(false)}) AND (${this.memberKey} < ${this.getJulianDaysFromValue(true)})`;
      }

      case StandardTypeNames.Bool:
      case StandardTypeNames.Boolean:
        if (typeof this._value === "string")
          return this.memberKey + operator + new BooleanTypeConverter().convertFromString(this._value).toString();
        if (typeof this._value === "boolean")
          return this.memberKey + operator + this._value.toString();
        Logger.logError(UiComponents.loggerCategory(this), `getEqualsExpression - invalid value type: ${typeof this._value}`);
        break;

      case StandardTypeNames.Point2d: {
        if (typeof this._value === "object")
          return `${prefix} (ArePointsEqualByValue(${this.memberKey}, ${this._value.x}, ${this._value.y}) = 1)`;
        if (typeof this._value === "string")
          return `${prefix + this._filterableTable.getPropertyDisplayValueExpression(this.memberKey)} = "${this.value}"`;
        Logger.logError(UiComponents.loggerCategory(this), `getEqualsExpression - invalid value type: ${typeof this._value}`);
        break;
      }

      case StandardTypeNames.Point3d: {
        if (typeof this._value === "object")
          return `${prefix} (ArePointsEqualByValue(${this.memberKey}, ${this._value.x}, ${this._value.y}, ${this._value.z}) = 1)`;
        if (typeof this._value === "string")
          return `${prefix + this._filterableTable.getPropertyDisplayValueExpression(this.memberKey)} = "${this.value}"`;
        Logger.logError(UiComponents.loggerCategory(this), `getEqualsExpression - invalid value type: ${typeof this._value}`);
        break;
      }

      case StandardTypeNames.Double:
      case StandardTypeNames.Float: {
        if (typeof this._value === "number")
          return `${prefix} (AreDoublesEqualByValue(${this.memberKey}, ${this._value}) = 1)`;
        if (typeof this._value === "string")
          return `${prefix + this._filterableTable.getPropertyDisplayValueExpression(this.memberKey)} = "${this.value}"`;
        Logger.logError(UiComponents.loggerCategory(this), `getEqualsExpression - invalid value type: ${typeof this._value}`);
        break;
      }
    }

    return `${this.memberKey + operator}"${this._value.toString()}"`;
  }

  /** Returns filter as ECExpression */
  public getFilterExpression(): string {
    switch (this.operator) {
      case FilterOperator.IsEqualTo:
        return this.getEqualsExpression(false);
      case FilterOperator.IsNotEqualTo:
        return this.getEqualsExpression(true);
      case FilterOperator.IsNull:
      case FilterOperator.IsEmpty:
        return `${this.memberKey} = Null`;
      case FilterOperator.IsNotNull:
      case FilterOperator.IsNotEmpty:
        return `${this.memberKey} <> Null`;
      case FilterOperator.IsLessThan:
        return this.constructComparisonFilterExpression("<");
      case FilterOperator.IsLessThanOrEqualTo:
        return this.constructComparisonFilterExpression("<=");
      case FilterOperator.IsGreaterThan:
        return this.constructComparisonFilterExpression(">");
      case FilterOperator.IsGreaterThanOrEqualTo:
        return this.constructComparisonFilterExpression(">=");
      case FilterOperator.Range:
        return this.constructRangeExpression(this._value);
      case FilterOperator.StartsWith:
        return `${this.memberKey} ~ ${null === this._value ? "Null" : `"${this._value.toString()}%"`}`;
      case FilterOperator.EndsWith:
        return `${this.memberKey} ~ ${null === this._value ? "Null" : `"%${this._value.toString()}"`}`;
      case FilterOperator.Contains:
        return `${this.memberKey} ~ ${null === this._value ? "Null" : `"%${this._value.toString()}%"`}`;
      case FilterOperator.DoesNotContain:
        return `NOT(${this.memberKey} ~ ${null === this._value ? "Null" : `"%${this._value.toString()}%"`})`;
      case FilterOperator.IsContainedIn:
        return `${null === this._value ? "Null" : `"${this._value.toString()}"`} ~ "%" & ${this.memberKey} & "%" `;
      case FilterOperator.IsNotContainedIn:
        return `NOT(${null === this._value ? "Null" : `"${this._value.toString()}"`} ~ "%" & ${this.memberKey} & "%" )`;
    }

    // istanbul ignore next
    return "";
  }

  private isOperatorUnary(op: FilterOperator): boolean {
    return (op === FilterOperator.IsNull ||
      op === FilterOperator.IsNotNull ||
      op === FilterOperator.IsEmpty ||
      op === FilterOperator.IsNotEmpty);
  }

  private processFilterOperator(cellValue: any): boolean {
    let result: boolean = false;
    const converter = TypeConverterManager.getConverter(this.memberType, this._typeConverterName);

    switch (this.operator) {
      case FilterOperator.IsEqualTo: {
        result = converter.isEqualTo(cellValue, this.value);
        break;
      }
      case FilterOperator.IsNotEqualTo: {
        result = converter.isNotEqualTo(cellValue, this.value);
        break;
      }

      // Numeric types, Dates, all types that implement these methods
      case FilterOperator.IsLessThan: {
        // istanbul ignore else
        if (converter.isLessGreaterType) {
          const lgConverter: LessGreaterOperatorProcessor = converter as any as LessGreaterOperatorProcessor;
          result = lgConverter.isLessThan(cellValue, this.value);
        }
        break;
      }
      case FilterOperator.IsLessThanOrEqualTo: {
        // istanbul ignore else
        if (converter.isLessGreaterType) {
          const lgConverter: LessGreaterOperatorProcessor = converter as any as LessGreaterOperatorProcessor;
          result = lgConverter.isLessThanOrEqualTo(cellValue, this.value);
        }
        break;
      }
      case FilterOperator.IsGreaterThan: {
        // istanbul ignore else
        if (converter.isLessGreaterType) {
          const lgConverter: LessGreaterOperatorProcessor = converter as any as LessGreaterOperatorProcessor;
          result = lgConverter.isGreaterThan(cellValue, this.value);
        }
        break;
      }
      case FilterOperator.IsGreaterThanOrEqualTo: {
        // istanbul ignore else
        if (converter.isLessGreaterType) {
          const lgConverter: LessGreaterOperatorProcessor = converter as any as LessGreaterOperatorProcessor;
          result = lgConverter.isGreaterThanOrEqualTo(cellValue, this.value);
        }
        break;
      }
      case FilterOperator.Range: {
        // istanbul ignore else
        if (converter.isLessGreaterType) {
          const lgConverter: LessGreaterOperatorProcessor = converter as any as LessGreaterOperatorProcessor;
          const rangeData = this.value as unknown as NumericRangeData;
          const passed = lgConverter.isGreaterThanOrEqualTo(cellValue, rangeData.begin);
          if (!passed)
            result = false;
          else
            result = lgConverter.isLessThanOrEqualTo(cellValue, rangeData.end);
        }
        break;
      }

      // Strings
      case FilterOperator.StartsWith: {
        // istanbul ignore else
        if (converter.isStringType) {
          const strConverter: StringOperatorProcessor = converter as any as StringOperatorProcessor;
          result = strConverter.startsWith(cellValue, this.value, this.isCaseSensitive);
        }
        break;
      }
      case FilterOperator.EndsWith: {
        // istanbul ignore else
        if (converter.isStringType) {
          const strConverter: StringOperatorProcessor = converter as any as StringOperatorProcessor;
          result = strConverter.endsWith(cellValue, this.value, this.isCaseSensitive);
        }
        break;
      }
      case FilterOperator.Contains: {
        // istanbul ignore else
        if (converter.isStringType) {
          const strConverter: StringOperatorProcessor = converter as any as StringOperatorProcessor;
          result = strConverter.contains(cellValue, this.value, this.isCaseSensitive);
        }
        break;
      }
      case FilterOperator.DoesNotContain: {
        // istanbul ignore else
        if (converter.isStringType) {
          const strConverter: StringOperatorProcessor = converter as any as StringOperatorProcessor;
          result = strConverter.doesNotContain(cellValue, this.value, this.isCaseSensitive);
        }
        break;
      }
      case FilterOperator.IsContainedIn: {
        // istanbul ignore else
        if (converter.isStringType) {
          const strConverter: StringOperatorProcessor = converter as any as StringOperatorProcessor;
          result = strConverter.isContainedIn(cellValue, this.value, this.isCaseSensitive);
        }
        break;
      }
      case FilterOperator.IsNotContainedIn: {
        // istanbul ignore else
        if (converter.isStringType) {
          const strConverter: StringOperatorProcessor = converter as any as StringOperatorProcessor;
          result = strConverter.isNotContainedIn(cellValue, this.value, this.isCaseSensitive);
        }
        break;
      }
      case FilterOperator.IsEmpty: {
        // istanbul ignore else
        if (converter.isStringType) {
          const strConverter: StringOperatorProcessor = converter as any as StringOperatorProcessor;
          result = strConverter.isEmpty(cellValue);
        }
        break;
      }
      case FilterOperator.IsNotEmpty: {
        // istanbul ignore else
        if (converter.isStringType) {
          const strConverter: StringOperatorProcessor = converter as any as StringOperatorProcessor;
          result = strConverter.isNotEmpty(cellValue);
        }
        break;
      }

      // All filterable null-able types
      case FilterOperator.IsNull: {
        // istanbul ignore else
        if (converter.isNullableType) {
          const nullConverter: NullableOperatorProcessor = converter as any as NullableOperatorProcessor;
          result = nullConverter.isNull(cellValue);
        }
        break;
      }
      case FilterOperator.IsNotNull: {
        // istanbul ignore else
        if (converter.isNullableType) {
          const nullConverter: NullableOperatorProcessor = converter as any as NullableOperatorProcessor;
          result = nullConverter.isNotNull(cellValue);
        }
        break;
      }
    }

    return result;
  }
}
