/*---------------------------------------------------------------------------------------------
|  $Copyright: (c) 2017 Bentley Systems, Incorporated. All rights reserved. $
 *--------------------------------------------------------------------------------------------*/
import { AccessToken, Briefcase as HubBriefcase, IModelHubClient, ChangeSet, IModel as ConnectIModel } from "@bentley/imodeljs-clients";
import { DbResult, OpenMode } from "@bentley/bentleyjs-core/lib/BeSQLite";
import { assert } from "@bentley/bentleyjs-core/lib/Assert";
import { BriefcaseStatus, IModelError } from "../common/IModelError";
import { IModelVersion } from "../common/IModelVersion";
import { IModelToken, Configuration } from "../common/IModel";
import { NodeAddonRegistry } from "./NodeAddonRegistry";
import { NodeAddonDgnDb, ErrorStatusOrResult, NodeAddonBriefcaseManagerResourcesRequest } from "@bentley/imodeljs-nodeaddonapi/imodeljs-nodeaddonapi";
import { IModelDb } from "./IModelDb";

import * as fs from "fs";
import * as path from "path";

declare const __dirname: string;

/** The ID assigned to a briefcase by iModelHub, or one of the special values that identify special kinds of iModels */
export class BriefcaseId {
  private value: number;
  public static get Illegal(): number { return 0xffffffff; }
  public static get Master(): number { return 0; }
  public static get Standalone(): number { return 1; }
  constructor(value?: number) {
    if (value === undefined)
      this.value = BriefcaseId.Illegal;
    else this.value = value;
  }
  public isValid(): boolean { return this.value !== BriefcaseId.Illegal; }
  public isMaster(): boolean { return this.value !== BriefcaseId.Master; }
  public isStandaloneId(): boolean { return this.value !== BriefcaseId.Standalone; }
  public getValue(): number { return this.value; }
  public toString(): string { return this.value.toString(); }
}

/** Option to keep briefcase when the imodel is closed */
export const enum KeepBriefcase {
  Yes,
  No,
}

/** A token that represents a ChangeSet  */
class ChangeSetToken {
  constructor(public id: string, public index: number, public pathname: string) { }
}

/** Entry in the briefcase cache */
export class BriefcaseInfo {
  /** Id of the iModel - set to the DbGuid field in the BIM, it corresponds to the Guid used to track the iModel in iModelHub */
  public iModelId: string;

  /** Id of the last change set that was applied to the BIM. Set to an empty string if it's the initial version, or a standalone briefcase */
  public changeSetId: string;

  /** Index of the change set - only specified if the briefcase was acquired from the Hub. Set to 0 if there are no change sets - it's the initial version */
  public changeSetIndex?: number;

  /** Briefcase Id  */
  public briefcaseId: number;

  /** Local path name where the briefcase is cached */
  public pathname: string;

  /** Mode used to open the iModel */
  public openMode: OpenMode;

  /** Flag to indicate if the briefcase is currently open */
  public isOpen: boolean;

  /** Id of the user that acquired the briefcase. This is not set if it's standalone briefcase */
  public userId?: string;

  /** In-memory handle of the native Db */
  public nativeDb: NodeAddonDgnDb;

  /** In-memory handle fo the IModelDb that corresponds with this briefcase. This is only set if an IModelDb wrapper has been created for this briefcase */
  public iModelDb?: IModelDb;
}

/** In-memory cache of briefcases */
class BriefcaseCache {
  private readonly briefcases = new Map<string, BriefcaseInfo[]>(); // Indexed by iModelId

  /** Add a briefcase to the cache */
  public addBriefcase(briefcase: BriefcaseInfo) {
    const existingBriefcase = this.findBriefcase({ iModelId: briefcase.iModelId, changeSetId: briefcase.changeSetId, userId: briefcase.userId, openMode: briefcase.openMode });
    if (!!existingBriefcase)
      assert(false, `Briefcase for iModel with iModelId=${briefcase.iModelId}, changeSetId=${briefcase.changeSetId} and userId=${briefcase.userId} already exists in the cache. Please close it before opening a new one`);

    let iModelBriefcases = this.getIModelBriefcases(briefcase.iModelId);
    if (!iModelBriefcases) {
      iModelBriefcases = new Array<BriefcaseInfo>();
      this.briefcases.set(briefcase.iModelId, iModelBriefcases);
    }
    iModelBriefcases.push(briefcase);
  }

