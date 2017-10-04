/*---------------------------------------------------------------------------------------------
|  $Copyright: (c) 2017 Bentley Systems, Incorporated. All rights reserved. $
 *--------------------------------------------------------------------------------------------*/
import { OpenMode, DbResult } from "@bentley/bentleyjs-core/lib/BeSQLite";
import { AccessToken } from "@bentley/imodeljs-clients";
import { IModel } from "../IModel";
import { IModelVersion } from "../IModelVersion";
import { BriefcaseManager, KeepBriefcase } from "./BriefcaseManager";
import { IModelError, IModelStatus } from "../IModelError";
import { ECSqlStatement } from "./ECSqlStatement";
import { assert } from "@bentley/bentleyjs-core/lib/Assert";

class CachedECSqlStatement {
  public statement: ECSqlStatement;
  public useCount: number;
}

class ECSqlStatementCache {
  private statements: Map<string, CachedECSqlStatement> = new Map<string, CachedECSqlStatement>();

  public add(str: string, stmt: ECSqlStatement): void {

    assert(!stmt.isShared(), "when you add a statement to the cache, the cache takes ownership of it. You can't add a statement that is already being shared in some other way");
    assert(stmt.isPrepared(), "you must cache only cached statements.");

    const existing = this.statements.get(str);
    if (existing !== undefined)
      throw new Error("collision");
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
        } else {
          assert(false, "double-release of cached statement");
        }
        // leave the statement in the cache, even if its use count goes to zero. See removeUnusedStatements and clearOnClose.
        break;
      }
    }
  }

  public removeUnusedStatements(targetCount: number) {
    const keysToRemove = [];
    for (const cs of this.statements) {
      const css = cs[1];
      assert(css.statement.isShared());
      assert(css.statement.isPrepared());
      if (css.useCount === 0) {
        css.statement.setIsShared(false);
        css.statement.dispose();
        keysToRemove.push(cs[0]);
        if (keysToRemove.length >= targetCount)
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

/** Represents a physical copy (briefcase) of an iModel that can be accessed as a file. */
export class IModelDb extends IModel {
  private statementCache: ECSqlStatementCache = new ECSqlStatementCache();
  private _maxStatementCacheCount = 20;

  private constructor() {
    super();
  }

  /** Open the iModel from a local file
   * @param fileName The file name of the iModel
   * @param openMode Open mode for database
   * @throws [[IModelError]]
   */
  public static async openStandalone(fileName: string, openMode: OpenMode = OpenMode.ReadWrite): Promise<IModelDb> {
    const iModel = new IModelDb();
    iModel._briefcaseKey = await BriefcaseManager.openStandalone(fileName, openMode);
    return iModel;
  }

  /**
   * Prepare an ECSql statement.
   * @param ecsql The ECSql statement to prepare
   */
  public prepareECSqlStatement(ecsql: string): ECSqlStatement {
    if (!this.briefcaseKey)
      throw new IModelError(IModelStatus.NotOpen);
    return BriefcaseManager.prepareECSqlStatement(this.briefcaseKey!, ecsql);
  }

  /**
   * Get a prepared ECSql statement - may require preparing the statement, if not found in the cache.
   * @param ecsql The ECSql statement to prepare
   */
  public getPreparedECSqlStatement(ecsql: string): ECSqlStatement {
    const cs = this.statementCache.find(ecsql);
    if (cs !== undefined) {
      assert(cs.statement.isShared());
      assert(cs.statement.isPrepared());
      cs.useCount++;
      return cs.statement;
    }

    if (this.statementCache.getCount() > this._maxStatementCacheCount) {
      this.statementCache.removeUnusedStatements(this._maxStatementCacheCount);
    }

    const stmt = this.prepareECSqlStatement(ecsql);
    this.statementCache.add(ecsql, stmt);
    return stmt;
  }

  /**
   * Get a prepared ECSql statement - may require preparing the statement, if not found in the cache.
   * @param ecsql The ECSql statement to prepare
   */
  public releasePreparedECSqlStatement(stmt: ECSqlStatement): void {
    this.statementCache.release(stmt);
  }

  public clearStatementCacheOnClose(): void {
    this.statementCache.clearOnClose();
  }

  /** Close this iModel, if it is currently open */
  public closeStandalone() {
    this.clearStatementCacheOnClose();
    if (!this.briefcaseKey)
      return;
    BriefcaseManager.closeStandalone(this.briefcaseKey);
  }

  /** Commit pending changes to this iModel */
  public saveChanges() {
    if (!this.briefcaseKey)
      throw new IModelError(DbResult.BE_SQLITE_ERROR);
    BriefcaseManager.saveChanges(this.briefcaseKey);
  }

  /** Open an iModel from the iModelHub */
  public static async open(accessToken: AccessToken, iModelId: string, openMode: OpenMode = OpenMode.ReadWrite, version: IModelVersion = IModelVersion.latest()): Promise<IModelDb> {
    const iModel = new IModelDb();
    iModel._briefcaseKey = await BriefcaseManager.open(accessToken, iModelId, openMode, version);
    return iModel;
  }

  /** Close this iModel, if it is currently open. */
  public async close(accessToken: AccessToken, keepBriefcase: KeepBriefcase = KeepBriefcase.Yes): Promise<void> {
    this.clearStatementCacheOnClose();
    if (!this.briefcaseKey)
      return;
    await BriefcaseManager.close(accessToken, this.briefcaseKey, keepBriefcase);
  }

}
