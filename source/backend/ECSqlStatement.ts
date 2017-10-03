/*---------------------------------------------------------------------------------------------
|  $Copyright: (c) 2017 Bentley Systems, Incorporated. All rights reserved. $
 *--------------------------------------------------------------------------------------------*/
import { MultiTierExecutionHost, RunsIn, Tier } from "@bentley/bentleyjs-core/lib/tiering";
import { DbResult } from "@bentley/bentleyjs-core/lib/BeSQLite";
import { IModelError } from "../IModelError";
import { BindingUtility, BindingValue } from "./BindingUtility";

declare function require(arg: string): any;
// tslint:disable-next-line:no-var-requires
const addonLoader = require("../../scripts/addonLoader");
let dgnDbNodeAddon: any | undefined;
if (addonLoader !== undefined)
  dgnDbNodeAddon = addonLoader.loadNodeAddon(); // Note that evaluating this script has the side-effect of loading the addon

@MultiTierExecutionHost("@bentley/imodeljs-core/ECSqlStatement")
export class ECSqlStatement {
  private stmt: any;

  constructor() {
    this.stmt = new dgnDbNodeAddon.ECSqlStatement();
  }

  @RunsIn(Tier.Services)
  public prepare(db: any, ecsqlStatement: string): void {
    const error = this.stmt.prepare(db, ecsqlStatement);
    if (error !== undefined)
      throw new IModelError(error.status, error.message);
  }

  @RunsIn(Tier.Services)
  public reset(): DbResult {
    return this.stmt.reset();
  }

  @RunsIn(Tier.Services)
  public dispose(): void {
    const stmt = this.stmt;
    this.stmt = undefined;
    stmt.dispose();
  }

  @RunsIn(Tier.Services)
  public clearBindings(): DbResult {
    return this.stmt.clearBindings();
  }

  @RunsIn(Tier.Services)
  public bindValues(bindings: BindingValue[]| Map<string, BindingValue>| any): void {
    const { error, result: ecBindings } = BindingUtility.preProcessBindings(bindings);
    if (error)
      throw new IModelError(error.status, error.message);
    const bindingsStr = JSON.stringify(ecBindings);
    const nativeerror = this.stmt.bindValues(bindingsStr);
    if (nativeerror !== undefined)
      throw new IModelError(nativeerror.status, nativeerror.message);
  }

  @RunsIn(Tier.Services)
  public step(): DbResult {
    return this.stmt.step();
  }

  @RunsIn(Tier.Services)
  public getValues(): any {
    return this.stmt.getValues();
  }
}