  /** Get all briefcases for an imodel */
  public getIModelBriefcases(iModelId: string): BriefcaseInfo[] | undefined {
    return this.briefcases.get(iModelId);
  }

  /** Get all entries in the cache */
  public getFilteredBriefcases(filterFn: (value: BriefcaseInfo) => boolean): BriefcaseInfo[] {
    const allBriefcases = new Array<BriefcaseInfo>();
    for (const modelEntries of this.briefcases.values()) {
      allBriefcases.concat(modelEntries.filter(filterFn));
    }
    return allBriefcases;
  }

  /** Find a briefcase in the cache by token */
  public findBriefcase({ iModelId, changeSetId, userId, openMode }: IModelToken): BriefcaseInfo | undefined {
    const iModelBriefcases = this.briefcases.get(iModelId);
    if (!iModelBriefcases)
      return undefined;

    const foundBriefcase: BriefcaseInfo | undefined = iModelBriefcases.find((briefcase: BriefcaseInfo) => {
      if (openMode === OpenMode.Readonly) {
        return briefcase.changeSetId === changeSetId;
      }
      return briefcase.changeSetId === changeSetId && briefcase.userId === userId;
    });

    if (!!foundBriefcase)
      assert(foundBriefcase.openMode === openMode, "Error locating the briefcase with the correct mode");

    return foundBriefcase;
  }

  /** Remove a briefcase from the cache */
  public removeBriefcase(briefcase: BriefcaseInfo) {
    const entries = this.getIModelBriefcases(briefcase.iModelId);
    if (!entries) {
      throw new Error("Briefcase not found in cache");
    }

    const index = entries.findIndex((value: BriefcaseInfo) => value.pathname === briefcase.pathname);
    if (index < 0) {
      throw new Error("Briefcase not found in cache");
    }
    entries.splice(index, 1);

    if (entries.length === 0) {
      this.briefcases.delete(briefcase.iModelId);
    }
  }

}

/** Utility to manage briefcases
 * @description
 * Folder structure for cached imodels:
 *  /assets/imodels/                => cachePath (can be specified)
 *    iModelId1/                    => iModelPath
 *      csets/                      => csetPath
 *        csetId1.cs
 *        csetid2.cs
 *        ...
 *      readOnly/
 *        0/IModelName.bim
 *        1/IModelName.bim
 *        ...
 *      readWrite/
 *        briefcaseId1/IModelName.bim
 *        briefcaseId2/IModelName.bim
 *        ...
 *    iModelId2/
 *      ...
 */
export class BriefcaseManager {
  public static hubClient?: IModelHubClient;
  private static cache?: BriefcaseCache;

  /** The path where the cache of briefcases are stored. */
  public static cachePath = path.join(__dirname, "cache/imodels");

  /** Get the local path of the root folder storing the imodel seed file, change sets and briefcases */
  private static getIModelPath(iModelId: string): string {
    return path.join(BriefcaseManager.cachePath, iModelId);
  }

  public static getChangeSetsPath(iModelId: string): string {
    return path.join(BriefcaseManager.getIModelPath(iModelId), "csets");
  }

  public static buildChangeSummaryFilePath(iModelId: string): string {
    return path.join(BriefcaseManager.getIModelPath(iModelId), iModelId.concat(".bim.ecchanges"));
  }

  private static buildReadOnlyPath(iModelId: string, iModelName: string): string {
    const briefcases = BriefcaseManager.cache!.getIModelBriefcases(iModelId);
    const numReadonly = !briefcases ? 0 : briefcases.reduce((total, briefcase) => briefcase.openMode === OpenMode.Readonly ? total + 1 : total, 0);
    return path.join(BriefcaseManager.getIModelPath(iModelId), "readOnly", numReadonly.toString(), iModelName.concat(".bim"));
  }

  private static buildReadWritePath(iModelId: string, briefcaseId: number, iModelName: string): string {
    return path.join(BriefcaseManager.getIModelPath(iModelId), "readWrite", briefcaseId.toString(), iModelName.concat(".bim"));
  }

