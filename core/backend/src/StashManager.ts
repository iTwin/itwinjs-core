import { DbResult, GuidString, Id64Array, Id64String, ITwinError, Logger, OpenMode } from "@itwin/core-bentley";
import { ChangesetIdWithIndex, LocalDirName, LockState } from "@itwin/core-common";
import { existsSync, mkdirSync, readdirSync, statSync, unlinkSync } from "node:fs";
import * as path from "node:path";
import { BriefcaseManager } from "./BriefcaseManager";
import { BriefcaseDb } from "./IModelDb";
import { _elementWasCreated, _getHubAccess, _hubAccess, _nativeDb, _resetIModelDb } from "./internal/Symbols";
import { SQLiteDb } from "./SQLiteDb";
import { TxnProps } from "./TxnManager";
import { IModelHost } from "./IModelHost";
import { BackendLoggerCategory } from "./BackendLoggerCategory";

const loggerCategory = BackendLoggerCategory.StashManager;

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
  /** discard all local changes and unless retainLocks flag is set, all locks will be released */
  readonly discardLocalChanges?: true;
  /** retains all locks after discarding local changes */
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

enum LockOrigin {
  Acquired = 0,
  NewElement = 1,
  Discovered = 2,
};

/**
 * Stash manager allow stash, drop, apply and merge stashes
 * @internal
 */
export class StashManager {

