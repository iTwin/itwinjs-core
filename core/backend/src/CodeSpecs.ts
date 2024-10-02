/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
/** @packageDocumentation
 * @module Codes
 */

import { BentleyError, DbResult, Id64, Id64String, IModelStatus } from "@itwin/core-bentley";
import { CodeScopeSpec, CodeSpec, CodeSpecProperties, IModelError } from "@itwin/core-common";
import { IModelDb } from "./IModelDb";
import { CodeService } from "./CodeService";

/** Manages [CodeSpecs]($docs/BIS/guide/fundamentals/element-fundamentals.md#codespec) within an [[IModelDb]]
 * @public
 */
export class CodeSpecs {
  private static tableName = "bis_CodeSpec";
  private _imodel: IModelDb;
  private _loadedCodeSpecs: CodeSpec[] = [];

  constructor(imodel: IModelDb) {
    this._imodel = imodel;
    if (imodel.isBriefcaseDb()) {
      imodel.onChangesetApplied.addListener(() => this._loadedCodeSpecs.length = 0);
    }
  }

  private findByName(name: string): Id64String | undefined {
    return this._imodel.withSqliteStatement(`SELECT Id FROM ${CodeSpecs.tableName} WHERE Name=?`, (stmt) => {
      stmt.bindString(1, name);
      return stmt.nextRow() ? stmt.getValueId(0) : undefined;
    });
  }

  /** Look up the Id of the CodeSpec with the specified name. */
  public queryId(name: string): Id64String {
    const id = this.findByName(name);
    if (!id)
      throw new IModelError(IModelStatus.NotFound, "CodeSpec not found");
    return id;
  }

  /** Look up a CodeSpec by Id. The CodeSpec will be loaded from the database if necessary.
   * @param codeSpecId The Id of the CodeSpec to load
   * @returns The CodeSpec with the specified Id
   * @throws [[IModelError]] if the Id is invalid or if no CodeSpec with that Id could be found.
   */
  public getById(codeSpecId: Id64String): CodeSpec {
    // good chance it is already loaded - check there before running a query
    const found = this._loadedCodeSpecs.find((codeSpec) => codeSpec.id === codeSpecId);
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
    } catch {
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
    const found = this._loadedCodeSpecs.find((codeSpec) => codeSpec.name === name);
    if (found !== undefined)
      return found;
    const codeSpecId = this.queryId(name);
    if (codeSpecId === undefined)
      throw new IModelError(IModelStatus.NotFound, "CodeSpec not found");
    return this.getById(codeSpecId);
  }

  /** Returns true if the IModelDb has a CodeSpec of the specified name. */
  public hasName(name: string): boolean {
    try {
      return undefined !== this.getByName(name);
    } catch {
      return false;
    }
  }

  private insertCodeSpec(specName: string, properties: CodeSpecProperties): Id64String {
    const iModel = this._imodel;
    const spec: CodeService.BisCodeSpecIndexProps = { name: specName.trim(), props: JSON.stringify(properties) };
    if (this.findByName(spec.name))
      throw new IModelError(IModelStatus.DuplicateName, "CodeSpec already exists");

    const internalCodes = iModel.codeService?.internalCodes;
    if (internalCodes) {
      // Since there is no lock on the codespec table, to add a codespec to an iModel it must first be reserved in the
      // internal code index via `internalCodes.reserveBisCodeSpecs` prior to calling this function.
      // This ensures that the Ids will be unique, and the property values consistent, even if more than one user
      // adds them without pushing their changes. The call to `verifyBisCodeSpec` will throw otherwise.
      internalCodes.reader.verifyBisCodeSpec(spec);
    } else {
      // If this iModel doesn't have an internal code index, we have no way of coordinating the Ids for CodeSpecs across multiple users.
      // Just look in this briefcase to find the currently highest used Id and hope for the best.
      spec.id = iModel.withSqliteStatement(`SELECT MAX(Id) FROM ${CodeSpecs.tableName}`, (stmt) => stmt.nextRow() ? stmt.getValueInteger(0) + 1 : 1);
    }

    const id = spec.id!; // eslint-disable-line @typescript-eslint/no-non-null-assertion
    iModel.withSqliteStatement(`INSERT INTO ${CodeSpecs.tableName}(Id,Name,JsonProperties) VALUES(?,?,?)`, (stmt) => {
      stmt.bindInteger(1, id);
      stmt.bindString(2, spec.name);
      stmt.bindString(3, spec.props);
      const rc = stmt.step();
      if (rc !== DbResult.BE_SQLITE_DONE)
        throw new BentleyError(rc, "Error inserting codeSpec");
    });

    return Id64.fromLocalAndBriefcaseIds(id, 0);
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
   * @param properties The properties or the CodeSpec. For backwards compatibility this may also be a `CodeScopeSpec.Type`.
   * @returns The Id of the persistent CodeSpec.
   * @throws IModelError if the insertion fails
   */
  public insert(name: string, properties: CodeSpecProperties | CodeScopeSpec.Type): Id64String;
  public insert(codeSpecOrName: CodeSpec | string, props?: CodeSpecProperties | CodeScopeSpec.Type): Id64String {
    if (codeSpecOrName instanceof CodeSpec) {
      const id = this.insertCodeSpec(codeSpecOrName.name, codeSpecOrName.properties);
      codeSpecOrName.id = id;
      return id;
    }
    if (props === undefined)
      throw new IModelError(IModelStatus.BadArg, "Invalid argument");

    if (typeof props === "object")
      return this.insertCodeSpec(codeSpecOrName, props);

    const spec = CodeSpec.create(this._imodel, codeSpecOrName, props);
    return this.insertCodeSpec(spec.name, spec.properties);
  }

  /** Update the Json properties of an existing CodeSpec.
 * @param codeSpec The codeSpec holding Json properties values to update
 * @throws if unable to update the codeSpec.
 */
  public updateProperties(codeSpec: CodeSpec): void {
    this._imodel.withSqliteStatement(`UPDATE ${CodeSpecs.tableName} SET JsonProperties=? WHERE Id=?`, (stmt) => {
      stmt.bindString(1, JSON.stringify(codeSpec.properties));
      stmt.bindId(2, codeSpec.id);
      if (DbResult.BE_SQLITE_DONE !== stmt.step())
        throw new IModelError(IModelStatus.BadArg, "error updating CodeSpec properties");
    });
  }

  /** Load a CodeSpec from the iModel
   * @param id  The persistent Id of the CodeSpec to load
   */
  public load(id: Id64String): CodeSpec {
    if (Id64.isInvalid(id))
      throw new IModelError(IModelStatus.InvalidId, "Invalid codeSpecId");

    return this._imodel.withSqliteStatement(`SELECT Name,JsonProperties FROM ${CodeSpecs.tableName} WHERE Id=?`, (stmt) => {
      stmt.bindId(1, id);
      if (!stmt.nextRow())
        throw new IModelError(IModelStatus.InvalidId, "CodeSpec not found");

      return CodeSpec.createFromJson(this._imodel, id, stmt.getValueString(0), JSON.parse(stmt.getValueString(1)));
    });
  }
}
