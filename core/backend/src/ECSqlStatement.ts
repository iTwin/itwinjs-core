/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
/** @packageDocumentation
 * @module ECSQL
 */

import type { GuidString, Id64String, IDisposable, StatusCodeWithMessage } from "@itwin/core-bentley";
import { assert, DbResult } from "@itwin/core-bentley";
import type { LowAndHighXYZ, XAndY, XYAndZ} from "@itwin/core-geometry";
import { Range3d, XYZ } from "@itwin/core-geometry";
import type { NavigationBindingValue, NavigationValue } from "@itwin/core-common";
import { ECJsNames, ECSqlValueType, IModelError } from "@itwin/core-common";
import type { IModelJsNative } from "@bentley/imodeljs-native";
import type { ECDb } from "./ECDb";
import { IModelHost } from "./IModelHost";

/** The result of an **ECSQL INSERT** statement as returned from [ECSqlStatement.stepForInsert]($backend).
 *
 * If the step was successful, the ECSqlInsertResult contains
 * [DbResult.BE_SQLITE_DONE]($core-bentley)
 * and the ECInstanceId of the newly created instance.
 * In case of failure it contains the [DbResult]($core-bentley) error code.
 *
 * > Insert statements can be used with ECDb only, not with IModelDb.
 * @public
 */
export class ECSqlInsertResult {
  public constructor(public status: DbResult, public id?: Id64String) { }
}

/** Executes ECSQL statements.
 *
 * A statement must be prepared before it can be executed, and it must be released when no longer needed.
 * See [IModelDb.withPreparedStatement]($backend) or
 * [ECDb.withPreparedStatement]($backend) for a convenient and
 * reliable way to prepare, execute, and then release a statement.
 *
 * A statement may contain parameters that must be filled in before use by the **bind** methods.
 *
 * Once prepared (and parameters are bound, if any), the statement is executed by calling [ECSqlStatement.step]($backend).
 * In case of an **ECSQL SELECT** statement, the current row can be retrieved with [ECSqlStatement.getRow]($backend) as
 * a whole, or with [ECSqlStatement.getValue]($backend) when individual values are needed.
 * Alternatively, query results of an **ECSQL SELECT** statement can be stepped through by using
 * standard iteration syntax, such as `for of`.
 *
 * > Preparing a statement can be time-consuming. The best way to reduce the effect of this overhead is to cache and reuse prepared
 * > statements. A cached prepared statement may be used in different places in an app, as long as the statement is general enough.
 * > The key to making this strategy work is to phrase a statement in a general way and use placeholders to represent parameters that will vary on each use.
 *
 * See also
 * - [Executing ECSQL]($docs/learning/backend/ExecutingECSQL) provides more background on ECSQL and an introduction on how to execute ECSQL with the iTwin.js API.
 * - [Code Examples]($docs/learning/backend/ECSQLCodeExamples) illustrate the use of the iTwin.js API for executing and working with ECSQL
 * @public
 */
export class ECSqlStatement implements IterableIterator<any>, IDisposable {
  private _stmt: IModelJsNative.ECSqlStatement | undefined;
  private _sql: string | undefined;

  public get sql() { return this._sql!; } // eslint-disable-line @typescript-eslint/no-non-null-assertion

  /** Check if this statement has been prepared successfully or not */
  public get isPrepared(): boolean { return !!this._stmt; }

  /** Prepare this statement prior to first use.
   * @param db The DgnDb or ECDb to prepare the statement against
   * @param ecsql The ECSQL statement string to prepare
   * @param logErrors Determine if errors are logged or not
   * @throws [IModelError]($common) if the ECSQL statement cannot be prepared. Normally, prepare fails due to ECSQL syntax errors or references to tables or properties that do not exist.
   * The error.message property will provide details.
   * @internal
   */
  public prepare(db: IModelJsNative.DgnDb | IModelJsNative.ECDb, ecsql: string, logErrors = true): void {
    const stat = this.tryPrepare(db, ecsql, logErrors);
    if (stat.status !== DbResult.BE_SQLITE_OK) {
      throw new IModelError(stat.status, stat.message);
    }
  }

  /** Prepare this statement prior to first use.
   * @param db The DgnDb or ECDb to prepare the statement against
   * @param ecsql The ECSQL statement string to prepare
   * @param logErrors Determine if errors are logged or not, its set to false by default for tryPrepare()
   * @returns A [StatusCodeWithMessage]($bentley) object with a `status` member equal to [DbResult.BE_SQLITE_OK]($bentley) on success. Upon error, the `message` member will provide details.
   * @internal
   */
  public tryPrepare(db: IModelJsNative.DgnDb | IModelJsNative.ECDb, ecsql: string, logErrors = false): StatusCodeWithMessage<DbResult> {
    if (this.isPrepared)
      throw new Error("ECSqlStatement is already prepared");
    this._sql = ecsql;
    this._stmt = new IModelHost.platform.ECSqlStatement();
    return this._stmt.prepare(db, ecsql, logErrors);
  }

