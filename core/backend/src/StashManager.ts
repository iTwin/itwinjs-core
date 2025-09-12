import { DbResult, GuidString, Id64Array, Id64String, IModelStatus, Logger, OpenMode } from "@itwin/core-bentley";
import { ChangesetIdWithIndex, IModelError, LocalDirName, LockState } from "@itwin/core-common";
import { existsSync, mkdirSync, readdirSync, statSync, unlinkSync } from "node:fs";
import * as path from "path";
import { BriefcaseManager } from "./BriefcaseManager";
import { BriefcaseDb } from "./IModelDb";
import { _elementWasCreated, _getHubAccess, _hubAccess, _nativeDb } from "./internal/Symbols";
import { SQLiteDb } from "./SQLiteDb";
import { TxnProps } from "./TxnManager";
import { IModelHost } from "./IModelHost";

/**
 * Properties of a stash
 * @internal
 */
export interface StashProps {
  /** Unique identifier for the stash */
  readonly id: GuidString;

  /** ID of the iModel being stashed */
  readonly iModelId: GuidString;

  /** ID of the briefcase being stashed */
  readonly briefcaseId: number;

  /** ISO local Timestamp of the stash */
  readonly timestamp: string;

  /** Description of the stash */
  readonly description: string;

  /** Hash of the stash */
  readonly hash: string;

  /** Parent changeset of the stash */
  readonly parentChangeset: ChangesetIdWithIndex;

  /** ID sequences for the stash */
  readonly idSequences: {
    element: Id64String;
    instance: Id64String;
  };

  /** Transaction properties for the stash */
  readonly txns: TxnProps[];

  /** Number of locks acquired by the stash */
  readonly acquiredLocks: number;
}

/**
 * Properties for creating a stash
 * @internal
 */
export interface CreateStashProps {
  /** Briefcase database instance */
  readonly db: BriefcaseDb;
  /** description of the stash */
  readonly description: string;
  /** discard all local changes and unless keepLocks flag is set, all locks will be released */
  readonly discardLocalChanges?: true;
  /** keep all locks after discarding local changes */
  readonly retainLocks?: true;
}

/**
 * Arguments for stash operations
 * @internal
 */
export interface StashArgs {
  readonly db: BriefcaseDb;
  readonly stash: Id64String | StashProps;
}

/**
 * Arguments for applying or restoring a stash.
 *
 * Extends {@link StashArgs} with an additional `method` property to specify the operation.
 *
 * @property method - Specifies the stash operation to perform.
 *   - `"apply"`: Apply the stash without removing it.
 *   - `"restore"`: Apply the stash and remove it from the stash list.
 * @internal
 */
export interface StashApplyArgs extends StashArgs {
  readonly method: "apply" | "restore";
}

enum LockOrigin {
  Acquired = 0,
  NewElement = 1,
  Discovered = 2,
}

/**
 * Stash manager allow stash, drop, apply and merge stashes
 * @internal
 */
export class StashManager {

  private static readonly STASH_ROOT_DIR_NAME: string = ".stashes";
  /**
   * Retrieves the root folder path for stash files associated with the specified BriefcaseDb.
   *
   * @param db - The BriefcaseDb instance for which to determine the stash root folder.
   * @param ensureExists - If true, the stash root directory will be created if it does not already exist.
   * @returns The absolute path to the stash root directory.
   * @throws IModelError if the database is not open, is readonly, has unsaved changes, or if the briefcase path cannot be determined.
   */
  private static getStashRootFolder(db: BriefcaseDb, ensureExists: boolean): LocalDirName {
    if (!db.isOpen || db.isReadonly)
      throw new IModelError(IModelStatus.BadArg, "Database is not open or is readonly");

    if (!existsSync(db[_nativeDb].getFilePath())) {
      throw new IModelError(IModelStatus.BadArg, "Could not determine briefcase path");
    }

    const stashDir = path.join(path.dirname(db[_nativeDb].getFilePath()), StashManager.STASH_ROOT_DIR_NAME, `${db.briefcaseId}`);
    if (ensureExists && !existsSync(stashDir)) {
      mkdirSync(stashDir, { recursive: true });
    }
    return stashDir;
  }

