/*---------------------------------------------------------------------------------------------
|  $Copyright: (c) 2017 Bentley Systems, Incorporated. All rights reserved. $
 *--------------------------------------------------------------------------------------------*/
import { MultiTierExecutionHost, RunsIn, Tier } from "@bentley/bentleyjs-core/lib/tiering";
import { AccessToken, Briefcase, IModelHubClient, ChangeSet } from "@bentley/imodeljs-clients";
import { BentleyReturn } from "@bentley/bentleyjs-core/lib/Bentley";
import { DbResult, OpenMode } from "@bentley/bentleyjs-core/lib/BeSQLite";
import { assert } from "@bentley/bentleyjs-core/lib/Assert";
import { IModelError } from "../IModelError";
import { IModelVersion } from "../IModelVersion";
import { BriefcaseToken } from "../IModel";
import { IModelDb } from "./IModelDb";

import * as fs from "fs";
import * as path from "path";

declare const __dirname: string;
declare function require(arg: string): any;
// tslint:disable-next-line:no-var-requires
const addonLoader = require("../../scripts/addonLoader");
let dgnDbNodeAddon: any | undefined;
if (addonLoader !== undefined)
  dgnDbNodeAddon = addonLoader.loadNodeAddon(); // Note that evaluating this script has the side-effect of loading the addon

/**
 * Error status from various briefcase operations
 * @todo: need to setup the error numbers in a consistent way
 */
export const enum BriefcaseError {
  NotInitialized = 0x20000,
  CannotAcquire,
  CannotDownload,
  CannotCopy,
  CannotDelete,
  VersionNotFound,
  BriefcaseNotFound,
  NotSupportedYet,
}

/** Option to keep briefcase when the imodel is closed */
export const enum KeepBriefcase {
  Yes,
  No,
}

/** A token that represents a ChangeSet  */
export class ChangeSetToken {
  constructor(public id: string, public index: number, public pathname: string) {}
}

/** In-memory cache of briefcases  */
class BriefcaseCache {
  public readonly briefcases = new Map<string, IModelDb>(); // Indexed by local pathname of the briefcase

  public setBriefcase(briefcaseToken: BriefcaseToken, db: any): void {
    const entry = new IModelDb(briefcaseToken, db);
    this.briefcases.set(briefcaseToken.pathname, entry);
  }

  public getBriefcase(briefcaseToken: BriefcaseToken): IModelDb|undefined {
    return this.briefcases.get(briefcaseToken.pathname);
  }

  public hasBriefcase(briefcaseToken: BriefcaseToken): boolean {
    return this.briefcases.has(briefcaseToken.pathname);
  }

  public deleteBriefcase(briefcaseToken: BriefcaseToken): void {
    this.briefcases.delete(briefcaseToken.pathname);
  }
}

@MultiTierExecutionHost("@bentley/imodeljs-core/IModel")
export class BriefcaseManager {
  private static hubClient = new IModelHubClient("QA");
  public static rootPath = path.join(__dirname, "../assets/imodels");
  private static cache?: BriefcaseCache;

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
  @RunsIn(Tier.Services)
  private static getIModelPath(iModelId: string): string {
    return path.join(BriefcaseManager.rootPath, iModelId);
  }

  @RunsIn(Tier.Services)
  private static getSeedPathname(iModelId: string, briefcase: Briefcase): string {
    return path.join(BriefcaseManager.getIModelPath(iModelId), briefcase.fileName);
  }

  @RunsIn(Tier.Services)
  private static getChangeSetsPath(iModelId: string): string {
    return path.join(BriefcaseManager.getIModelPath(iModelId), "csets");
  }

  @RunsIn(Tier.Services)
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

    const db = new dgnDbNodeAddon.DgnDb();
    const res: BentleyReturn<DbResult, string> = await db.getCachedBriefcaseInfos(BriefcaseManager.rootPath);
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
        assert (localIModelId === hubBriefcase.iModelId);

