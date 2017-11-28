/*---------------------------------------------------------------------------------------------
|  $Copyright: (c) 2017 Bentley Systems, Incorporated. All rights reserved. $
 *--------------------------------------------------------------------------------------------*/
import { AccessToken, Briefcase, IModelHubClient, ChangeSet } from "@bentley/imodeljs-clients";
import { BentleyReturn } from "@bentley/bentleyjs-core/lib/Bentley";
import { DbResult, OpenMode } from "@bentley/bentleyjs-core/lib/BeSQLite";
import { assert } from "@bentley/bentleyjs-core/lib/Assert";
import { BriefcaseStatus, IModelError } from "../common/IModelError";
import { IModelVersion } from "../common/IModelVersion";
import { IModelToken } from "../common/IModel";
import { IModelDb } from "./IModelDb";
import { NodeAddon } from "./NodeAddon";
import { NodeAddonDgnDb } from "@bentley/types_imodeljsnodeaddon/iModelJsNodeAddon";

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
}

/** Option to keep briefcase when the imodel is closed */
export const enum KeepBriefcase {
  Yes,
  No,
}

/** A token that represents a ChangeSet  */
export class ChangeSetToken {
  constructor(public id: string, public index: number, public pathname: string) { }
}

/** In-memory cache of briefcases  */
class BriefcaseCache {
  public readonly briefcases = new Map<string, IModelDb>(); // Indexed by local pathname of the briefcase

  public setBriefcase(iModelToken: IModelToken, entry: IModelDb): void {
    this.briefcases.set(iModelToken.pathname, entry);
  }

  public getBriefcase(iModelToken: IModelToken): IModelDb | undefined {
    return this.briefcases.get(iModelToken.pathname);
  }

  public hasBriefcase(iModelToken: IModelToken): boolean {
    return this.briefcases.has(iModelToken.pathname);
  }

  public deleteBriefcase(iModelToken: IModelToken): void {
    this.briefcases.delete(iModelToken.pathname);
  }
}

export class BriefcaseManager {
  private static hubClient = new IModelHubClient("QA");
  private static cache?: BriefcaseCache;

  /** The path where the cache of briefcases are stored. */
  public static cachePath = path.join(__dirname, "cache/imodels");

  /**
   * Get the local path of the root folder storing the imodel seed file, change sets and briefcases
   * @description
   * /assets/imodels/<iModelId>/  (iModelPath contains)
   *    IModelName.bim  (seed path name)
   *    csets/ (change sets path)
   *        <change set id 1>.cs
   *        etc.
   *    <briefcaseId>/ (briefcase path)
   *        IModelName.bim (briefcase path name)
   */
  private static getIModelPath(iModelId: string): string {
    return path.join(BriefcaseManager.cachePath, iModelId);
  }

  private static getSeedPathname(iModelId: string, briefcase: Briefcase): string {
    return path.join(BriefcaseManager.getIModelPath(iModelId), briefcase.fileName);
  }

  private static getChangeSetsPath(iModelId: string): string {
    return path.join(BriefcaseManager.getIModelPath(iModelId), "csets");
  }

  private static getBriefcasePathname(iModelId: string, briefcase: Briefcase) {
    return path.join(BriefcaseManager.getIModelPath(iModelId), briefcase.briefcaseId.toString(), briefcase.fileName);
  }

  /** Initialize the briefcase manager */
  public static async initialize(accessToken?: AccessToken): Promise<void> {
    if (BriefcaseManager.cache)
      return;

    BriefcaseManager.cache = new BriefcaseCache();
    if (!accessToken)
      return;

    const nativeDb: NodeAddonDgnDb = new (NodeAddon.getAddon()).NodeAddonDgnDb();
    const res: BentleyReturn<DbResult, string> = nativeDb.getCachedBriefcaseInfosSync(BriefcaseManager.cachePath);
    if (res.error)
      Promise.reject(new IModelError(res.error.status));

    const briefcaseInfos: any = JSON.parse(res.result!);
    // JSON -
    // <IModelId1>
    //   <BriefcaseId1>
    //     pathname
    //     parentChangeSetId
    //   <BriefcaseId2>
    //     ...
    // <IModelId2>
    //  ...

    const localIModelIds = Object.getOwnPropertyNames(briefcaseInfos);
    for (const localIModelId of localIModelIds) {
      const localBriefcases = briefcaseInfos[localIModelId];
      const hubBriefcases: Briefcase[] = await BriefcaseManager.hubClient.getBriefcases(accessToken, localIModelId);

      for (const hubBriefcase of hubBriefcases) {
        const localBriefcase = localBriefcases[hubBriefcase.briefcaseId.toString()];
        if (!localBriefcase)
          continue;
        assert(localIModelId === hubBriefcase.iModelId);

        const iModelToken = IModelToken.fromBriefcase(localIModelId, hubBriefcase.briefcaseId, localBriefcase.pathname, hubBriefcase.userId);
        iModelToken.isOpen = undefined;
        iModelToken.changeSetId = localBriefcase.parentChangeSetId;
        iModelToken.changeSetIndex = await BriefcaseManager.getChangeSetIndexFromId(accessToken, localIModelId, iModelToken.changeSetId!);
        BriefcaseManager.cache.setBriefcase(iModelToken, new IModelDb(iModelToken, undefined, "", "", {})); // WIP - should be cache entry
      }

    }
  }

