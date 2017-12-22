/*---------------------------------------------------------------------------------------------
|  $Copyright: (c) 2017 Bentley Systems, Incorporated. All rights reserved. $
 *--------------------------------------------------------------------------------------------*/
import { assert } from "@bentley/bentleyjs-core/lib/Assert";
import { DbResult } from "@bentley/bentleyjs-core/lib/BeSQLite";
import { IModelError } from "../common/IModelError";
import { BindingUtility, BindingValue } from "./BindingUtility";
import { NodeAddonRegistry } from "./NodeAddonRegistry";
import { NodeAddonECSqlStatement, NodeAddonDgnDb } from "@bentley/imodeljs-nodeaddonapi/imodeljs-nodeaddonapi";

/** An ECSql Statement. A statement must be prepared before it can be executed. See prepare. A statement may contain placeholders that must be filled
 * in before use. See bindValues. A prepared statement can be stepped through all matching rows by calling step. ECSqlStatement is-a iterator, so that you
 * can step through its results by using standard iteration syntax, such as "for in".
 */
export class ECSqlStatement implements IterableIterator<any> {
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
  public prepare(db: NodeAddonDgnDb, statement: string): void {
    if (this.isPrepared())
      throw new Error("statement is already prepared");
    this._stmt = new (NodeAddonRegistry.getAddon()).NodeAddonECSqlStatement();
    const error = this._stmt!.prepare(db, statement);
    if (error.status !== DbResult.BE_SQLITE_OK)
      throw new IModelError(error.status, error.message);
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

  /** Clear any bindings that were previously set on this statement. */
  public clearBindings(): DbResult {
    return this._stmt!.clearBindings();
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