  /** Reset this statement so that the next call to step will return the first row, if any. */
  public reset(): void {
    assert(undefined !== this._stmt);
    this._stmt.reset();
  }

  /** Get the Native SQL statement
   * @internal
   */
  public getNativeSql(): string {
    assert(undefined !== this._stmt);
    return this._stmt.getNativeSql();
  }

  /** Call this function when finished with this statement. This releases the native resources held by the statement.
   *
   * > Do not call this method directly on a statement that is being managed by a statement cache.
   */
  public dispose(): void {
    if (this._stmt) {
      this._stmt.dispose(); // free native statement
      this._stmt = undefined;
    }
  }

  /** Binds the specified value to the specified ECSQL parameter.
   * The section "[iTwin.js Types used in ECSQL Parameter Bindings]($docs/learning/ECSQLParameterTypes)" describes the
   * iTwin.js types to be used for the different ECSQL parameter types.
   * @param parameter Index (1-based) or name of the parameter
   */
  public bindValue(parameter: number | string, val: any): void { this.getBinder(parameter).bind(val); }

  /** Binds null to the specified ECSQL parameter.
   * @param parameter Index (1-based) or name of the parameter
   */
  public bindNull(parameter: number | string): void { this.getBinder(parameter).bindNull(); }

  /** Binds a BLOB value to the specified ECSQL parameter.
   * @param parameter Index (1-based) or name of the parameter
   * @param BLOB value as either a Uint8Array, ArrayBuffer or a Base64 string
   */
  public bindBlob(parameter: number | string, blob: string | Uint8Array | ArrayBuffer | SharedArrayBuffer): void { this.getBinder(parameter).bindBlob(blob); }

  /** Binds a boolean value to the specified ECSQL parameter.
   * @param parameter Index (1-based) or name of the parameter
   * @param val Boolean value
   */
  public bindBoolean(parameter: number | string, val: boolean): void { this.getBinder(parameter).bindBoolean(val); }

  /** Binds a DateTime value to the specified ECSQL parameter.
   * @param parameter Index (1-based) or name of the parameter
   * @param isoDateTimeString DateTime value as ISO8601 string
   */
  public bindDateTime(parameter: number | string, isoDateTimeString: string): void { this.getBinder(parameter).bindDateTime(isoDateTimeString); }

  /** Binds a double value to the specified ECSQL parameter.
   * @param parameter Index (1-based) or name of the parameter
   * @param val Double value
   */
  public bindDouble(parameter: number | string, val: number): void { this.getBinder(parameter).bindDouble(val); }

  /** Binds an GUID value to the specified ECSQL parameter.
   * @param parameter Index (1-based) or name of the parameter
   * @param val GUID value
   */
  public bindGuid(parameter: number | string, val: GuidString): void { this.getBinder(parameter).bindGuid(val); }

  /** Binds an Id value to the specified ECSQL parameter.
   * @param parameter Index (1-based) or name of the parameter
   * @param val Id value
   */
  public bindId(parameter: number | string, val: Id64String): void { this.getBinder(parameter).bindId(val); }

  /** Binds an integer value to the specified ECSQL parameter.
   * @param parameter Index (1-based) or name of the parameter
   * @param val Integer value as number, decimal string or hexadecimal string.
   */
  public bindInteger(parameter: number | string, val: number | string): void { this.getBinder(parameter).bindInteger(val); }

  /** Binds an Point2d value to the specified ECSQL parameter.
   * @param parameter Index (1-based) or name of the parameter
   * @param val Point2d value
   */
  public bindPoint2d(parameter: number | string, val: XAndY): void { this.getBinder(parameter).bindPoint2d(val); }

  /** Binds an Point3d value to the specified ECSQL parameter.
   * @param parameter Index (1-based) or name of the parameter
   * @param val Point3d value
   */
  public bindPoint3d(parameter: number | string, val: XYAndZ): void { this.getBinder(parameter).bindPoint3d(val); }

  /** Binds a Range3d as a blob to the specified ECSQL parameter
   * @param parameter Index(1-based) or name of the parameter
   * @param val Range3d value
   */
  public bindRange3d(parameter: number | string, val: LowAndHighXYZ): void { this.getBinder(parameter).bindRange3d(val); }

  /** Binds an string to the specified ECSQL parameter.
   * @param parameter Index (1-based) or name of the parameter
   * @param val String value
   */
  public bindString(parameter: number | string, val: string): void { this.getBinder(parameter).bindString(val); }

  /** Binds a navigation property value to the specified ECSQL parameter.
   * @param parameter Index (1-based) or name of the parameter
   * @param val Navigation property value
   */
  public bindNavigation(parameter: number | string, val: NavigationBindingValue): void { this.getBinder(parameter).bindNavigation(val); }

  /** Binds a struct property value to the specified ECSQL parameter.
   * @param parameter Index (1-based) or name of the parameter
   * @param val Struct value. The struct value is an object composed of pairs of a struct member property name and its value
   * (of one of the supported types)
   */
  public bindStruct(parameter: number | string, val: object): void { this.getBinder(parameter).bindStruct(val); }