  /** Acquires a briefcase */
  private static async acquireBriefcase(accessToken: AccessToken, iModelId: string): Promise<Briefcase> {
    const briefcaseId: number = await BriefcaseManager.hubClient.acquireBriefcase(accessToken, iModelId);
    if (!briefcaseId)
      return Promise.reject(new IModelError(BriefcaseStatus.CannotAcquire));

    const briefcase: Briefcase = await BriefcaseManager.hubClient.getBriefcase(accessToken, iModelId, briefcaseId, true /*=getDownloadUrl*/);
    if (!briefcase) {
      await BriefcaseManager.hubClient.deleteBriefcase(accessToken, iModelId, briefcaseId)
        .catch(() => {
          assert(false, "Could not delete acquired briefcase");
          return Promise.reject(new IModelError(BriefcaseStatus.CannotDelete));
        });
    }

    return briefcase;
  }

  /** Deletes a briefcase, and releases it's references in the iModelHub */
  private static async deleteBriefcase(accessToken: AccessToken, iModelToken: IModelToken): Promise<void> {
    // Delete from the local file system
    if (fs.existsSync(iModelToken.pathname!))
      fs.unlinkSync(iModelToken.pathname!);

    // Delete from the hub
    assert(!!iModelToken.iModelId);
    assert(!!iModelToken.briefcaseId);
    await BriefcaseManager.hubClient.deleteBriefcase(accessToken, iModelToken.iModelId!, iModelToken.briefcaseId!)
      .catch(() => {
        assert(false, "Could not delete the accquired briefcase");
        return Promise.reject(new IModelError(BriefcaseStatus.CannotDelete));
      });

    // Delete from the cache
    BriefcaseManager.cache!.deleteBriefcase(iModelToken);
  }

  /** Downloads the briefcase seed file */
  private static async downloadBriefcase(briefcase: Briefcase, seedPathname: string): Promise<void> {
    if (fs.existsSync(seedPathname))
      return;

    BriefcaseManager.makeDirectoryRecursive(path.dirname(seedPathname)); // todo: move this to IModel Hub Client
    await BriefcaseManager.hubClient.downloadBriefcase(briefcase, seedPathname)
      .catch(() => {
        assert(false, "Could not download briefcase");
        if (fs.existsSync(seedPathname))
          fs.unlinkSync(seedPathname); // Just in case there was a partial download, delete the file
        return Promise.reject(new IModelError(BriefcaseStatus.CannotDownload));
      });
  }

  private static async copyFile(targetPathname: string, sourcePathname: string): Promise<void> {
    return new Promise<void>((resolve, reject) => {
      let status = true;

      const readStream = fs.createReadStream(sourcePathname);
      readStream.on("error", () => { status = false; });

      const writeStream = fs.createWriteStream(targetPathname);
      writeStream.on("error", () => { status = false; });

      readStream.pipe(writeStream);

      writeStream.on("close", () => { status ? resolve() : reject(); });
    });
  }

  private static async copyBriefcase(iModelId: string, briefcase: Briefcase, seedPathname: string): Promise<string> {
    const briefcasePathname: string = BriefcaseManager.getBriefcasePathname(iModelId, briefcase);

    const briefcasePath: string = path.dirname(briefcasePathname);
    if (!fs.existsSync(briefcasePath))
      fs.mkdirSync(briefcasePath);

    await BriefcaseManager.copyFile(briefcasePathname, seedPathname)
      .catch(() => { Promise.reject(new IModelError(BriefcaseStatus.CannotCopy)); });

    return briefcasePathname;
  }

  private static async getChangeSetIndexFromId(accessToken: AccessToken, iModelId: string, changeSetId: string): Promise<number | undefined> {
    if (changeSetId === "")
      return 0; // todo: perhaps this needs to be in the lower level hubClient method?
    const changeSet: ChangeSet = await BriefcaseManager.hubClient.getChangeSet(accessToken, iModelId, false, changeSetId);
    return +changeSet.index;
  }

