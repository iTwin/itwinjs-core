/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
/** @packageDocumentation
 * @module Codes
 */

import { DbResult, Id64, Id64String, IModelStatus } from "@itwin/core-bentley";
import { CodeScopeSpec, CodeSpec, IModelError } from "@itwin/core-common";
import { ECSqlStatement } from "./ECSqlStatement";
import { IModelDb } from "./IModelDb";

/** Manages [CodeSpecs]($docs/BIS/intro/element-fundamentals.md#codespec) within an [[IModelDb]]
 * @public
 */
export class CodeSpecs {
  private _imodel: IModelDb;
  private _loadedCodeSpecs: CodeSpec[] = [];

  constructor(imodel: IModelDb) {
    this._imodel = imodel;
    if (imodel.isBriefcaseDb()) {
      imodel.onChangesetApplied.addListener(() => this._loadedCodeSpecs.length = 0);
    }
  }

  /** Look up the Id of the CodeSpec with the specified name. */
  public queryId(name: string): Id64String {
    return this._imodel.withPreparedStatement("SELECT ECInstanceId FROM BisCore.CodeSpec WHERE Name=:name", (stmt: ECSqlStatement) => {
      stmt.bindString("name", name);
      if (DbResult.BE_SQLITE_ROW !== stmt.step())
        throw new IModelError(IModelStatus.NotFound, "CodeSpec not found", () => ({ name }));
      return stmt.getValue(0).getId();
    });
  }

  /** Look up a CodeSpec by Id. The CodeSpec will be loaded from the database if necessary.
   * @param codeSpecId The Id of the CodeSpec to load
   * @returns The CodeSpec with the specified Id
   * @throws [[IModelError]] if the Id is invalid or if no CodeSpec with that Id could be found.
   */
  public getById(codeSpecId: Id64String): CodeSpec {
    if (Id64.isInvalid(codeSpecId))
      throw new IModelError(IModelStatus.InvalidId, "Invalid codeSpecId");

    // good chance it is already loaded - check there before running a query
    const found: CodeSpec | undefined = this._loadedCodeSpecs.find((codeSpec) => codeSpec.id === codeSpecId);
    if (found !== undefined)
      return found;

    // must load this codespec
    const loadedCodeSpec = this.load(codeSpecId);
    this._loadedCodeSpecs.push(loadedCodeSpec);
    return loadedCodeSpec;
  }

  /** Returns true if the IModelDb has a CodeSpec of the specified Id. */
  public hasId(codeSpecId: Id64String): boolean {
    try {
      return undefined !== this.getById(codeSpecId);
    } catch (error) {
      return false;
    }
  }

  /** Look up a CodeSpec by name. The CodeSpec will be loaded from the database if necessary.
   * @param name The name of the CodeSpec to load
   * @returns The CodeSpec with the specified name
   * @throws [[IModelError]] if no CodeSpec with the specified name could be found.
   */
  public getByName(name: string): CodeSpec {
    // good chance it is already loaded - check there before running a query
    const found: CodeSpec | undefined = this._loadedCodeSpecs.find((codeSpec) => codeSpec.name === name);
    if (found !== undefined)
      return found;
    const codeSpecId = this.queryId(name);
    if (codeSpecId === undefined)
      throw new IModelError(IModelStatus.NotFound, "CodeSpec not found", () => ({ name }));
    return this.getById(codeSpecId);
  }

  /** Returns true if the IModelDb has a CodeSpec of the specified name. */
  public hasName(name: string): boolean {
    try {
      return undefined !== this.getByName(name);
    } catch (error) {
      return false;
    }
  }

  /** Add a new CodeSpec to the iModel.
   * @param codeSpec The CodeSpec to insert
   * @returns The Id of the persistent CodeSpec.
   * @note If successful, this method will assign a valid CodeSpecId to the supplied CodeSpec
   * @throws IModelError if the insertion fails
   */
  public insert(codeSpec: CodeSpec): Id64String;
  /** Add a new CodeSpec to the IModelDb.
   * @param name The name for the new CodeSpec.
   * @param scopeType The scope type
   * @returns The Id of the persistent CodeSpec.
   * @throws IModelError if the insertion fails
   */
  public insert(name: string, scopeType: CodeScopeSpec.Type): Id64String;
  public insert(codeSpecOrName: CodeSpec | string, scopeType?: CodeScopeSpec.Type): Id64String {
    if (codeSpecOrName instanceof CodeSpec) {
      const codeSpec = codeSpecOrName;
      const id: Id64String = this._imodel.insertCodeSpec(codeSpec);
      codeSpec.id = id;
      return id;
    }
    if (typeof codeSpecOrName === "string") {
      const name = codeSpecOrName;
      if (scopeType)
        return this._imodel.insertCodeSpec(CodeSpec.create(this._imodel, name, scopeType));
    }
    throw new IModelError(IModelStatus.BadArg, "Invalid argument");
  }

  /** Load a CodeSpec from the iModel
   * @param id  The persistent Id of the CodeSpec to load
   */
  public load(id: Id64String): CodeSpec {
    if (Id64.isInvalid(id))
      throw new IModelError(IModelStatus.InvalidId, "Invalid codeSpecId");

    return this._imodel.withPreparedStatement("SELECT name,jsonProperties FROM BisCore.CodeSpec WHERE ECInstanceId=?", (stmt: ECSqlStatement) => {
      stmt.bindId(1, id);
      if (DbResult.BE_SQLITE_ROW !== stmt.step())
        throw new IModelError(IModelStatus.InvalidId, "Invalid codeSpecId");

      const row: any = stmt.getRow();
      return CodeSpec.createFromJson(this._imodel, id, row.name, JSON.parse(row.jsonProperties));
    });
  }
}
