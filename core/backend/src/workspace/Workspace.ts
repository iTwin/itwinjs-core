/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
/** @packageDocumentation
 * @module Workspace
 */

import { AccessToken, BeEvent, Logger, Optional, UnexpectedErrors } from "@itwin/core-bentley";
import { LocalDirName, LocalFileName } from "@itwin/core-common";
import { CloudSqlite } from "../CloudSqlite";
import { SQLiteDb } from "../SQLiteDb";
import { SettingName, Settings, SettingsDictionary, SettingsPriority } from "./Settings";
import type { IModelJsNative } from "@bentley/imodeljs-native";
import { BackendLoggerCategory } from "../BackendLoggerCategory";
import { _implementationProhibited } from "../internal/Symbols";

/** The unique identifier of a [[WorkspaceContainer]]. This becomes the base name for a local file directory holding the container's [[WorkspaceDb]]s.
 * A valid `WorkspaceContainerId` must conform to the following constraints:
 *  - Consist solely of a combination of lower case letters, numbers, and dashes.
 *  - May not start or end with a dash.
 *  - Must be at least 3 characters long and no longer than 63 characters.
 * @beta
 */
export type WorkspaceContainerId = string;

/** Properties describing a [[WorkspaceContainer]] for methods like [[Workspace.getContainerAsync]].
 * @beta
 */
export interface WorkspaceContainerProps extends Optional<CloudSqlite.ContainerAccessProps, "accessToken"> {
  /** Whether to synchronize the container via [[CloudSqlite.CloudContainer.checkForChanges]] whenever it is connected to a [[CloudSqlite.CloudCache]].
   * @note This property defaults to `true`.
   */
  readonly syncOnConnect?: boolean;
  /** A user-friendly description of the container's contents. */
  readonly description?: string;
  /** A message to display to the user if problems occur while loading the container. */
  readonly loadingHelp?: string;
}

/** The base name of a [[WorkspaceDb]], without any version information.
 * The name must conform to the following constraints:
 * - Case-insensitively unique among all [[WorkspaceDb]]s in the same [[WorkspaceContainer]].
 * - Between 1 and 255 characters in length.
 * - A legal filename on both [Windows](https://learn.microsoft.com/en-us/windows/win32/fileio/naming-a-file#naming-conventions) and UNIX.
 * - Contain none of the following characters: forward or backward slash, period, single or double quote, backtick, and "#".
 * - Begin or end with a whitespace character.
 * @see [[WorkspaceDbFullName]] for the fully-specified name, including version information.
 * @beta
 */
export type WorkspaceDbName = string;

/** The fully-specified name of a [[WorkspaceDb]], combining its [[WorkspaceDbName]] and [[WorkspaceDbVersion]] in the format "name:version".
 * @beta
 */
export type WorkspaceDbFullName = string;

/** A [semver](https://github.com/npm/node-semver) string describing the version of a [[WorkspaceDb]], e.g., "4.2.11".
 * @beta
 */
export type WorkspaceDbVersion = string;

/** A [semver string](https://github.com/npm/node-semver?tab=readme-ov-file#ranges) describing a range of acceptable [[WorkspaceDbVersion]]s,
 * e.g., ">=1.2.7 <1.3.0".
 * @beta
 */
export type WorkspaceDbVersionRange = string;

/** Specifies the name and version of a [[WorkspaceDb]].
 * @beta
 */
export interface WorkspaceDbNameAndVersion {
  /** The name of the [[WorkspaceDb]]. If omitted, it defaults to "workspace-db". */
  readonly dbName?: WorkspaceDbName;
  /** The range of acceptable versions of the [[WorkspaceDb]] of the specified [[dbName]].
   * If omitted, it defaults to the newest available version.
   */
  readonly version?: WorkspaceDbVersionRange;
}

/** Properties that specify how to load a [[WorkspaceDb]] within a [[WorkspaceContainer]].
 * @beta
 */