        const briefcaseToken = BriefcaseToken.fromBriefcase(localIModelId, hubBriefcase.briefcaseId, localBriefcase.pathname, hubBriefcase.userId);
        briefcaseToken.isOpen = undefined;
        briefcaseToken.changeSetId = localBriefcase.parentChangeSetId;
        briefcaseToken.changeSetIndex = await BriefcaseManager.getChangeSetIndexFromId(accessToken, localIModelId, briefcaseToken.changeSetId!);
        BriefcaseManager.cache.setBriefcase(briefcaseToken, undefined);
      }

    }
  }

  /** Acquires a briefcase */
  @RunsIn(Tier.Services)
  private static async acquireBriefcase(accessToken: AccessToken, iModelId: string): Promise<Briefcase> {
    const briefcaseId: number = await BriefcaseManager.hubClient.acquireBriefcase(accessToken, iModelId);
    if (!briefcaseId)
      return Promise.reject(new IModelError(BriefcaseError.CannotAcquire));

    const briefcase: Briefcase = await BriefcaseManager.hubClient.getBriefcase(accessToken, iModelId, briefcaseId, true /*=getDownloadUrl*/);
    if (!briefcase) {
      await BriefcaseManager.hubClient.deleteBriefcase(accessToken, iModelId, briefcaseId)
        .catch(() => {
          assert(false, "Could not delete acquired briefcase");
          return Promise.reject(new IModelError(BriefcaseError.CannotDelete));
        });
    }

    return briefcase;
  }

  /** Deletes a briefcase, and releases it's references in the iModelHub */
  @RunsIn(Tier.Services)
  private static async deleteBriefcase(accessToken: AccessToken, briefcaseToken: BriefcaseToken): Promise<void> {
    // Delete from the local file system
    if (fs.existsSync(briefcaseToken.pathname!))
      fs.unlinkSync(briefcaseToken.pathname!);

    // Delete from the hub
    assert(!!briefcaseToken.imodelId);
    assert(!!briefcaseToken.briefcaseId);
    await BriefcaseManager.hubClient.deleteBriefcase(accessToken, briefcaseToken.imodelId!, briefcaseToken.briefcaseId!)
      .catch(() => {
        assert(false, "Could not delete the accquired briefcase");
        return Promise.reject(new IModelError(BriefcaseError.CannotDelete));
      });

    // Delete from the cache
    BriefcaseManager.cache!.deleteBriefcase(briefcaseToken);
    }

  /** Downloads the briefcase seed file */
  @RunsIn(Tier.Services)
  private static async downloadBriefcase(briefcase: Briefcase, seedPathname: string): Promise<void> {
    if (fs.existsSync(seedPathname))
      return;

    BriefcaseManager.makeDirectoryRecursive(path.dirname(seedPathname)); // todo: move this to IModel Hub Client
    await BriefcaseManager.hubClient.downloadBriefcase(briefcase, seedPathname)
      .catch(() => {
        assert(false, "Could not download briefcase");
        if (fs.existsSync(seedPathname))
          fs.unlinkSync(seedPathname); // Just in case there was a partial download, delete the file
        return Promise.reject(new IModelError(BriefcaseError.CannotDownload));
      });
  }

  @RunsIn(Tier.Services)
  private static async copyFile(targetPathname: string, sourcePathname: string): Promise<void> {
    return new Promise<void> ((resolve, reject) => {
      let status = true;

      const readStream = fs.createReadStream(sourcePathname);
      readStream.on("error", () => { status = false; });

      const writeStream = fs.createWriteStream(targetPathname);
      writeStream.on("error", () => { status = false; });

      readStream.pipe(writeStream);

      writeStream.on("close", () => { status ? resolve() : reject(); });
    });
  }

  @RunsIn(Tier.Services)
  private static async copyBriefcase(iModelId: string, briefcase: Briefcase, seedPathname: string): Promise<string> {
    const briefcasePathname: string = BriefcaseManager.getBriefcasePathname(iModelId, briefcase);

    const briefcasePath: string = path.dirname(briefcasePathname);
    if (!fs.existsSync(briefcasePath))
      fs.mkdirSync(briefcasePath);

    await BriefcaseManager.copyFile(briefcasePathname, seedPathname)
      .catch(() => {Promise.reject(new IModelError(BriefcaseError.CannotCopy)); });

    return briefcasePathname;
  }

  @RunsIn(Tier.Services)
  private static async getChangeSetIndexFromId(accessToken: AccessToken, iModelId: string, changeSetId: string): Promise<number|undefined> {
    if (changeSetId === "")
      return 0; // todo: perhaps this needs to be in the lower level hubClient method?
    const changeSet: ChangeSet = await BriefcaseManager.hubClient.getChangeSet(accessToken, iModelId, false, changeSetId);
    return +changeSet.index;
  }

  @RunsIn(Tier.Services)
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

    return Promise.reject(new IModelError(BriefcaseError.VersionNotFound));
  }

  @RunsIn(Tier.Services)
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
          Promise.reject(new IModelError(BriefcaseError.CannotDownload));
        });
    }

    return changeSetTokens;
  }

  @RunsIn(Tier.Services)
  private static makeDirectoryRecursive(dirPath: string) {
    if (fs.existsSync(dirPath))
      return;
    BriefcaseManager.makeDirectoryRecursive(path.dirname(dirPath));
    fs.mkdirSync(dirPath);
  }

  @RunsIn(Tier.Services)
  private static async getLatestChangeSet(accessToken: AccessToken, iModelId: string): Promise<ChangeSet|null> {
    const changeSets: ChangeSet[] = await BriefcaseManager.hubClient.getChangeSets(accessToken, iModelId, false /*=includeDownloadLink*/);
      // todo: pass the last known highest change set id to improve efficiency, and cache the results also.

    return (changeSets.length === 0) ? null : changeSets[changeSets.length - 1];
  }

  @RunsIn(Tier.Services)
  private static async getChangeSetFromId(accessToken: AccessToken, iModelId: string, changeSetId: string): Promise<ChangeSet> {
    const changeSets: ChangeSet[] = await BriefcaseManager.hubClient.getChangeSets(accessToken, iModelId, false /*=includeDownloadLink*/);
    // todo: pass the last known highest change set id to improve efficiency, and cache the results also.

    for (const changeSet of changeSets) {
      if (changeSet.wsgId === changeSetId)
        return changeSet;
    }

    return Promise.reject(new IModelError(BriefcaseError.VersionNotFound));
  }

  private static async getChangeSetFromNamedVersion(accessToken: AccessToken, iModelId: string, versionName: string): Promise<ChangeSet|null> {
    const version = await BriefcaseManager.hubClient.getVersion(accessToken, iModelId, {
      $select: "*",
      $filter: `Name+eq+'${versionName}'`,
    });

    assert(!!version.changeSetId);
    return BriefcaseManager.getChangeSetFromId(accessToken, iModelId, version.changeSetId);
  }

  @RunsIn(Tier.Services)
  private static async getChangeSetFromVersion(accessToken: AccessToken, iModelId: string, version: IModelVersion): Promise<ChangeSet|null> {
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

    return Promise.reject(new IModelError(BriefcaseError.VersionNotFound));
  }

  @RunsIn(Tier.Services)
  private static async findUnusedBriefcase(accessToken: AccessToken, iModelId: string, openMode: OpenMode, requiredChangeSet: ChangeSet|null): Promise<IModelDb|undefined> {
    const requiredChangeSetIndex: number = requiredChangeSet ? +requiredChangeSet.index : 0;
    const cache = BriefcaseManager.cache!;

    const briefcases = new Array<IModelDb>();
    for (const entry of cache.briefcases.values()) {
      const briefcaseKey = entry.briefcaseKey!;
      assert(!!briefcaseKey);

      if (briefcaseKey.imodelId !== iModelId)
        continue;
      if (briefcaseKey.changeSetIndex! > requiredChangeSetIndex)
        continue;
      briefcases.push(entry);
    }

    // For read-only cases...
    let briefcase: IModelDb|undefined;
    if (openMode === OpenMode.Readonly) {

      // first prefer any briefcase that's opened already, is read-only and with version = requiredVersion
      briefcase = briefcases.find((entry: IModelDb): boolean => {
        const briefcaseKey = entry.briefcaseKey!;
        return !!briefcaseKey.isOpen && briefcaseKey.openMode === OpenMode.Readonly && briefcaseKey.changeSetIndex === requiredChangeSetIndex;
      });
      if (briefcase)
        return briefcase;

      // next prefer any briefcase that's closed, and with version = requiredVersion
      briefcase = briefcases.find((entry: IModelDb): boolean => {
        const briefcaseKey = entry.briefcaseKey!;
        return !briefcaseKey.isOpen && briefcaseKey.changeSetIndex === requiredChangeSetIndex;
      });
      if (briefcase)
        return briefcase;

      // next prefer any briefcase that's closed, and with version < requiredVersion
      briefcase = briefcases.find((entry: IModelDb): boolean => {
        const briefcaseKey = entry.briefcaseKey!;
        return !briefcaseKey.isOpen && briefcaseKey.changeSetIndex! < requiredChangeSetIndex;
      });
      if (briefcase)
        return briefcase;

      return undefined;
    }

    // For read-write cases...
    // first prefer any briefcase that's been acquired by the user, is currently closed, and with version = requiredVersion
    briefcase = briefcases.find((entry: IModelDb): boolean => {
      const briefcaseKey = entry.briefcaseKey!;
      return !briefcaseKey.isOpen && briefcaseKey.changeSetIndex === requiredChangeSetIndex && briefcaseKey.userId === accessToken.getUserProfile().userId;
    });
    if (briefcase)
      return briefcase;

    // next prefer any briefcase that's been acquired by the user, is currently closed, and with version < requiredVersion
    briefcase = briefcases.find((entry: IModelDb): boolean => {
      const briefcaseKey = entry.briefcaseKey!;
      return !briefcaseKey.isOpen && briefcaseKey.changeSetIndex! < requiredChangeSetIndex && briefcaseKey.userId === accessToken.getUserProfile().userId;
    });
    if (briefcase)
      return briefcase;

    return undefined;
  }

  @RunsIn(Tier.Services)
  private static async createBriefcaseSeed(accessToken: AccessToken, iModelId: string): Promise<BriefcaseToken> {
    const briefcase = await BriefcaseManager.acquireBriefcase(accessToken, iModelId);

    const seedPathname = BriefcaseManager.getSeedPathname(iModelId, briefcase);
    await BriefcaseManager.downloadBriefcase(briefcase, seedPathname);
    const briefcasePathname = await BriefcaseManager.copyBriefcase(iModelId, briefcase, seedPathname);

    const userId = accessToken.getUserProfile().userId;
    const briefcaseToken = BriefcaseToken.fromBriefcase(briefcase.iModelId, briefcase.briefcaseId, briefcasePathname, userId);
    return briefcaseToken;
  }

  @RunsIn(Tier.Services)
  private static async updateAndOpenBriefcase(accessToken: AccessToken, briefcaseKey: BriefcaseToken, openMode: OpenMode, changeSet: ChangeSet|null): Promise<IModelDb> {
    briefcaseKey.openMode = openMode;

    const toChangeSetId: string = !!changeSet ? changeSet.wsgId : "";
    const toChangeSetIndex: number = !!changeSet ? +changeSet.index : 0;
    const fromChangeSetId: string = briefcaseKey.changeSetId!;
    const changeSetTokens = await BriefcaseManager.downloadChangeSets(accessToken, briefcaseKey.imodelId!, toChangeSetId, fromChangeSetId);

    const db = new dgnDbNodeAddon.DgnDb();
    const res: BentleyReturn<DbResult, void> = await db.openBriefcase(JSON.stringify(briefcaseKey), JSON.stringify(changeSetTokens));
    if (res.error)
      throw new IModelError(res.error.status);

    // Remove any old entry in the cache if an older briefcase may be repurposed.
    if (BriefcaseManager.cache!.hasBriefcase(briefcaseKey))
      BriefcaseManager.cache!.deleteBriefcase(briefcaseKey);

    briefcaseKey.isOpen = true;
    briefcaseKey.changeSetId = toChangeSetId;
    briefcaseKey.changeSetIndex = toChangeSetIndex;
    BriefcaseManager.cache!.setBriefcase(briefcaseKey, db);

    return new IModelDb(briefcaseKey, db);
  }

  /** Purge closed briefcases */
  public static async purgeClosed(accessToken: AccessToken) {
    if (!BriefcaseManager.cache)
      await BriefcaseManager.initialize(accessToken);

    const cache = BriefcaseManager.cache!;
    const briefcases = cache.briefcases;
    for (const entry of briefcases.values()) {
      const briefcaseKey = entry.briefcaseKey!;
      if (briefcaseKey.isOpen)
        continue;
      await BriefcaseManager.deleteBriefcase(accessToken, briefcaseKey);
    }
  }

  @RunsIn(Tier.Services)
  public static async open(accessToken: AccessToken, iModelId: string, openMode: OpenMode, version: IModelVersion): Promise<IModelDb> {
    if (!BriefcaseManager.cache)
      await BriefcaseManager.initialize(accessToken);

    const changeSet: ChangeSet|null = await BriefcaseManager.getChangeSetFromVersion(accessToken, iModelId, version);

    const briefcase = await BriefcaseManager.findUnusedBriefcase(accessToken, iModelId, openMode, changeSet);
    if (briefcase && openMode === OpenMode.Readonly && briefcase.briefcaseKey!.isOpen)
      return briefcase;

    let briefcaseKey: BriefcaseToken;
    if (briefcase)
      briefcaseKey = briefcase.briefcaseKey!;
    else
      briefcaseKey = await BriefcaseManager.createBriefcaseSeed(accessToken, iModelId);

    return await BriefcaseManager.updateAndOpenBriefcase(accessToken, briefcaseKey, openMode, changeSet);
  }

  @RunsIn(Tier.Services)
  public static async openStandalone(fileName: string, openMode: OpenMode): Promise<IModelDb> {
    if (!BriefcaseManager.cache)
      BriefcaseManager.initialize();

    const db = new dgnDbNodeAddon.DgnDb();
    const res: BentleyReturn<DbResult, void> = await db.openDgnDb(fileName, openMode);
    if (res.error)
      throw new IModelError(res.error.status);

    const briefcaseKey = BriefcaseToken.fromFile(fileName, openMode, true /*isOpen*/);
    BriefcaseManager.cache!.setBriefcase(briefcaseKey, db);

    return new IModelDb(briefcaseKey, db);
  }

  public static async close(accessToken: AccessToken, briefcaseToken: BriefcaseToken, keepBriefcase: KeepBriefcase): Promise<void> {
    if (keepBriefcase === KeepBriefcase.No)
      await BriefcaseManager.deleteBriefcase(accessToken, briefcaseToken);
    else
      BriefcaseManager.cache!.setBriefcase(briefcaseToken, undefined);
  }

  public static closeStandalone(briefcaseToken: BriefcaseToken) {
    BriefcaseManager.cache!.setBriefcase(briefcaseToken, undefined);
  }

  public static getBriefcase(briefcaseToken: BriefcaseToken): IModelDb|undefined {
    if (!BriefcaseManager.cache)
      return undefined;

    return BriefcaseManager.cache.getBriefcase(briefcaseToken);
  }

}
