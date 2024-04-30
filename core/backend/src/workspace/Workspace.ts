/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
/** @packageDocumentation
 * @module Workspace
 */

import { createHash } from "crypto";
import * as fs from "fs-extra";
import { dirname, extname, join } from "path";
import * as semver from "semver";
import { AccessToken, BeEvent, DbResult, Logger, Mutable, OpenMode, Optional, UnexpectedErrors } from "@itwin/core-bentley";
import { IModelError, LocalDirName, LocalFileName } from "@itwin/core-common";
import { CloudSqlite } from "../CloudSqlite";
import { IModelHost, KnownLocations } from "../IModelHost";
import { IModelJsFs } from "../IModelJsFs";
import { SQLiteDb, VersionedSqliteDb } from "../SQLiteDb";
import { SqliteStatement } from "../SqliteStatement";
import { BaseSettings, SettingName, SettingObject, Settings } from "./Settings";
import type { IModelJsNative } from "@bentley/imodeljs-native";
import { SettingsSchemas } from "./SettingsSchemas";
import { BlobContainer } from "../BlobContainerService";

// cspell:ignore rowid julianday primarykey premajor preminor prepatch

function noLeadingOrTrailingSpaces(name: string, msg: string) {
  if (name.trim() !== name)
    throw new Error(`${msg} [${name}] may not have leading or tailing spaces`);
}
const loggerCategory = "workspace";

/** @beta */
export namespace WorkspaceContainer {
  /** The unique identifier of a WorkspaceContainer. This becomes the base name for the local directory holding the WorkspaceDbs from a WorkspaceContainer.
   * `WorkspaceContainer.Id`s may:
   *  - only contain lower case letters, numbers or dashes
   *  - not start or end with a dash
   *  - not be shorter than 3 or longer than 63 characters
   */
  export type Id = string;

  /** Properties that specify a WorkspaceContainer. */
  export interface Props extends Optional<CloudSqlite.ContainerAccessProps, "accessToken"> {
    /** attempt to synchronize (i.e. call `checkForChanges`) this cloud container whenever it is connected to a cloud cache. Default=true */
    readonly syncOnConnect?: boolean;
    /** description of what's in this container */
    readonly description?: string;
    /** in case of problems loading the container, display this message. */
    readonly loadingHelp?: string;
  }