export interface WorkspaceDbProps extends WorkspaceDbNameAndVersion {
  /** If true, allow semver [prerelease versions](https://github.com/npm/node-semver?tab=readme-ov-file#prerelease-tags), e.g., "1.4.2-beta.0".
   * By default, only released version are allowed.
   */
  readonly includePrerelease?: boolean;
  /** If true, start a prefetch operation whenever this [[WorkspaceDb]] is opened, to begin downloading pages of the database before they are needed. */
  readonly prefetch?: boolean;
}

/** Properties describing a [[WorkspaceDb]] and the [[WorkspaceContainer]] containing it.
 * @beta
 */
export type WorkspaceDbCloudProps = WorkspaceDbProps & WorkspaceContainerProps;

/** A function supplied as [[WorkspaceDbQueryResourcesArgs.callback]] to be invoked to process the requested resources.
 * @beta
 */
export type WorkspaceDbQueryResourcesCallback = (resourceNames: Iterable<string>) => void;

/** Arguments supplied to [[WorkspaceDb.queryResources]].
 * @beta
 */
export interface WorkspaceDbQueryResourcesArgs {
  /** The type of resource to query. */
  type?: "string" | "blob";
  /** A pattern against which to compare the name of each resource, using [[nameCompare]] as the comparison operator.
   * Only resources whose names match the pattern will be included in the query results.
   */
  namePattern?: string;
  /** The comparison operator by which to compare the name of each resource to [[namePattern]].
   * Only resources whose names match the pattern will be included in the query results.
   * Ignored if [[namePattern]] is undefined.
   */
  nameCompare?: "GLOB" | "LIKE" | "NOT GLOB" | "NOT LIKE" | "=" | "<" | ">";
  /** A function invoked to process the resources that match the query criterion. */
  callback: WorkspaceDbQueryResourcesCallback;
}

/** Metadata stored inside a [[WorkspaceDb]] describing the database's contents, to help users understand the purpose of the [[WorkspaceDb]], who to
  * contact with questions about it, and so on.
  * @note Only the [[workspaceName]] field is required, and users may add additional fields for their own purposes.
  * @note Since the information is stored inside of the [[WorkspaceDb]], it is versioned along with the rest of the contents.
  * @beta
  */
export interface WorkspaceDbManifest {
  /** The name of the [[WorkspaceDb]] to be shown in user interfaces. Organizations should attempt to make this name informative enough
   * so that uses may refer to this name in conversations. It should also be unique enough that there's no confusion when it appears in
   * lists of WorkspaceDbs.
   * @note it is possible and valid to change the workspaceName between new version of a WorkspaceDb (e.g. incorporating a date).
   */
  readonly workspaceName: string;
  /** A description of the contents of this [[WorkspaceDb]] to help users understand its purpose and appropriate usage. */
  readonly description?: string;
  /** The name of the person to contact with questions about this [[WorkspaceDb]]. */
  readonly contactName?: string;
  /** The name of the person who last modified this [[WorkspaceDb]]. */
  readonly lastEditedBy?: string;
}

/**
 * An exception thrown when attempting to load a [[WorkspaceDb]] or some of its data; for example, if the [[WorkspaceDb]] could not be found or the user
 * is not authorized to access its [[WorkspaceContainer]].
 * @beta
 */
export interface WorkspaceDbLoadError extends Error {
  /** The properties of the [[WorkspaceDb]] that was attempted to load, including the identity of its [[WorkspaceContainer]]. */
  wsDbProps?: WorkspaceDbProps & Partial<WorkspaceDbCloudProps>;
  /** The [[WorkspaceDb]] in which the error occurred, if available. */
  wsDb?: WorkspaceDb;
}

/** An exception that may occur while opening an [[IModelDb]] if any problems are detected while loading its [[IModelDb.workspace]].
 * This exception is never actually thrown; instead, after the iModel is opened, the exception is forwarded to [[Workspace.exceptionDiagnosticFn]]
 * so that the user can be notified of the problems.
 * @beta
 */