  /** Binds an array value to the specified ECSQL parameter.
   * @param parameter Index (1-based) or name of the parameter
   * @param val Array value. The array value is an array of values of the supported types
   */
  public bindArray(parameter: number | string, val: any[]): void { this.getBinder(parameter).bindArray(val); }

  public bindIdSet(parameter: number | string, val: Id64String[]): void { this.getBinder(parameter).bindIdSet(val); }
  /**
   * Gets a binder to bind a value for an ECSQL parameter
   * > This is the most low-level API to bind a value to a specific parameter. Alternatively you can use the ECSqlStatement.bindXX methods
   * > or [ECSqlStatement.bindValues]($backend).
   * @param parameter Index (1-based) or name of the parameter
   */
  public getBinder(parameter: string | number): ECSqlBinder {
    assert(undefined !== this._stmt);
    return new ECSqlBinder(this._stmt.getBinder(parameter));
  }

  /** Bind values to all parameters in the statement.
   * @param values The values to bind to the parameters.
   * Pass an *array* of values if the parameters are *positional*.
   * Pass an *object of the values keyed on the parameter name* for *named parameters*.
   * The values in either the array or object must match the respective types of the parameter.
   *
   * The section "[iTwin.js Types used in ECSQL Parameter Bindings]($docs/learning/ECSQLParameterTypes)" describes the
   * iTwin.js types to be used for the different ECSQL parameter types.
   *
   * See also these [Code Samples]($docs/learning/backend/ECSQLCodeExamples#binding-to-all-parameters-at-once)
   */
  public bindValues(values: any[] | object): void {
    if (Array.isArray(values)) {
      for (let i = 0; i < values.length; i++) {
        const paramIndex: number = i + 1;
        const paramValue: any = values[i];
        if (paramValue === undefined || paramValue === null)
          continue;

        this.bindValue(paramIndex, paramValue);
      }
      return;
    }

    for (const entry of Object.entries(values)) {
      const paramName: string = entry[0];
      const paramValue: any = entry[1];
      if (paramValue === undefined || paramValue === null)
        continue;

      this.bindValue(paramName, paramValue);
    }
  }

  /** Clear any bindings that were previously set on this statement.
   * @throws [IModelError]($common) in case of errors
   */
  public clearBindings(): void {
    if (this._stmt) {
      const stat: DbResult = this._stmt.clearBindings();
      if (stat !== DbResult.BE_SQLITE_OK)
        throw new IModelError(stat, "Error clearing bindings");
    }
  }

  /** Step this statement to the next row.
   *
   *  For **ECSQL SELECT** statements the method returns
   *  - [DbResult.BE_SQLITE_ROW]($core-bentley) if the statement now points successfully to the next row.
   *  - [DbResult.BE_SQLITE_DONE]($core-bentley) if the statement has no more rows.
   *  - Error status in case of errors.
   *
   *  For **ECSQL INSERT, UPDATE, DELETE** statements the method returns
   *  - [DbResult.BE_SQLITE_DONE]($core-bentley) if the statement has been executed successfully.
   *  - Error status in case of errors.
   *
   *  >  Insert statements can be used with ECDb only, not with IModelDb.
   *
   * See also: [Code Samples]($docs/learning/backend/ECSQLCodeExamples)
   */
  public step(): DbResult { return this._stmt!.step(); } // eslint-disable-line @typescript-eslint/no-non-null-assertion

  /** @internal added this back in for testing purposes */
  public async stepAsync(): Promise<DbResult> {
    return new Promise((resolve, _reject) => {
      this._stmt!.stepAsync(resolve); // eslint-disable-line @typescript-eslint/no-non-null-assertion
    });
  }

  /** Step this INSERT statement and returns status and the ECInstanceId of the newly
   * created instance.
   *
   * > Insert statements can be used with ECDb only, not with IModelDb.
   *
   * @returns Returns the generated ECInstanceId in case of success and the status of the step
   * call. In case of error, the respective error code is returned.
   */
  public stepForInsert(): ECSqlInsertResult {
    assert(undefined !== this._stmt);
    const r: { status: DbResult, id: string } = this._stmt.stepForInsert();
    if (r.status === DbResult.BE_SQLITE_DONE)
      return new ECSqlInsertResult(r.status, r.id);

    return new ECSqlInsertResult(r.status);
  }

  /** Get the query result's column count (only for ECSQL SELECT statements). */
  public getColumnCount(): number { return this._stmt!.getColumnCount(); } // eslint-disable-line @typescript-eslint/no-non-null-assertion