  private static readonly STASHES_ROOT_DIR_NAME: string = ".stashes";
  /**
   * Retrieves the root folder path for stash files associated with the specified BriefcaseDb.
   *
   * @param db - The BriefcaseDb instance for which to determine the stash root folder.
   * @param ensureExists - If true, the stash root directory will be created if it does not already exist.
   * @returns The absolute path to the stash root directory.
   */
  private static getStashRootFolder(db: BriefcaseDb, ensureExists: boolean): LocalDirName {
    if (!db.isOpen || db.isReadonly)
      ITwinError.throwError<ITwinError>({ message: "Database is not open or is readonly", iTwinErrorId: { scope: "stash-manager", key: "readonly" } });

    if (!existsSync(db[_nativeDb].getFilePath())) {
      ITwinError.throwError<ITwinError>({ message: "Database file does not exist", iTwinErrorId: { scope: "stash-manager", key: "no-file" } });
    }

    const stashDir = path.join(path.dirname(db[_nativeDb].getFilePath()), this.STASHES_ROOT_DIR_NAME, `${db.briefcaseId}`);
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
   */
  private static getStashFilePath(args: StashArgs) {
    const stashRoot = this.getStashRootFolder(args.db, false);
    if (!existsSync(stashRoot)) {
      ITwinError.throwError<ITwinError>({ message: "No stashes exist for this briefcase", iTwinErrorId: { scope: "stash-manager", key: "no-stashes" } });
    }

    const stashFilePath = path.join(stashRoot, `${this.getStashId(args)}.stash`);
    if (!existsSync(stashFilePath)) {
      ITwinError.throwError<ITwinError>({ message: "Invalid stash", iTwinErrorId: { scope: "stash-manager", key: "invalid-stash" } });
    }
    return stashFilePath;
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
        if (stmt.step() === DbResult.BE_SQLITE_ROW) {
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
   */
  public static async stash(args: CreateStashProps): Promise<StashProps> {
    if (!args.db.txns.hasPendingTxns) {
      ITwinError.throwError<ITwinError>({ message: "Nothing to stash", iTwinErrorId: { scope: "stash-manager", key: "nothing-to-stash" } });
    }

    if (args.db.txns.hasUnsavedChanges) {
      ITwinError.throwError<ITwinError>({ message: "Unsaved changes exist", iTwinErrorId: { scope: "stash-manager", key: "unsaved-changes" } });
    }

    if (args.db.txns.hasPendingSchemaChanges) {
      ITwinError.throwError<ITwinError>({ message: "Pending schema changeset. Stashing is not currently supported for schema changes", iTwinErrorId: { scope: "stash-manager", key: "pending-schema-changes" } });
    }

    const stashRootDir = this.getStashRootFolder(args.db, true);
    const iModelId = args.db.iModelId;
    const stash = args.db[_nativeDb].stashChanges({ stashRootDir, description: args.description, iModelId }) as StashProps;
    if (args.discardLocalChanges) {
      await args.db.discardChanges({ retainLocks: args.retainLocks });
    }

    Logger.logInfo(loggerCategory, `Stashed changes`, () => stash);
    return stash;
  }

  /**
   * Retrieves the stash properties from the database for the given arguments.
   *
   * @param args - The arguments required to locate and access the stash.
   * @returns The stash file properties if found; otherwise, `undefined`.
   */
  public static tryGetStash(args: StashArgs): StashProps | undefined {
    try {
      return this.getStash(args);
    } catch (error: any) {
      Logger.logError(loggerCategory, `Error getting stash with ${this.getStashId(args)}: ${error.message}`);
    }
    return undefined;
  }

  /**
   * Retrieves the stash properties from the database using the provided arguments.
   *
   * @param args - The arguments required to access the stash.
   * @returns The stash properties parsed from the database.
   */
  public static getStash(args: StashArgs): StashProps {
    return this.withStash(args, (stashDb) => {
      const stashProps = stashDb.withPreparedSqliteStatement("SELECT [val] FROM [be_Local] WHERE [name]='$stash_info'", (stmt) => {
        if (stmt.step() !== DbResult.BE_SQLITE_ROW)
          ITwinError.throwError<ITwinError>({ message: "Invalid stash", iTwinErrorId: { scope: "stash-manager", key: "invalid-stash" } });
        return JSON.parse(stmt.getValueString(0)) as StashProps;
      });
      return stashProps;
    });
  }

  /**
   * Executes a callback function with a read-only SQLite database connection to a stash file.
   *
   * @typeParam T - The return type of the callback function.
   * @param args - Arguments required to determine the stash file path.
   * @param callback - A function that receives an open {@link SQLiteDb} instance connected to the stash file.
   * @returns The value returned by the callback function.
   */
  private static withStash<T>(args: StashArgs, callback: (stashDb: SQLiteDb) => T): T {
    const stashFile = this.getStashFilePath(args);
    if (!existsSync(stashFile)) {
      ITwinError.throwError<ITwinError>({ message: "Invalid stash", iTwinErrorId: { scope: "stash-manager", key: "invalid-stash" } });
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
   * @param db - The {@link BriefcaseDb} instance for which to retrieve stash files.
   * @returns An array of `StashProps` representing the found stash files, sorted by timestamp.
   */
  public static getStashes(db: BriefcaseDb): StashProps[] {
    const stashes: StashProps[] = [];
    const stashDir = this.getStashRootFolder(db, false);
    if (!existsSync(stashDir)) {
      return stashes;
    }
    readdirSync(stashDir).filter((file) => {
      const filePath = path.join(stashDir, file);
      if (existsSync(filePath) && statSync(filePath).isFile() && file.endsWith(".stash")) {
        const id = file.slice(0, -path.extname(file).length)
        const stash = this.tryGetStash({ db, stash: id });
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
   */
  public static dropStash(args: StashArgs): boolean {
    try {
      const stashFile = this.getStashFilePath(args);
      unlinkSync(stashFile);
      return true;
    } catch (error: any) {
      Logger.logError(loggerCategory, `Error dropping stash: ${error}`);
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
   * Restores the specified stash to the given {@link BriefcaseDb}. This operation will discard any local changes made to db and reverse the tip to the state of the stash and then apply stash. This will restore the undo stack.
   *
   * @param args - The arguments including the target database and stash properties.
   */
  public static async restore(args: StashArgs): Promise<void> {
    const { db } = args;
    Logger.logInfo(loggerCategory, `Restoring stash: ${this.getStashId(args)}`);

    const stash = this.tryGetStash(args);
    if (!stash) {
      ITwinError.throwError<ITwinError>({ message: `Stash not found ${this.getStashId(args)}`, iTwinErrorId: { scope: "stash-manager", key: "stash-not-found" } });
    }

    if (db.txns.hasUnsavedChanges) {
      ITwinError.throwError<ITwinError>({ message: `Unsaved changes present`, iTwinErrorId: { scope: "stash-manager", key: "unsaved-changes" } });
    }

    if (db.iModelId !== stash.iModelId) {
      ITwinError.throwError<ITwinError>({ message: `Stash does not belong to this iModel`, iTwinErrorId: { scope: "stash-manager", key: "invalid-stash" } });
    }

    if (db.briefcaseId !== stash.briefcaseId) {
      ITwinError.throwError<ITwinError>({ message: `Stash does not belong to this briefcase`, iTwinErrorId: { scope: "stash-manager", key: "invalid-stash" } });
    }

    const stashFile = this.getStashFilePath({ db, stash });
    // we need to retain lock that overlapped with stash locks instead of all locks
    await db.discardChanges({ retainLocks: true });
    await this.acquireLocks(args);
    if (db.changeset.id !== stash.parentChangeset.id) {
      // Changeset ID mismatch
      Logger.logWarning(loggerCategory, "Changeset ID mismatch");
      const stashChangeset = await this.queryChangeset({ db, stash });
      await BriefcaseManager.pullAndApplyChangesets(db, { toIndex: stashChangeset.index });
    }

    db[_nativeDb].stashRestore(stashFile);
    db[_resetIModelDb]();
    db.saveChanges();
    Logger.logInfo(loggerCategory, `Restored stash: ${this.getStashId(args)}`);
  }
}