export interface WorkspaceDbLoadErrors extends Error {
  /** An array of problems that were encountered attempting to load [[WorkspaceDb]]s for an [[IModelDb]]. The most common problem
   * is that the user doesn't have read access to one or more [[WorkspaceContainer]]s used by the iModel's [[Workspace]]..
   */
  wsLoadErrors?: WorkspaceDbLoadError[];
}

/** Specifies a resource inside a [[WorkspaceDb]] that holds a [[SettingsDictionary]] to load into [[Workspace.settings]].
  * Settings of this type named [[WorkspaceSettingNames.settingsWorkspaces]] are automatically loaded by [[Workspace.loadSettingsDictionary]].
  * @beta
  */
export interface WorkspaceDbSettingsProps extends WorkspaceDbCloudProps {
  /** The name of the resource holding the stringified JSON of the [[SettingsDictionary]]. */
  resourceName: string;
  /** The priority to assign to the [[SettingsDictionary]]. */
  priority: SettingsPriority;
}

/** The name of a blob, string, or file resource stored in a [[WorkspaceDb]].
 * Resource names must conform to the following constraints:
 * - At least 1 character and no more than 1024 characters in length.
 * - No leading or trailing whitespace characters.
 * Each resource of a given type must has a unique name within the [[WorkspaceDb]]. It is technically possible, but discouraged, to define
 * resources with the same name but different types.
 * @beta
 */
export type WorkspaceResourceName = string;

/** A SQLite database in a [[Workspace]] containing named resources that the application is configured to use.
 * Resources are referred to by their [[WorkspaceResourceName]]s and can represent any number of things, including:
 * - Fonts and [TextStyle]($common)s used when placing [TextAnnotation]($common)s.
 * - [GeographicCRS]($common)es used to define the coordinate reference system of an iTwin.
 * - [[SettingsDictionary]]'s that contribute to the [[Workspace.settings]].
 * - Files that can be extracted temporarily to the local file system to be accessed by programs directly from disk.
 *
 * Ultimately, each resource is stored in one of the following formats:
 * - A `string`, which is often a stringified `JSON` representation of the resource;
 * - A binary `blob`; or
 * - An embedded file.
 *
 * Strings and blobs can be accessed directly using [[getString]] and [[getBlob]]. Files must first be copied to the local file system using [[getFile]], and should be avoided unless the software
 * that uses them is written to access them from disk.
 *
 * A `WorkspaceDb` resides in a [[WorkspaceContainer]] that can be published to the cloud. Once published, the `WorkspaceDb` becomes immutable.
 * However, multiple versions of a single `WorkspaceDb` can be created, allowing the [[Workspace]] contents to evolve over time.
 * `WorkspaceDb`s use [semantic versioning](https://github.com/npm/node-semver).
 *
 * The set of available `WorkspaceDb`s available for use for specific purposes are defined in the [[Workspace]]'s [[Settings]]. You can obtain
 * a single `WorkspaceDb` using [[WorkspaceContainer.getWorkspaceDb]], but more commonly you will use [[Workspace.getWorkspaceDbs]] to obtain
 * a list of all of the `WorkspaceDb`s, sorted by priority, that correspond to a given [[SettingName]].
 *
 * You can create new `WorkspaceDb`s (or new versions of existing `WorkspaceDb`s) using [[WorkspaceEditor]].
 * @beta
 */
export interface WorkspaceDb {
  /** @internal */
  [_implementationProhibited]: unknown;
  /** The [[WorkspaceContainer]] in which this db resides. */
  readonly container: WorkspaceContainer;
  /** The base name of this WorkspaceDb, without version */
  readonly dbName: WorkspaceDbName;
  /** An event raised before this WorkspaceDb is [[close]]d. */
  readonly onClose: BeEvent<() => void>;
  /** The name by which the WorkspaceDb can be opened. This will be either a local file name or the name of a database in a [[CloudSqlite.CloudContainer]]. */
  readonly dbFileName: string;
  /** The underlying SQLite database that stores this WorkspaceDb's resources. */
  readonly sqliteDb: SQLiteDb;
  /** Whether the underlying [[sqliteDb]] is currently [[open]]ed. */
  readonly isOpen: boolean;
  /** The manifest that describes the contents and context of this WorkspaceDb. */
  readonly manifest: WorkspaceDbManifest;
  /** The version of this WorkspaceDb */
  readonly version: WorkspaceDbVersion;