  /** Get information on the briefcases that have been cached on disk
   * @description Format of returned JSON:
   *  {
   *    "iModelId1": [
   *      {
   *        "pathname": "path to imodel",
   *        "parentChangeSetId": "Id of parent change set",
   *        "briefcaseId": "Id of brief case. Standalone if it's a readonly standalone briefcase.",
   *        "readOnly": true or false
   *      },
   *      {
   *        ...
   *      },
   *    ],
   *    "iModelId2": [
   *      ...
   *    ]
   * }
   */
  private static getCachedBriefcaseInfos(): any {
    const nativeDb: NodeAddonDgnDb = new (NodeAddonRegistry.getAddon()).NodeAddonDgnDb();
    const res: ErrorStatusOrResult<DbResult, string> = nativeDb.getCachedBriefcaseInfos(BriefcaseManager.cachePath);
    if (res.error)
      Promise.reject(new IModelError(res.error.status));

    return JSON.parse(res.result!);
  }

  /** Initialize the briefcase manager. This hydrates a cache of in-memory briefcases if necessary. */
  public static async initialize(accessToken?: AccessToken): Promise<void> {
    if (BriefcaseManager.cache) {
      if (BriefcaseManager.hubClient!.deploymentEnv === Configuration.iModelHubDeployConfig)
        return;
      // console.log("Detected change of configuration - reinitializing Briefcase cache!"); // tslint:disable-line:no-console
    }

    BriefcaseManager.hubClient = new IModelHubClient(Configuration.iModelHubDeployConfig);
    BriefcaseManager.cache = new BriefcaseCache();
    if (!accessToken)
      return;

    const briefcaseInfos = BriefcaseManager.getCachedBriefcaseInfos();

    const iModelIds = Object.getOwnPropertyNames(briefcaseInfos);
    for (const iModelId of iModelIds) {
      const localBriefcases = briefcaseInfos[iModelId];

      let hubBriefcases: HubBriefcase[] = new Array<HubBriefcase>();
      try {
        hubBriefcases = await BriefcaseManager.hubClient.getBriefcases(accessToken, iModelId);
      } catch (error) {
        // The iModel is unreachable on the hub (the current deployment configuration is different, or the imodel was removed)
        localBriefcases.forEach((localBriefcase: BriefcaseInfo) => BriefcaseManager.deleteBriefcaseFromLocalDisk(localBriefcase));
        continue;
      }

      for (const localBriefcase of localBriefcases) {
        const briefcase = new BriefcaseInfo();
        briefcase.iModelId = iModelId;
        briefcase.changeSetId = localBriefcase.parentChangeSetId;
        briefcase.changeSetIndex = await BriefcaseManager.getChangeSetIndexFromId(accessToken, iModelId, briefcase.changeSetId);
        briefcase.briefcaseId = localBriefcase.briefcaseId;
        briefcase.pathname = localBriefcase.pathname;
        briefcase.openMode = localBriefcase.readOnly ? OpenMode.Readonly : OpenMode.ReadWrite;
        if (briefcase.openMode === OpenMode.ReadWrite) {
          const hubBriefcase = hubBriefcases.find((bc: HubBriefcase) => bc.briefcaseId === localBriefcase.briefcaseId);
          if (!hubBriefcase) {
            // The local briefcase is unreachable on the hub - either because it has been removed,
            // or because the deployment configuration has changed (during development).
            continue;
          }
          briefcase.userId = hubBriefcase.userId;
        }

        briefcase.isOpen = false;
        // briefcase.nativeDb = undefined;

        BriefcaseManager.cache.addBriefcase(briefcase);
      }
    }
  }

  /** Get the index of the change set from it's id */
  private static async getChangeSetIndexFromId(accessToken: AccessToken, iModelId: string, changeSetId: string): Promise<number> {
    if (changeSetId === "")
      return 0; // the first version
    try {
      const changeSet: ChangeSet = await BriefcaseManager.hubClient!.getChangeSet(accessToken, iModelId, false, changeSetId);
      return +changeSet.index;
    } catch (err) {
      assert(false, "Could not determine index of change set");
      return -1;
    }
  }

  /** Open a briefcase */
  public static async open(accessToken: AccessToken, projectId: string, iModelId: string, openMode: OpenMode, version: IModelVersion): Promise<BriefcaseInfo> {
    await BriefcaseManager.initialize(accessToken);
    assert(!!BriefcaseManager.hubClient);

    const changeSetId: string = await version.evaluateChangeSet(accessToken, iModelId);
    let changeSet: ChangeSet | null;
    let changeSetIndex: number;
    if (!changeSetId) {
      // First version
      changeSet = null;
      changeSetIndex = 0;
    } else {
      changeSet = await BriefcaseManager.getChangeSetFromId(accessToken, iModelId, changeSetId);
      changeSetIndex = changeSet ? +changeSet.index : 0;
    }

    let briefcase = BriefcaseManager.findCachedBriefcase(accessToken, iModelId, openMode, changeSetIndex);
    if (briefcase && briefcase.isOpen) {
      assert(briefcase.changeSetIndex === changeSetIndex);
      return briefcase;
    }

    if (!briefcase)
      briefcase = await BriefcaseManager.createBriefcase(accessToken, projectId, iModelId, openMode);

    await BriefcaseManager.updateAndOpenBriefcase(accessToken, briefcase, changeSet);
    return briefcase;
  }