  private static async getChangeSets(accessToken: AccessToken, iModelId: string, toChangeSetId: string, includeDownloadLink?: boolean, fromChangeSetId?: string): Promise<ChangeSet[]> {

    if (toChangeSetId === "" || fromChangeSetId === toChangeSetId)
      return new Array<ChangeSet>(); // first version

    const allChangeSets: ChangeSet[] = await BriefcaseManager.hubClient.getChangeSets(accessToken, iModelId, includeDownloadLink, fromChangeSetId);

    const changeSets = new Array<ChangeSet>();
    for (const changeSet of allChangeSets) {
      changeSets.push(changeSet);
      if (changeSet.wsgId === toChangeSetId)
        return changeSets;
    }

    return Promise.reject(new IModelError(BriefcaseStatus.VersionNotFound));
  }

  private static async downloadChangeSets(accessToken: AccessToken, iModelId: string, toChangeSetId: string, fromChangeSetId?: string): Promise<ChangeSetToken[]> {
    const changeSets = await BriefcaseManager.getChangeSets(accessToken, iModelId, toChangeSetId, true /*includeDownloadLink*/, fromChangeSetId);
    if (changeSets.length === 0)
      return new Array<ChangeSetToken>();

    const changeSetTokens = new Array<ChangeSetToken>();
    const changeSetsToDownload = new Array<ChangeSet>();
    const changeSetsPath: string = BriefcaseManager.getChangeSetsPath(iModelId);
    for (const changeSet of changeSets) {
      const changeSetPathname = path.join(changeSetsPath, changeSet.fileName);
      changeSetTokens.push(new ChangeSetToken(changeSet.wsgId, +changeSet.index, changeSetPathname));
      if (!fs.existsSync(changeSetPathname))
        changeSetsToDownload.push(changeSet);
    }

    // download
    if (changeSetsToDownload.length > 0) {
      BriefcaseManager.makeDirectoryRecursive(changeSetsPath); // todo: move this to IModel Hub Client
      await BriefcaseManager.hubClient.downloadChangeSets(changeSetsToDownload, changeSetsPath)
        .catch(() => {
          assert(false, "Could not download ChangeSets");
          fs.unlinkSync(changeSetsPath); // Just in case there was a partial download, delete the entire folder
          Promise.reject(new IModelError(BriefcaseStatus.CannotDownload));
        });
    }

    return changeSetTokens;
  }

  private static makeDirectoryRecursive(dirPath: string) {
    if (fs.existsSync(dirPath))
      return;
    BriefcaseManager.makeDirectoryRecursive(path.dirname(dirPath));
    fs.mkdirSync(dirPath);
  }

  private static async getLatestChangeSet(accessToken: AccessToken, iModelId: string): Promise<ChangeSet | null> {
    const changeSets: ChangeSet[] = await BriefcaseManager.hubClient.getChangeSets(accessToken, iModelId, false /*=includeDownloadLink*/);
    // todo: pass the last known highest change set id to improve efficiency, and cache the results also.

    return (changeSets.length === 0) ? null : changeSets[changeSets.length - 1];
  }

  private static async getChangeSetFromId(accessToken: AccessToken, iModelId: string, changeSetId: string): Promise<ChangeSet> {
    const changeSets: ChangeSet[] = await BriefcaseManager.hubClient.getChangeSets(accessToken, iModelId, false /*=includeDownloadLink*/);
    // todo: pass the last known highest change set id to improve efficiency, and cache the results also.

    for (const changeSet of changeSets) {
      if (changeSet.wsgId === changeSetId)
        return changeSet;
    }

    return Promise.reject(new IModelError(BriefcaseStatus.VersionNotFound));
  }

  private static async getChangeSetFromNamedVersion(accessToken: AccessToken, iModelId: string, versionName: string): Promise<ChangeSet | null> {
    const version = await BriefcaseManager.hubClient.getVersion(accessToken, iModelId, {
      $select: "*",
      $filter: `Name+eq+'${versionName}'`,
    });

    assert(!!version.changeSetId);
    return BriefcaseManager.getChangeSetFromId(accessToken, iModelId, version.changeSetId);
  }

