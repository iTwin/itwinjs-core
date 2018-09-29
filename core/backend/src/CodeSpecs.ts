/*---------------------------------------------------------------------------------------------
* Copyright (c) 2018 - present Bentley Systems, Incorporated. All rights reserved.
* Licensed under the MIT License. See LICENSE.md in the project root for license terms.
*--------------------------------------------------------------------------------------------*/
/** @module Codes */

import { DbResult, Id64 } from "@bentley/bentleyjs-core";
import { IModelError, IModelStatus, CodeSpec } from "@bentley/imodeljs-common";
import { ECSqlStatement } from "./ECSqlStatement";
import { IModelDb } from "./IModelDb";

/** Manages [CodeSpecs]($docs/BIS/intro/element-fundamentals.md#codespec) within an [[IModelDb]] */
export class CodeSpecs {
  private _imodel: IModelDb;
  private _loadedCodeSpecs: CodeSpec[] = [];

  constructor(imodel: IModelDb) {
    this._imodel = imodel;
    imodel.onChangesetApplied.addListener(() => this._loadedCodeSpecs.length = 0);
  }

  /** Look up the Id of the CodeSpec with the specified name. */
  public queryId(name: string): Id64 {
    return this._imodel.withPreparedStatement("SELECT ECInstanceId as id FROM BisCore.CodeSpec WHERE Name=?", (stmt: ECSqlStatement) => {
      stmt.bindString(1, name);
      if (DbResult.BE_SQLITE_ROW !== stmt.step())
        throw new IModelError(IModelStatus.NotFound);
      return new Id64(stmt.getRow().id);
    });
  }

  /** Look up a CodeSpec by Id. The CodeSpec will be loaded from the database if necessary.
   * @param codeSpecId The Id of the CodeSpec to load
   * @returns The CodeSpec with the specified Id
   * @throws [[IModelError]] if the Id is invalid or if no CodeSpec with that Id could be found.
   */
  public getById(codeSpecId: Id64): CodeSpec {
    if (!codeSpecId.isValid)
      throw new IModelError(IModelStatus.InvalidId);

    // good chance it is already loaded - check there before running a query
    const found: CodeSpec | undefined = this._loadedCodeSpecs.find((codeSpec: CodeSpec) => {
      return codeSpec.id === codeSpecId;
    });
    if (found !== undefined)
      return found;

    // must load this codespec
    const loadedCodeSpec = this.load(codeSpecId);
    this._loadedCodeSpecs.push(loadedCodeSpec);
    return loadedCodeSpec;
  }

  /** Look up a CodeSpec by name. The CodeSpec will be loaded from the database if necessary.
   * @param name The name of the CodeSpec to load
   * @returns The CodeSpec with the specified name
   * @throws [[IModelError]] if no CodeSpec with the specified name could be found.
   */
  public getByName(name: string): CodeSpec {
    // good chance it is already loaded - check there before running a query
    const found: CodeSpec | undefined = this._loadedCodeSpecs.find((codeSpec: CodeSpec) => {
      return codeSpec.name === name;
    });
    if (found !== undefined)
      return found;
    const codeSpecId = this.queryId(name);
    if (codeSpecId === undefined)
      throw new IModelError(IModelStatus.NotFound);
    return this.getById(codeSpecId);
  }

  /** Add a new CodeSpec to the IModelDb.
   * <p><em>Example:</em>
   * ``` ts
   * [[include:CodeSpecs.insert]]
   * ```
   * @param  codeSpec The new entry to add.
   * @return The id of the persistent CodeSpec.
   * @note If successful, this method will assign a valid CodeSpecId to the supplied CodeSpec
   * @throws IModelError if the insertion fails
   */
  public insert(codeSpec: CodeSpec): Id64 {
    const id: Id64 = this._imodel.insertCodeSpec(codeSpec);
    codeSpec.id = id;
    return id;
  }

  /** Load a CodeSpec from IModel
   * @param id  The persistent Id of the CodeSpec to load
   */
  public load(id: Id64): CodeSpec {
    if (!id.isValid) {
      throw new IModelError(IModelStatus.InvalidId);
    }

    return this._imodel.withPreparedStatement("SELECT name,jsonProperties FROM BisCore.CodeSpec WHERE ECInstanceId=?", (stmt: ECSqlStatement) => {
      stmt.bindId(1, id);
      if (DbResult.BE_SQLITE_ROW !== stmt.step())
        throw new IModelError(IModelStatus.InvalidId);

      const row: any = stmt.getRow();
      return new CodeSpec(this._imodel, id, row.name, JSON.parse(row.jsonProperties));
    });
  }

}
