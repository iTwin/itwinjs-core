/*---------------------------------------------------------------------------------------------
|  $Copyright: (c) 2018 Bentley Systems, Incorporated. All rights reserved. $
 *--------------------------------------------------------------------------------------------*/
import { assert } from "@bentley/bentleyjs-core/lib/Assert";
import { DbResult } from "@bentley/bentleyjs-core/lib/BeSQLite";
import { BentleyStatus } from "@bentley/bentleyjs-core/lib/Bentley";
import { IModelError } from "../common/IModelError";
import { Id64 } from "@bentley/bentleyjs-core/lib/Id";
import { ECSqlValueType, DateTime, Blob, NavigationValue, NavigationBindingValue, ECSqlSystemProperty, ECJsNames } from "../common/ECSqlTypes";
import { Point2d, Point3d, XAndY, XY, XYAndZ, XYZ } from "@bentley/geometry-core/lib/PointVector";
import { ECDb } from "./ECDb";
import { using, IDisposable } from "@bentley/bentleyjs-core/lib/Disposable";
import { NodeAddonRegistry } from "./NodeAddonRegistry";
import { AddonECSqlStatement, AddonECSqlBinder, AddonECSqlValue, AddonECSqlColumnInfo, AddonECDb, AddonDgnDb } from "@bentley/imodeljs-nodeaddonapi/imodeljs-nodeaddonapi";
import { StatusCodeWithMessage } from "@bentley/bentleyjs-core/lib/BentleyError";

/** The result of an ECSQL INSERT statement as returned from ECSqlStatement.stepForInsert.
 *  If the step was successful, the ECSqlInsertResult contains
 * DbResult.BE_SQLITE_DONE and the ECInstanceId of the newly created instance.
 * In case of failure it contains the error DbResult code.
 */
export class ECSqlInsertResult {
  public constructor(public status: DbResult, public id?: Id64) {}
}

/** An ECSql Statement. A statement must be prepared before it can be executed. See prepare. A statement may contain placeholders that must be filled
 * in before use. See bindValues. A prepared statement can be stepped through all matching rows by calling step. ECSqlStatement is-a iterator, so that you
 * can step through its results by using standard iteration syntax, such as "for in".
 */
export class ECSqlStatement implements IterableIterator<any>, IDisposable {
  private _stmt: AddonECSqlStatement | undefined;
  private _isShared: boolean = false;

  /** @hidden - used by statement cache */
  public setIsShared(b: boolean) {
    this._isShared = b;
  }

  /** @hidden - used by statement cache */
  public isShared(): boolean {
    assert(!this._isShared || this.isPrepared(), "a shared statement must always be in the prepared state");
    return this._isShared;
  }

  /** Check if this statement has been prepared successfully or not */
  public isPrepared(): boolean {
    return this._stmt !== undefined;
  }

  /** Prepare this statement prior to first use.
   * @throws [[IModelError]] if the statement cannot be prepared. Normally, prepare fails due to ECSql syntax errors or references to tables or properties that do not exist. The error.message property will describe the property.
   */
  public prepare(db: AddonDgnDb | AddonECDb, statement: string): void {
    if (this.isPrepared())
      throw new Error("statement is already prepared");
    this._stmt = new (NodeAddonRegistry.getAddon()).AddonECSqlStatement();
    const stat: StatusCodeWithMessage<DbResult> = this._stmt!.prepare(db, statement);
    if (stat.status !== DbResult.BE_SQLITE_OK)
      throw new IModelError(stat.status, stat.message);
  }

  /** Reset this statement so that the next call to step will return the first row, if any. */
  public reset(): DbResult {
    if (!this._stmt)
      throw new Error("statement is not prepared");
    return this._stmt.reset();
  }

