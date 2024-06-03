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
import { implementationProhibited } from "../internal/ImplementationProhibited";

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
  namePattern: string;
  /** The comparison operator by which to compare the name of each resource to [[namePattern]].
   * Only resources whose names match the pattern will be included in the query results.
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

/**
 * A WorkspaceDb holds workspace resources. `WorkspaceDb`s are stored in in cloud WorkspaceContainers.
 * Each `WorkspaceResource` in a WorkspaceDb is identified by a [[WorkspaceResourceName]].
 * Resources of type `string` and `blob` may be loaded directly from the `WorkspaceDb`. Resources of type `file` are
 * copied from the WorkspaceDb into a temporary local file so they can be accessed by programs directly from disk.
 * ###TODO
 * @beta
 */

/** A SQLite database in a [[Workspace]] containing resources that the application is configured to use.
 * Resources can represent any number of things, including:
 * - Fonts and [TextStyle]($common)s used when placing [TextAnnotation]($common)s.
 * - [GeographicCRS]($common)es used to define the coordinate reference system of an iTwin.
 * - [[SettingsDictionary]]'s that contribute to the [[Workspace.settings]].
 * - Files that can be extracted temporarily to the local file system to be accessed by programs directly from disk.
 *
 * Internally, each resource is stored in one of the following formats:
 * - A `string`, which is often a stringified `JSON` representation of the resource;
 * - A binary `blob`; or
 * - An embedded file.
 * 
 * Strings and blobs can be accessed directly using [[getString]] and [[getBlob]]. Files must first be copied to the local file system using [[getFile]], and should be avoided unless the software
 * that uses them is written to access them from disk.
 *
 * ###TODO how to obtain, versioning, manifest, WorkspaceContainer.
 * @beta
 */
export interface WorkspaceDb {
  /** @internal */
  [implementationProhibited]: unknown;
  /** The WorkspaceContainer holding this WorkspaceDb. */
  readonly container: WorkspaceContainer;
  /** The base name of this WorkspaceDb, without version */
  readonly dbName: WorkspaceDbName;
  /** event raised before this WorkspaceDb is closed. */
  readonly onClose: BeEvent<() => void>;
  /** Name by which a WorkspaceDb may be opened. This will be either a local file name or the name of a database in a cloud container */
  readonly dbFileName: string;
  /** the SQLiteDb for this WorkspaceDb */
  readonly sqliteDb: SQLiteDb;
  /** determine whether this WorkspaceDb is currently open */
  readonly isOpen: boolean;
  /** The manifest that describes the content of this WorkspaceDb. */
  get manifest(): WorkspaceDbManifest;
  /** Get the version of this WorkspaceDb */
  get version(): WorkspaceDbVersion;

  /** Open the SQLiteDb of this WorkspaceDb. Generally WorkspaceDbs are left closed and opened/closed as they're used. However,
   * when there will be significant activity against a WorkspaceDb, it may be useful to open it before the operations and close it afterwards.
   */
  open(): void;

  /** Close the SQLiteDb of this WorkspaceDb. */
  close(): void;

  /** Get a string resource from this WorkspaceDb, if present. */
  getString(rscName: WorkspaceResourceName): string | undefined;

  /** Get a blob resource from this WorkspaceDb, if present. */
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
  getFile(rscName: WorkspaceResourceName, targetFileName?: LocalFileName): LocalFileName | undefined;

  /**
   * Ensure that the contents of a `WorkspaceDb` are downloaded into the local cache so that it may be accessed offline.
   * Until the promise is resolved, the `WorkspaceDb` is not fully downloaded, but it *may* be safely accessed during the download.
   * To determine the progress of the download, use the `localBlocks` and `totalBlocks` values returned by `CloudContainer.queryDatabase`.
   * @returns a `CloudSqlite.CloudPrefetch` object that can be used to await and/or cancel the prefetch.
   * @throws if this WorkspaceDb is not from a `CloudContainer`.
   */
  prefetch(opts?: CloudSqlite.PrefetchProps): CloudSqlite.CloudPrefetch;