  /**
   * Retrieves the stash ID from the provided arguments.
   *
   * If the `stash` property of `args` is a string, it returns the string in lowercase.
   * If the `stash` property is an object, it returns the `id` property of the object in lowercase.
   *
   * @param args - The arguments containing the stash information, which can be either a string or an object with an `id` property.
   * @returns The stash ID as a lowercase string.
   */
  private static getStashId(args: StashArgs) {
    return (typeof args.stash === "string" ? args.stash : args.stash.id).toLowerCase();
  }

  /**
   * Retrieves the file path to the stash file associated with the provided arguments.
   *
   * @param args - The arguments required to identify the stash, including the database reference.
   * @returns The absolute path to the stash file.
   * @throws IModelError with status `IModelStatus.BadArg` if the stash root folder or the stash file does not exist.
   */
  private static getStashFilePath(args: StashArgs) {
    const stashRoot = this.getStashRootFolder(args.db, false);
    if (!existsSync(stashRoot)) {
      throw new IModelError(IModelStatus.BadArg, "Invalid stash");
    }

    const stashFile = path.join(stashRoot, `${this.getStashId(args)}.stash`);
    if (!existsSync(stashFile)) {
      throw new IModelError(IModelStatus.BadArg, "Invalid stash");
    }
    return stashFile;
  }

  /**
   * Queries the stash database for lock IDs matching the specified state and origin.
   *
   * @param args - The arguments required to access the stash database.
   * @param state - The lock state to filter by.
   * @param origin - The lock origin to filter by.
   * @returns An array of lock IDs (`Id64Array`) that match the given state and origin.
   */
  private static queryLocks(args: StashArgs, state: LockState, origin: LockOrigin): Id64Array {
    return this.withStash(args, (stashDb) => {
      const query = `SELECT JSON_GROUP_ARRAY(FORMAT('0x%x', Id)) FROM [locks] WHERE State = ${state} AND origin = ${origin}`;
      return stashDb.withPreparedSqliteStatement(query, (stmt) => {
        while (stmt.step() === DbResult.BE_SQLITE_ROW) {
          return JSON.parse(stmt.getValueString(0)) as Id64Array;
        }
        return [];
      });
    });
  }

  /**
   * Acquire locks for the specified stash. If this fail then stash should not be applied.
   * @param args The stash arguments.
   */
  private static async acquireLocks(args: StashArgs) {
    const shared = this.queryLocks(args, LockState.Shared, LockOrigin.Acquired);
    await args.db.locks.acquireLocks({ shared });

    const exclusive = this.queryLocks(args, LockState.Exclusive, LockOrigin.Acquired);
    await args.db.locks.acquireLocks({ exclusive });

    const newElements = this.queryLocks(args, LockState.Shared, LockOrigin.NewElement);
    for (const id of newElements) {
      if (!args.db.locks.holdsExclusiveLock(id)) {
        args.db.locks[_elementWasCreated](id);
      }
    }
  }
  /**
   * Creates a stash of changes for the specified briefcase.
   *
   * This method generates a stash in the stash root directory for the given briefcase, using the provided description and iModelId.
   * Optionally, it can reset the briefcase by releasing all locks after stashing.
   *
   * @param args - The properties required to create a stash, including the briefcase, description, iModelId, and an optional resetBriefcase flag.
   * @returns A promise that resolves to the properties of the created stash.
   *
   * @throws Error if the stash operation fails.
   */
  public static async stash(args: CreateStashProps): Promise<StashProps> {
    const stashRootDir = StashManager.getStashRootFolder(args.db, true);
    const iModelId = args.db.iModelId;
    if (!args.db.txns.hasPendingTxns) {
      throw new IModelError(IModelStatus.BadArg, "nothing to stash");
    }

    if (args.db.txns.hasUnsavedChanges) {
      throw new IModelError(IModelStatus.BadArg, "Unsaved changes exist");
    }

    if (args.db.txns.hasPendingSchemaChanges) {
      throw new IModelError(IModelStatus.BadArg, "Pending schema changeset stashing is not currently supported");
    }

    const stash = args.db[_nativeDb].stashChanges({ stashRootDir, description: args.description, iModelId }) as StashProps;
    if (args.discardLocalChanges) {
      await args.db.discardChanges({ retainLocks: args.retainLocks });
    }
    return stash;
  }