  /** Get the current row.
   * The returned row is formatted as JavaScript object where every SELECT clause item becomes a property in the JavaScript object.
   *
   * See also:
   * - [ECSQL row format]($docs/learning/ECSQLRowFormat) for details about the format of the returned row.
   * - [Code Samples]($docs/learning/backend/ECSQLCodeExamples#working-with-the-query-result)
   */
  public getRow(): any {
    const colCount: number = this.getColumnCount();
    const row: object = {};
    const duplicatePropNames = new Map<string, number>();
    for (let i = 0; i < colCount; i++) {
      const ecsqlValue = this.getValue(i);
      if (!ecsqlValue.isNull) {
        const propName: string = ECSqlStatement.determineResultRowPropertyName(duplicatePropNames, ecsqlValue);
        const val: any = ecsqlValue.value;
        Object.defineProperty(row, propName, { enumerable: true, configurable: true, writable: true, value: val });
      }
    }
    return row;
  }

  private static determineResultRowPropertyName(duplicatePropNames: Map<string, number>, ecsqlValue: ECSqlValue): string {
    const colInfo: ECSqlColumnInfo = ecsqlValue.columnInfo;
    let jsName: string = ECJsNames.toJsName(colInfo.getAccessString(), colInfo.isSystemProperty());

    // now check duplicates. If there are, append a numeric suffix to the duplicates
    let suffix: number | undefined = duplicatePropNames.get(jsName);
    if (suffix === undefined)
      duplicatePropNames.set(jsName, 0);
    else {
      suffix++;
      duplicatePropNames.set(jsName, suffix);
      jsName += `_${suffix}`;
    }

    return jsName;
  }

  /** Calls step when called as an iterator.
   *
   *  Each iteration returns an [ECSQL row format]($docs/learning/ECSQLRowFormat) as returned
   *  from [ECSqlStatement.getRow]($backend).
   */
  public next(): IteratorResult<any> {
    if (DbResult.BE_SQLITE_ROW === this.step()) {
      return {
        done: false,
        value: this.getRow(),
      };
    } else {
      return {
        done: true,
        value: undefined,
      };
    }
  }

  /** The iterator that will step through the results of this statement. */
  public [Symbol.iterator](): IterableIterator<any> { return this; }

  /** Get the value for the column at the given index in the query result.
   * @param columnIx Index of ECSQL column in query result (0-based)
   *
   * See also: [Code Samples]($docs/learning/backend/ECSQLCodeExamples#working-with-the-query-result)
   */
  public getValue(columnIx: number): ECSqlValue {
    assert(undefined !== this._stmt);
    return new ECSqlValue(this._stmt.getValue(columnIx));
  }
}

/** Binds a value to an ECSQL parameter.
 *
 * See also:
 *
 * - [ECSqlStatement]($backend)
 * - [ECSqlStatement.getBinder]($backend)
 * - [Executing ECSQL]($docs/learning/backend/ExecutingECSQL)
 * @public
 */
export class ECSqlBinder {
  private _binder: IModelJsNative.ECSqlBinder;

  /** @internal */
  public constructor(binder: IModelJsNative.ECSqlBinder) { this._binder = binder; }

  /** Binds the specified value to the ECSQL parameter.
   * The section "[iTwin.js Types used in ECSQL Parameter Bindings]($docs/learning/ECSQLParameterTypes)" describes the
   * iTwin.js types to be used for the different ECSQL parameter types.
   * @param val Value to bind
   */
  public bind(val: any): void {
    ECSqlBindingHelper.bindValue(this, val);
  }

  /** Binds null to the ECSQL parameter. */
  public bindNull(): void {
    const stat: DbResult = this._binder.bindNull();
    if (stat !== DbResult.BE_SQLITE_OK)
      throw new IModelError(stat, "Error binding null");
  }

  /** Binds a BLOB value to the ECSQL parameter.
   * @param BLOB value as either a UInt8Array, ArrayBuffer or a Base64 string
   */
  public bindBlob(blob: string | Uint8Array | ArrayBuffer | SharedArrayBuffer): void {
    const stat: DbResult = this._binder.bindBlob(blob);
    if (stat !== DbResult.BE_SQLITE_OK)
      throw new IModelError(stat, "Error binding blob");
  }

  /** Binds a boolean value to the ECSQL parameter.
   * @param val Boolean value
   */
  public bindBoolean(val: boolean): void {
    const stat: DbResult = this._binder.bindBoolean(val);
    if (stat !== DbResult.BE_SQLITE_OK)
      throw new IModelError(stat, "Error binding boolean");
  }

  /** Binds a DateTime value to the ECSQL parameter.
   * @param isoDateTimeString DateTime value as ISO8601 string
   */
  public bindDateTime(isoDateTimeString: string): void {
    const stat: DbResult = this._binder.bindDateTime(isoDateTimeString);
    if (stat !== DbResult.BE_SQLITE_OK)
      throw new IModelError(stat, "Error binding DateTime");
  }

  /** Binds a double value to the ECSQL parameter.
   * @param val Double value
   */
  public bindDouble(val: number): void {
    const stat: DbResult = this._binder.bindDouble(val);
    if (stat !== DbResult.BE_SQLITE_OK)
      throw new IModelError(stat, "Error binding double");
  }

  /** Binds an GUID value to the ECSQL parameter.
   * @param val GUID value. If passed as string, it must be formatted as described in [GuidString]($core-bentley).
   */
  public bindGuid(val: GuidString): void {
    const stat: DbResult = this._binder.bindGuid(val);
    if (stat !== DbResult.BE_SQLITE_OK)
      throw new IModelError(stat, "Error binding GUID");
  }