  /** Open the underlying [[sqliteDb]] to perform a query. Generally WorkspaceDbs are left closed and opened/closed as they're used. However,
   * when there will be significant activity against a WorkspaceDb, it may be useful to open it before the operations and close it afterwards.
   * Methods like [[queryResources]] open the SQLite database automatically and [[close]] it before they return.
   */
  open(): void;

  /** Close the underlying [[sqliteDb]]. You should call this after [[open]]ing the database and completing your query. */
  close(): void;

  /** Look up a string resource by name, if one exists. */
  getString(rscName: WorkspaceResourceName): string | undefined;

  /** Look up a binary resource by name, if one exists. */
  getBlob(rscName: WorkspaceResourceName): Uint8Array | undefined;

  /** Get a BlobIO reader for a blob WorkspaceResource.
   * @note when finished, caller *must* call `close` on the BlobIO.
   * @internal
   */
  getBlobReader(rscName: WorkspaceResourceName): SQLiteDb.BlobIO;

  /**
   * Extract a local copy of a file resource from this WorkspaceDb, if present.
   * @param rscName The name of the file resource in the WorkspaceDb
   * @param targetFileName optional name for extracted file. Some applications require files in specific locations or filenames. If
   * you know the full path to use for the extracted file, you can supply it. Generally, it is best to *not* supply the filename and
   * keep the extracted files in the directory specified by [[WorkspaceContainer.filesDir]].
   * @returns the full path to a file on the local file system, or undefined if the no file named `rscName` exists.
   * @note The file is copied from the file into the local file system so it may be accessed directly. This happens only
   * as necessary, if the local file doesn't exist, or if it is out-of-date because it was updated in the file.
   * For this reason, you should not save the local file name, and instead call this method every time you access it, so its
   * content is always holds the correct version.
   * @note The filename will be a hash value, not the resource name.
   * @note Workspace resource files are set as read-only as they are copied from the file.
   * To edit them, you must first copy them to another location.
   */
  getFile(rscName: WorkspaceResourceName, targetFileName?: LocalFileName): LocalFileName | undefined;

  /**
   * Ensure that the contents of this `WorkspaceDb` are downloaded into the local cache so that it may be accessed offline.
   * Until the promise resolves, the `WorkspaceDb` is not fully downloaded, but it *may* be safely accessed during the download.
   * To determine the progress of the download, use the `localBlocks` and `totalBlocks` values returned by `CloudContainer.queryDatabase`.
   * @returns a [[CloudSqlite.CloudPrefetch]] object that can be used to await and/or cancel the prefetch.
   * @throws if this WorkspaceDb is not from a [[CloudSqlite.CloudContainer]].
   */
  prefetch(opts?: CloudSqlite.PrefetchProps): CloudSqlite.CloudPrefetch;

  /** Find resources of a particular type with names matching a specified pattern.
   * The matching resources will be supplied to [[WorkspaceDbQueryResourcesArgs.callbackk]].
   * @see [[Workspace.queryResources]] to query resources within multiple `WorkspaceDb`s.
   */
  queryResources(args: WorkspaceDbQueryResourcesArgs): void;

  /** @internal */
  queryFileResource(rscName: WorkspaceResourceName): { localFileName: LocalFileName, info: IModelJsNative.EmbedFileQuery } | undefined;
}

/** Options supplied to [[IModelHost.startup]] via [[IModelHostOptions.workspace]] to customize the initialization of [[IModelHost.appWorkspace]].
  * @beta
  */
export interface WorkspaceOpts {
  /** The local directory for non-cloud-based [[WorkspaceDb]] files. The [[Workspace]] API will look in this directory
   * for files named `${containerId}/${dbId}.itwin-workspace`.
   * @note if not supplied, defaults to "iTwin/Workspace" in the user-local folder.
   */
  containerDir?: LocalDirName;