  /** Get the change set from the specified id */
  private static async getChangeSetFromId(accessToken: AccessToken, iModelId: string, changeSetId: string): Promise<ChangeSet> {
    const changeSets: ChangeSet[] = await BriefcaseManager.hubClient!.getChangeSets(accessToken, iModelId, false /*=includeDownloadLink*/);
    // todo: pass the last known highest change set id to improve efficiency, and cache the results also.

    for (const changeSet of changeSets) {
      if (changeSet.wsgId === changeSetId)
        return changeSet;
    }

    return Promise.reject(new IModelError(BriefcaseStatus.VersionNotFound));
  }
  /** Finds any existing briefcase for the specified parameters. Pass null for the requiredChangeSet if the first version is to be retrieved */
  private static findCachedBriefcase(accessToken: AccessToken, iModelId: string, openMode: OpenMode, requiredChangeSetIndex: number): BriefcaseInfo | undefined {

    // Narrow the cache down to the entries for the specified imodel and openMode
    let briefcases: BriefcaseInfo[] | undefined = BriefcaseManager.cache!.getIModelBriefcases(iModelId);
    if (briefcases)
      briefcases = briefcases.filter((entry: BriefcaseInfo) => entry.openMode === openMode);
    if (!briefcases || briefcases.length === 0)
      return undefined;

    // For read-only cases...
    let briefcase: BriefcaseInfo | undefined;
    if (openMode === OpenMode.Readonly) {

      // first prefer any standalone briefcase that's open, and with changeSetIndex = requiredChangeSetIndex
      briefcase = briefcases.find((entry: BriefcaseInfo): boolean => {
        return entry.briefcaseId === BriefcaseId.Standalone && entry.isOpen && entry.changeSetIndex === requiredChangeSetIndex && entry.briefcaseId === BriefcaseId.Standalone;
      });
      if (briefcase)
        return briefcase;

      // next prefer any standalone briefcase that's closed, and with changeSetIndex = requiredChangeSetIndex
      briefcase = briefcases.find((entry: BriefcaseInfo): boolean => {
        return entry.briefcaseId === BriefcaseId.Standalone && !entry.isOpen && entry.changeSetIndex === requiredChangeSetIndex;
      });
      if (briefcase)
        return briefcase;

      // next prefer any standalone briefcase that's closed, and with changeSetIndex < requiredChangeSetIndex
      briefcase = briefcases.find((entry: BriefcaseInfo): boolean => {
        return entry.briefcaseId === BriefcaseId.Standalone && !entry.isOpen && entry.changeSetIndex! < requiredChangeSetIndex;
      });
      if (briefcase)
        return briefcase;

      return undefined;
    }

    // For read-write cases...

    // first prefer any briefcase that's been acquired by the user, and with changeSetIndex = requiredChangeSetIndex
    const requiredUserId = accessToken.getUserProfile().userId;
    briefcase = briefcases.find((entry: BriefcaseInfo): boolean => {
      return entry.userId === requiredUserId && entry.changeSetIndex === requiredChangeSetIndex;
    });
    if (briefcase)
      return briefcase;

    // next prefer any briefcase that's been acquired by the user, is currently closed, and with changeSetIndex < requiredChangeSetIndex
    briefcase = briefcases.find((entry: BriefcaseInfo): boolean => {
      return entry.userId === requiredUserId && !entry.isOpen && entry.changeSetIndex! < requiredChangeSetIndex;
    });
    if (briefcase)
      return briefcase;

    return undefined;
  }