  /** Binds an Id value to the ECSQL parameter.
   * @param val Id value. If passed as string it must be the hexadecimal representation of the Id.
   */
  public bindId(val: Id64String): void {
    const stat: DbResult = this._binder.bindId(val);
    if (stat !== DbResult.BE_SQLITE_OK)
      throw new IModelError(stat, "Error binding Id");
  }

  /** Binds an integer value to the ECSQL parameter.
   * @param val Integer value as number, decimal string or hexadecimal string.
   */
  public bindInteger(val: number | string): void {
    const stat: DbResult = this._binder.bindInteger(val);
    if (stat !== DbResult.BE_SQLITE_OK)
      throw new IModelError(stat, "Error binding integer");
  }

  /** Binds an Point2d value to the ECSQL parameter.
   * @param val Point2d value
   */
  public bindPoint2d(val: XAndY): void {
    const stat: DbResult = this._binder.bindPoint2d(val.x, val.y);
    if (stat !== DbResult.BE_SQLITE_OK)
      throw new IModelError(stat, "Error binding Point2d");
  }

  /** Binds an Point3d value to the ECSQL parameter.
   * @param val Point3d value
   */
  public bindPoint3d(val: XYAndZ): void {
    const stat: DbResult = this._binder.bindPoint3d(val.x, val.y, val.z);
    if (stat !== DbResult.BE_SQLITE_OK)
      throw new IModelError(stat, "Error binding Point3d");
  }

  /** Binds a Range3d as a blob to the ECSQL parameter.
   * @param val Range3d value
   */
  public bindRange3d(val: LowAndHighXYZ): void {
    const stat: DbResult = this._binder.bindBlob(Range3d.toFloat64Array(val).buffer);
    if (stat !== DbResult.BE_SQLITE_OK)
      throw new IModelError(stat, "Error binding Range3d");
  }

  /** Binds an string to the ECSQL parameter.
   * @param val String value
   */
  public bindString(val: string): void {
    const stat: DbResult = this._binder.bindString(val);
    if (stat !== DbResult.BE_SQLITE_OK)
      throw new IModelError(stat, "Error binding string");
  }

  /** Binds a navigation property value to the ECSQL parameter.
   * @param val Navigation property value
   */
  public bindNavigation(val: NavigationBindingValue): void {
    const stat: DbResult = this._binder.bindNavigation(val.id, val.relClassName, val.relClassTableSpace);
    if (stat !== DbResult.BE_SQLITE_OK)
      throw new IModelError(stat, "Error binding navigation property");
  }

  /** Binds a struct property value to the ECSQL parameter.
   * @param val Struct value. The struct value is an object composed of pairs of a struct member property name and its value
   * (of one of the supported types)
   */
  public bindStruct(val: object): void { ECSqlBindingHelper.bindStruct(this, val); }

  /** Gets the binder for the specified member of a struct parameter
   *
   * > This is the most low-level way to bind struct parameters with most flexibility. A simpler alternative is
   * > to just call [ECSqlBinder.bindStruct]($backend).
   */
  public bindMember(memberName: string): ECSqlBinder { return new ECSqlBinder(this._binder.bindMember(memberName)); }

  /** Binds a set of Id strings to the ECSQL parameter.
   * @param val array of Id values. If passed as string they must be the hexadecimal representation of the Ids.
   */
  public bindIdSet(vector: Id64String[]): void {
    const stat: DbResult = this._binder.bindIdSet(vector);
    if (stat !== DbResult.BE_SQLITE_OK)
      throw new IModelError(stat, "Error binding id set");
  }

  /** Binds an array value to the ECSQL parameter.
   * @param val Array value. The array value is an array of values of the supported types
   */
  public bindArray(val: any[]): void { ECSqlBindingHelper.bindArray(this, val); }

  /** Adds a new array element to the array parameter and returns the binder for the new array element
   *
   * > This is the most low-level way to bind array parameters with most flexibility. A simpler alternative is
   * > to just call [ECSqlBinder.bindArray]($backend).
   */
  public addArrayElement(): ECSqlBinder { return new ECSqlBinder(this._binder.addArrayElement()); }
}

/** Represents the value of an ECEnumeration.
 *
 * See also:
 * - [[ECSqlValue.getEnum]]
 * - [[ECSqlStatement]]
 * - [[ECSqlStatement.getValue]]
 * - [Code Samples]($docs/learning/backend/ECSQLCodeExamples#working-with-the-query-result)
 * @public
 */
export interface ECEnumValue {
  schema: string;
  name: string;
  key: string;
  value: number | string;
}

/** Value of a column in a row of an ECSQL query result.
 *
 * See also:
 * - [ECSqlStatement]($backend)
 * - [ECSqlStatement.getValue]($backend)
 * - [Code Samples]($docs/learning/backend/ECSQLCodeExamples#working-with-the-query-result)
 * @public
 */