  /** The name(s) of one or more local JSON files containing [[SettingsDictionary]]s to load when initializing the [[Workspace]]. */
  settingsFiles?: LocalFileName | LocalFileName[];
}

/** Arguments supplied to [[Workspace.getContainer]] and [[WorkspaceEditor.getContainer]].
 * @beta
 */
export interface GetWorkspaceContainerArgs extends WorkspaceContainerProps {
  /** Token required to access the container. */
  accessToken: AccessToken;
}

/**
 * Settings and resources that customize an application for the current session.
 * See the [learning article]($docs/learning/backend/Workspace) for a detailed overiew and examples.
 * @beta
 */
export interface Workspace {
  /** @internal */
  [_implementationProhibited]: unknown;

  /** The directory for local WorkspaceDb files with the name `${containerId}/${dbId}.itwin-workspace`.
   * @internal
   */
  readonly containerDir: LocalDirName;

  /** The current [[Settings]] for this Workspace */
  readonly settings: Settings;

  /** Get the cloud cache for cloud-based [[WorkspaceContainer]]s. */
  getCloudCache(): CloudSqlite.CloudCache;

  /** Search for a container previously opened by [[getContainer]] or [[getContainerAsync]].
   * @param containerId The id of the container
   * @returns the [[WorkspaceContainer]] for `containerId`, or `undefined` if no such container has been opened.
   * @internal
   */
  findContainer(containerId: WorkspaceContainerId): WorkspaceContainer | undefined;

  /** Obtain the [[WorkspaceContainer]] specified by `props`.
   * @param props The properties of the `WorkspaceContainer`, opening it if it is not already opened.
   * Otherwise it is created.
   * @note This function allows a `WorkspaceContainer.Props` without its [AccessToken]($bentley). It will attempt to obtain one from the [[BlobContainer]] service,
   * hence this function is async.
   * @see [[getContainer]] to obtain a container synchronously.
  */
  getContainerAsync(props: WorkspaceContainerProps): Promise<WorkspaceContainer>;

  /** Get a WorkspaceContainer with a supplied access token. This function is synchronous and may be used if:
   * - a valid [AccessToken]($bentley) is already available;
   * - the container has already been previously prefetched in another session (this is useful for offline usage); or
   * - the container is public and doesn't require an [AccessToken]($bentley).
   * @see [[getContainerAsync]] to obtain a container asynchronously if the above conditions do not apply.
   */
  getContainer(props: GetWorkspaceContainerArgs): WorkspaceContainer;

  /** Load a [[SettingsDictionary]] from the specified [[WorkspaceDb]] and add it to this workspace's current [[Settings]].
   * @note this function will load the dictionaries from the supplied list, and it will also call itself recursively for any entries in
   * the loaded Settings with the name [[WorkspaceSettingNames.settingsWorkspaces]]. In this manner, WorkspaceSettings may be "chained" together so that loading one
   * causes its "dependent" WorkspaceSettings to be loaded. Its `Promise` is resolved after all have been loaded (or failed to load).
   */
  loadSettingsDictionary(
    /** The properties of the [[WorkspaceDb]], plus the resourceName and [[SettingsPriority]]. May be either a single value or an array of them */
    props: WorkspaceDbSettingsProps | WorkspaceDbSettingsProps[],
    /** If present, an array that is populated with a list of problems while attempting to load the [[SettingsDictionary]](s).   */
    problems?: WorkspaceDbLoadError[]
  ): Promise<void>;

  /** Get a single [[WorkspaceDb]].  */
  getWorkspaceDb(props: WorkspaceDbCloudProps): Promise<WorkspaceDb>;