  private static async getChangeSetFromVersion(accessToken: AccessToken, iModelId: string, version: IModelVersion): Promise<ChangeSet | null> {
    if (version.isFirst())
      return null;

    if (version.isLatest())
      return await BriefcaseManager.getLatestChangeSet(accessToken, iModelId);

    const afterChangeSetId: string | undefined = version.getAfterChangeSetId();
    if (afterChangeSetId)
      return await BriefcaseManager.getChangeSetFromId(accessToken, iModelId, afterChangeSetId);

    const versionName: string | undefined = version.getName();
    if (versionName)
      return await BriefcaseManager.getChangeSetFromNamedVersion(accessToken, iModelId, versionName);

    return Promise.reject(new IModelError(BriefcaseStatus.VersionNotFound));
  }

  private static async findUnusedBriefcase(accessToken: AccessToken, iModelId: string, openMode: OpenMode, requiredChangeSet: ChangeSet | null): Promise<IModelDb | undefined> {
    const requiredChangeSetIndex: number = requiredChangeSet ? +requiredChangeSet.index : 0;
    const cache = BriefcaseManager.cache!;

    const briefcases = new Array<IModelDb>();
    for (const entry of cache.briefcases.values()) {
      if (entry.iModelToken.iModelId !== iModelId)
        continue;
      if (entry.iModelToken.changeSetIndex! > requiredChangeSetIndex)
        continue;
      briefcases.push(entry);
    }

    // For read-only cases...
    let briefcase: IModelDb | undefined;
    if (openMode === OpenMode.Readonly) {

      // first prefer any briefcase that's opened already, is read-only and with version = requiredVersion
      briefcase = briefcases.find(({ iModelToken }): boolean => {
        return !!iModelToken.isOpen && iModelToken.openMode === OpenMode.Readonly && iModelToken.changeSetIndex === requiredChangeSetIndex;
      });
      if (briefcase)
        return briefcase;

      // next prefer any briefcase that's closed, and with version = requiredVersion
      briefcase = briefcases.find(({ iModelToken }): boolean => {
        return !iModelToken.isOpen && iModelToken.changeSetIndex === requiredChangeSetIndex;
      });
      if (briefcase)
        return briefcase;

      // next prefer any briefcase that's closed, and with version < requiredVersion
      briefcase = briefcases.find(({ iModelToken }): boolean => {
        return !iModelToken.isOpen && iModelToken.changeSetIndex! < requiredChangeSetIndex;
      });
      if (briefcase)
        return briefcase;

      return undefined;
    }

    // For read-write cases...
    // first prefer any briefcase that's been acquired by the user, is currently closed, and with version = requiredVersion
    briefcase = briefcases.find(({ iModelToken }): boolean => {
      return !iModelToken.isOpen && iModelToken.changeSetIndex === requiredChangeSetIndex && iModelToken.userId === accessToken.getUserProfile().userId;
    });
    if (briefcase)
      return briefcase;

    // next prefer any briefcase that's been acquired by the user, is currently closed, and with version < requiredVersion
    briefcase = briefcases.find(({ iModelToken }): boolean => {
      return !iModelToken.isOpen && iModelToken.changeSetIndex! < requiredChangeSetIndex && iModelToken.userId === accessToken.getUserProfile().userId;
    });
    if (briefcase)
      return briefcase;

    return undefined;
  }

  private static async createBriefcaseSeed(accessToken: AccessToken, iModelId: string): Promise<IModelToken> {
    const briefcase = await BriefcaseManager.acquireBriefcase(accessToken, iModelId);

    const seedPathname = BriefcaseManager.getSeedPathname(iModelId, briefcase);
    await BriefcaseManager.downloadBriefcase(briefcase, seedPathname);
    const briefcasePathname = await BriefcaseManager.copyBriefcase(iModelId, briefcase, seedPathname);

    const userId = accessToken.getUserProfile().userId;
    const iModelToken = IModelToken.fromBriefcase(briefcase.iModelId, briefcase.briefcaseId, briefcasePathname, userId);
    return iModelToken;
  }

  private static async updateAndOpenBriefcase(accessToken: AccessToken, iModelToken: IModelToken, openMode: OpenMode, changeSet: ChangeSet | null): Promise<IModelDb> {
    iModelToken.openMode = openMode;

    const toChangeSetId: string = !!changeSet ? changeSet.wsgId : "";
    const toChangeSetIndex: number = !!changeSet ? +changeSet.index : 0;
    const fromChangeSetId: string = iModelToken.changeSetId!;
    const changeSetTokens = await BriefcaseManager.downloadChangeSets(accessToken, iModelToken.iModelId!, toChangeSetId, fromChangeSetId);

    const nativeDb: NodeAddonDgnDb  = new (NodeAddon.getAddon()).NodeAddonDgnDb();
    const res: DbResult = await nativeDb.openBriefcaseSync(JSON.stringify(iModelToken), JSON.stringify(changeSetTokens));
    if (DbResult.BE_SQLITE_OK !== res)
      throw new IModelError(res);

    // Remove any old entry in the cache if an older briefcase may be repurposed.
    if (BriefcaseManager.cache!.hasBriefcase(iModelToken))
      BriefcaseManager.cache!.deleteBriefcase(iModelToken);

    iModelToken.isOpen = true;
    iModelToken.changeSetId = toChangeSetId;
    iModelToken.changeSetIndex = toChangeSetIndex;

    const iModelDb = new IModelDb(iModelToken, nativeDb, iModelToken.pathname, "", {}); // WIP - properly set name, description, extents
    BriefcaseManager.cache!.setBriefcase(iModelToken, iModelDb);

    return iModelDb;
  }

