/*---------------------------------------------------------------------------------------------
|  $Copyright: (c) 2018 Bentley Systems, Incorporated. All rights reserved. $
 *--------------------------------------------------------------------------------------------*/
import { assert } from "@bentley/bentleyjs-core/lib/Assert";
import { DbResult } from "@bentley/bentleyjs-core/lib/BeSQLite";
import { IModelError } from "../common/IModelError";
import { Id64 } from "@bentley/bentleyjs-core/lib/Id";
import { XAndY, XY, XYAndZ, XYZ } from "@bentley/geometry-core/lib/PointVector";
import { BindingUtility, BindingValue } from "./BindingUtility";
import { using, IDisposable } from "@bentley/bentleyjs-core/lib/Disposable";
import { NodeAddonRegistry } from "./NodeAddonRegistry";
import { NodeAddonECSqlStatement, NodeAddonECSqlBinder, NodeAddonECDb, NodeAddonDgnDb } from "@bentley/imodeljs-nodeaddonapi/imodeljs-nodeaddonapi";
import { StatusCodeWithMessage } from "@bentley/bentleyjs-core/lib/BentleyError";

export class DateTime {
  public constructor(public isoString: string) {}
}
export class Int64 {
  public constructor(public value: string | number) {}
}
export class Blob {
  public constructor(public base64: string) {}
}

/** An ECSql Statement. A statement must be prepared before it can be executed. See prepare. A statement may contain placeholders that must be filled
 * in before use. See bindValues. A prepared statement can be stepped through all matching rows by calling step. ECSqlStatement is-a iterator, so that you
 * can step through its results by using standard iteration syntax, such as "for in".
 */