  queryResources(args: WorkspaceDbQueryResourcesArgs): void;

  /** @internal */
  queryFileResource(rscName: WorkspaceResourceName): { localFileName: LocalFileName, info: IModelJsNative.EmbedFileQuery } | undefined;
}

 /** Options supplied to [[IModelHost.startup]] via [[IModelHostOptions.workspace]] to customize the initialization of [[IModelHost.appWorkspace]].
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

/** Arguments supplied to [[Workspace.getContainer]] and [[WorkspaceEditor.getContainer]].
 * @beta
 */
export interface GetWorkspaceContainerArgs extends WorkspaceContainerProps {
  /** Token required to access the container. */
  accessToken: AccessToken;
}

/**
 * Settings and resources that customize an application for the current session.
 * See [Workspaces]($docs/learning/backend/Workspace)
 * ###TODO WorkspaceOpts.settingsFiles
 * @beta
 */
export interface Workspace {
  /** @internal */
  [implementationProhibited]: unknown;

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
  findContainer(containerId: WorkspaceContainerId): WorkspaceContainer | undefined;

  /** Get a [[WorkspaceContainer]] by [[WorkspaceContainer.Props]]
   * @param props the properties of the `WorkspaceContainer`. If `props.containerId` was already opened, its WorkspaceContainer is returned.
   * Otherwise it is created.
   * @note this function allows a `WorkspaceContainer.Props` without its AccessToken. It will attempt to obtain one from the BlobContainer service,
   * hence this function is async.
   * @see [[getContainer]]
  */
  getContainerAsync(props: WorkspaceContainerProps): Promise<WorkspaceContainer>;

  /** Get a WorkspaceContainer with a supplied access token. This function is synchronous and may be used if:
   * - a valid accessToken is al is already available
   * - the container has already been previously prefetched in another session (this is useful for offline usage)
   * - the container is public and doesn't require an accessToken
   * @see [[getContainerAsync]]
   */
  getContainer(props: GetWorkspaceContainerArgs): WorkspaceContainer;

  /** Load a settings dictionary from the specified WorkspaceDb, and add it to the current Settings for this Workspace.
   * @note this function will load the dictionaries from the supplied list, and it will also call itself recursively for any entries in
   * the loaded Settings with the name `settingsWorkspaces`. In this manner, WorkspaceSettings may be "chained" together so that loading one
   * causes its "dependent" WorkspaceSettings to be loaded. Its Promise is resolve after all have been loaded (or failed).
   */
  loadSettingsDictionary(
    /** The properties of the WorkspaceDb, plus the resourceName and Settings.priority. May be either a single value or an array of them */
    props: WorkspaceDbSettingsProps | WorkspaceDbSettingsProps[],
    /** if present, an array that is populated with a list of problems while attempting to load the Settings.Dictionary(s).   */
    problems?: WorkspaceDbLoadError[]
  ): Promise<void>;

  /** Get a single [[WorkspaceDb]] from a WorkspaceDb.CloudProps.  */
  getWorkspaceDb(props: WorkspaceDbCloudProps): Promise<WorkspaceDb>;

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
    filter?: Workspace.DbListFilter): WorkspaceDbCloudProps[];

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
      problems?: WorkspaceDbLoadError[];
      /** only valid when called with a settingName, if so passed as `filter` argument to [[resolveWorkspaceDbSetting]]  */
      filter?: Workspace.DbListFilter;
    }): Promise<WorkspaceDb[]>;
}