  /**
   * Resolve the value of all [[Setting]]s from this workspace with the supplied `settingName` into an array of [[WorkspaceDbCloudProps]]
   * that can be used to query or load workspace resources. The settings must each be an array of type [[WorkspaceDbSettingsProps]].
   * The returned array will be sorted according to their [[SettingsPriority]], with the first entry being the highest priority [[WorkspaceDb]].
   * @note The list is built by combining, in order, all of the settings with the supplied [[SettingName]]. It may therefore include the
   * properties of same WorkspaceDb multiple times. This list is automatically de-duped by [[getWorkspaceDb]].
   * @note This function is rarely used directly. Usually it is called by [[getWorkspaceDbs]]. However, this function is synchronous and may sometimes
   * be useful for editors, tests, or diagnostics.
   */
  resolveWorkspaceDbSetting(
    /** the name of the setting. */
    settingName: SettingName,
    /** optional filter to choose specific WorkspaceDbs from the settings values. If present, only those WorkspaceDbs for which the filter returns `true` will be included. */
    filter?: Workspace.DbListFilter): WorkspaceDbCloudProps[];

  /**
   * Get a sorted array of [[WorkspaceDb]]s that can be used to query or load resources. If the arguments supply a `settingName`, this function will
   * use [[resolveWorkspaceDbSetting]] to get get the array of [[WorkspaceDbCloudProps]].
   * @returns A `Promise` resolving to an array of [[WorkspaceDb]]s sorted by [[SettingsPriority]] so that resources found in WorkspaceDbs earlier in the list take precedence
   * over ones with the same name in later WorkspaceDbs. No WorkspaceDb will appear more than once in the list.
   * @note this function may request an [AccessToken]($bentley) for each WorkspaceDb if necessary, and hence is asynchronous.
   */
  getWorkspaceDbs(
    args: Workspace.DbListOrSettingName & {
      /** if supplied, this array is populated with a list of problems (e.g. no read permission) attempting to load WorkspacesDbs. */
      problems?: WorkspaceDbLoadError[];
      /** only valid when called with a settingName, if so passed as `filter` argument to [[resolveWorkspaceDbSetting]]  */
      filter?: Workspace.DbListFilter;
    }): Promise<WorkspaceDb[]>;
}

/**
 * A WorkspaceContainer is a type of [[CloudSqlite.CloudContainer]] that holds one or more [[WorkspaceDb]]s. Normally a WorkspaceContainer will hold (many versions of) a single WorkspaceDb.
 * Each version of a WorkspaceDb is treated as immutable after it is created and is stored in the WorkspaceContainer indefinitely. That means that
 * older versions of the WorkspaceDb may continue to be used, for example by archived projects. For programmers familiar with [NPM](https://www.npmjs.com/), this is conceptually
 * similar and versioning follows the same rules as NPM using [Semantic Versioning](https://semver.org/).
 * @note It is possible to store more than one WorkspaceDb in the same WorkspaceContainer, but access rights are administered per WorkspaceContainer.
 * That is, if a user has rights to access a WorkspaceContainer, that right applies to all WorkspaceDbs in the WorkspaceContainer.
 * @note Not every WorkspaceContainer is associated with a [[CloudSqlite.CloudContainer]] - WorkspaceContainers may also be loaded from the local file system.
 * In this case, [[cloudContainer]] will be `undefined`.
 * @see [[Workspace.getContainer]] and [[Workspace.getContainerAsync]] to load a container.
 * @beta
 */
export interface WorkspaceContainer {
  /** @internal */
  [_implementationProhibited]: unknown;
  /** the local directory where this WorkspaceContainer will store temporary files extracted for file-resources.
   * @internal
   */
  readonly filesDir: LocalDirName;
  /** The workspace into which this container was loaded. */
  readonly workspace: Workspace;
  /** Cloud container for this WorkspaceContainer, or `undefined` if this is a local WorkspaceContainer. */
  readonly cloudContainer?: CloudSqlite.CloudContainer;
  /** Properties supplied when this container was loaded */
  readonly fromProps: WorkspaceContainerProps;

  /** @internal */
  addWorkspaceDb(toAdd: WorkspaceDb): void;

