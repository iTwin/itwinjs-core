/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
/** @packageDocumentation
 * @module Workspace
 */

import * as semver from "semver";
import { AccessToken, BeEvent, Logger, Optional, UnexpectedErrors } from "@itwin/core-bentley";
import { LocalDirName, LocalFileName } from "@itwin/core-common";
import { CloudSqlite } from "../CloudSqlite";
import { SQLiteDb, VersionedSqliteDb } from "../SQLiteDb";
import { SettingName, Settings } from "./Settings";
import type { IModelJsNative } from "@bentley/imodeljs-native";
import { constructWorkspace, constructWorkspaceDb } from "../internal/workspace/WorkspaceImpl";
import { BackendLoggerCategory } from "../BackendLoggerCategory";

// cspell:ignore rowid julianday primarykey premajor preminor prepatch

function noLeadingOrTrailingSpaces(name: string, msg: string) {
  if (name.trim() !== name)
    throw new Error(`${msg} [${name}] may not have leading or trailing spaces`);
}
const loggerCategory = BackendLoggerCategory.Workspace;

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

  /** @internal */
  export const manifestProperty = { namespace: "workspace", name: "manifest" };

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
    return constructWorkspaceDb(props, container);
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
  settingsFiles?: LocalFileName | LocalFileName[];
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
    return constructWorkspace(settings, opts);
  }

  /** type that requires an accessToken */
  export interface WithAccessToken { accessToken: AccessToken }
}

/** @internal */
export class WorkspaceSqliteDb extends VersionedSqliteDb {
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
      this.nativeDb.saveFileProperty(WorkspaceDb.manifestProperty, JSON.stringify(args.manifest));
  }
}