/**
 * A WorkspaceContainer is a type of `CloudSqlite.CloudContainer` that holds one or more WorkspaceDbs. Normally a WorkspaceContainer will hold (many versions of) a single WorkspaceDb.
 * Each version of a WorkspaceDb is treated as immutable after it is created and is stored in the WorkspaceContainer indefinitely. That means that
 * older versions of the WorkspaceDb may continue to be used, for example by archived projects. For programmers familiar with [NPM](https://www.npmjs.com/), this is conceptually
 * similar and versioning follows the same rules as NPM using [Semantic Versioning](https://semver.org/).
 * @note It is possible to store more than one WorkspaceDb in the same WorkspaceContainer, but access rights are administered per WorkspaceContainer.
 * That is, if a user has rights to access a WorkspaceContainer, that right applies to all WorkspaceDbs in the WorkspaceContainer.
 * ###TODO "local" containers (no cloud container, no versioning)
 * @beta
 */
export interface WorkspaceContainer {
  /** @internal */
  [implementationProhibited]: unknown;
  /** the local directory where this WorkspaceContainer will store temporary files extracted for file-resources.
   * @internal
   */
  readonly filesDir: LocalDirName;
  /** The unique identifier for a WorkspaceContainer a cloud storage account. */
  readonly workspace: Workspace;
  /** CloudContainer for this WorkspaceContainer (`undefined` if this is a local WorkspaceContainer.) */
  readonly cloudContainer?: CloudSqlite.CloudContainer;
  /** properties supplied when this container was loaded */
  readonly fromProps: WorkspaceContainerProps;

  /** @internal */
  addWorkspaceDb(toAdd: WorkspaceDb): void;

  /**
   * Find the appropriate version of a WorkspaceDb in this WorkspaceContainer based on the SemVer rule
   * in the `WorkspaceDb.Props`.
   * If no version satisfying the WorkspaceDb.Props rules exists, throws an exception.
   */
  resolveDbFileName(props: WorkspaceDbProps): WorkspaceDbFullName;

  /** get a WorkspaceDb from this WorkspaceContainer. */
  getWorkspaceDb(props?: WorkspaceDbProps): WorkspaceDb;

  /** Close and remove a currently opened [[WorkspaceDb]] from this Workspace.
   * @internal
   */
  closeWorkspaceDb(container: WorkspaceDb): void;
}

function makeSettingName(name: string) { return `${"itwin/core/workspace"}/${name}`; }

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

/** @beta */
export namespace Workspace {
  /** IModelHost applications may supply a different implementation to diagnose (rather than merely log) errors loading workspace data */
  export let exceptionDiagnosticFn = (e: WorkspaceDbLoadErrors) => {  // eslint-disable-line prefer-const
    if (e instanceof Error)
      Logger.logException(BackendLoggerCategory.Workspace, e);
    else
      UnexpectedErrors.handle(e);
  };
  /** passed to [[onSettingsDictionaryLoadedFn]] for every Setting.Dictionary that is loaded from a WorkspaceDb. */
  export interface SettingsDictionaryLoaded {
    /** The dictionary loaded */
    dict: SettingsDictionary;
    /** The WorkspaceDb from which the dictionary was found. */
    from: WorkspaceDb;
  }
  /** IModelHost applications may set this variable for diagnostics or user feedback. It is called each time
   * any Settings.Dictionary is loaded from a WorkspaceDb. The default implementation calls `Logger.logInfo`.
   */
  export let onSettingsDictionaryLoadedFn = (loaded: SettingsDictionaryLoaded) => {  // eslint-disable-line prefer-const
    Logger.logInfo(BackendLoggerCategory.Workspace, `loaded setting dictionary ${loaded.dict.props.name} from ${loaded.from.dbFileName}`);
  };

  /** either an array of [[WorkspaceDb.CloudProps]], or a settingName of a `itwin/core/workspace/workspaceDbList` from which the array can be resolved. */
  export type DbListOrSettingName = { readonly dbs: WorkspaceDbCloudProps[], readonly settingName?: never } | { readonly settingName: string, readonly dbs?: never };