  /**
   * Retrieves the stash properties from the database for the given arguments.
   *
   * This method attempts to read the stash information from the local database using a prepared SQL statement.
   * If successful, it returns the stash properties along with the file path of the stash database.
   * If an error occurs during the process, it logs the error and returns `undefined`.
   *
   * @param args - The arguments required to locate and access the stash.
   * @returns The stash file properties if found; otherwise, `undefined`.
   */
  public static getStash(args: StashArgs): StashProps | undefined {
    try {
      return this.withStash(args, (stashDb) => {
        const stashProps = stashDb.withPreparedSqliteStatement("SELECT [val] FROM [be_Local] WHERE [name]='$stash_info'", (stmt) => {
          if (stmt.step() !== DbResult.BE_SQLITE_ROW)
            throw new IModelError(IModelStatus.BadArg, "Invalid stash");
          return JSON.parse(stmt.getValueString(0)) as StashProps;
        });
        return stashProps;
      });
    } catch (error: any) {
      Logger.logError("StashManager", `Error getting stash: ${error}`);
    }
    return undefined;
  }

  /**
   * Executes a callback function with a read-only SQLite database connection to a stash file.
   *
   * @typeParam T - The return type of the callback function.
   * @param args - Arguments required to determine the stash file path.
   * @param callback - A function that receives an open {@link SQLiteDb} instance connected to the stash file.
   * @returns The value returned by the callback function.
   * @throws {@link IModelError} If the stash file does not exist or cannot be opened.
   *
   * @remarks
   * The stash database is opened in read-only mode and is automatically closed after the callback completes,
   * regardless of whether the callback throws an error.
   */
  private static withStash<T>(args: StashArgs, callback: (stashDb: SQLiteDb) => T): T {
    const stashFile = this.getStashFilePath(args);
    if (!existsSync(stashFile)) {
      throw new IModelError(IModelStatus.BadArg, "Invalid stash");
    }

    const stashDb = new SQLiteDb();
    stashDb.openDb(stashFile, OpenMode.Readonly);
    try {
      return callback(stashDb);
    } finally {
      stashDb.closeDb();
    }
  }

  /**
   * Retrieves all stash files associated with the specified {@link BriefcaseDb}.
   *
   * This method scans the stash directory for files with a `.stash` extension,
   * loads their metadata, and returns an array of `StashProps` objects sorted
   * by their timestamp in descending order (most recent first).
   *
   * @param db - The {@link BriefcaseDb} instance for which to retrieve stash files.
   * @returns An array of `StashProps` representing the found stash files, sorted by timestamp.
   */
  public static getStashes(db: BriefcaseDb): StashProps[] {
    const stashes: StashProps[] = [];
    const stashDir = StashManager.getStashRootFolder(db, false);
    if (!existsSync(stashDir)) {
      return stashes;
    }
    readdirSync(stashDir).filter((file) => {
      const filePath = path.join(stashDir, file);
      if (existsSync(filePath) && statSync(filePath).isFile() && file.endsWith(".stash")) {
        const id = file.slice(0, -path.extname(file).length)
        const stash = this.getStash({ db, stash: id });
        if (stash) {
          stashes.push(stash);
        }
      }
    });
    stashes.sort((a, b) => Date.parse(b.timestamp) - Date.parse(a.timestamp));
    return stashes;
  }

