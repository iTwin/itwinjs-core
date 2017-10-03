/*---------------------------------------------------------------------------------------------
|  $Copyright: (c) 2017 Bentley Systems, Incorporated. All rights reserved. $
 *--------------------------------------------------------------------------------------------*/
import { MultiTierExecutionHost, RunsIn, Tier } from "@bentley/bentleyjs-core/lib/tiering";
import { AccessToken, Briefcase, IModelHubClient, ChangeSet } from "@bentley/imodeljs-clients";
import { BentleyReturn } from "@bentley/bentleyjs-core/lib/Bentley";
import { DbResult, OpenMode } from "@bentley/bentleyjs-core/lib/BeSQLite";
import { assert } from "@bentley/bentleyjs-core/lib/Assert";
import { IModelStatus, IModelError } from "../IModelError";
import { IModelVersion } from "../IModelVersion";
import { ECSqlStatement } from "./ECSqlStatement";
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

/** A token that represents a Briefcase */
export class BriefcaseToken {
  public pathname: string;
  public openMode?: OpenMode;

  public imodelId?: string;
  public briefcaseId?: number;
  public userId?: string;

  public changeSetId?: string;
  public changeSetIndex?: number;

  public isOpen?: boolean;

  public static fromFile(pathname: string, openMode: OpenMode, isOpen: boolean): BriefcaseToken {
    const token = new BriefcaseToken();
    token.pathname = pathname;
    token.openMode = openMode;
    token.isOpen = isOpen;
    return token;
  }

  public static fromBriefcase(imodelId: string, briefcaseId: number, pathname: string, userId: string): BriefcaseToken {
    const token = new BriefcaseToken();
    token.imodelId = imodelId;
    token.briefcaseId = briefcaseId;
    token.pathname = pathname;
    token.userId = userId;
    return token;
  }
}

/** A token that represents a ChangeSet  */
export class ChangeSetToken {
  constructor(public id: string, public index: number, public pathname: string) {}
}

/** An entry in the briefcase cache */
class BriefcaseCacheEntry {
  public constructor(public briefcaseToken: BriefcaseToken, public db: any|undefined) {
  }
}

/** In-memory cache of briefcases  */
class BriefcaseCache {
  public readonly briefcases = new Map<string, BriefcaseCacheEntry>(); // Indexed by local pathname of the briefcase

  public setBriefcase(briefcaseToken: BriefcaseToken, db: any): void {
    const entry = new BriefcaseCacheEntry(briefcaseToken, db);
    this.briefcases.set(briefcaseToken.pathname, entry);
  }

