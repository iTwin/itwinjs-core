import { DbResult, GuidString, Id64Array, Id64String, IModelStatus, Logger, OpenMode } from "@itwin/core-bentley";
import { ChangesetIdWithIndex, IModelError, LocalDirName, LockState } from "@itwin/core-common";
import { BriefcaseDb } from "./IModelDb";
import { _elementWasCreated, _nativeDb } from "./internal/Symbols";
import { existsSync, mkdirSync, readdirSync, statSync, unlinkSync } from "node:fs";
import { SQLiteDb } from "./SQLiteDb";
import * as path from "path"
import { TxnProps } from "./TxnManager";

/**
 * Properties of a stash
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
 */
export interface CreateStashProps {
  /** Briefcase database instance */
  readonly briefcase: BriefcaseDb;
  /** description of the stash */
  readonly description: string;
  /** reverse and delete all local changes. Also release all locks */
  readonly resetBriefcase?: true;
}

/**
 * Arguments for stash operations
 */
interface StashOperationArgs {
  db: BriefcaseDb;
  stash: Id64String | StashProps;
}

enum LockOrigin {
  Acquired = 0,
  NewElement = 1,
  Discovered = 2,
}

/**
 * Stash manager allow stash, drop, apply and merge stashes
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

    if (db.txns.hasUnsavedChanges)
      throw new IModelError(IModelStatus.BadArg, "There are unsaved changes");

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
  private static getStashId(args: StashOperationArgs) {
    return (typeof args.stash === "string" ? args.stash : args.stash.id).toLowerCase();
  }

  /**
   * Retrieves the file path to the stash file associated with the provided arguments.
   *
   * @param args - The arguments required to identify the stash, including the database reference.
   * @returns The absolute path to the stash file.
   * @throws IModelError with status `IModelStatus.BadArg` if the stash root folder or the stash file does not exist.
   */
  private static getStashFilePath(args: StashOperationArgs) {
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
  private static queryLocks(args: StashOperationArgs, state: LockState, origin: LockOrigin): Id64Array {
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
  public static async acquireLocks(args: StashOperationArgs) {
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
    const stashRootDir = StashManager.getStashRootFolder(args.briefcase, true);
    const iModelId = args.briefcase.iModelId;
    const stash = args.briefcase[_nativeDb].stashChanges({ stashRootDir, description: args.description, iModelId }) as StashProps;
    if (args.resetBriefcase) {
      await args.briefcase.locks.releaseAllLocks();
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
  public static getStash(args: StashOperationArgs): StashProps | undefined {
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
  public static withStash<T>(args: StashOperationArgs, callback: (stashDb: SQLiteDb) => T): T {
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
   * Retrieves all stash files associated with the specified BriefcaseDb.
   *
   * This method scans the stash directory for files with a `.stash` extension,
   * loads their metadata, and returns an array of `StashFileProps` objects sorted
   * by their timestamp in descending order (most recent first).
   *
   * @param db - The BriefcaseDb instance for which to retrieve stash files.
   * @returns An array of `StashFileProps` representing the found stash files, sorted by timestamp.
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
   * Deletes the stash file associated with the specified stash ID or properties from the given BriefcaseDb.
   *
   * @param db - The BriefcaseDb instance from which the stash should be dropped.
   * @param stashId - The unique identifier (GuidString) or properties (StashProps) of the stash to be deleted.
   * @returns Returns `true` if the stash file was successfully deleted, otherwise returns `false`.
   * @throws Does not throw; logs errors internally and returns `false` on failure.
   */
  public static dropStash(db: BriefcaseDb, stashId: GuidString | StashProps): boolean {
    try {
      const stashFile = this.getStashFilePath({ db, stash: stashId });
      unlinkSync(stashFile);
      return true;
    } catch (error: any) {
      Logger.logError("StashManager", `Error dropping stash: ${error}`);
    }
    return false;
  }

  /**
   * Removes all stashes associated with the specified BriefcaseDb.
   *
   * @param db - The BriefcaseDb instance from which all stashes will be removed.
   */
  public static dropAllStashes(db: BriefcaseDb): void {
    this.getStashes(db).forEach((stash) => {
      this.dropStash(db, stash);
    });
  }
}