  /** Call this function when finished with this statement. This releases the native resources held by the statement.
   * @Note Do not call this method directly on a statement that is being managed by a statement cache.
   */
  public dispose(): void {
    if (this.isShared())
      throw new Error("you can't dispose a statement that is shared with others (e.g., in a cache)");
    if (!this.isPrepared())
      return;
    this._stmt!.dispose(); // Tell the peer JS object to free its native resources immediately
    this._stmt = undefined; // discard the peer JS object as garbage

    assert(!this.isPrepared()); // leaves the statement in the un-prepared state
  }

  /** Binds null to the specified ECSQL parameter
   *  @param param Index (1-based) or name of the parameter
   */
  public bindNull(param: number | string): void {
    using(this.getBinder(param), (binder) => binder.bindNull());
  }

  /** Binds a BLOB value to the specified ECSQL parameter
   *  @param param Index (1-based) or name of the parameter
   *  @param val BLOB value, either as Blob object, or as Base64 string
   */
  public bindBlob(param: number | string, val: Blob | string): void {
    using(this.getBinder(param), (binder) => {
      let base64Str: string;
      if (typeof(val) === "string")
        base64Str = val;
      else
        base64Str = val.base64;

      binder.bindBlob(base64Str);
    });
  }

  /** Binds a boolean value to the specified ECSQL parameter
   *  @param param Index (1-based) or name of the parameter
   *  @param val Boolean value
   */
  public bindBoolean(param: number | string, val: boolean): void {
    using(this.getBinder(param), (binder) => binder.bindBoolean(val));
  }

  /** Binds a DateTime value to the specified ECSQL parameter
   *  @param param Index (1-based) or name of the parameter
   *  @param val DateTime value, either passed as DateTime object or as ISO 8601 string
   */
  public bindDateTime(param: number | string, val: DateTime | string): void {
    using(this.getBinder(param), (binder) => {
      let isoString: string;
      if (typeof(val) === "string")
        isoString = val;
      else
        isoString = val.isoString;

      binder.bindDateTime(isoString);
    });
  }

  /** Binds a double value to the specified ECSQL parameter
   *  @param param Index (1-based) or name of the parameter
   *  @param val Double value
   */
  public bindDouble(param: number | string, val: number): void {
    using(this.getBinder(param), (binder) => binder.bindDouble(val));
  }

  /** Binds an Id value to the specified ECSQL parameter
   *  @param param Index (1-based) or name of the parameter
   *  @param val Id value
   */
  public bindId(param: number | string, val: Id64): void {
    using(this.getBinder(param), (binder) => binder.bindId(val.value));
   }

  /** Binds an integer value to the specified ECSQL parameter
   *  @param param Index (1-based) or name of the parameter
   *  @param val Integer value
   */
  public bindInt(param: number | string, val: number): void {
    using(this.getBinder(param), (binder) => binder.bindInt(val));
  }

  /** Binds an Point2d value to the specified ECSQL parameter
   *  @param param Index (1-based) or name of the parameter
   *  @param val Point2d value
   */
  public bindPoint2d(param: number | string, val: XAndY): void {
    using(this.getBinder(param), (binder) => binder.bindPoint2d(val.x, val.y));
  }

  /** Binds an Point3d value to the specified ECSQL parameter
   *  @param param Index (1-based) or name of the parameter
   *  @param val Point3d value
   */
  public bindPoint3d(param: number | string, val: XYAndZ): void {
    using(this.getBinder(param), (binder) => binder.bindPoint3d(val.x, val.y, val.z));
  }

  /** Binds an string to the specified ECSQL parameter
   *  @param param Index (1-based) or name of the parameter
   *  @param val String value
   */
  public bindString(param: number | string, val: string): void {
    using(this.getBinder(param), (binder) => binder.bindString(val));
  }

  /** Binds a navigation property value to the specified ECSQL parameter
   *  @param param Index (1-based) or name of the parameter
   *  @param val Navigation property value
   */
  public bindNavigation(param: number | string, val: NavigationBindingValue): void {
    using(this.getBinder(param), (binder) => binder.bindNavigation(val.id.value, val.relClassName, val.relClassTableSpace));
    }