  /**
   * Find the fully-qualified name of a [[WorkspaceDb]] satisfying the name and version criteria specified by `props`.
   * @throws Error if no version satisfying the criteria exists.
   */
  resolveDbFileName(props: WorkspaceDbProps): WorkspaceDbFullName;

  /** Obtain a [[WorkspaceDb]] satisfying the name and version criteria specified by `props`. */
  getWorkspaceDb(props?: WorkspaceDbProps): WorkspaceDb;

  /** Close and remove a currently opened [[WorkspaceDb]] from this Workspace.
   * @internal
   */
  closeWorkspaceDb(container: WorkspaceDb): void;
}

function makeSettingName(name: string) {
  return `${"itwin/core/workspace"}/${name}`;
}

/** The names of various [[Setting]]s with special meaning to the [[Workspace]] system.
 * @beta
 */
export namespace WorkspaceSettingNames {
  /** The name of a setting that, when present in a [[WorkspaceDb]] loaded by [[Workspace.loadSettingsDictionary]], will automatically
   * be used to find and load additional [[SettingsDictionary]]'s in other [[WorkspaceDb]]s. This permits you to chain the settings inside on [[WorkspaceDb]]
   * to others upon which they depend.
   * This setting's value is an array of [[WorkspaceDbSettingsProps]]s.
   */
  export const settingsWorkspaces = makeSettingName("settingsWorkspaces");
}

/** A function supplied as part of a [[QueryWorkspaceResourcesArgs]] to iterate the resources retrieved by [[Workspace.queryResources]].
 * The `resources` object should only be used inside the function - it is an error to attempt to iterate it after the function returns.
 * @beta
 */
export type QueryWorkspaceResourcesCallback = (resources: Iterable<{ name: string, db: WorkspaceDb }>) => void;

/** Arguments supplied to [[Workspace.queryResources]] defining the query criteria and the list of [[WorkspaceDb]]s to query.
 * @beta
 */
export interface QueryWorkspaceResourcesArgs {
  /** The list of `WorkspaceDb`s to query, in the order in which they are to be queried.
   * @see [[Workspace.resolveWorkspaceDbSetting]] or [[Workspace.getWorkspaceDbs]] to obtain an appropriate list of `WorkspaceDb`s.
   */
  dbs: WorkspaceDb[];
  /** The type of resource to query. */
  type?: "string" | "blob";
  /** A pattern against which to compare the name of each resource, using [[nameCompare]] as the comparison operator.
   * Only resources whose names match the pattern will be included in the query results.
   */
  namePattern?: string;
  /** The comparison operator by which to compare the name of each resource to [[namePattern]].
   * Only resources whose names match the pattern will be included in the query results.
   * Ignored i [[namePattern]] is undefined.
   */
  nameCompare?: "GLOB" | "LIKE" | "NOT GLOB" | "NOT LIKE" | "=" | "<" | ">";
  /** A function invoked to process the resources that match the query criteria. */
  callback: QueryWorkspaceResourcesCallback;
}

function getWorkspaceResource(dbs: WorkspaceDb[], name: string, type: "string" | "blob"): string | Uint8Array | undefined {
  for (const db of dbs) {
    const val = type === "blob" ? db.getBlob(name) : db.getString(name);
    if (undefined !== val) {
      return val;
    }
  }

  return undefined;
}

/** Arguments supplied to [[Workspace.getStringResource]] and [[WOrkspace.getBlobResource]].
 * @beta
 */
export interface GetWorkspaceResourceArgs {
  /** The list of `WorkspaceDb`s to search, in the order in which they are to be searched.
   * @see [[Workspace.resolveWorkspaceDbSetting]] or [[Workspace.getWorkspaceDbs]] to obtain an appropriate list of `WorkspaceDb`s.
   */
  dbs: WorkspaceDb[];
  /** The name of the resource to find. */
  name: WorkspaceResourceName;
}

/** @beta */
export namespace Workspace {
  /** A function invoked to handle exceptions produced while loading workspace data.
   * Applications can override this function to notify the user and/or attempt to diagnose the problem.
   * The default implementation simply logs each exception.
   */
  export let exceptionDiagnosticFn = (e: WorkspaceDbLoadErrors) => {  // eslint-disable-line prefer-const
    if (e instanceof Error)
      Logger.logException(BackendLoggerCategory.Workspace, e);
    else
      UnexpectedErrors.handle(e);
  };