export class ECSqlStatement implements IterableIterator<any>, IDisposable {
  private _stmt: NodeAddonECSqlStatement | undefined;
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
   * @throws IModelError if the statement cannot be prepared. Normally, prepare fails due to ECSql syntax errors or references to tables or properties that do not exist. The error.message property will describe the property.
   */
  public prepare(db: NodeAddonDgnDb | NodeAddonECDb, statement: string): void {
    if (this.isPrepared())
      throw new Error("statement is already prepared");
    this._stmt = new (NodeAddonRegistry.getAddon()).NodeAddonECSqlStatement();
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

  public bindNull(param: number | string): void {
    using(this.getBinder(param), (binder) => binder.bindNull());
  }

  public bindBlob(param: number | string, val: Blob): void {
    using(this.getBinder(param), (binder) => binder.bindBlob(val.base64));
  }

  public bindBoolean(param: number | string, val: boolean): void {
    using(this.getBinder(param), (binder) => binder.bindBoolean(val));
  }

  public bindDateTime(param: number | string, val: DateTime): void {
    using(this.getBinder(param), (binder) => binder.bindDateTime(val.isoString));
  }

  public bindDouble(param: number | string, val: number): void {
    using(this.getBinder(param), (binder) => binder.bindDouble(val));
  }

  public bindId(param: number | string, val: Id64): void {
    using(this.getBinder(param), (binder) => binder.bindId(val.value));
   }

  public bindInt(param: number | string, val: number): void {
    using(this.getBinder(param), (binder) => binder.bindInt(val));
  }

  public bindInt64(param: number | string, val: Int64): void {
    using(this.getBinder(param), (binder) => binder.bindInt64(val.value));
  }

  public bindPoint2d(param: number | string, val: XAndY): void {
    using(this.getBinder(param), (binder) => binder.bindPoint2d(val.x, val.y));
  }

  public bindPoint3d(param: number | string, val: XYAndZ): void {
    using(this.getBinder(param), (binder) => binder.bindPoint3d(val.x, val.y, val.z));
  }

  public bindString(param: number | string, val: string): void {
    using(this.getBinder(param), (binder) => binder.bindString(val));
  }

  public bindNavigation(param: number | string, navId: Id64, relClassName?: string, relClassTableSpace?: string): void {
    using(this.getBinder(param), (binder) => binder.bindNavigation(navId.value, relClassName, relClassTableSpace));
    }

  public bindStruct(param: number | string, value: object): void {
    using(this.getBinder(param), (binder) => ECSqlBindingHelper.bindStruct(binder, value));
  }

  public bindArray(param: number | string, value: any[]): void {
    using(this.getBinder(param), (binder) => ECSqlBindingHelper.bindArray(binder, value));
  }

  private getBinder(param: string | number): NodeAddonECSqlBinder {
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

  /** Bind values to placeholders.
   * @param bindings  The values to set for placeholders. Pass an array if the placeholders are positional. Pass an 'any' object
   * for named placeholders, where the properties of the object match the names of the placeholders in the statement.
   * @throws IModelError in case the binding fails. This will normally happen only if the type of a value does not match and cannot be converted to the type required for the corresponding property in the statement.
   */
  public bindValues(bindings: BindingValue[] | Map<string, BindingValue> | any): void {
    const ecBindings = BindingUtility.preProcessBindings(bindings);
    const bindingsStr = JSON.stringify(ecBindings);
    const nativeError = this._stmt!.bindValues(bindingsStr);
    if (nativeError.status !== DbResult.BE_SQLITE_OK)
      throw new IModelError(nativeError.status, nativeError.message);
  }

  /** Step this statement to the next matching row. */
  public step(): DbResult {
    return this._stmt!.step();
  }

  /** Get the current row. */
  public getRow(): any {
    return JSON.parse(this._stmt!.getRow());
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

  public static bindValue(binder: NodeAddonECSqlBinder, val: any): void {
    if (val == null) {
      binder.bindNull();
      return;
    }

    if (ECSqlBindingHelper.tryBindPrimitive(binder, val))
      return;

    if (typeof(val) === "object") {
      ECSqlBindingHelper.bindStruct(binder, val);
      return;
    }

    if (Array.isArray(val)) {
      ECSqlBindingHelper.bindArray(binder, val);
      return;
    }

    throw new Error(`Bound value is of an unsupported type: ${val}`);
  }

  public static bindPrimitive(binder: NodeAddonECSqlBinder, val: any): void {
    const isPrimitive: boolean = ECSqlBindingHelper.tryBindPrimitive(binder, val);
    if (!isPrimitive)
      throw new Error(`Binding value is of an unsupported primitive type: ${val}`);
  }

  public static bindStruct(binder: NodeAddonECSqlBinder, val: object): void {
    if (val == null) {
      binder.bindNull();
      return;
    }

    for (const member of Object.entries(val)) {
      const memberName: string = member[0];

      const memberBinder: NodeAddonECSqlBinder = binder.bindMember(memberName);
      const memberVal: any = member[1];
      ECSqlBindingHelper.bindValue(memberBinder, memberVal);
    }
  }

  public static bindArray(binder: NodeAddonECSqlBinder, val: any[]): void {
    if (val == null) {
      binder.bindNull();
      return;
    }

    for (const element of val) {
      const elementBinder: NodeAddonECSqlBinder = binder.addArrayElement();
      ECSqlBindingHelper.bindValue(elementBinder, element);
      }
  }

  private static tryBindPrimitive(binder: NodeAddonECSqlBinder, val: any): boolean {
    if (val == null) {
      binder.bindNull();
      return true;
    }

    if (typeof(val) === "number") {
      if (Number.isInteger(val))
        binder.bindInt(val);
      else
        binder.bindDouble(val);

      return true;
    }

    if (typeof(val) === "boolean") {
      binder.bindBoolean(val);
      return true;
    }

    if (typeof(val) === "string") {
      binder.bindString(val);
      return true;
    }

    assert(typeof(val) === "object");

    if (val instanceof Blob) {
      binder.bindBlob(val.base64);
      return true;
    }

    if (val instanceof DateTime) {
      binder.bindDateTime(val.isoString);
      return true;
    }

    if (val instanceof Id64) {
      binder.bindId(val.value);
      return true;
    }

    if (val instanceof Int64) {
      binder.bindInt64(val.value);
      return true;
    }

    if (val instanceof XY) {
      binder.bindPoint2d(val.x, val.y);
      return true;
    }
    if (val instanceof XYZ) {
      binder.bindPoint3d(val.x, val.y, val.z);
      return true;
    }

    return false;
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