  /** Binds a struct property value to the specified ECSQL parameter
   *  @param param Index (1-based) or name of the parameter
   *  @param val Struct value. The struct value is an object composed of pairs of a struct member property name and its value
   * (of one of the supported types)
   */
  public bindStruct(param: number | string, value: object): void {
    using(this.getBinder(param), (binder) => ECSqlBindingHelper.bindStruct(binder, value));
  }

  /** Binds a array value to the specified ECSQL parameter
   *  @param param Index (1-based) or name of the parameter
   *  @param val Array value. The array value is an array of values of the supported types
   */
  public bindArray(param: number | string, value: any[]): void {
    using(this.getBinder(param), (binder) => ECSqlBindingHelper.bindArray(binder, value));
  }

  /** Bind values to all parameters in the statement.
   * @param values The values to bind to the parameters. Pass an array if the parameters are positional.
   * Pass an object of the values keyed on the parameter name for named parameters
   * The values in either the array or object must match the respective types of the parameter. See the bindXXX
   * methods for each type.
   */
  public bindValues(values: any[] | object): void {
    if (Array.isArray(values)) {
      for (let i = 0; i < values.length; i++) {
        const paramIndex: number = i + 1;
        const paramValue: any = values[i];
        if (paramValue === undefined || paramValue === null)
          continue;

        using (this.getBinder(paramIndex),
          (binder) => ECSqlBindingHelper.bindValue(binder, paramValue));
      }
      return;
    }

    for (const entry of Object.entries(values)) {
        const paramName: string = entry[0];
        const paramValue: any = entry[1];
        if (paramValue === undefined || paramValue === null)
        continue;

        using (this.getBinder(paramName),
          (binder) => ECSqlBindingHelper.bindValue(binder, paramValue));
    }
  }

  private getBinder(param: string | number): AddonECSqlBinder {
    return this._stmt!.getBinder(param);
  }

  /** Clear any bindings that were previously set on this statement.
   * @throws IModelError in case of errors
   */
  public clearBindings(): void {
    const stat: DbResult = this._stmt!.clearBindings();
    if (stat !== DbResult.BE_SQLITE_OK)
      throw new IModelError(stat);
  }

  /** Step this statement to the next matching row. */
  public step(): DbResult {
    return this._stmt!.step();
  }

  /** Step this INSERT statement and returns status and the ECInstanceId of the newly
   * created instance.
   * @returns Returns the generated ECInstanceId in case of success and the status of the step
   * call.
   */
  public stepForInsert(): ECSqlInsertResult {
    const r: {status: DbResult, id: string} = this._stmt!.stepForInsert();
    if (r.status === DbResult.BE_SQLITE_DONE)
      return new ECSqlInsertResult(r.status, new Id64(r.id));

    return new ECSqlInsertResult(r.status);
  }

  /** Get the current row. */
  public getRow(): any {
    return JSON.parse(this._stmt!.getRow());
  }

  /** @hidden Needs to wait for respective add-on build before it can be used.
   * Get the current row.
   */
  public getRow_new(): any {
    const colCount: number = this._stmt!.getColumnCount();
    const row: object = {};
    const duplicatePropNames = new Map<string, number>();
    for (let i = 0; i < colCount; i++) {
      using (this._stmt!.getValue(i), (ecsqlValue) => {
        if (ecsqlValue.isNull())
          return;

        const propName: string = ECSqlValueHelper.determineResultRowPropertyName(duplicatePropNames, ecsqlValue);
        const val: any = ECSqlValueHelper.getValue(ecsqlValue);
        Object.defineProperty(row, propName, {enumerable: true, configurable: true, writable: true, value: val});
        });
      }

    return row;
    }

  /** Calls step when called as an iterator. */
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
  public [Symbol.iterator](): IterableIterator<any> {
    return this;
  }
}

class ECSqlBindingHelper {