  /** Create a briefcase */
  private static async createBriefcase(accessToken: AccessToken, projectId: string, iModelId: string, openMode: OpenMode): Promise<BriefcaseInfo> {
    const iModel: ConnectIModel = await BriefcaseManager.hubClient!.getIModel(accessToken, projectId, {
      $select: "Name",
      $filter: "$id+eq+'" + iModelId + "'",
    });

    const seedFile = await BriefcaseManager.hubClient!.getSeedFile(accessToken, iModelId, true);
    const downloadUrl = seedFile.downloadUrl!;

    const briefcase = new BriefcaseInfo();
    briefcase.changeSetId = seedFile.mergedChangeSetId;
    briefcase.changeSetIndex = await BriefcaseManager.getChangeSetIndexFromId(accessToken, iModelId, briefcase.changeSetId);
    briefcase.iModelId = iModelId;
    briefcase.isOpen = false;
    briefcase.openMode = openMode;
    briefcase.userId = accessToken.getUserProfile().userId;

    let downloadToPathname: string;
    if (openMode === OpenMode.Readonly) {
      downloadToPathname = BriefcaseManager.buildReadOnlyPath(iModelId, iModel.name);
      briefcase.briefcaseId = BriefcaseId.Standalone;
    } else {
      const hubBriefcase: HubBriefcase = await BriefcaseManager.acquireBriefcase(accessToken, iModelId);
      downloadToPathname = BriefcaseManager.buildReadWritePath(iModelId, +hubBriefcase.briefcaseId, iModel.name);
      briefcase.briefcaseId = hubBriefcase.briefcaseId;
    }
    briefcase.pathname = downloadToPathname;

    await BriefcaseManager.downloadSeedFile(downloadUrl, downloadToPathname);

    BriefcaseManager.cache!.addBriefcase(briefcase);
    return briefcase;
  }

  /** Acquire a briefcase */
  private static async acquireBriefcase(accessToken: AccessToken, iModelId: string): Promise<HubBriefcase> {
    const briefcaseId: number = await BriefcaseManager.hubClient!.acquireBriefcase(accessToken, iModelId);
    if (!briefcaseId)
      return Promise.reject(new IModelError(BriefcaseStatus.CannotAcquire));

    const briefcase: HubBriefcase = await BriefcaseManager.hubClient!.getBriefcase(accessToken, iModelId, briefcaseId, true /*=getDownloadUrl*/);
    if (!briefcase) {
      await BriefcaseManager.hubClient!.deleteBriefcase(accessToken, iModelId, briefcaseId)
        .catch(() => {
          assert(false, "Could not delete acquired briefcase");
          return Promise.reject(new IModelError(BriefcaseStatus.CannotDelete));
        });
    }

    return briefcase;
  }

  /** Downloads the briefcase seed file */
  private static async downloadSeedFile(seedUrl: string, seedPathname: string): Promise<void> {
    if (fs.existsSync(seedPathname))
      return;

    BriefcaseManager.makeDirectoryRecursive(path.dirname(seedPathname)); // todo: move this to IModel Hub Client
    await BriefcaseManager.hubClient!.downloadFile(seedUrl, seedPathname)
      .catch(() => {
        assert(false, "Could not download seed file");
        if (fs.existsSync(seedPathname))
          fs.unlinkSync(seedPathname); // Just in case there was a partial download, delete the file
        return Promise.reject(new IModelError(BriefcaseStatus.CannotDownload));
      });
  }

  /** Create a directory, recursively setting up the path as necessary */
  private static makeDirectoryRecursive(dirPath: string) {
    if (fs.existsSync(dirPath))
      return;
    BriefcaseManager.makeDirectoryRecursive(path.dirname(dirPath));
    fs.mkdirSync(dirPath);
  }

  /** Close a briefcase */
  public static close(accessToken: AccessToken, briefcase: BriefcaseInfo, keepBriefcase: KeepBriefcase): void {
    briefcase.nativeDb!.closeDgnDb();
    briefcase.isOpen = false;
    if (keepBriefcase === KeepBriefcase.No)
      BriefcaseManager.deleteBriefcase(accessToken, briefcase);
  }

  /** Deletes a briefcase from the local disk */
  private static deleteBriefcaseFromLocalDisk(briefcase: BriefcaseInfo) {
    const dirName = path.dirname(briefcase.pathname);
    BriefcaseManager.deleteFolderRecursive(dirName);
  }

  /** Deletes a briefcase from the hub */
  private static async deleteBriefcaseFromHub(accessToken: AccessToken, briefcase: BriefcaseInfo): Promise<void> {
    assert(!!briefcase.iModelId);
    if (briefcase.userId) {
      await BriefcaseManager.hubClient!.deleteBriefcase(accessToken, briefcase.iModelId, briefcase.briefcaseId)
        .catch(() => {
          assert(false, "Could not delete the accquired briefcase");
          return Promise.reject(new IModelError(BriefcaseStatus.CannotDelete));
        });
    }
  }