  /** Arguments supplied to [[Workspace.onSettingsDictionaryLoadedFn]] for every [[SettingsDictionary]] that is loaded from a [[WorkspaceDb]]. */
  export interface SettingsDictionaryLoaded {
    /** The dictionary that was loaded */
    dict: SettingsDictionary;
    /** The WorkspaceDb from which the dictionary was loaded. */
    from: WorkspaceDb;
  }

  /** A function invoked each time any [[SettingsDictionary]] is loaded from a [[WorkspaceDb]].
   * Applications can override this function to notify the user and/or record diagnostics.
   * The default implementation simply records an information message in the [Logger]($bentley).
   */
  export let onSettingsDictionaryLoadedFn = (loaded: SettingsDictionaryLoaded) => {  // eslint-disable-line prefer-const
    Logger.logInfo(BackendLoggerCategory.Workspace, `loaded setting dictionary ${loaded.dict.props.name} from ${loaded.from.dbFileName}`);
  };

  /** Either an array of [[WorkspaceDbCloudProps]] or the name of a [[Setting]] that resolves to an array of [[WorkspaceDbCloudProps]].
   * Used by [[Workspace.getWorkspaceDbs]].
   */
  export type DbListOrSettingName = { readonly dbs: WorkspaceDbCloudProps[], readonly settingName?: never } | { readonly settingName: SettingName, readonly dbs?: never };

  /** In arguments supplied to [[Workspace.getWorkspaceDbs]] and [[Workspace.resolveWorkspaceDbSetting]], an optional function used to exclude some
   * [[WorkspaceDb]]s. Only those [[WorkspaceDb]]s for which the function returns `true` will be included.
   */
  export type DbListFilter = (
    /** The properties of the WorkspaceDb to be returned */
    dbProp: WorkspaceDbCloudProps,
    /** The SettingsDictionary holding the [[WorkspaceSettingNames.settingsWorkspace]] setting. May be used, for example, to determine the
     * [[SettingsPriority]] of the dictionary.
     */
    dict: SettingsDictionary
  ) => boolean;

  /** Searches a list of [[WorkspaceDb]]s for a string resource of a given name.
   * The list is searched in order, and the first resource with the request name is returned.
   * If no such resource exists, the function returns `undefined`.
   * @see [[WorkspaceDb.getString]] if you only need to search a single `WorkspaceDb`.
   * @beta
   */
  export function getStringResource(args: GetWorkspaceResourceArgs): string | undefined {
    return getWorkspaceResource(args.dbs, args.name, "string") as string | undefined;
  }

  /** Searches a list of [[WorkspaceDb]]s for a blob resource of a given name.
   * The list is searched in order, and the first resource with the request name is returned.
   * If no such resource exists, the function returns `undefined`.
   * @see [[WorkspaceDb.getblob]] if you only need to search a single `WorkspaceDb`.
   * @beta
   */
  export function getBlobResource(args: GetWorkspaceResourceArgs): Uint8Array | undefined {
    return getWorkspaceResource(args.dbs, args.name, "blob") as Uint8Array | undefined;
  }

  /** Query a list of [[WorkspaceDb]]s to find resources of a particular type with names matching a specified pattern.
   * @see [[WorkspaceDb.queryResources]] if you only need to query a single `WorkspaceDb`.
   * @beta
   */
  export function queryResources(args: QueryWorkspaceResourcesArgs): void {
    const resources: Array<{ name: string, db: WorkspaceDb }> = [];
    for (const db of args.dbs) {
      db.queryResources({
        type: args.type,
        namePattern: args.namePattern,
        nameCompare: args.nameCompare,
        callback: (names) => {
          for (const name of names) {
            resources.push({ db, name });
          }
        },
      });
    }

    args.callback(resources);
  }
}