  /** Binds the specified value to the specified binder
   * @param binder Parameter Binder to bind to
   * @param val Value to be bound. Must be of one of these types:
   *  null | undefined, boolean, number, string, DateTime, Blob, Id64, XY, XYZ, NavigationValue
   *  Objects of primitives, objects or arrays of any of the above types when binding structs
   *  Arrays of primitives or objects of any of the above when binding arrays
   * @throws IModelError in case of errors
   */
  public static bindValue(binder: AddonECSqlBinder, val: any): void {
    // returns undefined if val is no primitive and returns DbResult if it is primitive and a binding call was done
    const primStat: DbResult | undefined = ECSqlBindingHelper.tryBindPrimitiveTypes(binder, val);
    if (primStat !== undefined) {
      if (primStat !== DbResult.BE_SQLITE_OK)
        throw new IModelError(primStat);

      return;
    }

    if (Array.isArray(val)) {
      ECSqlBindingHelper.bindArray(binder, val);
      return;
    }

    if (typeof(val) === "object") {
      ECSqlBindingHelper.bindStruct(binder, val);
      return;
    }

    throw new Error(`Bound value is of an unsupported type: ${val}`);
  }

  /** Binds the specified primitive value to the specified binder
   * @param binder Parameter Binder to bind to
   * @param val Primitive value to be bound. Must be of one of these types:
   *  null | undefined, boolean, number, string, DateTime, Blob, Id64, XY, XYZ, NavigationValue
   * @throws [[IModelError]] in case of errors
   */
  public static bindPrimitive(binder: AddonECSqlBinder, val: any): void {
    const stat: DbResult | undefined = ECSqlBindingHelper.tryBindPrimitiveTypes(binder, val);
    if (stat === undefined)
      throw new IModelError(DbResult.BE_SQLITE_ERROR, `Binding value is of an unsupported primitive type: ${val}`);

    if (stat !== DbResult.BE_SQLITE_OK)
      throw new IModelError(stat);
  }

  /** Binds the specified object to the specified struct binder
   * @param binder Struct parameter binder to bind to
   * @param val Value to be bound. Must be an Object with members of the supported types
   * @throws [[IModelError]] in case of errors
   */
  public static bindStruct(binder: AddonECSqlBinder, val: object): void {
    if (val === null || val === undefined) {
      const stat: DbResult = binder.bindNull();
      if (stat !== DbResult.BE_SQLITE_OK)
        throw new IModelError(stat);

      return;
    }

    for (const member of Object.entries(val)) {
      const memberName: string = member[0];
      const memberVal: any = member[1];
      using (binder.bindMember(memberName),
        (memberBinder) => ECSqlBindingHelper.bindValue(memberBinder, memberVal));
      }
  }

  /** Binds the specified array to the specified array binder
   * @param binder Array parameter binder to bind to
   * @param val Value to be bound. Must be an Array with elements of the supported types
   * @throws [[IModelError]] in case of errors
   */
  public static bindArray(binder: AddonECSqlBinder, val: any[]): void {
    if (val === null || val === undefined) {
      const stat: DbResult = binder.bindNull();
      if (stat !== DbResult.BE_SQLITE_OK)
        throw new IModelError(stat);

      return;
    }

    for (const element of val) {
      using (binder.addArrayElement(),
        (elementBinder) => ECSqlBindingHelper.bindValue(elementBinder, element) );
      }
  }