  public getBriefcase(briefcaseToken: BriefcaseToken): any|undefined {
    const entry: BriefcaseCacheEntry|undefined = this.briefcases.get(briefcaseToken.pathname);
    return entry ? entry.db : undefined;
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

  /** @private */
  @RunsIn(Tier.Services)
  public static prepareECSqlStatement(bctok: BriefcaseToken, ecsql: string): ECSqlStatement {
    const s = new ECSqlStatement();
    s.prepare(BriefcaseManager.getBriefcaseFromCache(bctok), ecsql);
    return s;
  }

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

  @RunsIn(Tier.Services)
  private static getBriefcaseFromCache(briefcaseToken: BriefcaseToken): any | undefined {
    if (!BriefcaseManager.cache)
      throw new IModelError(BriefcaseError.NotInitialized, "Call BriefcaseManager.initialize(), and reopen iModel");
    return BriefcaseManager.cache.getBriefcase(briefcaseToken);
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

  @RunsIn(Tier.Services)
  private static async getChangeSetFromVersion(accessToken: AccessToken, iModelId: string, version: IModelVersion): Promise<ChangeSet|null> {
    if (version.isFirst())
      return null;

    if (version.isLatest())
      return await BriefcaseManager.getLatestChangeSet(accessToken, iModelId);

    const afterChangeSetId: string | undefined = version.getAfterChangeSetId();
    if (!!afterChangeSetId)
      return await BriefcaseManager.getChangeSetFromId(accessToken, iModelId, afterChangeSetId);

    assert(false, "version.isWithName() || version.shouldUseExisting() not supported yet");
    return Promise.reject(new IModelError(BriefcaseError.NotSupportedYet));
    // todo: support version.isWithName() || version.shouldUseExisting()
  }

  @RunsIn(Tier.Services)
  private static async findUnusedBriefcase(accessToken: AccessToken, iModelId: string, openMode: OpenMode, requiredChangeSet: ChangeSet|null): Promise<BriefcaseToken|undefined> {
    const requiredChangeSetIndex: number = requiredChangeSet ? +requiredChangeSet.index : 0;
    const cache = BriefcaseManager.cache!;
    let briefcaseToken: BriefcaseToken|undefined;

    const briefcases = new Array<BriefcaseToken>();
    for (const entry of cache.briefcases.values()) {
      briefcaseToken = entry.briefcaseToken;
      if (briefcaseToken.imodelId !== iModelId)
        continue;
      if (briefcaseToken.changeSetIndex! > requiredChangeSetIndex)
        continue;
      briefcases.push(entry.briefcaseToken);
    }

    // For read-only cases...
    if (openMode === OpenMode.Readonly) {
      // first prefer any briefcase that's opened already, is read-only and with version = requiredVersion
      briefcaseToken = briefcases.find((entry: BriefcaseToken): boolean => !!entry.isOpen && entry.openMode === OpenMode.Readonly && entry.changeSetIndex === requiredChangeSetIndex);
      if (briefcaseToken)
        return briefcaseToken;

      // next prefer any briefcase that's closed, and with version = requiredVersion
      briefcaseToken = briefcases.find((entry: BriefcaseToken): boolean => !entry.isOpen && entry.changeSetIndex === requiredChangeSetIndex);
      if (briefcaseToken)
        return briefcaseToken;

      // next prefer any briefcase that's closed, and with version < requiredVersion
      briefcaseToken = briefcases.find((entry: BriefcaseToken): boolean => !entry.isOpen && entry.changeSetIndex! < requiredChangeSetIndex);
      if (briefcaseToken)
        return briefcaseToken;

      return undefined;
    }

    // For read-write cases...
    // first prefer any briefcase that's been acquired by the user, is currently closed, and with version = requiredVersion
    briefcaseToken = briefcases.find((entry: BriefcaseToken): boolean => !entry.isOpen && entry.changeSetIndex === requiredChangeSetIndex && entry.userId === accessToken.getUserProfile().userId);
    if (briefcaseToken)
      return briefcaseToken;

    // next prefer any briefcase that's been acquired by the user, is currently closed, and with version < requiredVersion
    briefcaseToken = briefcases.find((entry: BriefcaseToken): boolean => !entry.isOpen && entry.changeSetIndex! < requiredChangeSetIndex && entry.userId === accessToken.getUserProfile().userId);
    if (briefcaseToken)
      return briefcaseToken;

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
  private static async updateAndOpenBriefcase(accessToken: AccessToken, briefcaseToken: BriefcaseToken, openMode: OpenMode, changeSet: ChangeSet|null): Promise<void> {
    briefcaseToken.openMode = openMode;

    const toChangeSetId: string = !!changeSet ? changeSet.wsgId : "";
    const toChangeSetIndex: number = !!changeSet ? +changeSet.index : 0;
    const fromChangeSetId: string = briefcaseToken.changeSetId!;
    const changeSetTokens = await BriefcaseManager.downloadChangeSets(accessToken, briefcaseToken.imodelId!, toChangeSetId, fromChangeSetId);

    const db = new dgnDbNodeAddon.DgnDb();
    const res: BentleyReturn<DbResult, void> = await db.openBriefcase(JSON.stringify(briefcaseToken), JSON.stringify(changeSetTokens));
    if (res.error)
      throw new IModelError(res.error.status);

    // Remove any old entry in the cache if an older briefcase may be repurposed.
    if (BriefcaseManager.cache!.hasBriefcase(briefcaseToken))
      BriefcaseManager.cache!.deleteBriefcase(briefcaseToken);

    briefcaseToken.isOpen = true;
    briefcaseToken.changeSetId = toChangeSetId;
    briefcaseToken.changeSetIndex = toChangeSetIndex;
    BriefcaseManager.cache!.setBriefcase(briefcaseToken, db);
  }

  /** Purge closed briefcases */
  public static async purgeClosed(accessToken: AccessToken) {
    if (!BriefcaseManager.cache)
      await BriefcaseManager.initialize(accessToken);

    const cache = BriefcaseManager.cache!;
    const briefcases = cache.briefcases;
    for (const entry of briefcases.values()) {
      const briefcaseToken = entry.briefcaseToken;
      if (briefcaseToken.isOpen)
        continue;
      await BriefcaseManager.deleteBriefcase(accessToken, briefcaseToken);
    }
  }

  @RunsIn(Tier.Services)
  public static async open(accessToken: AccessToken, iModelId: string, openMode: OpenMode, version: IModelVersion): Promise<BriefcaseToken> {
    if (!BriefcaseManager.cache)
      await BriefcaseManager.initialize(accessToken);

    const changeSet: ChangeSet|null = await BriefcaseManager.getChangeSetFromVersion(accessToken, iModelId, version);

    let briefcaseToken = await BriefcaseManager.findUnusedBriefcase(accessToken, iModelId, openMode, changeSet);
    if (briefcaseToken && openMode === OpenMode.Readonly && briefcaseToken.isOpen)
      return briefcaseToken;

    if (!briefcaseToken)
      briefcaseToken = await BriefcaseManager.createBriefcaseSeed(accessToken, iModelId);

    await BriefcaseManager.updateAndOpenBriefcase(accessToken, briefcaseToken, openMode, changeSet);
    return briefcaseToken;
  }

  @RunsIn(Tier.Services)
  public static async openStandalone(fileName: string, openMode: OpenMode): Promise<BriefcaseToken> {
    if (!BriefcaseManager.cache)
      BriefcaseManager.initialize();

    const db = new dgnDbNodeAddon.DgnDb();
    const res: BentleyReturn<DbResult, void> = await db.openDgnDb(fileName, openMode);
    if (res.error)
      throw new IModelError(res.error.status);

    const briefcaseToken = BriefcaseToken.fromFile(fileName, openMode, true /*isOpen*/);
    BriefcaseManager.cache!.setBriefcase(briefcaseToken, db);

    return briefcaseToken;
  }

  @RunsIn(Tier.Services)
  public static async close(accessToken: AccessToken, briefcaseToken: BriefcaseToken, keepBriefcase: KeepBriefcase): Promise<void> {
    if (briefcaseToken.openMode === OpenMode.Readonly)
      return;

    const db = BriefcaseManager.getBriefcaseFromCache(briefcaseToken);
    if (!db)
      return;
    db.closeDgnDb();
    briefcaseToken.isOpen = false;

    if (keepBriefcase === KeepBriefcase.No)
      await BriefcaseManager.deleteBriefcase(accessToken, briefcaseToken);
    else
      BriefcaseManager.cache!.setBriefcase(briefcaseToken, undefined);
  }

  @RunsIn(Tier.Services, { synchronous: true })
  public static closeStandalone(briefcaseToken: BriefcaseToken) {
    const db = BriefcaseManager.getBriefcaseFromCache(briefcaseToken);
    if (!db)
      return;
    db.closeDgnDb();
    briefcaseToken.isOpen = false;
    BriefcaseManager.cache!.setBriefcase(briefcaseToken, undefined);
  }

  /**
   * Get a JSON representation of an element.
   * @param opt A JSON string with options for loading the element
   * @returns Promise that resolves to an object with a result property set to the JSON string of the element.
   * The resolved object contains an error property if the operation failed.
   */
  @RunsIn(Tier.Services)
  public static async getElement(briefcaseToken: BriefcaseToken, opt: string): Promise<string> {
    const db = BriefcaseManager.getBriefcaseFromCache(briefcaseToken);
    if (!db)
      return Promise.reject(new IModelError(IModelStatus.NotOpen));

    const response: BentleyReturn<IModelStatus, string> = await db.getElement(opt);
    if (response.error)
      return Promise.reject(new IModelError(response.error.status));

    return response.result!;
  }

  @RunsIn(Tier.Services)
  public static async getElementPropertiesForDisplay(briefcaseToken: BriefcaseToken, elementId: string): Promise<string> {
    const db = BriefcaseManager.getBriefcaseFromCache(briefcaseToken);
    if (!db)
      return Promise.reject(new IModelError(IModelStatus.NotOpen));

    const response: BentleyReturn<DbResult, string> = await db.getElementPropertiesForDisplay(elementId);
    if (response.error)
      return Promise.reject(new IModelError(response.error.status));

    return response.result!;
  }

  /**
   * Insert a new element into the DgnDb.
   * @param props A JSON string with properties of new element
   * @returns Promise that resolves to an object with
   * The resolved object contains an error property if the operation failed.
   */
  @RunsIn(Tier.Services)
  public static async insertElement(briefcaseToken: BriefcaseToken, props: string): Promise<string> {
    const db = BriefcaseManager.getBriefcaseFromCache(briefcaseToken);
    if (!db)
      return Promise.reject(new IModelError(IModelStatus.NotOpen));

    // Note that inserting an element is always done synchronously. That is because of constraints
    // on the native code side. Nevertheless, we want the signature of this method to be
    // that of an asynchronous method, since it must run in the services tier and will be
    // asynchronous from a remote client's point of view in any case.
    const response: BentleyReturn<IModelStatus, string> = db.insertElementSync(props);
    if (response.error)
      return Promise.reject(new IModelError(response.error.status));

    return response.result!;
  }

  @RunsIn(Tier.Services)
  public static async updateElement(briefcaseToken: BriefcaseToken, props: string): Promise<void> {
    const db = BriefcaseManager.getBriefcaseFromCache(briefcaseToken);
    if (!db)
      return Promise.reject(new IModelError(IModelStatus.NotOpen));

    // Note that updating an element is always done synchronously. That is because of constraints
    // on the native code side. Nevertheless, we want the signature of this method to be
    // that of an asynchronous method, since it must run in the services tier and will be
    // asynchronous from a remote client's point of view in any case.
    const response: BentleyReturn<IModelStatus, string> = db.updateElementSync(props);
    if (response.error)
      return Promise.reject(new IModelError(response.error.status));
  }

  @RunsIn(Tier.Services)
  public static async deleteElement(briefcaseToken: BriefcaseToken, elemid: string): Promise<void> {
    const db = BriefcaseManager.getBriefcaseFromCache(briefcaseToken);
    if (!db)
      return Promise.reject(new IModelError(IModelStatus.NotOpen));

    // Note that deleting an element is always done synchronously. That is because of constraints
    // on the native code side. Nevertheless, we want the signature of this method to be
    // that of an asynchronous method, since it must run in the services tier and will be
    // asynchronous from a remote client's point of view in any case.
    const response: BentleyReturn<IModelStatus, string> = db.deleteElementSync(elemid);
    if (response.error)
      return Promise.reject(new IModelError(response.error.status));
  }

  /**
   * Get a JSON representation of a Model.
   * @param opt A JSON string with options for loading the model
   * @returns Promise that resolves to an object with a result property set to the JSON string of the model.
   * The resolved object contains an error property if the operation failed.
   */
  @RunsIn(Tier.Services)
  public static async getModel(briefcaseToken: BriefcaseToken, opt: string): Promise<string> {
    const db = BriefcaseManager.getBriefcaseFromCache(briefcaseToken);
    if (!db)
      return Promise.reject(new IModelError(IModelStatus.NotOpen));

    const response: BentleyReturn<DbResult, string> = await db.getModel(opt);
    if (response.error)
      return Promise.reject(new IModelError(response.error.status));

    return response.result!;
  }

  /**
   * Execute an ECSql select statement
   * @param ecsql The ECSql select statement to prepare
   * @returns Promise that resolves to an object with a result property set to a JSON array containing the rows returned from the query
   * The resolved object contains an error property if the operation failed.
   */
  @RunsIn(Tier.Services)
  public static async executeQuery(briefcaseToken: BriefcaseToken, ecsql: string): Promise<string> {
    const db = BriefcaseManager.getBriefcaseFromCache(briefcaseToken);
    if (!db)
      return Promise.reject(new IModelError(IModelStatus.NotOpen));

    const response: BentleyReturn<DbResult, string> = await db.executeQuery(ecsql);
    if (response.error)
      return Promise.reject(new IModelError(response.error.status));

    return response.result!;
  }

  /**
   * Get the meta data for the specified ECClass from the schema in this DgnDbNativeCode.
   * @param ecschemaname  The name of the schema
   * @param ecclassname   The name of the class
   * @returns Promise that resolves to an object with a result property set to a the meta data in JSON format
   * The resolved object contains an error property if the operation failed.
   */
  @RunsIn(Tier.Services)
  public static async getECClassMetaData(briefcaseToken: BriefcaseToken, ecschemaname: string, ecclassname: string): Promise<string> {
    const db = BriefcaseManager.getBriefcaseFromCache(briefcaseToken);
    if (!db)
      return Promise.reject(new IModelError(IModelStatus.NotOpen));

    const response: BentleyReturn<IModelStatus, string> = await db.getECClassMetaData(ecschemaname, ecclassname);
    if (response.error)
      return Promise.reject(new IModelError(response.error.status));

    return response.result!;
  }

  /**
   * Get the meta data for the specified ECClass from the schema in this iModel, blocking until the result is returned.
   * @param ecschemaname  The name of the schema
   * @param ecclassname   The name of the class
   * @returns On success, the BentleyReturn result property will be the class meta data in JSON format.
   */
  @RunsIn(Tier.Services, { synchronous: true })
  public static getECClassMetaDataSync(briefcaseToken: BriefcaseToken, ecschemaname: string, ecclassname: string): string {
    const db = BriefcaseManager.getBriefcaseFromCache(briefcaseToken);
    if (!db)
      throw new IModelError(IModelStatus.NotOpen);

    const response: BentleyReturn<IModelStatus, string> = db.getECClassMetaDataSync(ecschemaname, ecclassname);
    if (response.error)
      throw new IModelError(response.error.status);

    return response.result!;
  }
}