  /** Deletes a briefcase, and releases it's references in the iModelHub */
  private static async deleteBriefcase(accessToken: AccessToken, briefcase: BriefcaseInfo): Promise<void> {
    BriefcaseManager.cache!.removeBriefcase(briefcase);
    BriefcaseManager.deleteBriefcaseFromLocalDisk(briefcase);
    await BriefcaseManager.deleteBriefcaseFromHub(accessToken, briefcase);
  }

  /** Get change sets */
  private static async getChangeSets(accessToken: AccessToken, iModelId: string, toChangeSetId: string, includeDownloadLink?: boolean, fromChangeSetId?: string): Promise<ChangeSet[]> {
    if (toChangeSetId === "" || fromChangeSetId === toChangeSetId)
      return new Array<ChangeSet>(); // first version

    const allChangeSets: ChangeSet[] = await BriefcaseManager.hubClient!.getChangeSets(accessToken, iModelId, includeDownloadLink, fromChangeSetId);

    const changeSets = new Array<ChangeSet>();
    for (const changeSet of allChangeSets) {
      changeSets.push(changeSet);
      if (changeSet.wsgId === toChangeSetId)
        return changeSets;
    }

    return Promise.reject(new IModelError(BriefcaseStatus.VersionNotFound));
  }

  /** Updates the briefcase to the specifid change set, and opens it up. */
  private static async updateAndOpenBriefcase(accessToken: AccessToken, briefcase: BriefcaseInfo, changeSet: ChangeSet | null): Promise<void> {
    const toChangeSetId: string = !!changeSet ? changeSet.wsgId : "";
    const toChangeSetIndex: number = !!changeSet ? +changeSet.index : 0;
    const fromChangeSetId: string = briefcase.changeSetId!;
    const changeSets = await BriefcaseManager.downloadChangeSets(accessToken, briefcase.iModelId, toChangeSetId, fromChangeSetId);

    const changeSetTokens = new Array<ChangeSetToken>();
    const changeSetsPath: string = BriefcaseManager.getChangeSetsPath(briefcase.iModelId);
    for (const downloadedChangeSet of changeSets) {
      const changeSetPathname = path.join(changeSetsPath, downloadedChangeSet.fileName);
      changeSetTokens.push(new ChangeSetToken(downloadedChangeSet.wsgId, +downloadedChangeSet.index, changeSetPathname));
    }

    const nativeDb: NodeAddonDgnDb = new (NodeAddonRegistry.getAddon()).NodeAddonDgnDb();
    const res: DbResult = nativeDb.openBriefcase(JSON.stringify(briefcase), JSON.stringify(changeSetTokens));
    if (DbResult.BE_SQLITE_OK !== res)
      throw new IModelError(res);

    briefcase.nativeDb = nativeDb;
    briefcase.isOpen = true;
    briefcase.changeSetId = toChangeSetId;
    briefcase.changeSetIndex = toChangeSetIndex;
  }

  /** Downloads changesets in the specified range */
  public static async downloadChangeSets(accessToken: AccessToken, iModelId: string, toChangeSetId: string, fromChangeSetId?: string): Promise<ChangeSet[]> {
    const changeSets = await BriefcaseManager.getChangeSets(accessToken, iModelId, toChangeSetId, true /*includeDownloadLink*/, fromChangeSetId);
    if (changeSets.length === 0)
      return new Array<ChangeSet>();

    const changeSetsToDownload = new Array<ChangeSet>();
    const changeSetsPath: string = BriefcaseManager.getChangeSetsPath(iModelId);
    for (const changeSet of changeSets) {
      const changeSetPathname = path.join(changeSetsPath, changeSet.fileName);
      if (!fs.existsSync(changeSetPathname))
        changeSetsToDownload.push(changeSet);
    }

    // download
    if (changeSetsToDownload.length > 0) {
      BriefcaseManager.makeDirectoryRecursive(changeSetsPath); // todo: move this to IModel Hub Client
      await BriefcaseManager.hubClient!.downloadChangeSets(changeSetsToDownload, changeSetsPath)
        .catch(() => {
          assert(false, "Could not download ChangeSets");
          BriefcaseManager.deleteFolderRecursive(changeSetsPath); // Just in case there was a partial download, delete the entire folder
          Promise.reject(new IModelError(BriefcaseStatus.CannotDownload));
        });
    }

    return changeSets;
  }