  /** called for each entry in a `itwin/core/workspace/workspaceDbList` setting by [[Workspace.resolveWorkspaceDbSetting]].
   * If this function returns `false` the value is skipped and the corresponding WorkspaceDb will not be returned.
   */
  export type DbListFilter = (
    /** The properties of the WorkspaceDb to be returned */
    dbProp: WorkspaceDbCloudProps,
    /** the Settings.Dictionary holding the `itwin/core/workspace/workspaceDbList` setting. May be used, for example, to determine the
     * Settings.Priority of the dictionary.
     */
    dict: SettingsDictionary
  ) => boolean;
}

/** A function supplied as part of a [[QueryWorkspaceResourcesArgs]] to iterate the resources retrieved by [[queryWorkspaceResources]].
 * The `resources` object should only be used inside the function - it is an error to attempt to iterate it after the function returns.
 * @beta
 */
export type QueryWorkspaceResourcesCallback = (resources: Iterable<{ name: string, db: WorkspaceDb }>) => void;

/** Arguments supplied to [[queryWorkspaceResources]] defining the query criteria and the list of [[WorkspaceDb]]s to query.
 * @beta
 */
export interface QueryWorkspaceResourcesArgs {
  /** The list of `WorkspaceDb`s to query, in the order in which they are to be queried. */
  dbs: WorkspaceDb[];
  /** The type of resource to query. */
  type?: "string" | "blob";
  /** A pattern against which to compare the name of each resource, using [[nameCompare]] as the comparison operator.
   * Only resources whose names match the pattern will be included in the query results.
   */
  namePattern: string;
  /** The comparison operator by which to compare the name of each resource to [[namePattern]].
   * Only resources whose names match the pattern will be included in the query results.
   */
  nameCompare?: "GLOB" | "LIKE" | "NOT GLOB" | "NOT LIKE" | "=" | "<" | ">";
  /** A function invoked to process the resources that match the query criteria. */
  callback: QueryWorkspaceResourcesCallback;
}

/** Query a list of [[WorkspaceDb]]s to find resources of a particular type with names matching a specified pattern.
 * @see [[WorkspaceDb.queryResources]] if you only need to query a single `WorkspaceDb`.
 * @beta
 */
export function queryWorkspaceResources(args: QueryWorkspaceResourcesArgs): void {
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

function getWorkspaceResource(dbs: WorkspaceDb[], name: string, type: "string" | "blob"): string | Uint8Array | undefined {
  for (const db of dbs) {
    const val = type === "blob" ? db.getBlob(name) : db.getString(name);
    if (undefined !== val) {
      return val;
    }
  }

  return undefined;
}

/** Arguments supplied to [[getWorkspaceString]] and [[getWorkspaceBlob]].
 * @beta
 */
export interface GetWorkspaceResourceArgs {
  /** The list of `WorkspaceDb`s to search, in the order in which they are to be searched. */
  dbs: WorkspaceDb[];
  /** The name of the resource to find. */
  name: WorkspaceResourceName;
}

/** Searches a list of [[WorkspaceDb]]s for a string resource of a given name.
 * The list is searched in order, and the first resource with the request name is returned.
 * If no such resource exists, the function returns `undefined`.
 * @see [[WorkspaceDb.getString]] if you only need to search a single `WorkspaceDb`.
 * @beta
 */
export function getWorkspaceString(args: GetWorkspaceResourceArgs): string | undefined {
  return getWorkspaceResource(args.dbs, args.name, "string") as string | undefined;
}

/** Searches a list of [[WorkspaceDb]]s for a blob resource of a given name.
 * The list is searched in order, and the first resource with the request name is returned.
 * If no such resource exists, the function returns `undefined`.
 * @see [[WorkspaceDb.getblob]] if you only need to search a single `WorkspaceDb`.
 * @beta
 */
export function getWorkspaceBlob(args: GetWorkspaceResourceArgs): Uint8Array | undefined {
  return getWorkspaceResource(args.dbs, args.name, "blob") as Uint8Array | undefined;
}
