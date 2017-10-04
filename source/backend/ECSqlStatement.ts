/*---------------------------------------------------------------------------------------------
|  $Copyright: (c) 2017 Bentley Systems, Incorporated. All rights reserved. $
 *--------------------------------------------------------------------------------------------*/
import { MultiTierExecutionHost, RunsIn, Tier } from "@bentley/bentleyjs-core/lib/tiering";
import { DbResult } from "@bentley/bentleyjs-core/lib/BeSQLite";
import { IModelError } from "../IModelError";
import { BindingUtility, BindingValue } from "./BindingUtility";
import { assert } from "@bentley/bentleyjs-core/lib/Assert";

declare function require(arg: string): any;
// tslint:disable-next-line:no-var-requires
const addonLoader = require("../../scripts/addonLoader");
let dgnDbNodeAddon: any | undefined;
if (addonLoader !== undefined)
  dgnDbNodeAddon = addonLoader.loadNodeAddon(); // Note that evaluating this script has the side-effect of loading the addon

@MultiTierExecutionHost("@bentley/imodeljs-core/ECSqlStatement")
export class ECSqlStatement implements IterableIterator<any> {
  private _stmt: any | undefined;
  private _isShared: boolean = false;

  public setIsShared(b: boolean) {
    this._isShared = b;
  }

  public isShared(): boolean {
    assert(!this._isShared || this.isPrepared(), "a shared statement must always be in the prepared state");
    return this._isShared;
  }

  public isPrepared(): boolean {
    return this._stmt !== undefined;
  }

  @RunsIn(Tier.Services)
  public prepare(db: any, ecsqlStatement: string): void {
    if (this.isPrepared())
      throw new Error("statement is already prepared");
    this._stmt = new dgnDbNodeAddon.ECSqlStatement();
    const error = this._stmt.prepare(db, ecsqlStatement);
    if (error !== undefined)
      throw new IModelError(error.status, error.message);
  }

  @RunsIn(Tier.Services)
  public reset(): DbResult {
    return this._stmt.reset();
  }

  @RunsIn(Tier.Services)
  public dispose(): void {
    if (this.isShared())
      throw new Error("you can't dispose a statement that is shared with others (e.g., in a cache)");
    if (!this.isPrepared())
      return;
    this._stmt.dispose(); // Tell the peer JS object to free its native resources immediately
    this._stmt = undefined; // discard the peer JS object as garbage

    assert(!this.isPrepared()); // leaves the statement in the un-prepared state
  }

  @RunsIn(Tier.Services)
  public clearBindings(): DbResult {
    return this._stmt.clearBindings();
  }

  @RunsIn(Tier.Services)
  public bindValues(bindings: BindingValue[]| Map<string, BindingValue>| any): void {
    const { error, result: ecBindings } = BindingUtility.preProcessBindings(bindings);
    if (error)
      throw new IModelError(error.status, error.message);
    const bindingsStr = JSON.stringify(ecBindings);
    const nativeerror = this._stmt.bindValues(bindingsStr);
    if (nativeerror !== undefined)
      throw new IModelError(nativeerror.status, nativeerror.message);
  }

  @RunsIn(Tier.Services)
  public step(): DbResult {
    return this._stmt.step();
  }

  @RunsIn(Tier.Services)
  public getValues(): any {
    return this._stmt.getValues();
  }

  public next(): IteratorResult<any> {
    if (DbResult.BE_SQLITE_ROW === this.step()) {
      return {
        done: false,
        value: this.getValues(),
      };
    } else {
      return {
        done: true,
        value: undefined,
      };
    }
  }

  public [Symbol.iterator](): IterableIterator<any> {
    return this;
  }

}