export class ECSqlValue {
  private _val: IModelJsNative.ECSqlValue;

  /** @internal */
  public constructor(val: IModelJsNative.ECSqlValue) { this._val = val; }

  /** Get information about the query result's column this value refers to. */
  public get columnInfo(): ECSqlColumnInfo { return this._val.getColumnInfo() as ECSqlColumnInfo; }

  /** Get the value of this ECSQL value */
  public get value(): any { return ECSqlValueHelper.getValue(this); }

  /** Indicates whether the value is NULL or not. */
  public get isNull(): boolean { return this._val.isNull(); }
  /** Get the value as BLOB */
  public getBlob(): Uint8Array { return this._val.getBlob(); }
  /** Get the value as a boolean value */
  public getBoolean(): boolean { return this._val.getBoolean(); }
  /** Get the value as a DateTime value (formatted as ISO8601 string) */
  public getDateTime(): string { return this._val.getDateTime(); }
  /** Get the value as a double value */
  public getDouble(): number { return this._val.getDouble(); }
  /** Get the value as a IGeometry value (as ECJSON IGeometry) */
  public getGeometry(): any { return JSON.parse(this._val.getGeometry()); }
  /** Get the value as a GUID (formatted as GUID string).
   *  See [GuidString]($core-bentley)
   */
  public getGuid(): GuidString { return this._val.getGuid(); }
  /** Get the value as a Id (formatted as hexadecimal string). */
  public getId(): Id64String { return this._val.getId(); }
  /** Get the ClassId value formatted as fully qualified class name. */
  public getClassNameForClassId(): string { return this._val.getClassNameForClassId(); }
  /** Get the value as a integer value */
  public getInteger(): number { return this._val.getInt64(); }
  /** Get the value as a string value */
  public getString(): string { return this._val.getString(); }
  /** Get the value as [XAndY]($core-geometry) */
  public getXAndY(): XAndY { return this._val.getPoint2d(); }
  /** Get the value as [XYAndZ]($core-geometry) */
  public getXYAndZ(): XYAndZ { return this._val.getPoint3d(); }
  /** Get the value as ECEnumeration value
   *  Note: This method is optional. Using [[ECSqlValue.getInteger]] for integral enums and
   *  [[ECSqlValue.getString]] for string enums respectively are the usual way to get
   *  enum values. This method can be used if the context of the underlying ECEnumeration
   *  is required.
   *  The value is broken down into the ECEnumerators that make it up, if the value
   *  is a combination of ECEnumerators. If the value is not a strict match of an ECEnumerator
   *  or a combination of them, undefined is returned.
   *  > Note: You can call [[ECSqlValue.columnInfo.isEnum]] to find out whether
   *  > this method can be called or not.
   *  @return ECEnumeration value(s) or undefined if the ECSqlValue does not represent an ECEnumeration.
   *  or is not a strict match of an ECEnumerator or a combination of them.
   */
  public getEnum(): ECEnumValue[] | undefined { return this._val.getEnum(); }

  /** Get the value as [NavigationValue]($common) */
  public getNavigation(): NavigationValue { return this._val.getNavigation(); }

  /** Get an iterator for iterating the struct members of this struct value. */
  public getStructIterator(): ECSqlValueIterator { return new ECSqlValueIterator(this._val.getStructIterator()); }

  /** Get this struct value's content as object literal */
  public getStruct(): any { return ECSqlValueHelper.getStruct(this); }

  /** Get an iterator for iterating the array elements of this array value. */
  public getArrayIterator(): ECSqlValueIterator { return new ECSqlValueIterator(this._val.getArrayIterator()); }

  /** Get this array value as JavaScript array */
  public getArray(): any[] { return ECSqlValueHelper.getArray(this); }
}

/** Iterator over members of a struct [ECSqlValue]($backend) or the elements of an array [ECSqlValue]($backend).
 * See [ECSqlValue.getStructIterator]($backend) or [ECSqlValue.getArrayIterator]($backend).
 * @public
 */
export class ECSqlValueIterator implements IterableIterator<ECSqlValue> {
  private _it: IModelJsNative.ECSqlValueIterator;

  /** @internal */
  public constructor(it: IModelJsNative.ECSqlValueIterator) { this._it = it; }

  public next(): IteratorResult<ECSqlValue> {
    if (this._it.moveNext())
      return { done: false, value: new ECSqlValue(this._it.getCurrent()) };

    return { done: true, value: undefined };
  }

  public [Symbol.iterator](): IterableIterator<ECSqlValue> { return this; }
}

/** Information about an ECSQL column in an ECSQL query result.
 * See [ECSqlValue.columnInfo]($backend), [ECSqlStatement.getValue]($backend), [ECSqlStatement]($backend)
 * @public
 */
export interface ECSqlColumnInfo {
  /** Gets the data type of the column.
   */
  getType(): ECSqlValueType;

  /** Gets the name of the property backing the column.
   * > If this column is backed by a generated property, i.e. it represents ECSQL expression,
   * > the access string consists of the name of the generated property.
   */
  getPropertyName(): string;