  /** Open a standalone iModel from the local disk */
  public static openStandalone(pathname: string, openMode: OpenMode, enableTransactions: boolean): BriefcaseInfo {
    BriefcaseManager.initialize();

    const nativeDb: NodeAddonDgnDb = new (NodeAddonRegistry.getAddon()).NodeAddonDgnDb();

    const res: DbResult = nativeDb.openDgnDb(pathname, openMode);
    if (DbResult.BE_SQLITE_OK !== res)
      throw new IModelError(res);

    let briefcaseId: number = nativeDb.getBriefcaseId();
    if (enableTransactions) {
      if (briefcaseId === BriefcaseId.Illegal || briefcaseId === BriefcaseId.Master) {
        briefcaseId = BriefcaseId.Standalone;
        nativeDb.setBriefcaseId(briefcaseId);
      }
      assert(nativeDb.getBriefcaseId() !== BriefcaseId.Illegal || nativeDb.getBriefcaseId() !== BriefcaseId.Master);
    }

    const briefcase = new BriefcaseInfo();
    briefcase.briefcaseId = briefcaseId;
    briefcase.changeSetId = nativeDb.getParentChangeSetId();
    briefcase.iModelId = nativeDb.getDbGuid();
    briefcase.isOpen = true;
    briefcase.openMode = openMode;
    briefcase.pathname = pathname;
    briefcase.nativeDb = nativeDb;

    const existingBriefcase = this.findBriefcase({ iModelId: briefcase.iModelId, changeSetId: briefcase.changeSetId, userId: briefcase.userId, openMode: briefcase.openMode });
    if (existingBriefcase) {
      throw new IModelError(DbResult.BE_SQLITE_CANTOPEN,
        `Cannot open ${briefcase.pathname} since it shares it's DbGuid with ${existingBriefcase.pathname} that was opened earlier`);
    }

    BriefcaseManager.cache!.addBriefcase(briefcase);
    return briefcase;
}

  /** Close the standalone briefcase */
  public static closeStandalone(briefcase: BriefcaseInfo) {
    briefcase.nativeDb!.closeDgnDb();
    briefcase.isOpen = false;
    BriefcaseManager.cache!.removeBriefcase(briefcase);
  }

  public static attachChangeCache(briefcase: BriefcaseInfo) {
    if (!briefcase.isOpen)
      throw new IModelError(DbResult.BE_SQLITE_ERROR, `Failed to attach change cache to ${briefcase.pathname} because the briefcase is not open.`);

    const csumFilePath: string = BriefcaseManager.buildChangeSummaryFilePath(briefcase.iModelId);
    assert(briefcase.nativeDb != null);
    if (briefcase.nativeDb!.isChangeCacheAttached())
      return;

    const res: DbResult = briefcase.nativeDb!.attachChangeCache(csumFilePath);
    if (res !== DbResult.BE_SQLITE_OK)
      throw new IModelError(res, `Failed to attach change cache to ${briefcase.pathname}.`);
  }

  /** Purge closed briefcases */
  public static async purgeClosed(accessToken: AccessToken) {
    if (!BriefcaseManager.cache)
      await BriefcaseManager.initialize(accessToken);

    const cache = BriefcaseManager.cache!;
    const briefcases = cache.getFilteredBriefcases((briefcase: BriefcaseInfo) => !briefcase.isOpen);
    for (const briefcase of briefcases) {
      await BriefcaseManager.deleteBriefcase(accessToken, briefcase);
    }
  }

  private static deleteFolderRecursive(folderPath: string) {
    if (!fs.existsSync(folderPath))
      return;
    try {
      fs.readdirSync(folderPath).forEach((file) => {
        const curPath = folderPath + "/" + file;
        if (fs.lstatSync(curPath).isDirectory()) {
          BriefcaseManager.deleteFolderRecursive(curPath);
        } else {
          // delete file
          fs.unlinkSync(curPath);
        }
      });
      fs.rmdirSync(folderPath);
    } catch (err) {
      return; // todo: This seems to fail sometimes for no reason
    }
  }

  /** Purge all briefcases and reset the briefcase manager */
  public static purgeAll() {
    if (fs.existsSync(BriefcaseManager.cachePath))
      BriefcaseManager.deleteFolderRecursive(BriefcaseManager.cachePath);

    BriefcaseManager.cache = undefined;
  }