  /**
   * Deletes the stash file associated with the specified stash ID or properties from the given {@link BriefcaseDb}.
   *
   * @param db - The {@link BriefcaseDb} instance from which the stash should be dropped.
   * @param stashId - The unique identifier (GuidString) or properties (StashProps) of the stash to be deleted.
   * @returns Returns `true` if the stash file was successfully deleted, otherwise returns `false`.
   * @throws Does not throw; logs errors internally and returns `false` on failure.
   */
  public static dropStash(args: StashArgs): boolean {
    try {
      const stashFile = this.getStashFilePath(args);
      unlinkSync(stashFile);
      return true;
    } catch (error: any) {
      Logger.logError("StashManager", `Error dropping stash: ${error}`);
    }
    return false;
  }

  /**
   * Removes all stashes associated with the specified {@link BriefcaseDb}.
   *
   * @param db - The {@link BriefcaseDb} instance from which all stashes will be removed.
   */
  public static dropAllStashes(db: BriefcaseDb): void {
    this.getStashes(db).forEach((stash) => {
      this.dropStash({ db, stash });
    });
  }

  /**
   * Queries the hub for the changeset information associated with the given stash.
   *
   * @param args - The arguments including the stash properties.
   * @returns A promise resolving to the changeset ID and index.
   */
  private static async queryChangeset(args: StashArgs & { stash: StashProps }): Promise<ChangesetIdWithIndex> {
    return IModelHost[_hubAccess].queryChangeset({
      iModelId: args.stash.iModelId,
      changeset: args.stash.parentChangeset,
      accessToken: await IModelHost.getAccessToken()
    });
  }

  /**
   * Restores the specified stash to the given {@link BriefcaseDb}.
   *
   * This method will discard local changes, acquire required locks, pull and apply changesets if needed,
   * and then restore the stash from the stash file.
   *
   * @param args - The arguments including the target database and stash properties.
   * @throws IModelError if the restore operation fails.
   */
  private static async restore(args: StashArgs & { stash: StashProps }): Promise<void> {
    const { db, stash } = args;
    Logger.logInfo("StashManager", `Restoring stash: ${stash.id}`);

    const stashFile = this.getStashFilePath({ db, stash });
    await db.discardChanges({ retainLocks: true });
    await this.acquireLocks(args);
    if (db.changeset.id !== stash.parentChangeset.id) {
      // Changeset ID mismatch
      Logger.logWarning("StashManager", "Changeset ID mismatch");

      const stashChangeset = await this.queryChangeset(args);
      await BriefcaseManager.pullAndApplyChangesets(db, { toIndex: stashChangeset.index });
    }

    db[_nativeDb].stashRestore(stashFile);

    (db as any).loadIModelSettings();
    (db as any).initializeIModelDb("pullMerge");
    db.saveChanges();
  }

  /**
   * Applies a stashed change to the specified {@link BriefcaseDb}.
   *
   * This method validates the stash, ensures the database is in a valid state, and applies or restores the stash as requested.
   *
   * @param args - The arguments for applying the stash, including the method ("restore").
   * @throws IModelError if the stash is invalid, the database is not in a valid state, or the stash does not belong to the database.
   */
  public static async apply(args: StashApplyArgs): Promise<void> {
    const conn = args.db;
    conn.clearCaches();
    conn[_nativeDb].clearECDbCache();
    const stash = this.getStash(args);
    if (!stash) {
      throw new IModelError(IModelStatus.BadArg, "Invalid stash");
    }

    if (conn.txns.hasUnsavedChanges) {
      throw new IModelError(IModelStatus.BadArg, "Unsaved changes present");
    }

    if (conn.iModelId !== stash.iModelId) {
      throw new IModelError(IModelStatus.BadArg, "Stash does not belong to this iModel");
    }

    if (conn.briefcaseId !== stash.briefcaseId) {
      throw new IModelError(IModelStatus.BadArg, "Stash does not belong to this briefcase");
    }

    if (args.method === "restore") {
      return this.restore({ db: conn, stash });
    }

    throw new IModelError(IModelStatus.BadArg, "Invalid stash operation");
  }
}