  /** Gets the full access string to the corresponding ECSqlValue starting from the root class.
   * > If this column is backed by a generated property, i.e. it represents ECSQL expression,
   * > the access string consists of the ECSQL expression.
   */
  getAccessString(): string;

  /** Indicates whether the column refers to an ECEnumeration property. */
  isEnum(): boolean;

  /** Indicates whether the column refers to a system property (e.g. id, className). */
  isSystemProperty(): boolean;

  /** Indicates whether the column is backed by a generated property or not. For SELECT clause items that are expressions other
   * than simply a reference to an ECProperty, a property is generated containing the expression name.
   */
  isGeneratedProperty(): boolean;

  /** Gets the table space in which this root class is persisted.
   * > For classes in the primary file the table space is MAIN. For classes in attached
   * > files, the table space is the name by which the file was attached. For generated properties the table space is empty.
   */
  getRootClassTableSpace(): string;

  /** Gets the fully qualified name of the ECClass of the top-level ECProperty backing this column. */
  getRootClassName(): string;

  /** Gets the class alias of the root class to which the column refers to.
   * > Returns an empty string if no class alias was specified in the select clause.
   */
  getRootClassAlias(): string;
}

class ECSqlBindingHelper {

  /** Binds the specified value to the specified binder
   * @param binder Parameter Binder to bind to
   * @param val Value to be bound. (See [iTwin.js Types used in ECSQL Parameter Bindings]($docs/learning/ECSQLParameterTypes))
   * @throws IModelError in case of errors
   */
  public static bindValue(binder: ECSqlBinder, val: any): void {
    // returns false if val is no primitive and returns true if it is primitive and a binding call was done
    if (ECSqlBindingHelper.tryBindPrimitiveTypes(binder, val))
      return;

    if (Array.isArray(val)) {
      ECSqlBindingHelper.bindArray(binder, val);
      return;
    }

    if (typeof (val) === "object") {
      ECSqlBindingHelper.bindStruct(binder, val);
      return;
    }

    throw new Error(`Bound value is of an unsupported type: ${val}`);
  }

  /** Binds the specified primitive value to the specified binder
   * @param binder Parameter Binder to bind to
   * @param val Primitive value to be bound. Must be of one of these types described here:
   * [ECSQL Binding types]($docs/learning/ECSQLParameterTypes)
   * @throws IModelError in case of errors
   */
  public static bindPrimitive(binder: ECSqlBinder, val: any): void {
    if (!ECSqlBindingHelper.tryBindPrimitiveTypes(binder, val))
      throw new IModelError(DbResult.BE_SQLITE_ERROR, `Binding value is of an unsupported primitive type: ${val}`);
  }

  /** Binds the specified object to the specified struct binder
   * @param binder Struct parameter binder to bind to
   * @param val Value to be bound. Must be an Object with members of the supported types
   * @throws IModelError in case of errors
   */
  public static bindStruct(binder: ECSqlBinder, val: object): void {
    if (val === null || val === undefined) {
      binder.bindNull();
      return;
    }

    for (const member of Object.entries(val)) {
      const memberName: string = member[0];
      const memberVal: any = member[1];
      ECSqlBindingHelper.bindValue(binder.bindMember(memberName), memberVal);
    }
  }

  /** Binds the specified array to the specified array binder
   * @param binder Array parameter binder to bind to
   * @param val Value to be bound. Must be an Array with elements of the supported types
   * @throws IModelError in case of errors
   */
  public static bindArray(binder: ECSqlBinder, val: any[]): void {
    if (val === null || val === undefined) {
      binder.bindNull();
      return;
    }

    for (const element of val) {
      ECSqlBindingHelper.bindValue(binder.addArrayElement(), element);
    }
  }

  /** tries to interpret the passed value as known leaf types (primitives and navigation values).
   *  @returns Returns undefined if the value wasn't a primitive. DbResult if it was a primitive and was bound to the binder
   */
  private static tryBindPrimitiveTypes(binder: ECSqlBinder, val: any): boolean {
    if (val === undefined || val === null) {
      binder.bindNull();
      return true;
    }

    if (typeof (val) === "number") {
      if (Number.isInteger(val))
        binder.bindInteger(val);
      else
        binder.bindDouble(val);

      return true;
    }

    if (typeof (val) === "boolean") {
      binder.bindBoolean(val);
      return true;
    }

    if (typeof (val) === "string") {
      binder.bindString(val);
      return true;
    }

    if (ECSqlTypeHelper.isBlob(val)) {
      binder.bindBlob(val);
      return true;
    }

    if (ECSqlTypeHelper.isXYAndZ(val)) {
      binder.bindPoint3d(val);
      return true;
    }

    if (ECSqlTypeHelper.isXAndY(val)) {
      binder.bindPoint2d(val);
      return true;
    }

    if (ECSqlTypeHelper.isLowAndHighXYZ(val)) {
      binder.bindRange3d(val);
      return true;
    }

    if (ECSqlTypeHelper.isNavigationBindingValue(val)) {
      binder.bindNavigation(val);
      return true;
    }

    return false;
  }
}