  /** Find the existing briefcase */
  public static findBriefcase(iModelToken: IModelToken): BriefcaseInfo | undefined {
    if (!BriefcaseManager.cache)
      return undefined;
    return BriefcaseManager.cache.findBriefcase(iModelToken);
  }

}

/** Types that are relative to BriefcaseManager. Typescript declaration merging will make these types appear to be properties of the BriefcaseManager class. */
export namespace BriefcaseManager {

  /** This is a stand-in for NodeAddonBriefcaseManagerResourcesRequest. We cannot (re-)export that for technical reasons. */
  export class ResourcesRequest {
    private constructor() { }

    /** Create an empty ResourcesRequest */
    public static create(): ResourcesRequest {
      return new (NodeAddonRegistry.getAddon()).NodeAddonBriefcaseManagerResourcesRequest();
    }

    /** Convert the request to any */
    public static toAny(req: ResourcesRequest): any {
      return JSON.parse((req as NodeAddonBriefcaseManagerResourcesRequest).toJSON());
    }

  }

  /** How to handle a conflict */
  export const enum ConflictResolution {
    /** Reject the incoming change */
    Reject = 0,
    /** Accept the incoming change */
    Take = 1,
  }

  /** The options for how conflicts are to be handled during change-merging in an OptimisticConcurrencyControlPolicy.
   * The scenario is that the caller has made some changes to the *local* briefcase. Now, the caller is attempting to
   * merge in changes from iModelHub. The properties of this policy specify how to handle the *incoming* changes from iModelHub.
   */
  export interface ConflictResolutionPolicy {
    /** What to do with the incoming change in the case where the same entity was updated locally and also would be updated by the incoming change. */
    updateVsUpdate: ConflictResolution;
    /** What to do with the incoming change in the case where an entity was updated locally and would be deleted by the incoming change. */
    updateVsDelete: ConflictResolution;
    /** What to do with the incoming change in the case where an entity was deleted locally and would be updated by the incoming change. */
    deleteVsUpdate: ConflictResolution;
  }

  /** Specifies an optimistic concurrency policy.
   * Optimistic concurrency allows entities to be modified in the local briefcase without first acquiring locks. Allows codes to be used in the local briefcase without first acquiring them.
   * This creates the possibility that other apps may have uploaded changesets to iModelHub that overlap with local changes.
   * In that case, overlapping changes are merged when changesets are downloaded from iModelHub.
   * A ConflictResolutionPolicy is then applied in cases where an overlapping change conflict with a local change.
   */
  export class OptimisticConcurrencyControlPolicy {
    public conflictResolution: ConflictResolutionPolicy;
    constructor(p: ConflictResolutionPolicy) { this.conflictResolution = p; }
  }

  /** The options for when to acquire locks and codes in the course of a local transaction in a PessimisticConcurrencyControlPolicy */
  export const enum PessimisticLockingPolicy {
    /** Requires that the app must acquire locks for entities *before* modifying them in the local briefcase. Likewise, the app must acquire codes *before* using them in entities that a written to the local briefcase.
     * This policy prevents conflicts or the possibility that local changes would have to be rolled back. Implementing this policy requires the most effort for the app developer, and it requires
     * careful design and implementation to implement it efficiently.
     */
    Immediate = 0,

    /** Allows apps to write entities and codes to the local briefcase without first acquiring locks.
     * The transaction manager then attempts to acquire all needed locks and codes before saving the changes to the local briefcase.
     * The transaction manager will roll back all pending changes if any lock or code cannot be acquired at save time. Lock and code acquisition will fail if another user
     * has push changes to the same entities or used the same codes as the local transaction.
     * This policy does prevent conflicts and is the easiest way to implement the pessimistic locking policy efficiently.
     * It however carries the risk that local changes could be rolled back, and so it can only be used safely in special cases, where
     * contention for locks and codes is not a risk. Normally, that is only possible when writing to a model that is exclusively locked and where codes
     * are scoped to that model.
     */
    Deferred = 1,
  }

  /** Specifies a pessimistic concurrency policy.
   * Pessimistic concurrency means that entities must be locked and codes must be acquired before a local changes can be pushed to iModelHub.
   * There is more than one strategy for when to acquire locks. See briefcaseManagerStartBulkOperation.
   * A pessimistic concurrency policy with respect to iModelHub does not preclude using an optimistic concurrency strategy with respect to members of a workgroup.
   */
  export class PessimisticConcurrencyControlPolicy {
  }
}