  /** @internal */
  export function validateDbName(dbName: WorkspaceDb.DbName) {
    if (dbName === "" || dbName.length > 255 || /[#\.<>:"/\\"`'|?*\u0000-\u001F]/g.test(dbName) || /^(con|prn|aux|nul|com\d|lpt\d)$/i.test(dbName))
      throw new Error(`invalid dbName: [${dbName}]`);
    noLeadingOrTrailingSpaces(dbName, "dbName");
  }

  /**
   * Validate that a WorkspaceContainer.Id is valid.
   * The rules for ContainerIds (from Azure, see https://docs.microsoft.com/en-us/rest/api/storageservices/naming-and-referencing-containers--blobs--and-metadata):
   *  - may only contain lower case letters, numbers or dashes
   *  - may not start or end with with a dash nor have more than one dash in a row
   *  - may not be shorter than 3 or longer than 63 characters
   * @internal
   */
  export function validateContainerId(id: WorkspaceContainer.Id) {
    if (!/^(?=.{3,63}$)[a-z0-9]+(-[a-z0-9]+)*$/g.test(id))
      throw new Error(`invalid containerId: [${id}]`);
  }

  /** @internal */
  export function validateVersion(version?: WorkspaceDb.Version) {
    version = version ?? "1.0.0";
    if (version) {
      const opts = { loose: true, includePrerelease: true };
      // clean allows prerelease, so try it first. If that fails attempt to coerce it (coerce strips prerelease even if you say not to.)
      const semVersion = semver.clean(version, opts) ?? semver.coerce(version, opts)?.version;
      if (!semVersion)
        throw new Error("invalid version specification");
      version = semVersion;
    }
    return version;
  }

  /**
   * Parse the name stored in a WorkspaceContainer into the dbName and version number. A single WorkspaceContainer may hold
   * many versions of the same WorkspaceDb. The name of the Db in the WorkspaceContainer is in the format "name:version". This
   * function splits them into separate strings.
   * @internal
   */
  export function parseDbFileName(dbFileName: WorkspaceDb.DbFullName): { dbName: WorkspaceDb.DbName, version: WorkspaceDb.Version } {
    const parts = dbFileName.split(":");
    return { dbName: parts[0], version: parts[1] };
  }

  /** Create a dbName for a WorkspaceDb from its base name and version. This will be in the format "name:version"
   * @internal
   */
  export function makeDbFileName(dbName: WorkspaceDb.DbName, version?: WorkspaceDb.Version): WorkspaceDb.DbName {
    return `${dbName}:${WorkspaceContainer.validateVersion(version)}`;
  }
}

/** @beta */
export namespace WorkspaceDb {
  /** complete a WorkspaceDb name, replacing undefined with the default value "workspace-db"
   * @internal
   */
  export const dbNameWithDefault = (dbName?: WorkspaceDb.DbName) => dbName ?? "workspace-db";

  /** The base name of a WorkspaceDb within a WorkspaceContainer (without any version identifier) */
  export type DbName = string;

  /** The  name of a WorkspaceDb within a WorkspaceContainer, including the version identifier */
  export type DbFullName = string;

  /** The semver-format version identifier for a WorkspaceDb. */
  export type Version = string;

  /** The [semver range format](https://github.com/npm/node-semver) identifier for a range of acceptable versions. */
  export type VersionRange = string;

  export interface NameAndVersion {
    /** name of database within WorkspaceContainer. If not present, defaults to "workspace-db" */
    readonly dbName?: string;
    /** a semver version range specifier that determines the acceptable range of versions to load. If not present, use the newest version. */
    readonly version?: VersionRange;
  }
  /** Properties that specify how to load a WorkspaceDb within a [[WorkspaceContainer]]. */
  export interface Props extends NameAndVersion {
    /** if true, allow semver *prerelease* versions. By default only released version are allowed. */
    readonly includePrerelease?: boolean;
    /** start a prefetch operation whenever this WorkspaceDb is opened. */
    readonly prefetch?: boolean;
  }

  export type CloudProps = Props & WorkspaceContainer.Props;

  /**
   * A Manifests is stored *inside* every WorkspaceDb. IT describes the meaning, content, and context of what's in a WorkspaceDb. This can be used to
   * help users understand when to use the WorkspaceDb, as well as who to contact with questions, etc.
   * @note Only the `workspaceName` field is required. Users may add additional fields for their own purposes.
   * @note Since this information is stored within the WorkspaceDb itself, it is versioned along with the rest of the contents.
   */
  export interface Manifest {
    /** The name of this WorkspaceDb to be shown in user interfaces. Organizations should attempt to make this name informative enough
     * so that uses may refer to this name in conversations. It should also be unique enough that there's no confusion when it appears in
     * lists of WorkspaceDbs.
     * @note it is possible and valid to change the workspaceName between new version of a WorkspaceDb (e.g. incorporating a date).
     */
    readonly workspaceName: string;
    /** A description of the contents of this WorkspaceDb to help users understand its purpose and appropriate usage */
    readonly description?: string;
    /** the moniker of the individual to contact with questions about this WorkspaceDb */
    readonly contactName?: string;
    /** the moniker of the individual who last modified this WorkspaceDb */
    readonly lastEditedBy?: string;
  }

  /** file extension for local WorkspaceDbs
   * @internal
   */
  export const fileExt = "itwin-workspace";

  /**
   * An exception that happens attempting to load a WorkspaceDb or data from WorkspaceDb (e.g. the WorkspaceDb
   * can't be found or the user isn't authorized for access to the container.)
   */
  export interface LoadError extends Error {
    /** the properties of the workspace attempting to load, including the identity of the container. */
    wsDbProps?: WorkspaceDb.Props & Partial<WorkspaceDb.CloudProps>;
    /** the WorkspaceDb, if available */
    wsDb?: WorkspaceDb;
  }

  /** An exception that happened during [[IModelDb.loadWorkspaceSettings]]. The `LoadErrors` exception is passed
   * to [[Workspace.exceptionDiagnostic]] and contains the name of the iModel being loaded. */
  export interface LoadErrors extends Error {
    /** An array of problems that were encountered attempting to load WorkspaceDbs for an iModel. The most common problem
     * is that the user doesn't have read access to the container of the WorkspaceDb.
     */
    wsLoadErrors?: LoadError[];
  }

  /** construct a new instance of a WorkspaceDb
   * @internal
   */
  export function construct(props: WorkspaceDb.Props, container: WorkspaceContainer): WorkspaceDb {
    return new WorkspaceDbImpl(props, container);
  }
  /** @internal */
  export function throwLoadError(msg: string, wsDbProps: WorkspaceDb.Props | WorkspaceDb.CloudProps, db?: WorkspaceDb): never {
    const error = new Error(msg) as WorkspaceDb.LoadError;
    error.wsDbProps = wsDbProps;
    error.wsDb = db;
    throw error;
  }
  /** @internal */
  export function throwLoadErrors(msg: string, errors: WorkspaceDb.LoadError[]): never {
    const error = new Error(msg) as WorkspaceDb.LoadErrors;
    error.wsLoadErrors = errors;
    throw error;
  }
}

/**
 * Types for loading `Settings.Dictionary`s from WorkspaceDbs.
 * @beta
 */
export namespace WorkspaceSettings {
  /**
   * An entry in an `itwin/core/workspace/settingsWorkspaces` setting. This interface specifies a resource within
   * a WorkspaceDb that holds a `Settings.Dictionary` to be loaded. It also specifies the `Settings.Priority` for the Dictionary.
   */
  export interface Props extends WorkspaceDb.CloudProps {
    /** The name of the resource holding the stringified JSON of the `Settings.Dictionary`. The default resourceName is "settingsDictionary" */
    resourceName: string;
    /** The priority for loading the Settings.Dictionary. Higher values override lower values. */
    priority: Settings.Priority | number;
  }
}

/** Types used to identify Workspace resources
 *  @beta
 */
export namespace WorkspaceResource {
  /**
   * The name for identifying WorkspaceResources in a [[WorkspaceDb]].
   * * `WorkspaceResource.Name`s may not:
   *  - be blank or start or end with a space
   *  - be longer than 1024 characters
   * @note a single WorkspaceDb may hold WorkspaceResources of type 'blob', 'string' and 'file', all with the same WorkspaceResource.Name.
   */
  export type Name = string;

  /** Properties that specify an individual WorkspaceResource within a [[WorkspaceDb]]. */
  export interface Props {
    /** the name of the resource within the WorkspaceDb */
    rscName: Name;
  }

  /** The value passed to callback function  from `Workspace.queryStringResource` and `Workspace.queryBlobResource` for every resource that
   * satisfies the search criteria. It includes both the name of the resource and the WorkspaceDb from which it was found.
   * @note results are returned in random order (i.e. unordered) within a single WorkspaceDb.
   */
  export interface SearchResult extends Props {
    /** the WorkspaceDb holding this resource. */
    workspaceDb: WorkspaceDb;
  }

  /** Search criteria for `Workspace.queryStringResource` and `Workspace.queryBlobResource`. */
  export interface Search {
    /** The resource name to compare for searching. May include wildcards for GLOB and LIKE. */
    readonly nameSearch: string;
    /** The comparison operator for `nameSearch`. Default is `=` */
    readonly nameCompare?: "GLOB" | "LIKE" | "NOT GLOB" | "NOT LIKE" | "=" | "<" | ">";
  }
}

/**
 * A WorkspaceDb holds workspace resources. `WorkspaceDb`s are stored in in cloud WorkspaceContainers.
 * Each `WorkspaceResource` in a WorkspaceDb is identified by a [[WorkspaceResource.Name]].
 * Resources of type `string` and `blob` may be loaded directly from the `WorkspaceDb`. Resources of type `file` are
 * copied from the WorkspaceDb into a temporary local file so they can be accessed by programs directly from disk.
 * @beta
 */
export interface WorkspaceDb {
  /** The WorkspaceContainer holding this WorkspaceDb. */
  readonly container: WorkspaceContainer;
  /** The base name of this WorkspaceDb, without version */
  readonly dbName: WorkspaceDb.DbName;
  /** event raised before this WorkspaceDb is closed. */
  readonly onClose: BeEvent<() => void>;
  /** Name by which a WorkspaceDb may be opened. This will be either a local file name or the name of a database in a cloud container */
  readonly dbFileName: string;
  /** the SQLiteDb for this WorkspaceDb */
  readonly sqliteDb: SQLiteDb;
  /** determine whether this WorkspaceDb is currently open */
  readonly isOpen: boolean;
  /** The manifest that describes the content of this WorkspaceDb. */
  get manifest(): WorkspaceDb.Manifest;
  /** Get the version of this WorkspaceDb */
  get version(): WorkspaceDb.Version;

  /** Open the SQLiteDb of this WorkspaceDb. Generally WorkspaceDbs are left closed and opened/closed as they're used. However,
   * when there will be significant activity against a WorkspaceDb, it may be useful to open it before the operations and close it afterwards.
   */
  open(): void;

  /** Close the SQLiteDb of this WorkspaceDb. */
  close(): void;

  /** Get a string resource from this WorkspaceDb, if present. */
  getString(rscName: WorkspaceResource.Name): string | undefined;

  /** Get a blob resource from this WorkspaceDb, if present. */
  getBlob(rscName: WorkspaceResource.Name): Uint8Array | undefined;

  /** Get a BlobIO reader for a blob WorkspaceResource.
   * @note when finished, caller *must* call `close` on the BlobIO.
   * @internal
   */
  getBlobReader(rscName: WorkspaceResource.Name): SQLiteDb.BlobIO;

  /**
   * Extract a local copy of a file resource from this WorkspaceDb, if present.
   * @param rscName The name of the file resource in the WorkspaceDb
   * @param targetFileName optional name for extracted file. Some applications require files in specific locations or filenames. If
   * you know the full path to use for the extracted file, you can supply it. Generally, it is best to *not* supply the filename and
   * keep the extracted files in the  filesDir.
   * @returns the full path to a file on the local filesystem.
   * @note The file is copied from the file into the local filesystem so it may be accessed directly. This happens only
   * as necessary, if the local file doesn't exist, or if it is out-of-date because it was updated in the file.
   * For this reason, you should not save the local file name, and instead call this method every time you access it, so its
   * content is always holds the correct version.
   * @note The filename will be a hash value, not the resource name.
   * @note Workspace resource files are set readonly as they are copied from the file.
   * To edit them, you must first copy them to another location.
   */
  getFile(rscName: WorkspaceResource.Name, targetFileName?: LocalFileName): LocalFileName | undefined;

  /**
   * Ensure that the contents of a `WorkspaceDb` are downloaded into the local cache so that it may be accessed offline.
   * Until the promise is resolved, the `WorkspaceDb` is not fully downloaded, but it *may* be safely accessed during the download.
   * To determine the progress of the download, use the `localBlocks` and `totalBlocks` values returned by `CloudContainer.queryDatabase`.
   * @returns a `CloudSqlite.CloudPrefetch` object that can be used to await and/or cancel the prefetch.
   * @throws if this WorkspaceDb is not from a `CloudContainer`.
   */
  prefetch(opts?: CloudSqlite.PrefetchProps): CloudSqlite.CloudPrefetch;

  /** Query this WorkspaceDb for resources that match a search criteria.
   * @returns "stop" if the query was aborted by the `found` function
   * @see [[Workspace.queryStringResource]], [[Workspace.queryBlobResource]]
   */
  queryResource(
    /** the search criteria */
    search: WorkspaceResource.Search,
    /** the type of resource to find. */
    resourceType: Workspace.SearchResourceType,
    /** function to be called for each resource in this WorkspaceDb  */
    found: Workspace.ForEachResource
  ): Workspace.IterationReturn;

  /** @internal */
  queryFileResource(rscName: WorkspaceResource.Name): { localFileName: LocalFileName, info: IModelJsNative.EmbedFileQuery } | undefined;
}

/**
 * Options for constructing a [[Workspace]].
 * @beta
 */
export interface WorkspaceOpts {
  /** The local directory for non-cloud-based WorkspaceDb files. The workspace api will look in this directory
   * for files named `${containerId}/${dbId}.itwin-workspace`.
   * @note if not supplied, defaults to `iTwin/Workspace` in the user-local folder.
   */
  containerDir?: LocalDirName;

  /** the local fileName(s) of one or more settings files to load after the Workspace is first created. */
  settingsFiles?: LocalFileName | [LocalFileName];
}

/**
 * Settings and resources that customize an application for the current session.
 * See [Workspaces]($docs/learning/backend/Workspace)
 * @beta
 */
export interface Workspace {
  /** The directory for local WorkspaceDb files with the name `${containerId}/${dbId}.itwin-workspace`.
   * @internal
   */
  readonly containerDir: LocalDirName;

  /** The current [[Settings]] for this Workspace */
  readonly settings: Settings;

  /** Get The CloudCache for cloud-based WorkspaceContainers */
  getCloudCache(): CloudSqlite.CloudCache;

  /** search for a previously opened container.
   * @param containerId the id of the container
   * @returns the [[WorkspaceContainer]] for `containerId` if it was not previously opened with [[getContainer]]
   * @internal
   */
  findContainer(containerId: WorkspaceContainer.Id): WorkspaceContainer | undefined;

  /** Get a [[WorkspaceContainer]] by [[WorkspaceContainer.Props]]
   * @param props the properties of the `WorkspaceContainer`. If `props.containerId` was already opened, its WorkspaceContainer is returned.
   * Otherwise it is created.
   * @note this function allows a `WorkspaceContainer.Props` without its AccessToken. It will attempt to obtain one from the BlobContainer service,
   * hence this function is async.
   * @see [[getContainer]]
  */
  getContainerAsync(props: WorkspaceContainer.Props): Promise<WorkspaceContainer>;

  /** Get a WorkspaceContainer with a supplied access token. This function is synchronous and may be used if:
   * - a valid accessToken is al is already available
   * - the container has already been previously prefetched in another session (this is useful for offline usage)
   * - the container is public and doesn't require an accessToken
   * @see [[getContainerAsync]]
   */
  getContainer(props: WorkspaceContainer.Props & Workspace.WithAccessToken): WorkspaceContainer;

  /** Load a settings dictionary from the specified WorkspaceDb, and add it to the current Settings for this Workspace.
   * @note this function will load the dictionaries from the supplied list, and it will also call itself recursively for any entries in
   * the loaded Settings with the name `settingsWorkspaces`. In this manner, WorkspaceSettings may be "chained" together so that loading one
   * causes its "dependent" WorkspaceSettings to be loaded. Its Promise is resolve after all have been loaded (or failed).
   */
  loadSettingsDictionary(
    /** The properties of the WorkspaceDb, plus the resourceName and Settings.priority. May be either a single value or an array of them */
    props: WorkspaceSettings.Props | WorkspaceSettings.Props[],
    /** if present, an array that is populated with a list of problems while attempting to load the Settings.Dictionary(s).   */
    problems?: WorkspaceDb.LoadError[]
  ): Promise<void>;

  /** Get a single [[WorkspaceDb]] from a WorkspaceDb.CloudProps.  */
  getWorkspaceDb(props: WorkspaceDb.CloudProps): Promise<WorkspaceDb>;

  /**
   * Resolve the value of all Settings from this Workspace with the supplied settingName into an array of WorkspaceDb.CloudProps
   * that can be used to query or load workspace resources. The settings must each be of type `itwin/core/workspace/workspaceDbList`.
   * The returned array will be sorted according to user's priority-based wishes, with the first entry being the highest priority WorkspaceDb.
   * @note The list is built by combining, in order, all of the settings with the supplied SettingName. It may therefore include the
   * properties of same WorkspaceDb multiple times. This list is automatically de-duped by [[getWorkspaceDb]].
   * @note This function is rarely used directly. Usually it is called by [[getWorkspaceDbs]]. However, this function is synchronous and may sometimes
   * be useful for editors, tests, or diagnostics.
   */
  resolveWorkspaceDbSetting(
    /** the name of the */
    settingName: SettingName,
    /** optional filter to choose specific WorkspaceDbs from the settings values. If present, only  */
    filter?: Workspace.DbListFilter): WorkspaceDb.CloudProps[];

  /**
   * Get a sorted array of WorkspaceDbs that can be used to query or load resources. If the arguments supply a `settingName`, this function will
   * use [[resolveWorkspaceDbSetting]] to get get the array of WorkspaceDb.CloudProps.
   * @returns Promise for an array of WorkspaceDb sorted by priority so that resources found in WorkspaceDbs earlier in the list take precedence
   * over ones with the same name in later WorkspaceDbs. No WorkspaceDb will appear more than once in the list.
   * @note this function may request an accessToken for each WorkspaceDb if necessary, and hence is asynchronous.
   */
  getWorkspaceDbs(
    args: Workspace.DbListOrSettingName & {
      /** if supplied, this array is populated with a list of problems (e.g. no read permission) attempting to load WorkspacesDbs. */
      problems?: WorkspaceDb.LoadError[];
      /** only valid when called with a settingName, if so passed as `filter` argument to [[resolveWorkspaceDbSetting]]  */
      filter?: Workspace.DbListFilter;
    }): Promise<WorkspaceDb[]>;
}

/** @internal */
export interface OwnedWorkspace extends Workspace {
  /** Only the owner of a Workspace may close it. */
  close(): void;
}

/**
 * A WorkspaceContainer is a type of `CloudSqlite.CloudContainer` that holds one or more WorkspaceDbs. Normally a WorkspaceContainer will hold (many versions of) a single WorkspaceDb.
 * Each version of a WorkspaceDb is treated as immutable after it is created and is stored in the WorkspaceContainer indefinitely. That means that
 * older versions of the WorkspaceDb may continue to be used, for example by archived projects. For programmers familiar with [NPM](https://www.npmjs.com/), this is conceptually
 * similar and versioning follows the same rules as NPM using [Semantic Versioning](https://semver.org/).
 * @note It is possible to store more than one WorkspaceDb in the same WorkspaceContainer, but access rights are administered per WorkspaceContainer.
 * That is, if a user has rights to access a WorkspaceContainer, that right applies to all WorkspaceDbs in the WorkspaceContainer.
 * @beta
 */
export interface WorkspaceContainer {
  /** the local directory where this WorkspaceContainer will store temporary files extracted for file-resources.
   * @internal
   */
  readonly filesDir: LocalDirName;
  /** The unique identifier for a WorkspaceContainer a cloud storage account. */
  readonly workspace: Workspace;
  /** CloudContainer for this WorkspaceContainer (`undefined` if this is a local WorkspaceContainer.) */
  readonly cloudContainer?: CloudSqlite.CloudContainer;
  /** properties supplied when this container was loaded */
  readonly fromProps: WorkspaceContainer.Props;

  /** @internal */
  addWorkspaceDb(toAdd: WorkspaceDb): void;

  /**
   * Find the appropriate version of a WorkspaceDb in this WorkspaceContainer based on the SemVer rule
   * in the `WorkspaceDb.Props`.
   * If no version satisfying the WorkspaceDb.Props rules exists, throws an exception.
   */
  resolveDbFileName(props: WorkspaceDb.Props): WorkspaceDb.DbFullName;

  /** get a WorkspaceDb from this WorkspaceContainer. */
  getWorkspaceDb(props?: WorkspaceDb.Props): WorkspaceDb;

  /** Close and remove a currently opened [[WorkspaceDb]] from this Workspace.
   * @internal
   */
  closeWorkspaceDb(container: WorkspaceDb): void;
}

/** @beta */
export namespace Workspace {
  /** IModelHost applications may supply a different implementation to diagnose (rather than merely log) errors loading workspace data */
  export let exceptionDiagnosticFn = (e: WorkspaceDb.LoadErrors) => {  // eslint-disable-line prefer-const
    if (e instanceof Error)
      Logger.logException(loggerCategory, e);
    else
      UnexpectedErrors.handle(e);
  };
  /** passed to [[onSettingsDictionaryLoadedFn]] for every Setting.Dictionary that is loaded from a WorkspaceDb. */
  export interface SettingsDictionaryLoaded {
    /** The dictionary loaded */
    dict: Settings.Dictionary;
    /** The WorkspaceDb from which the dictionary was found. */
    from: WorkspaceDb;
  }
  /** IModelHost applications may set this variable for diagnostics or user feedback. It is called each time
   * any Settings.Dictionary is loaded from a WorkspaceDb. The default implementation calls `Logger.logInfo`.
   */
  export let onSettingsDictionaryLoadedFn = (loaded: SettingsDictionaryLoaded) => {  // eslint-disable-line prefer-const
    Logger.logInfo(loggerCategory, `loaded setting dictionary ${loaded.dict.props.name} from ${loaded.from.dbFileName}`);
  };

  const makeSettingName = (name: string) => `${"itwin/core/workspace"}/${name}`;

  /** Settings names used by the Workspace system. */
  export const settingName = {
    /** The name of a setting that, when present in a WorkspaceDb loaded by [[Workspace.loadSettingsDictionary]], will *automatically*
     * be used to find additional Settings.Dictionary(s) in other WorkspaceDbs (i.e. to "chain" the settings from one WorkspaceDb to others upon
     * which they depend.)
     */
    settingsWorkspaces: makeSettingName("settingsWorkspaces"),
  };

  export type SearchResourceType = "string" | "blob";
  export type IterationReturn = void | "stop";
  export type ForEachResource = (result: WorkspaceResource.SearchResult) => IterationReturn;

  /** either an array of [[WorkspaceDb.CloudProps]], or a settingName of a `itwin/core/workspace/workspaceDbList` from which the array can be resolved. */
  export type DbListOrSettingName = { readonly dbs: WorkspaceDb.CloudProps[], readonly settingName?: never } | { readonly settingName: string, readonly dbs?: never };

  /** called for each entry in a `itwin/core/workspace/workspaceDbList` setting by [[Workspace.resolveWorkspaceDbSetting]].
   * If this function returns `false` the value is skipped and the corresponding WorkspaceDb will not be returned.
   */
  export type DbListFilter = (
    /** The properties of the WorkspaceDb to be returned */
    dbProp: WorkspaceDb.CloudProps,
    /** the Settings.Dictionary holding the `itwin/core/workspace/workspaceDbList` setting. May be used, for example, to determine the
     * Settings.Priority of the dictionary.
     */
    dict: Settings.Dictionary
  ) => boolean;

  const queryResource = (dbList: WorkspaceDb[] | WorkspaceDb, search: WorkspaceResource.Search, resourceType: SearchResourceType, found: ForEachResource): IterationReturn => {
    if (!Array.isArray(dbList))
      dbList = [dbList];

    for (const db of dbList) {
      if ("stop" === db.queryResource(search, resourceType, found))
        return "stop";
    }
  };
  const loadResource = <T>(dbList: WorkspaceDb[] | WorkspaceDb, resourceType: SearchResourceType, rscName: WorkspaceResource.Name): T | undefined => {
    if (!Array.isArray(dbList))
      dbList = [dbList];
    for (const db of dbList) {
      const val = (resourceType === "string" ? db.getString(rscName) : db.getBlob(rscName)) as T | undefined;
      if (undefined !== val)
        return val; // first one wins
    }
    return undefined;
  };

  /**
   * Query one or more WorkspaceDbs for string resources whose names satisfy a search criteria. This may be used, for example, to create a list of available string resources
   * for UI.
   * @returns "stop" if the `found` function aborted the query
   */
  export const queryStringResource = (
    /** Either a single WorkspaceDb or a list of WorkspaceDbs in priority sorted order. */
    dbList: WorkspaceDb[] | WorkspaceDb,
    /** the query criteria for the search */
    search: WorkspaceResource.Search,
    /** function called for each resource that satisfies the search criteria.
     * @note Each WorkspaceDb is queried in order, so the `found` function may be called with the same resourceName multiple times. However, within a
     * single WorkspaceDb, it is called in unsorted order (i.e. resourceNames are *not* necessarily sorted alphabetically.)
     */
    found: ForEachResource,
  ): IterationReturn => queryResource(dbList, search, "string", found);

  /**
   * Query one or more WorkspaceDbs for blob resources whose names satisfy a search criteria. This may be used, for example, to create a list of available blob resources
   * for UI.
   * @returns "stop" if the `found` function aborted the query
   */
  export const queryBlobResource = (
    /** Either a single WorkspaceDb or a list of WorkspaceDbs in priority sorted order. */
    dbList: WorkspaceDb[] | WorkspaceDb,
    /** the query criteria for the search */
    search: WorkspaceResource.Search,
    /** function called for each resource that satisfies the search criteria.
     * @note Each WorkspaceDb is queried in order, so the `found` function may be called with the same resourceName multiple times. However, within a
     * single WorkspaceDb, it is called in unsorted order (i.e. resourceNames are *not* necessarily sorted alphabetically.)
     */
    found: ForEachResource,
  ): IterationReturn => queryResource(dbList, search, "blob", found);

  /** Load a string resource from the highest priority WorkspaceDb in a list.
   * @returns the value of the string resource or `undefined` if the resourceName is not present in any WorkspaceDb in the list.
   */
  export const loadStringResource = (
    /** Either a single WorkspaceDb or a list of WorkspaceDbs in priority sorted order. */
    dbList: WorkspaceDb[] | WorkspaceDb,
    /** The name of the string resource to load */
    rscName: WorkspaceResource.Name,
  ): string | undefined => loadResource(dbList, "string", rscName);

  /** Load a blob resource from the highest priority WorkspaceDb in a list.
   * @returns the value of the blob resource or `undefined` if the resourceName is not present in any WorkspaceDb in the list.
   */
  export const loadBlobResource = (
    /** Either a single WorkspaceDb or a list of WorkspaceDbs in priority sorted order. */
    dbList: WorkspaceDb[] | WorkspaceDb,
    /** The name of the blob resource to load */
    rscName: WorkspaceResource.Name,
  ): Uint8Array | undefined => loadResource(dbList, "blob", rscName);

  /** @internal */
  export function construct(settings: Settings, opts?: WorkspaceOpts): OwnedWorkspace {
    return new WorkspaceImpl(settings, opts);
  }

  /**
   * Construct a new `Workspace.Editor`
   * @note the caller becomes the owner of the Workspace.Editor and is responsible for calling `close` on it when it is no longer used.
   * It is illegal to have more than one Workspace.Editor active in a single session.
   */
  export function constructEditor(): Workspace.Editor {
    return new EditorImpl();
  }
  /** type that requires an accessToken */
  export interface WithAccessToken { accessToken: AccessToken }

  /** An editor used to supply workspace administrators tools for creating or editing WorkspaceDbs. */
  /**
   * Represents an editor that is associated with a workspace.
   */
  export interface Editor {
    /**
     * The workspace dedicated to this editor.
     * @note This workspace is independent of all iModel or IModelHost workspaces.
     * It does not share settings or WorkspaceDbs with others.
     */
    readonly workspace: Workspace;

    /**
     * Retrieves a container for the editor with the specified properties and access token.
     * @param props - The properties of the workspace container.
     * @returns A container for editing WorkspaceDbs.
     */
    getContainer(props: WorkspaceContainer.Props & WithAccessToken): Editor.Container;

    /**
     * Asynchronously retrieves a container for the editor with the specified properties.
     * @param props - The properties of the workspace container.
     * @returns A promise that resolves to a container for editing WorkspaceDbs.
     */
    getContainerAsync(props: WorkspaceContainer.Props): Promise<Editor.Container>;

    /**
     * Creates a new cloud container, for holding WorkspaceDbs, from the BlobContainer service.
     * @param props - The properties for creating a new container.
     * @returns A promise that resolves to a container for editing WorkspaceDbs.
     * @note The current user must have administrator rights for the iTwin for the container.
     */
    createNewCloudContainer(props: Editor.CreateNewContainerProps): Promise<Editor.Container>;

    /**
     * Closes this editor. All workspace containers are dropped.
     */
    close(): void;
  }

  export namespace Editor {

    /**
     * The properties needed to create a new container from the BlobContainer service
     */
    export interface CreateNewContainerProps {
      /**
       * The scope of the container. This determines the ownership of the container, how RBAC rights are assigned,
       * and the location of the datacenter
       */
      scope: BlobContainer.Scope;
      /** The manifest to be stored in the default WorkspaceDb in the new container. */
      manifest: WorkspaceDb.Manifest;
      /** Metadata stored by the BlobContainer service */
      metadata: Omit<BlobContainer.Metadata, "containerType">;
      dbName?: string;
    }

    /**
     * A Workspace.Editor.Container supplies methods for creating and modifying versions of a WorkspaceDb.
     */
    export interface Container extends WorkspaceContainer {
      /**
       * Create a copy of an existing WorkspaceDb in this Workspace.Editor.Container with a new version number.
       * This function is used by administrator tools that modify Workspaces.
       * This requires that the *write lock on the container be held*.
       * The copy should be modified with new content before the write lock is released,
       * and thereafter may never be modified again.
       * @note The copy actually shares all of the data with the original, but with copy-on-write if/when data in the new WorkspaceDb is modified.
       * @param props - The properties that determine the source WorkspaceDb for the new version.
       * @returns A promise that resolves to an object containing the old and new WorkspaceDb names and versions.
       */
      makeNewVersion(props: Container.MakeNewVersionProps): Promise<{ oldDb: WorkspaceDb.NameAndVersion, newDb: WorkspaceDb.NameAndVersion }>;

      /**
       * Create a new empty WorkspaceDb.
       * @param args - The arguments for creating the new WorkspaceDb.
       * @returns A promise that resolves to an EditableDb.
       */
      createDb(args: { dbName?: string, version?: string, manifest: WorkspaceDb.Manifest }): Promise<Editor.EditableDb>;

      /**
       * Get the cloud properties of this Container.
       */
      get cloudProps(): WorkspaceContainer.Props | undefined;

      /**
       * Get an Editor.EditableDb to add, delete, or update resources *within a newly created version* of a WorkspaceDb.
       * @param props - The properties of the WorkspaceDb.
       */
      getEditableDb(props: WorkspaceDb.Props): Editor.EditableDb;

      /**
       * Get an Editor.EditableDb to add, delete, or update resources *within a newly created version* of a WorkspaceDb.
       * @param props - The properties of the WorkspaceDb.
       */
      getWorkspaceDb(props: WorkspaceDb.Props): Editor.EditableDb;

      /**
       * Acquire the write lock on the container.
       * @param user - The user acquiring the write lock.
       */
      acquireWriteLock(user: string): void;

      /**
       * Release the write lock on the container. This should be called after all changes to the EditableDb are complete. It
       * "publishes" and uploads the changes to the new version of the EditableDb and it is thereafter immutable.
       */
      releaseWriteLock(): void;

      /**
       * Abandon any changes made to the container and release the write lock. Any newly created versions of WorkspaceDbs are discarded.
       */
      abandonChanges(): void;
    }

    export namespace Container {
      /**
       * The release increment for a version number.
       * @see [semver.ReleaseType](https://www.npmjs.com/package/semver)
       */
      export type VersionIncrement = "major" | "minor" | "patch" | "premajor" | "preminor" | "prepatch" | "prerelease";

      /**
       * The properties for creating a new version of a WorkspaceDb.
       */
      export interface MakeNewVersionProps {
        /**
         * The properties that determine the source WorkspaceDb for the new version.
         * This is usually the latest version, but it is possible to create patches to older versions.
         */
        fromProps?: WorkspaceDb.Props;
        /** The type of version increment to apply to the source version. */
        versionType: Container.VersionIncrement;
        /** For prerelease versions, a string that becomes part of the version name. */
        identifier?: string;
      }
    }

    /**
     * Create a new, empty, EditableDb file on the local filesystem for importing Workspace resources.
     */
    export function createEmptyDb(args: { localFileName: LocalFileName, manifest: WorkspaceDb.Manifest }) {
      WorkspaceSqliteDb.createNewDb(args.localFileName, args);
    }

    /**
     * An editable WorkspaceDb. This is used only by tools to allow administrators to create and modify WorkspaceDbs.
     * For cloud-based WorkspaceDbs, the write token must be obtained before the methods in this interface may be used.
     * Normally, only admins will have write access to Workspaces.
     * Only one admin at a time may be editing a Workspace.
     */
    export interface EditableDb extends WorkspaceDb {
      /**
       * Get the cloud properties of the WorkspaceDb.
       * @returns The cloud properties of the WorkspaceDb, or undefined if not available.
       */
      get cloudProps(): WorkspaceDb.CloudProps | undefined;

      /**
       * Update the contents of the manifest in this WorkspaceDb.
       * @param manifest - The updated manifest.
       */
      updateManifest(manifest: WorkspaceDb.Manifest): void;

      /**
       * Add or update a Settings resource to this WorkspaceDb.
       * @param settings - The settings object to add or update.
       * @param rscName - The name of the settings resource.
       */
      updateSettingsResource(settings: SettingObject, rscName?: string): void;

      /**
       * Add a new string resource to this WorkspaceDb.
       * @param rscName - The name of the string resource.
       * @param val - The string to save.
       */
      addString(rscName: WorkspaceResource.Name, val: string): void;

      /**
       * Update an existing string resource with a new value, or add it if it does not exist.
       * @param rscName - The name of the string resource.
       * @param val - The new value.
       */
      updateString(rscName: WorkspaceResource.Name, val: string): void;

      /**
       * Remove a string resource.
       * @param rscName - The name of the string resource to remove.
       */
      removeString(rscName: WorkspaceResource.Name): void;

      /**
       * Add a new blob resource to this WorkspaceDb.
       * @param rscName - The name of the blob resource.
       * @param val - The blob to save.
       */
      addBlob(rscName: WorkspaceResource.Name, val: Uint8Array): void;

      /**
       * Update an existing blob resource with a new value, or add it if it does not exist.
       * @param rscName - The name of the blob resource.
       * @param val - The new value.
       */
      updateBlob(rscName: WorkspaceResource.Name, val: Uint8Array): void;

      /**
       * Get a BlobIO writer for a previously-added blob WorkspaceResource.
       * @param rscName - The name of the blob resource.
       * @returns A BlobIO writer.
       * @note After writing is complete, the caller must call `close` on the BlobIO and must call `saveChanges` on the `db`.
       */
      getBlobWriter(rscName: WorkspaceResource.Name): SQLiteDb.BlobIO;

      /**
       * Remove a blob resource.
       * @param rscName - The name of the blob resource to remove.
       */
      removeBlob(rscName: WorkspaceResource.Name): void;

      /**
       * Copy the contents of an existing local file into this WorkspaceDb as a file resource.
       * @param rscName - The name of the file resource.
       * @param localFileName - The name of a local file to be read.
       * @param fileExt - The extension to be appended to the generated fileName when this WorkspaceDb is extracted from the WorkspaceDb.
       * By default, the characters after the last "." in `localFileName` are used. Pass this argument to override that.
       */
      addFile(rscName: WorkspaceResource.Name, localFileName: LocalFileName, fileExt?: string): void;

      /**
       * Replace an existing file resource with the contents of another local file.
       * @param rscName - The name of the file resource.
       * @param localFileName - The name of a local file to be read.
       * @throws If the file resource does not exist.
       */
      updateFile(rscName: WorkspaceResource.Name, localFileName: LocalFileName): void;

      /**
       * Remove a file resource.
       * @param rscName - The name of the file resource to remove.
       */
      removeFile(rscName: WorkspaceResource.Name): void;
    }

  }
}

interface WorkspaceCloudContainer extends CloudSqlite.CloudContainer {
  connectCount: number;
  sharedConnect(): boolean;
  sharedDisconnect(): void;
}
interface WorkspaceCloudCache extends CloudSqlite.CloudCache {
  workspaceContainers: Map<string, WorkspaceCloudContainer>;
}

function getContainerFullId(props: WorkspaceContainer.Props) {
  return `${props.baseUri}/${props.containerId}`;
}

function getWorkspaceCloudContainer(props: CloudSqlite.ContainerAccessProps, cache: WorkspaceCloudCache) {
  const id = getContainerFullId(props);
  let cloudContainer = cache.workspaceContainers.get(id);
  if (undefined !== cloudContainer)
    return cloudContainer;
  cloudContainer = CloudSqlite.createCloudContainer(props) as WorkspaceCloudContainer;
  cache.workspaceContainers.set(id, cloudContainer);
  cloudContainer.connectCount = 0;
  cloudContainer.sharedConnect = function (this: WorkspaceCloudContainer) {
    if (this.connectCount++ === 0) {
      this.connect(cache);
      return true;
    }
    return false;
  };
  cloudContainer.sharedDisconnect = function (this: WorkspaceCloudContainer) {
    if (--this.connectCount <= 0) {
      this.disconnect();
      cache.workspaceContainers.delete(id);
      this.connectCount = 0;
    }
  };
  return cloudContainer;
}
function makeWorkspaceCloudCache(arg: CloudSqlite.CreateCloudCacheArg): WorkspaceCloudCache {
  const cache = CloudSqlite.CloudCaches.getCache(arg) as WorkspaceCloudCache;
  if (undefined === cache.workspaceContainers) // if we just created this container, add the map.
    cache.workspaceContainers = new Map<string, WorkspaceCloudContainer>();
  return cache;
}

/** Implementation of Workspace */
class WorkspaceImpl implements Workspace {
  private _containers = new Map<WorkspaceContainer.Id, WorkspaceContainerImpl>();
  public readonly containerDir: LocalDirName;
  public readonly settings: Settings;
  protected _cloudCache?: WorkspaceCloudCache;
  public getCloudCache(): WorkspaceCloudCache {
    return this._cloudCache ??= makeWorkspaceCloudCache({ cacheName: "Workspace", cacheSize: "20G" });
  }

  public constructor(settings: Settings, opts?: WorkspaceOpts) {
    this.settings = settings;
    this.containerDir = opts?.containerDir ?? join(IModelHost.cacheDir, "Workspace");
    let settingsFiles = opts?.settingsFiles;
    if (settingsFiles) {
      if (typeof settingsFiles === "string")
        settingsFiles = [settingsFiles];
      settingsFiles.forEach((file) => settings.addFile(file, Settings.Priority.application));
    }
  }

  public addContainer(toAdd: WorkspaceContainerImpl) {
    if (undefined !== this._containers.get(toAdd.id))
      throw new Error("container already exists in workspace");
    this._containers.set(toAdd.id, toAdd);
  }

  public findContainer(containerId: WorkspaceContainer.Id) {
    return this._containers.get(containerId);
  }

  public getContainer(props: WorkspaceContainer.Props & Workspace.WithAccessToken): WorkspaceContainer {
    return this.findContainer(props.containerId) ?? new WorkspaceContainerImpl(this, props);
  }

  public async getContainerAsync(props: WorkspaceContainer.Props): Promise<WorkspaceContainer> {
    const accessToken = props.accessToken ?? ((props.baseUri === "") || props.isPublic) ? "" : await CloudSqlite.requestToken({ ...props, accessLevel: "read" });
    return this.getContainer({ ...props, accessToken });
  }

  public async getWorkspaceDb(props: WorkspaceDb.CloudProps): Promise<WorkspaceDb> {
    let container: WorkspaceContainer | undefined = this.findContainer(props.containerId);
    if (undefined === container) {
      const accessToken = props.isPublic ? "" : await CloudSqlite.requestToken({ accessLevel: "read", ...props });
      container = new WorkspaceContainerImpl(this, { ...props, accessToken });
    }
    return container.getWorkspaceDb(props);
  }

  public async loadSettingsDictionary(props: WorkspaceSettings.Props | WorkspaceSettings.Props[], problems?: WorkspaceDb.LoadError[]) {
    if (!Array.isArray(props))
      props = [props];

    for (const prop of props) {
      const db = await this.getWorkspaceDb(prop);
      db.open();
      try {
        const manifest = db.manifest;
        const dictProps: Settings.Dictionary.Props = { name: prop.resourceName, workspaceDb: db, priority: prop.priority };
        // don't load if we already have this dictionary. Happens if the same WorkspaceDb is in more than one list
        if (undefined === this.settings.getDictionary(dictProps)) {
          const settingsJson = db.getString(prop.resourceName);
          if (undefined === settingsJson)
            WorkspaceDb.throwLoadError(`could not load setting dictionary resource '${prop.resourceName}' from: '${manifest.workspaceName}'`, prop, db);

          db.close(); // don't leave this db open in case we're going to find another dictionary in it recursively.

          this.settings.addJson(dictProps, settingsJson);
          const dict = this.settings.getDictionary(dictProps);
          if (dict) {
            Workspace.onSettingsDictionaryLoadedFn({ dict, from: db });
            // if the dictionary we just loaded has a "settingsWorkspaces" entry, load them too, recursively
            const nested = dict.getSetting<WorkspaceSettings.Props[]>(Workspace.settingName.settingsWorkspaces);
            if (nested !== undefined) {
              SettingsSchemas.validateSetting<WorkspaceSettings.Props[]>(nested, Workspace.settingName.settingsWorkspaces);
              await this.loadSettingsDictionary(nested, problems);
            }
          }
        }
      } catch (e) {
        db.close();
        problems?.push(e as WorkspaceDb.LoadError);
      }
    }
  }

  public close() {
    this.settings.close();
    for (const [_id, container] of this._containers)
      container.close();
    this._containers.clear();
  }

  public resolveWorkspaceDbSetting(settingName: SettingName, filter?: Workspace.DbListFilter): WorkspaceDb.CloudProps[] {
    const result: WorkspaceDb.CloudProps[] = [];
    this.settings.resolveSetting<WorkspaceDb.CloudProps[]>({
      settingName, resolver: (dbProps, dict) => {
        for (const dbProp of dbProps) {
          if (!filter || filter(dbProp, dict))
            result.push(dbProp);
        }
        return undefined; // means keep going
      },
    });
    return result;
  }

  public async getWorkspaceDbs(args: Workspace.DbListOrSettingName & { filter?: Workspace.DbListFilter, problems?: WorkspaceDb.LoadError[] }): Promise<WorkspaceDb[]> {
    const dbList = (args.settingName !== undefined) ? this.resolveWorkspaceDbSetting(args.settingName, args.filter) : args.dbs;
    const result: WorkspaceDb[] = [];
    const pushUnique = (wsDb: WorkspaceDb) => {
      for (const db of result) {
        // if we already have this db, skip it. The test below also has to consider that we create a separate WorkspaceDb object for the same
        // database from more than one Workspace (though then they must use a "shared" CloudContainer).
        if (db === wsDb || ((db.container.cloudContainer === wsDb.container.cloudContainer) && (db.dbFileName === wsDb.dbFileName)))
          return; // this db is redundant
      }
      result.push(wsDb);
    };

    for (const dbProps of dbList) {
      try {
        pushUnique(await this.getWorkspaceDb(dbProps));
      } catch (e) {
        const loadErr = e as WorkspaceDb.LoadError;
        loadErr.wsDbProps = dbProps;
        args.problems?.push(loadErr);
      }
    }
    return result;
  }
}

class WorkspaceContainerImpl implements WorkspaceContainer {
  public readonly workspace: WorkspaceImpl;
  public readonly filesDir: LocalDirName;
  public readonly id: WorkspaceContainer.Id;
  public readonly fromProps: WorkspaceContainer.Props;

  public readonly cloudContainer?: WorkspaceCloudContainer | undefined;
  protected _wsDbs = new Map<WorkspaceDb.DbName, WorkspaceDb>();
  public get dirName() { return join(this.workspace.containerDir, this.id); }

  public constructor(workspace: WorkspaceImpl, props: WorkspaceContainer.Props & { accessToken: AccessToken }) {
    WorkspaceContainer.validateContainerId(props.containerId);
    this.workspace = workspace;
    this.id = props.containerId;
    this.fromProps = props;

    if (props.baseUri !== "")
      this.cloudContainer = getWorkspaceCloudContainer(props, this.workspace.getCloudCache());

    workspace.addContainer(this);
    this.filesDir = join(this.dirName, "Files");

    const cloudContainer = this.cloudContainer;
    if (undefined === cloudContainer)
      return;

    // sharedConnect returns true if we just connected (if the container is shared, it may have already been connected)
    if (cloudContainer.sharedConnect() && false !== props.syncOnConnect) {
      try {
        cloudContainer.checkForChanges();
      } catch (e: unknown) {
        // must be offline
      }
    }
  }

  public resolveDbFileName(props: WorkspaceDb.Props): WorkspaceDb.DbFullName {
    const cloudContainer = this.cloudContainer;
    if (undefined === cloudContainer)
      return join(this.dirName, `${props.dbName}.${WorkspaceDb.fileExt}`); // local file, versions not allowed

    const dbName = WorkspaceDb.dbNameWithDefault(props.dbName);
    const dbs = cloudContainer.queryDatabases(`${dbName}*`); // get all databases that start with dbName

    const versions = [];
    for (const db of dbs) {
      const thisDb = WorkspaceContainer.parseDbFileName(db);
      if (thisDb.dbName === dbName && "string" === typeof thisDb.version && thisDb.version.length > 0)
        versions.push(thisDb.version);
    }

    if (versions.length === 0)
      versions[0] = "1.0.0";

    const range = props.version ?? "*";
    try {
      const version = semver.maxSatisfying(versions, range, { loose: true, includePrerelease: props.includePrerelease });
      if (version)
        return `${dbName}:${version}`;
    } catch (e: unknown) {
    }
    WorkspaceDb.throwLoadError(`No version of '${dbName}' available for "${range}"`, props);
  }

  public addWorkspaceDb(toAdd: WorkspaceDb) {
    if (undefined !== this._wsDbs.get(toAdd.dbName))
      throw new Error(`workspaceDb '${toAdd.dbName}' already exists in workspace`);
    this._wsDbs.set(toAdd.dbName, toAdd);
  }

  public getWorkspaceDb(props?: WorkspaceDb.Props): WorkspaceDb {
    return this._wsDbs.get(WorkspaceDb.dbNameWithDefault(props?.dbName)) ?? new WorkspaceDbImpl(props ?? {}, this);
  }

  public closeWorkspaceDb(toDrop: WorkspaceDb) {
    const name = toDrop.dbName;
    const wsDb = this._wsDbs.get(name);
    if (wsDb === toDrop) {
      this._wsDbs.delete(name);
      wsDb.close();
    }
  }

  public close() {
    for (const [_name, db] of this._wsDbs)
      db.close();
    this._wsDbs.clear();
    this.cloudContainer?.sharedDisconnect();
  }
}

class WorkspaceSqliteDb extends VersionedSqliteDb {
  public override myVersion = "1.0.0";
  public override getRequiredVersions(): SQLiteDb.RequiredVersionRanges {
    try {
      return super.getRequiredVersions();
    } catch (e) {
      // early versions didn't have a version range, but they're fine
      return { readVersion: "^1", writeVersion: "^1" };
    }
  }

  protected override createDDL(args: any): void {
    const timeStampCol = "lastMod TIMESTAMP NOT NULL DEFAULT(julianday('now'))";
    this.executeSQL(`CREATE TABLE strings(id TEXT PRIMARY KEY NOT NULL,value TEXT,${timeStampCol})`);
    this.executeSQL(`CREATE TABLE blobs(id TEXT PRIMARY KEY NOT NULL,value BLOB,${timeStampCol})`);
    const createTrigger = (tableName: string) => {
      this.executeSQL(`CREATE TRIGGER ${tableName}_timeStamp AFTER UPDATE ON ${tableName} WHEN old.lastMod=new.lastMod AND old.lastMod != julianday('now') BEGIN UPDATE ${tableName} SET lastMod=julianday('now') WHERE id=new.id; END`);
    };
    createTrigger("strings");
    createTrigger("blobs");
    if (args?.manifest)
      this.nativeDb.saveFileProperty(WorkspaceDbImpl.manifestProperty, JSON.stringify(args.manifest));
  }
}

/** Implementation of WorkspaceDb */
class WorkspaceDbImpl implements WorkspaceDb {
  public static manifestProperty = { namespace: "workspace", name: "manifest" };
  public readonly sqliteDb = new WorkspaceSqliteDb();
  public readonly dbName: WorkspaceDb.DbName;
  public readonly container: WorkspaceContainer;
  public readonly onClose = new BeEvent<() => void>();
  public readonly dbFileName: string;
  private _manifest?: WorkspaceDb.Manifest;

  /** true if this WorkspaceDb is currently open */
  public get isOpen() { return this.sqliteDb.isOpen; }
  public queryFileResource(rscName: WorkspaceResource.Name): { localFileName: LocalFileName, info: IModelJsNative.EmbedFileQuery } | undefined {
    const info = this.sqliteDb.nativeDb.queryEmbeddedFile(rscName);
    if (undefined === info)
      return undefined;

    // since resource names can contain illegal characters, path separators, etc., we make the local file name from its hash, in hex.
    let localFileName = join(this.container.filesDir, createHash("sha1").update(this.dbFileName).update(rscName).digest("hex"));
    if (info.fileExt !== "") // since some applications may expect to see the extension, append it here if it was supplied.
      localFileName = `${localFileName}.${info.fileExt}`;
    return { localFileName, info };
  }

  public constructor(props: WorkspaceDb.Props, container: WorkspaceContainer) {
    this.dbName = WorkspaceDb.dbNameWithDefault(props.dbName);
    WorkspaceContainer.validateDbName(this.dbName);
    this.container = container;
    this.dbFileName = container.resolveDbFileName(props);
    container.addWorkspaceDb(this);
    if (true === props.prefetch)
      this.prefetch();
  }

  public open() {
    this.sqliteDb.openDb(this.dbFileName, OpenMode.Readonly, this.container.cloudContainer);
  }

  public close() {
    if (this.isOpen) {
      this.onClose.raiseEvent();
      this.sqliteDb.closeDb();
      this.container.closeWorkspaceDb(this);
    }
  }
  public get version() {
    return WorkspaceContainer.parseDbFileName(this.dbFileName).version;
  }

  public get manifest(): WorkspaceDb.Manifest {
    return this._manifest ??= this.withOpenDb((db) => {
      const manifestJson = db.nativeDb.queryFileProperty(WorkspaceDbImpl.manifestProperty, true) as string | undefined;
      return manifestJson ? JSON.parse(manifestJson) : { workspaceName: this.dbName };
    });
  }

  private withOpenDb<T>(operation: (db: WorkspaceSqliteDb) => T): T {
    const done = this.isOpen ? () => { } : (this.open(), () => this.close());
    try {
      return operation(this.sqliteDb);
    } finally {
      done();
    }
  }

  public getString(rscName: WorkspaceResource.Name): string | undefined {
    return this.withOpenDb((db) => {
      return db.withSqliteStatement("SELECT value from strings WHERE id=?", (stmt) => {
        stmt.bindString(1, rscName);
        return DbResult.BE_SQLITE_ROW === stmt.step() ? stmt.getValueString(0) : undefined;
      });
    });
  }

  public getBlobReader(rscName: WorkspaceResource.Name): SQLiteDb.BlobIO {
    return this.sqliteDb.withSqliteStatement("SELECT rowid from blobs WHERE id=?", (stmt) => {
      stmt.bindString(1, rscName);
      const blobReader = SQLiteDb.createBlobIO();
      blobReader.open(this.sqliteDb.nativeDb, { tableName: "blobs", columnName: "value", row: stmt.getValueInteger(0) });
      return blobReader;
    });
  }

  public getBlob(rscName: WorkspaceResource.Name): Uint8Array | undefined {
    return this.withOpenDb((db) => {
      return db.withSqliteStatement("SELECT value from blobs WHERE id=?", (stmt) => {
        stmt.bindString(1, rscName);
        return DbResult.BE_SQLITE_ROW === stmt.step() ? stmt.getValueBlob(0) : undefined;
      });
    });
  }

  public getFile(rscName: WorkspaceResource.Name, targetFileName?: LocalFileName): LocalFileName | undefined {
    return this.withOpenDb((db) => {
      const file = this.queryFileResource(rscName);
      if (!file)
        return undefined;

      const info = file.info;
      const localFileName = targetFileName ?? file.localFileName;

      // check whether the file is already up to date.
      const stat = fs.existsSync(localFileName) && fs.statSync(localFileName);
      if (stat && Math.round(stat.mtimeMs) === info.date && stat.size === info.size)
        return localFileName; // yes, we're done

      // extractEmbeddedFile fails if the file exists or if the directory does not exist
      if (stat)
        fs.removeSync(localFileName);
      else
        IModelJsFs.recursiveMkDirSync(dirname(localFileName));

      db.nativeDb.extractEmbeddedFile({ name: rscName, localFileName });
      const date = new Date(info.date);
      fs.utimesSync(localFileName, date, date); // set the last-modified date of the file to match date in container
      fs.chmodSync(localFileName, "0444"); // set file readonly
      return localFileName;
    });
  }

  public prefetch(opts?: CloudSqlite.PrefetchProps): CloudSqlite.CloudPrefetch {
    const cloudContainer = this.container.cloudContainer;
    if (cloudContainer === undefined)
      throw new Error("no cloud container to prefetch");
    return CloudSqlite.startCloudPrefetch(cloudContainer, this.dbFileName, opts);
  }

  public queryResource(search: WorkspaceResource.Search, resourceType: Workspace.SearchResourceType, callback: Workspace.ForEachResource): Workspace.IterationReturn {
    return this.withOpenDb((db) => {
      return db.withSqliteStatement(`SELECT id from ${resourceType}s WHERE id ${search.nameCompare ?? "="} ?`, (stmt) => {
        stmt.bindString(1, search.nameSearch);
        while (DbResult.BE_SQLITE_ROW === stmt.step()) {
          if (callback({ workspaceDb: this, rscName: stmt.getValueString(0) }) === "stop")
            return "stop";
        }
        return;
      });
    });
  }
}

const workspaceEditorName = "WorkspaceEditor"; // name of the cache for the editor workspace
class EditorWorkspaceImpl extends WorkspaceImpl {
  public override getCloudCache(): WorkspaceCloudCache {
    return this._cloudCache ??= makeWorkspaceCloudCache({ cacheName: workspaceEditorName, cacheSize: "20G" });
  }
}

class EditorImpl implements Workspace.Editor {
  public workspace = new EditorWorkspaceImpl(new BaseSettings(), { containerDir: join(IModelHost.cacheDir, workspaceEditorName) });

  public async initializeContainer(args: Workspace.Editor.CreateNewContainerProps) {
    class CloudAccess extends CloudSqlite.DbAccess<WorkspaceSqliteDb> {
      protected static override _cacheName = workspaceEditorName;
      public static async initializeWorkspace(args: Workspace.Editor.CreateNewContainerProps) {
        const props = await this.createBlobContainer({ scope: args.scope, metadata: { ...args.metadata, containerType: "workspace" } });
        const dbFullName = WorkspaceContainer.makeDbFileName(WorkspaceDb.dbNameWithDefault(args.dbName), "1.0.0");
        await super._initializeDb({ ...args, props, dbName: dbFullName, dbType: WorkspaceSqliteDb, blockSize: "4M" });
        return props;
      }
    }
    return CloudAccess.initializeWorkspace(args);
  }

  public async createNewCloudContainer(args: Workspace.Editor.CreateNewContainerProps): Promise<Workspace.Editor.Container> {
    const cloudContainer = await this.initializeContainer(args);
    const userToken = await IModelHost.authorizationClient?.getAccessToken();
    const accessToken = await CloudSqlite.requestToken({ ...cloudContainer, accessLevel: "write", userToken });
    return this.getContainer({ accessToken, ...cloudContainer, writeable: true, description: args.metadata.description });
  }

  public getContainer(props: WorkspaceContainer.Props & Workspace.WithAccessToken): Workspace.Editor.Container {
    return this.workspace.findContainer(props.containerId) as Workspace.Editor.Container | undefined ?? new EditorContainerImpl(this.workspace, props);
  }
  public async getContainerAsync(props: WorkspaceContainer.Props): Promise<Workspace.Editor.Container> {
    const accessToken = props.accessToken ?? (props.baseUri === "") ? "" : await CloudSqlite.requestToken({ ...props, accessLevel: "write" });
    return this.getContainer({ ...props, accessToken });
  }

  public close() {
    this.workspace.close();
  }
}

interface EditCloudContainer extends CloudSqlite.CloudContainer {
  writeLockHeldBy?: string;  // added by acquireWriteLock
}

class EditorContainerImpl extends WorkspaceContainerImpl implements Workspace.Editor.Container {
  public get cloudProps(): WorkspaceContainer.Props | undefined {
    const cloudContainer = this.cloudContainer;
    if (undefined === cloudContainer)
      return undefined;
    return {
      baseUri: cloudContainer.baseUri,
      containerId: cloudContainer.containerId,
      storageType: cloudContainer.storageType as "azure" | "google",
      isPublic: cloudContainer.isPublic,
    };
  }
  public async makeNewVersion(args: Workspace.Editor.Container.MakeNewVersionProps): Promise<{ oldDb: WorkspaceDb.NameAndVersion, newDb: WorkspaceDb.NameAndVersion }> {
    const cloudContainer = this.cloudContainer;
    if (undefined === cloudContainer)
      throw new Error("versions require cloud containers");

    const oldName = this.resolveDbFileName(args.fromProps ?? {});
    const oldDb = WorkspaceContainer.parseDbFileName(oldName);
    const newVersion = semver.inc(oldDb.version, args.versionType, args.identifier);
    if (!newVersion)
      WorkspaceDb.throwLoadError("invalid version", args.fromProps ?? {});

    const newName = WorkspaceContainer.makeDbFileName(oldDb.dbName, newVersion);
    await cloudContainer.copyDatabase(oldName, newName);
    // return the old and new db names and versions
    return { oldDb, newDb: { dbName: oldDb.dbName, version: newVersion } };
  }

  public override getWorkspaceDb(props: WorkspaceDb.Props): Workspace.Editor.EditableDb {
    return this.getEditableDb(props);
  }
  public getEditableDb(props: WorkspaceDb.Props): Workspace.Editor.EditableDb {
    const db = this._wsDbs.get(WorkspaceDb.dbNameWithDefault(props.dbName)) as EditableDbImpl | undefined ?? new EditableDbImpl(props, this);
    if (this.cloudContainer && this.cloudContainer.queryDatabase(db.dbFileName)?.state !== "copied")
      throw new Error(`${db.dbFileName} has been published and is not editable. Make a new version first.`);
    return db;
  }

  public acquireWriteLock(user: string): void {
    const cloudContainer = this.cloudContainer as EditCloudContainer | undefined;
    if (cloudContainer) {
      cloudContainer.acquireWriteLock(user);
      cloudContainer.writeLockHeldBy = user;
    }
  }
  public releaseWriteLock() {
    const cloudContainer = this.cloudContainer as EditCloudContainer | undefined;
    if (cloudContainer) {
      cloudContainer.releaseWriteLock();
      cloudContainer.writeLockHeldBy = undefined;
    }
  }
  public abandonChanges() {
    const cloudContainer = this.cloudContainer as EditCloudContainer | undefined;
    if (cloudContainer) {
      cloudContainer.abandonChanges();
      cloudContainer.writeLockHeldBy = undefined;
    }
  }
  public async createDb(args: { dbName?: string, version?: string, manifest: WorkspaceDb.Manifest }): Promise<Workspace.Editor.EditableDb> {
    if (!this.cloudContainer) {
      Workspace.Editor.createEmptyDb({ localFileName: this.resolveDbFileName(args), manifest: args.manifest });
    } else {
      // currently the only way to create a workspaceDb in a cloud container is to create a temporary workspaceDb and upload it.
      const tempDbFile = join(KnownLocations.tmpdir, `empty.${WorkspaceDb.fileExt}`);
      if (fs.existsSync(tempDbFile))
        IModelJsFs.removeSync(tempDbFile);
      Workspace.Editor.createEmptyDb({ localFileName: tempDbFile, manifest: args.manifest });
      await CloudSqlite.uploadDb(this.cloudContainer, { localFileName: tempDbFile, dbName: WorkspaceContainer.makeDbFileName(WorkspaceDb.dbNameWithDefault(args.dbName), args.version) });
      IModelJsFs.removeSync(tempDbFile);
    }
    return this.getWorkspaceDb(args);
  }
}

class EditableDbImpl extends WorkspaceDbImpl implements Workspace.Editor.EditableDb {
  private static validateResourceName(name: WorkspaceResource.Name) {
    noLeadingOrTrailingSpaces(name, "resource name");
    if (name.length > 1024)
      throw new Error("resource name too long");
  }

  private validateResourceSize(val: Uint8Array | string) {
    const len = typeof val === "string" ? val.length : val.byteLength;
    if (len > (1024 * 1024 * 1024)) // one gigabyte
      throw new Error("value is too large");
  }
  public get cloudProps(): WorkspaceDb.CloudProps | undefined {
    const props = (this.container as EditorContainerImpl).cloudProps as Mutable<WorkspaceDb.CloudProps>;
    if (props === undefined)
      return undefined;

    const parsed = WorkspaceContainer.parseDbFileName(this.dbFileName);
    return { ...props, dbName: parsed.dbName, version: parsed.version };
  }

  public override open() {
    this.sqliteDb.openDb(this.dbFileName, OpenMode.ReadWrite, this.container.cloudContainer);
  }

  public override close() {
    if (this.isOpen) {
      // whenever we close an EditableDb, update the name of the last editor in the manifest
      const lastEditedBy = (this.container.cloudContainer as any)?.writeLockHeldBy;
      if (lastEditedBy !== undefined)
        this.updateManifest({ ...this.manifest, lastEditedBy });

      // make sure all changes were saved before we close
      this.sqliteDb.saveChanges();
    }
    super.close();
  }

  private getFileModifiedTime(localFileName: LocalFileName): number {
    return Math.round(fs.statSync(localFileName).mtimeMs);
  }

  private performWriteSql(rscName: WorkspaceResource.Name, sql: string, bind?: (stmt: SqliteStatement) => void) {
    this.sqliteDb.withSqliteStatement(sql, (stmt) => {
      stmt.bindString(1, rscName);
      bind?.(stmt);
      const rc = stmt.step();
      if (DbResult.BE_SQLITE_DONE !== rc) {
        if (DbResult.BE_SQLITE_CONSTRAINT_PRIMARYKEY === rc)
          throw new IModelError(rc, `resource "${rscName}" already exists`);

        throw new IModelError(rc, `workspace [${sql}]`);
      }
    });
    this.sqliteDb.saveChanges();
  }

  public updateManifest(manifest: WorkspaceDb.Manifest) {
    this.sqliteDb.nativeDb.saveFileProperty(WorkspaceDbImpl.manifestProperty, JSON.stringify(manifest));
  }
  public updateSettingsResource(settings: SettingObject, rscName?: string) {
    this.updateString(rscName ?? "settingsDictionary", JSON.stringify(settings));
  }
  public addString(rscName: WorkspaceResource.Name, val: string): void {
    EditableDbImpl.validateResourceName(rscName);
    this.validateResourceSize(val);
    this.performWriteSql(rscName, "INSERT INTO strings(id,value) VALUES(?,?)", (stmt) => stmt.bindString(2, val));
  }
  public updateString(rscName: WorkspaceResource.Name, val: string): void {
    this.validateResourceSize(val);
    this.performWriteSql(rscName, "INSERT INTO strings(id,value) VALUES(?,?) ON CONFLICT(id) DO UPDATE SET value=excluded.value WHERE value!=excluded.value", (stmt) => stmt.bindString(2, val));
  }
  public removeString(rscName: WorkspaceResource.Name): void {
    this.performWriteSql(rscName, "DELETE FROM strings WHERE id=?");
  }
  public addBlob(rscName: WorkspaceResource.Name, val: Uint8Array): void {
    EditableDbImpl.validateResourceName(rscName);
    this.validateResourceSize(val);
    this.performWriteSql(rscName, "INSERT INTO blobs(id,value) VALUES(?,?)", (stmt) => stmt.bindBlob(2, val));
  }
  public updateBlob(rscName: WorkspaceResource.Name, val: Uint8Array): void {
    this.validateResourceSize(val);
    this.performWriteSql(rscName, "INSERT INTO blobs(id,value) VALUES(?,?) ON CONFLICT(id) DO UPDATE SET value=excluded.value WHERE value!=excluded.value", (stmt) => stmt.bindBlob(2, val));
  }
  public getBlobWriter(rscName: WorkspaceResource.Name): SQLiteDb.BlobIO {
    return this.sqliteDb.withSqliteStatement("SELECT rowid from blobs WHERE id=?", (stmt) => {
      stmt.bindString(1, rscName);
      const blobWriter = SQLiteDb.createBlobIO();
      blobWriter.open(this.sqliteDb.nativeDb, { tableName: "blobs", columnName: "value", row: stmt.getValueInteger(0), writeable: true });
      return blobWriter;
    });
  }
  public removeBlob(rscName: WorkspaceResource.Name): void {
    this.performWriteSql(rscName, "DELETE FROM blobs WHERE id=?");
  }
  public addFile(rscName: WorkspaceResource.Name, localFileName: LocalFileName, fileExt?: string): void {
    EditableDbImpl.validateResourceName(rscName);
    fileExt = fileExt ?? extname(localFileName);
    if (fileExt?.[0] === ".")
      fileExt = fileExt.slice(1);
    this.sqliteDb.nativeDb.embedFile({ name: rscName, localFileName, date: this.getFileModifiedTime(localFileName), fileExt });
  }
  public updateFile(rscName: WorkspaceResource.Name, localFileName: LocalFileName): void {
    this.queryFileResource(rscName); // throws if not present
    this.sqliteDb.nativeDb.replaceEmbeddedFile({ name: rscName, localFileName, date: this.getFileModifiedTime(localFileName) });
  }
  public removeFile(rscName: WorkspaceResource.Name): void {
    const file = this.queryFileResource(rscName);
    if (undefined === file)
      throw new Error(`file resource "${rscName}" does not exist`);
    if (file && fs.existsSync(file.localFileName))
      fs.unlinkSync(file.localFileName);
    this.sqliteDb.nativeDb.removeEmbeddedFile(rscName);
  }
}