  /** tries to interpret the passed value as known leaf types (primitives and navigation values).
   *  @returns Returns undefined if the value wasn't a primitive. DbResult if it was a primitive and was bound to the binder
   */
  private static tryBindPrimitiveTypes(binder: AddonECSqlBinder, val: any): DbResult | undefined {
    if (val === undefined || val === null)
      return binder.bindNull();

    if (typeof(val) === "number") {
      if (Number.isInteger(val))
        return binder.bindInt(val);

      return binder.bindDouble(val);
    }

    if (typeof(val) === "boolean")
      return binder.bindBoolean(val);

    if (typeof(val) === "string")
      return binder.bindString(val);

    assert(typeof(val) === "object");

    if (val instanceof Blob)
      return binder.bindBlob(val.base64);

    if (val instanceof DateTime)
      return binder.bindDateTime(val.isoString);

    if (val instanceof Id64)
      return binder.bindId(val.value);

    // check for XYZ before XY because XY derives from XYZ
    if (val instanceof XYZ)
      return binder.bindPoint3d(val.x, val.y, val.z);

    if (val instanceof XY)
      return binder.bindPoint2d(val.x, val.y);

    if (val instanceof NavigationBindingValue)
      return binder.bindNavigation(val.id.value, val.relClassName, val.relClassTableSpace);

    if (val instanceof NavigationValue)
      return binder.bindNavigation(val.id.value, val.relClassName);

    return undefined;
  }
}

class ECSqlValueHelper {

  public static getValue(ecsqlValue: AddonECSqlValue): any {
    if (ecsqlValue.isNull())
      return undefined;

    const dataType: ECSqlValueType = ecsqlValue.getColumnInfo().getType() as ECSqlValueType;
    switch (dataType) {
      case ECSqlValueType.Struct:
        return ECSqlValueHelper.getStructValue(ecsqlValue);

      case ECSqlValueType.Navigation:
      return ECSqlValueHelper.getNavigationValue(ecsqlValue);

      case ECSqlValueType.PrimitiveArray:
      case ECSqlValueType.StructArray:
      return ECSqlValueHelper.getArrayValue(ecsqlValue);

      default:
        return ECSqlValueHelper.getPrimitiveValue(ecsqlValue);
    }
  }

  public static determineResultRowPropertyName(duplicatePropNames: Map<string, number>, ecsqlValue: AddonECSqlValue): string {
    const colInfo: AddonECSqlColumnInfo = ecsqlValue.getColumnInfo();
    let propName: string;

    const colAccessString: string = colInfo.getAccessString();

    // only top-level system properties need to be treated separately. For other system properties
    // we need the full access string to be returned
    if (colInfo.isSystemProperty()) {
      if (colAccessString === "ECInstanceId")
        propName = ECJsNames.toJsName(ECSqlSystemProperty.ECInstanceId);
      else if (colAccessString === "ECClassId")
        propName = ECJsNames.toJsName(ECSqlSystemProperty.ECClassId);
      else if (colAccessString === "SourceECInstanceId")
        propName = ECJsNames.toJsName(ECSqlSystemProperty.SourceECInstanceId);
      else if (colAccessString === "TargetECInstanceId")
        propName = ECJsNames.toJsName(ECSqlSystemProperty.TargetECInstanceId);
      else if (colAccessString === "SourceECClassId")
        propName = ECJsNames.toJsName(ECSqlSystemProperty.SourceECClassId);
      else if (colAccessString === "TargetECClassId")
        propName = ECJsNames.toJsName(ECSqlSystemProperty.TargetECClassId);
      else {
        // now handle nested system props: output them with full access string, but
        // replace the system portion of it
        const accessStringTokens: string[] = colAccessString.split(".");
        const tokenCount: number = accessStringTokens.length;
        const leafToken: string = accessStringTokens[tokenCount - 1];
        propName = ECJsNames.toJsName(accessStringTokens[0] + ".");
        for (let j = 1; j < tokenCount - 1; j++) {
          propName += accessStringTokens[j] + ".";
        }

        if (leafToken === "Id")
          propName += ECJsNames.toJsName(ECSqlSystemProperty.NavigationId);
        else if (leafToken === "RelECClassId")
          propName += ECJsNames.toJsName(ECSqlSystemProperty.NavigationRelClassId);
        else if (leafToken === "X")
          propName += ECJsNames.toJsName(ECSqlSystemProperty.PointX);
        else if (leafToken === "Y")
          propName += ECJsNames.toJsName(ECSqlSystemProperty.PointY);
        else if (leafToken === "Z")
          propName += ECJsNames.toJsName(ECSqlSystemProperty.PointZ);
        else {
          assert(false, "Unhandled ECSQL system property type");
          throw new IModelError(BentleyStatus.ERROR, "Unhandled ECSQL system property: " + colInfo.getAccessString());
        }
      }
    } else
        propName = ECJsNames.toJsName(colAccessString);

    // now check duplicates. If there are, append a numeric suffix to the duplicates
    assert(propName !== undefined);
    let suffix: number | undefined = duplicatePropNames.get(propName);
    if (suffix === undefined)
      duplicatePropNames.set(propName, 0);
    else {
      suffix++;
      duplicatePropNames.set(propName, suffix);
      propName += "_" + suffix;
    }

    return propName;
  }

