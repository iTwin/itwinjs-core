/*---------------------------------------------------------------------------------------------
|  $Copyright: (c) 2017 Bentley Systems, Incorporated. All rights reserved. $
 *--------------------------------------------------------------------------------------------*/
import { DbResult, OpenMode } from "@bentley/bentleyjs-core/lib/BeSQLite";
import { IModelError } from "../common/IModelError";
import { NodeAddonRegistry } from "./NodeAddonRegistry";
import { NodeAddonECDb } from "@bentley/imodeljs-nodeaddonapi/imodeljs-nodeaddonapi";
import { ECSqlStatement } from "../backend/ECSqlStatement";

/** Allows performing CRUD operations in an ECDb */
export class ECDb {
  public _ecdb: NodeAddonECDb;

  /** Construct an invalid ECDb Error. */
  private _newInvalidDatabaseError(): IModelError {
    return new IModelError(DbResult.BE_SQLITE_ERROR, "ECDb must be created or opened to complete this operation");
  }

  /** Create an ECDb
   * @param pathname  The pathname of the Db.
   * @throws [[IModelError]] if the operation failed.
   */
  public createDb(pathname: string): void {
    if (!this._ecdb)
      this._ecdb =  new (NodeAddonRegistry.getAddon()).NodeAddonECDb();

    const status = this._ecdb.createDb(pathname);
    if (status !== DbResult.BE_SQLITE_OK)
      throw new IModelError(status, "Failed to created ECDb");
  }

  /** Open the ECDb.
   * @param pathname The pathname of the Db
   * @param openMode  Open mode
   * @throws [[IModelError]] if the operation failed.
   */
  public openDb(pathname: string, openMode: OpenMode = OpenMode.Readonly): void {
    if (!this._ecdb)
      this._ecdb = new (NodeAddonRegistry.getAddon()).NodeAddonECDb();

    const status = this._ecdb.openDb(pathname, openMode);
    if (status !== DbResult.BE_SQLITE_OK)
      throw new IModelError(status, "Failed to open ECDb");
  }

  /** Returns true if the ECDb is open */
  public isOpen(): boolean {
    return this._ecdb && this._ecdb.isOpen();
  }

  /** Close the Db after saving any uncommitted changes.
   * @returns Promise that resolves to an object that contains an error property if the operation failed.
   * @throws [[IModelError]] if the database is not open.
   */
  public closeDb(): void {
    if (!this._ecdb)
      throw this._newInvalidDatabaseError();

    this._ecdb.closeDb();
  }

  /** Commit the outermost transaction, writing changes to the file. Then, restart the transaction.
   * @param changeSetName The name of the operation that generated these changes.
   * @throws [[IModelError]] if the database is not open or if the operation failed.
   */
  public saveChanges(changeSetName?: string): void {
    if (!this._ecdb)
      throw this._newInvalidDatabaseError();

    const status: DbResult = this._ecdb.saveChanges(changeSetName);
    if (status !== DbResult.BE_SQLITE_OK)
      throw new IModelError(status, "Failed to save changes");
  }

  /** Abandon (cancel) the outermost transaction, discarding all changes since last save. Then, restart the transaction.
   * @throws [[IModelError]] if the database is not open or if the operation failed.
   */
  public abandonChanges(): void {
    if (!this._ecdb)
      throw this._newInvalidDatabaseError();

    const status = this._ecdb.abandonChanges();
    if (status !== DbResult.BE_SQLITE_OK)
      throw new IModelError(status, "Failed to abandon changes");
  }

  /** Import a schema. If the import was successful, the database is automatically saved to disk.
   * @throws [[IModelError]] if the database is not open or if the operation failed.
   */
  public importSchema(pathname: string): void {
    if (!this._ecdb)
      throw this._newInvalidDatabaseError();

    const status = this._ecdb.importSchema(pathname);
    if (status !== DbResult.BE_SQLITE_OK)
      throw new IModelError(status, "Failed to import schema");
  }

  /** Prepare an ECSql statement.
   * @param sql The ECSql statement to prepare
   * @throws [[IModelError]] if there is a problem preparing the statement.
   */
  public prepareStatement(sql: string): ECSqlStatement {
    if (!this._ecdb)
      throw this._newInvalidDatabaseError();

    const stmt = new ECSqlStatement();
    stmt.prepare(this._ecdb, sql);
    return stmt;
  }
}