  /** Purge closed briefcases */
  public static async purgeClosed(accessToken: AccessToken) {
    if (!BriefcaseManager.cache)
      await BriefcaseManager.initialize(accessToken);

    const cache = BriefcaseManager.cache!;
    const briefcases = cache.briefcases;
    for (const entry of briefcases.values()) {
      const iModelToken = entry.iModelToken;
      if (iModelToken.isOpen)
        continue;
      await BriefcaseManager.deleteBriefcase(accessToken, iModelToken);
    }
  }

  public static async open(accessToken: AccessToken, iModelId: string, openMode: OpenMode, version: IModelVersion): Promise<IModelDb> {
    if (!BriefcaseManager.cache)
      await BriefcaseManager.initialize(accessToken);

    const changeSet: ChangeSet | null = await BriefcaseManager.getChangeSetFromVersion(accessToken, iModelId, version);

    const briefcase = await BriefcaseManager.findUnusedBriefcase(accessToken, iModelId, openMode, changeSet);
    if (briefcase && openMode === OpenMode.Readonly && briefcase.iModelToken.isOpen)
      return briefcase;

    let iModelToken: IModelToken;
    if (briefcase)
      iModelToken = briefcase.iModelToken;
    else
      iModelToken = await BriefcaseManager.createBriefcaseSeed(accessToken, iModelId);

    return await BriefcaseManager.updateAndOpenBriefcase(accessToken, iModelToken, openMode, changeSet);
  }

  public static async openStandalone(fileName: string, openMode: OpenMode, enableTransactions: boolean): Promise<IModelDb> {
    if (!BriefcaseManager.cache)
      BriefcaseManager.initialize();

    const nativeDb: NodeAddonDgnDb  = new (NodeAddon.getAddon()).NodeAddonDgnDb();

    return new Promise<IModelDb>((resolve, reject) => {

        nativeDb.openDgnDb(fileName, openMode, (error: DbResult | undefined) => {

          if (error) {
            reject(new IModelError(error));
            return;
          }

          if (enableTransactions) {
            const bid: number = nativeDb.getBriefcaseId();
            if (bid === BriefcaseId.Illegal || bid === BriefcaseId.Master)
              nativeDb.setBriefcaseId(BriefcaseId.Standalone);
            assert(nativeDb.getBriefcaseId() !== BriefcaseId.Illegal || nativeDb.getBriefcaseId() !== BriefcaseId.Master);
          }

          const iModelToken = IModelToken.fromFile(fileName, openMode, true /*isOpen*/);
          BriefcaseManager.cache!.setBriefcase(iModelToken, new IModelDb(iModelToken, nativeDb, iModelToken.pathname, "", {})); // WIP - properly set name, description, extents

          resolve (new IModelDb(iModelToken, nativeDb, fileName, "", {})); // WIP - property set name, description, extents
          });
      });
  }

  public static async close(accessToken: AccessToken, iModelToken: IModelToken, keepBriefcase: KeepBriefcase): Promise<void> {
    if (keepBriefcase === KeepBriefcase.No)
      await BriefcaseManager.deleteBriefcase(accessToken, iModelToken);
    else
      BriefcaseManager.cache!.setBriefcase(iModelToken, new IModelDb(iModelToken, undefined, "", "", {})); // WIP - should be cache entry, not IModelDb
  }

  public static closeStandalone(iModelToken: IModelToken) {
    BriefcaseManager.cache!.setBriefcase(iModelToken, new IModelDb(iModelToken, undefined, "", "", {})); // WIP - should be cache entry, not IModelDb
  }

  public static getBriefcase(iModelToken: IModelToken): IModelDb | undefined {
    if (!BriefcaseManager.cache)
      return undefined;

    return BriefcaseManager.cache.getBriefcase(iModelToken);
  }
}