  private static getStructValue(ecsqlValue: AddonECSqlValue): any {
    if (ecsqlValue.isNull())
      return undefined;

    const structVal: object = {};
    using (ecsqlValue.getStructIterator(), (it) => {
      while (it.moveNext()) {
        using (it.getCurrent(), (memberECSqlVal) => {
        if (memberECSqlVal.isNull())
          return;

        assert(!memberECSqlVal.getColumnInfo().isGeneratedProperty());
        const memberName: string = ECJsNames.toJsName(memberECSqlVal.getColumnInfo().getPropertyName());
        const memberVal = ECSqlValueHelper.getValue(memberECSqlVal);
        Object.defineProperty(structVal, memberName, {
          enumerable: true,
          configurable: true,
          writable: true,
          value: memberVal});
        });
      }
    });
    return structVal;
  }

  private static getArrayValue(ecsqlValue: AddonECSqlValue): any {
    if (ecsqlValue.isNull())
      return undefined;

    const arrayVal: any[] = [];
    using (ecsqlValue.getArrayIterator(), (it) => {
      while (it.moveNext()) {
        using (it.getCurrent(), (memberECSqlVal) => {
        const memberVal = ECSqlValueHelper.getValue(memberECSqlVal);
        arrayVal.push(memberVal);
        });
      }
    });

    return arrayVal;
  }

  private static getNavigationValue(ecsqlValue: AddonECSqlValue): any {
    if (ecsqlValue.isNull())
      return undefined;

    const rawVal: {id: string, relClassName?: string} = ecsqlValue.getNavigation();
    return new NavigationValue(new Id64(rawVal.id), rawVal.relClassName);
  }

  private static getPrimitiveValue(ecsqlValue: AddonECSqlValue): any {
    if (ecsqlValue.isNull())
      return undefined;

    const colInfo: AddonECSqlColumnInfo = ecsqlValue.getColumnInfo();
    switch (colInfo.getType()) {
      case ECSqlValueType.Blob:
        return new Blob(ecsqlValue.getBlob());
      case ECSqlValueType.Boolean:
        return ecsqlValue.getBoolean();
      case ECSqlValueType.DateTime:
        return new DateTime(ecsqlValue.getDateTime());
      case ECSqlValueType.Double:
        return ecsqlValue.getDouble();
      case ECSqlValueType.Geometry:
        return JSON.parse(ecsqlValue.getGeometry());
      case ECSqlValueType.Id: {
        if (colInfo.isSystemProperty() && colInfo.getPropertyName().endsWith("ECClassId"))
          return ecsqlValue.getClassNameForClassId();

        return new Id64(ecsqlValue.getId());
      }
      case ECSqlValueType.Int:
        return ecsqlValue.getInt();
      case ECSqlValueType.Int64:
        return ecsqlValue.getInt64();
      case ECSqlValueType.Point2d: {
        const rawPoint: {x: number, y: number} = ecsqlValue.getPoint2d();
        return new Point2d(rawPoint.x, rawPoint.y);
      }
      case ECSqlValueType.Point3d: {
        const rawPoint: {x: number, y: number, z: number} = ecsqlValue.getPoint3d();
        return new Point3d(rawPoint.x, rawPoint.y, rawPoint.z);
      }
      case ECSqlValueType.String:
        return ecsqlValue.getString();
      default:
       throw new IModelError(DbResult.BE_SQLITE_ERROR, `Unsupported type ${ecsqlValue.getColumnInfo().getType()} of the ECSQL Value`);
    }
  }