class ECSqlValueHelper {
  public static getValue(ecsqlValue: ECSqlValue): any {
    if (ecsqlValue.isNull)
      return undefined;

    const dataType: ECSqlValueType = ecsqlValue.columnInfo.getType();
    switch (dataType) {
      case ECSqlValueType.Struct:
        return ECSqlValueHelper.getStruct(ecsqlValue);

      case ECSqlValueType.Navigation:
        return ecsqlValue.getNavigation();

      case ECSqlValueType.PrimitiveArray:
      case ECSqlValueType.StructArray:
        return ECSqlValueHelper.getArray(ecsqlValue);

      default:
        return ECSqlValueHelper.getPrimitiveValue(ecsqlValue);
    }
  }

  public static getStruct(ecsqlValue: ECSqlValue): any {
    if (ecsqlValue.isNull)
      return undefined;

    const structVal = {};
    const it = ecsqlValue.getStructIterator();
    try {
      for (const memberECSqlVal of it) {
        if (memberECSqlVal.isNull)
          continue;

        const memberName: string = ECJsNames.toJsName(memberECSqlVal.columnInfo.getPropertyName());
        const memberVal = ECSqlValueHelper.getValue(memberECSqlVal);
        Object.defineProperty(structVal, memberName, { enumerable: true, configurable: true, writable: true, value: memberVal });
      }
    } finally {
    }

    return structVal;
  }

  public static getArray(ecsqlValue: ECSqlValue): any[] {
    const arrayVal: any[] = [];
    const it = ecsqlValue.getArrayIterator();
    try {
      for (const elementECSqlVal of it) {
        const memberVal = ECSqlValueHelper.getValue(elementECSqlVal);
        arrayVal.push(memberVal);
      }
    } finally {
    }
    return arrayVal;
  }

  private static getPrimitiveValue(ecsqlValue: ECSqlValue): any {
    if (ecsqlValue.isNull)
      return undefined;

    const colInfo: ECSqlColumnInfo = ecsqlValue.columnInfo;
    switch (colInfo.getType()) {
      case ECSqlValueType.Blob:
        return ecsqlValue.getBlob();
      case ECSqlValueType.Boolean:
        return ecsqlValue.getBoolean();
      case ECSqlValueType.DateTime:
        return ecsqlValue.getDateTime();
      case ECSqlValueType.Double:
        return ecsqlValue.getDouble();
      case ECSqlValueType.Geometry:
        return ecsqlValue.getGeometry();
      case ECSqlValueType.Guid:
        return ecsqlValue.getGuid();
      case ECSqlValueType.Id: {
        if (colInfo.isSystemProperty() && colInfo.getPropertyName().endsWith("ECClassId"))
          return ecsqlValue.getClassNameForClassId();

        return ecsqlValue.getId();
      }
      case ECSqlValueType.Int:
      case ECSqlValueType.Int64:
        return ecsqlValue.getInteger();
      case ECSqlValueType.Point2d:
        return ecsqlValue.getXAndY();
      case ECSqlValueType.Point3d:
        return ecsqlValue.getXYAndZ();
      case ECSqlValueType.String:
        return ecsqlValue.getString();
      default:
        throw new IModelError(DbResult.BE_SQLITE_ERROR, `Unsupported type ${ecsqlValue.columnInfo.getType()} of the ECSQL Value`);
    }
  }

  public static queryClassName(ecdb: ECDb, classId: Id64String, tableSpace?: string): string {
    if (!tableSpace)
      tableSpace = "main";

    return ecdb.withPreparedStatement(`SELECT s.Name, c.Name FROM [${tableSpace}].meta.ECSchemaDef s, JOIN [${tableSpace}].meta.ECClassDef c ON s.ECInstanceId=c.SchemaId WHERE c.ECInstanceId=?`,
      (stmt: ECSqlStatement) => {
        stmt.bindId(1, classId);
        if (stmt.step() !== DbResult.BE_SQLITE_ROW)
          throw new IModelError(DbResult.BE_SQLITE_ERROR, `No class found with ECClassId ${classId} in table space ${tableSpace}.`);

        return `${stmt.getValue(0).getString()}.${stmt.getValue(1).getString()}`;
      });
  }
}

class ECSqlTypeHelper {
  public static isBlob(val: any): val is Uint8Array { return val instanceof Uint8Array; }

  public static isXAndY(val: any): val is XAndY { return XYZ.isXAndY(val); }
  public static isXYAndZ(val: any): val is XYAndZ { return XYZ.isXYAndZ(val); }
  public static isLowAndHighXYZ(arg: any): arg is LowAndHighXYZ { return arg.low !== undefined && ECSqlTypeHelper.isXYAndZ(arg.low) && arg.high !== undefined && ECSqlTypeHelper.isXYAndZ(arg.high); }

  public static isNavigationBindingValue(val: any): val is NavigationBindingValue { return val.id !== undefined && typeof (val.id) === "string"; }
}