  public static queryClassName(ecdb: ECDb, classId: Id64, tableSpace?: string): string {
    if (tableSpace === undefined)
      tableSpace = "main";

    return ecdb.withPreparedStatement("SELECT s.Name schemaName, c.Name className FROM [" + tableSpace
      + "].meta.ECSchemaDef s, JOIN [" + tableSpace + "].meta.ECClassDef c ON s.ECInstanceId=c.SchemaId WHERE c.ECInstanceId=?", (stmt) => {
      stmt.bindId(1, classId);
      if (stmt.step() !== DbResult.BE_SQLITE_ROW)
        throw new IModelError(DbResult.BE_SQLITE_ERROR, "No class found with ECClassId " + classId.value + " in table space " + tableSpace + ".");

      const row: any = stmt.getRow_new();
      return row.schemaName + "." + row.className;
    });
  }

}

export class CachedECSqlStatement {
  public statement: ECSqlStatement;
  public useCount: number;
}

export class ECSqlStatementCache {
  private statements: Map<string, CachedECSqlStatement> = new Map<string, CachedECSqlStatement>();
  public maxCount: number;

  constructor(maxCount: number = 20) {
    this.maxCount = maxCount;
  }
  public add(str: string, stmt: ECSqlStatement): void {

    assert(!stmt.isShared(), "when you add a statement to the cache, the cache takes ownership of it. You can't add a statement that is already being shared in some other way");
    assert(stmt.isPrepared(), "you must cache only cached statements.");

    const existing = this.statements.get(str);
    if (existing !== undefined) {
      assert(existing.useCount > 0, "you should only add a statement if all existing copies of it are in use.");
    }
    const cs = new CachedECSqlStatement();
    cs.statement = stmt;
    cs.statement.setIsShared(true);
    cs.useCount = 1;
    this.statements.set(str, cs);
  }

  public getCount(): number {
    return this.statements.size;
  }

  public find(str: string): CachedECSqlStatement | undefined {
    return this.statements.get(str);
  }

  public release(stmt: ECSqlStatement): void {
    for (const cs of this.statements) {
      const css = cs[1];
      if (css.statement === stmt) {
        if (css.useCount > 0) {
          css.useCount--;
          if (css.useCount === 0) {
            css.statement.reset();
            css.statement.clearBindings();
          }
        } else {
          assert(false, "double-release of cached statement");
        }
        // leave the statement in the cache, even if its use count goes to zero. See removeUnusedStatements and clearOnClose.
        // *** TODO: we should remove it if it is a duplicate of another unused statement in the cache. The trouble is that we don't have the ecsql for the statement,
        //           so we can't check for other equivalent statements.
        break;
      }
    }
  }

  public removeUnusedStatementsIfNecessary(): void {
    if (this.getCount() <= this.maxCount)
      return;

    const keysToRemove = [];
    for (const cs of this.statements) {
      const css = cs[1];
      assert(css.statement.isShared());
      assert(css.statement.isPrepared());
      if (css.useCount === 0) {
        css.statement.setIsShared(false);
        css.statement.dispose();
        keysToRemove.push(cs[0]);
        if (keysToRemove.length >= this.maxCount)
          break;
      }
    }
    for (const k of keysToRemove) {
      this.statements.delete(k);
    }
  }

  public clearOnClose() {
    for (const cs of this.statements) {
      assert(cs[1].useCount === 0, "statement was never released: " + cs[0]);
      assert(cs[1].statement.isShared());
      assert(cs[1].statement.isPrepared());
      const stmt = cs[1].statement;
      if (stmt !== undefined) {
        stmt.setIsShared(false);
        stmt.dispose();
      }
    }
    this.statements.clear();
  }
}
