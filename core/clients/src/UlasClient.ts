/*---------------------------------------------------------------------------------------------
|  $Copyright: (c) 2018 Bentley Systems, Incorporated. All rights reserved. $
 *--------------------------------------------------------------------------------------------*/
import { Client, DeploymentEnv, UrlDescriptor } from "./Client";
import { ImsDelegationSecureTokenClient } from "./ImsClients";
import { AccessToken, AuthorizationToken } from "./Token";
import { request, RequestOptions, Response } from "./Request";
import { Logger, BentleyStatus, Guid, GuidProps, LogLevel, ActivityLoggingContext } from "@bentley/bentleyjs-core";
import { UserProfile } from "./UserProfile";

const loggingCategory: string = "imodeljs-clients.Ulas";

/**
 * Represents one of the potential sources of usage log entries.
 * See [FeatureLogEntry]$(imodeljs-clients)
 */
export enum LogPostingSource {
  RealTime, Offline, Checkout,
}
/**
 * Represents one of the potential usage types.
 * See [FeatureLogEntry]$(imodeljs-clients)
 */
export enum UsageType {
  Production, Trial, Beta, HomeUse, PreActivation,
}

/**
 * Represents arbitrary metadata that can be attached to a
 * [FeatureLogEntry]$(imodeljs-clients) when collecting
 * information about feature usage.
 */
export interface FeatureLogEntryAttribute {
  name: string;
  value: any;
}

export interface ProductVersion {
  major: number;
  minor: number;
  sub1?: number;
  sub2?: number;
}

/**
 * Usage log entry data that is submitted to the ULAS Posting Service.
 * See [UlasClient]$(imodeljs-clients)
 */
export class UsageLogEntry {
  /* The product ID for which usage is being submitted. It is a 4-digit Product ID from the GPR */
  public readonly productId: number;

  /* Product version */
  public productVersion: ProductVersion;

  /* The client's machine name */
  public hostName: string;
  /* The user's login name. */
  public hostUserName: string;

  /* Identifies the source of the usage log entry. */
  public logPostingSource: LogPostingSource;
  /* The type of usage that occurred on the client. It is acting as a filter to eliminate records from log processing that
  should not count towards a customer’s peak processing. */
  public usageType: UsageType;

  /* The GUID of the project that the usage should be associated with.  */
  public projectId?: GuidProps;

  public readonly timestamp: string;

  public constructor(productId: number) {
    this.productId = productId;
    this.timestamp = new Date().toISOString();
  }
}
/**
 * Feature log entry data that is submitted to the ULAS Posting Service.
 * See [UlasClient]$(imodeljs-clients)
 */
export class FeatureLogEntry {
  /* ID of the feature to log usage for (from FeatureRegistry). */
  public readonly featureId: GuidProps;
  /* The product ID for which usage is being submitted. It is a 4-digit Product ID from the GPR */
  public readonly productId: number;

  /* Product version */
  public productVersion: ProductVersion;

  /* Additional user-defined metadata for the feature usage. */
  public usageData: FeatureLogEntryAttribute[];

  /* The client's machine name */
  public hostName: string;
  /* The user's login name. */
  public hostUserName: string;

  /* Identifies the source of the usage log entry. */
  public logPostingSource: LogPostingSource;
  /* The type of usage that occurred on the client. It is acting as a filter to eliminate records from log processing that
  should not count towards a customer’s peak processing. */
  public usageType: UsageType;

  /* The GUID of the project that the usage should be associated with.  */
  public projectId?: GuidProps;

  public readonly timestamp: string;

  public constructor(featureId: GuidProps, productId: number) {
    this.featureId = featureId;
    this.productId = productId;
    this.usageData = [];
    this.timestamp = new Date().toISOString();
  }
}

/**
 * Data to log the start of a Feature usage with the ULAS Posting Service.
 * Use [FeatureEndedLogEntry]($imodeljs-clients) to log the end of the feature usage.
 * See [UlasClient]$(imodeljs-clients)
 */
export class FeatureStartedLogEntry extends FeatureLogEntry {
  public readonly entryId: Guid;

  public constructor(featureId: GuidProps, productId: number) {
    super(featureId, productId);
    this.entryId = new Guid(true);
  }
}

/**
 * Data to log the end of a Feature usage with the ULAS Posting Service.
 * Must have logged a [FeatureStartedLogEntry]($imodeljs-clients) before.
 * See [UlasClient]$(imodeljs-clients)
 */
export class FeatureEndedLogEntry extends FeatureLogEntry {
  /* Id of the corresponding [FeatureStartedLogEntry]($imodeljs-clients).
   * See [FeatureStartedLogEntry.entryId]($imodeljs-clients)
   */
  public readonly startEntryId: Guid;

  public constructor(featureId: GuidProps, productId: number, startEntryId: Guid) {
    super(featureId, productId);
    this.startEntryId = startEntryId;
  }
}

/**
 * Response from posting a Feature Log entry with
 * [UlasClient]$(imodeljs-clients)
 */
export interface LogPostingResponse {
  /* The overall status of the request. */
  status: BentleyStatus;
  /* The message localized in client's language. */
  message: string;
  /* The time in milliseconds it took to complete the request submitted by the client. */
  time: number;
  /* The unique ID of the request assigned by the server when handling the client's request. */
  requestId: GuidProps;
}

/**
 * Client for the Bentley Usage Logging & Analysis Services.
 */
export class UlasClient extends Client {
  public static readonly searchKey: string = "UsageLoggingServices.RealtimeLogging.Url";
  private static readonly _defaultUrlDescriptor: UrlDescriptor = {
    DEV: "https://dev-connect-ulastm.bentley.com/Bentley.ULAS.PostingService/PostingSvcWebApi",
    QA: "https://qa-connect-ulastm.bentley.com/Bentley.ULAS.PostingService/PostingSvcWebApi",
    PROD: "https://connect-ulastm.bentley.com/Bentley.ULAS.PostingService/PostingSvcWebApi",
    // WIP: Is this the right URL?
    PERF: "https://qa-connect-ulastm.bentley.com/Bentley.ULAS.PostingService/PostingSvcWebApi",
  };

  // Workaround until these values can be read from Policy API
  private readonly _policyIds: ImsPolicyIds = new ImsPolicyIds();

  /**
   * Creates an instance of UlasClient.
   * @param deploymentEnv Deployment environment
   */
  constructor(public deploymentEnv: DeploymentEnv) { super(deploymentEnv); }

  /**
   * WIP: iModelBank might not be able to access the BUDDI service. How to solve that?
   *
   * Gets name/key to query the service URLs from the URL Discovery Service ("Buddi")
   * @returns Search key for the URL.
   */
  protected getUrlSearchKey(): string { return UlasClient.searchKey; }

  /**
   * @returns Default URL for the service.
   */
  protected getDefaultUrl(): string { return UlasClient._defaultUrlDescriptor[this.deploymentEnv]; }

  /**
   * Gets the (delegation) access token to access the service
   * @param authorizationToken Authorization token.
   * @returns Resolves to the (delegation) access token.
   */
  public async getAccessToken(alctx: ActivityLoggingContext, authorizationToken: AuthorizationToken): Promise<AccessToken> {
    alctx.enter();
    const imsClient = new ImsDelegationSecureTokenClient(this.deploymentEnv);
    const token: AccessToken = await imsClient.getToken(alctx, authorizationToken);
    alctx.enter();
    return token;
  }

  /**
   * Logs a usage entry via the ULAS service
   * @param token Access token.
   * @param entry Usage log entry.
   * @returns Response from the service.
   */
  public async logUsage(alctx: ActivityLoggingContext, token: AccessToken, entry: UsageLogEntry): Promise<LogPostingResponse> {
    alctx.enter();
    const entryJson: any = UlasLogEntryLogConverter.toUsageLogJson(token, entry, this._policyIds);
    const resp: LogPostingResponse = await this.logEntry(alctx, token, entryJson, false);
    alctx.enter();
    return resp;
  }

  /**
   * Logs one ore more feature entries via the ULAS service
   * @param token Access token.
   * @param entries One or more feature log entries.
   * @returns Response from the service.
   */
  public async logFeature(alctx: ActivityLoggingContext, token: AccessToken, ...entries: FeatureLogEntry[]): Promise<LogPostingResponse> {
    alctx.enter();
    if (entries.length === 0)
      throw new Error("At least one FeatureLogEntry must be passed to UlasClient.logFeatures.");

    const entriesJson: any = UlasLogEntryLogConverter.toFeatureLogJson(token, entries, this._policyIds);
    const resp: LogPostingResponse = await this.logEntry(alctx, token, entriesJson, true);
    alctx.enter();
    return resp;
  }

  private async logEntry(alctx: ActivityLoggingContext, token: AccessToken, entryJson: any, isFeatureEntry: boolean): Promise<LogPostingResponse> {
    alctx.enter();
    let postUrl: string = (await this.getUrl(alctx));
    alctx.enter();
    if (isFeatureEntry)
      postUrl += "/featureLog";

    const options: RequestOptions = {
      method: "POST",
      headers: { authorization: "SAML " + Base64.btoa(token.getSamlAssertion()!) },
      body: entryJson,
    };

    await this.setupOptionDefaults(options);
    alctx.enter();
    if (Logger.isEnabled(loggingCategory, LogLevel.Trace))
      Logger.logTrace(loggingCategory, `Sending ${isFeatureEntry ? "Feature" : "Usage"} Log REST request...`, () => ({ url: postUrl, body: entryJson }));

    const resp: Response = await request(alctx, postUrl, options);
    alctx.enter();
    const requestDetails = { url: postUrl, body: entryJson, response: resp };
    if (Logger.isEnabled(loggingCategory, LogLevel.Trace))
      Logger.logTrace(loggingCategory, `Sent ${isFeatureEntry ? "Feature" : "Usage"} Log REST request.`, () => requestDetails);

    const respBody: any = resp.body;
    if (!respBody || !respBody.status || !respBody.reqID)
      throw new Error(`Post ${isFeatureEntry ? "Feature" : "Usage"} Log REST request failed: No response body available. Details: ${JSON.stringify(requestDetails)}`);

    const status: BentleyStatus = respBody.status.toLowerCase() === "success" ? BentleyStatus.SUCCESS : BentleyStatus.ERROR;
    const message: string = !!respBody.msg ? respBody.msg : "";
    const time: number = !!respBody.time ? respBody.time : -1;
    const requestId = new Guid(respBody.reqID);
    if (status !== BentleyStatus.SUCCESS)
      throw new Error(`Post ${isFeatureEntry ? "Feature" : "Usage"} Log REST request failed: ${message}. Details: ${JSON.stringify(requestDetails)}`);

    return { status, message, time, requestId };
  }
}

class UlasLogEntryLogConverter {
  public static toUsageLogJson(token: AccessToken, entry: UsageLogEntry, policyIds: ImsPolicyIds): any {
    if (!token.getUserProfile())
      throw new Error("AccessToken is expected to include user information");

    const prdid: number = entry.productId;
    // empty for now
    const fstr: string = "";

    const userProfile: UserProfile = token.getUserProfile()!;
    const ultId: number = parseInt(userProfile.ultimateId, 10);
    const imsID: string = userProfile.userId;
    // WIP: must be replaced by pulling from policy file. For now we use imsID.
    const pid: string = imsID;

    const hID: string = UlasLogEntryLogConverter.prepareMachineName(entry.hostName);
    const uID: string = UlasLogEntryLogConverter.prepareUserName(entry.hostUserName, entry.hostName);

    const polID: string = UlasLogEntryLogConverter.guidToString(policyIds.policyFileId);
    const secID: string = UlasLogEntryLogConverter.guidToString(policyIds.securableId);

    const ver: number = UlasLogEntryLogConverter.toVersionNumber(entry.productVersion);

    let projID: string | undefined;
    if (!!entry.projectId)
      projID = UlasLogEntryLogConverter.guidToString(entry.projectId);

    const evTimeZ: string = entry.timestamp;

    const corID: string = UlasLogEntryLogConverter.guidToString(policyIds.correlationId);

    // for now this is always 1
    const lVer: number = 1;

    const lSrc: string = UlasLogEntryLogConverter.logPostingSourceToString(entry.logPostingSource);
    const country: string = userProfile.usageCountryIso;

    const uType: string = UlasLogEntryLogConverter.usageTypeToString(entry.usageType);
    return {
      ultId, pid, imsID, hID, uID, polID, secID, prdid, fstr, ver, projID, corID,
      evTimeZ, lVer, lSrc, country, uType,
    };
  }

  public static toFeatureLogJson(token: AccessToken, entries: FeatureLogEntry[], policyIds: ImsPolicyIds): any {
    if (!token.getUserProfile())
      throw new Error("AccessToken is expected to include user information");

    const json = [];
    for (const entry of entries) {
      const ftrID: string = UlasLogEntryLogConverter.guidToString(entry.featureId);
      const prdid: number = entry.productId;
      // empty for now
      const fstr: string = "";

      const userProfile: UserProfile = token.getUserProfile()!;
      const ultId: number = parseInt(userProfile.ultimateId, 10);
      const imsID: string = userProfile.userId;
      // WIP: must be replaced by pulling from policy file. For now we use imsID.
      const pid: string = imsID;

      const hID: string = UlasLogEntryLogConverter.prepareMachineName(entry.hostName);
      const uID: string = UlasLogEntryLogConverter.prepareUserName(entry.hostUserName, entry.hostName);

      const polID: string = UlasLogEntryLogConverter.guidToString(policyIds.policyFileId);
      const secID: string = UlasLogEntryLogConverter.guidToString(policyIds.securableId);

      const ver: number = UlasLogEntryLogConverter.toVersionNumber(entry.productVersion);

      let projID: string | undefined;
      if (!!entry.projectId)
        projID = UlasLogEntryLogConverter.guidToString(entry.projectId);

      const evTimeZ: string = entry.timestamp;

      let sDateZ: string;
      let eDateZ: string;
      let corID: string;
      const startEntry: FeatureStartedLogEntry = entry as FeatureStartedLogEntry;
      const endEntry: FeatureEndedLogEntry = entry as FeatureEndedLogEntry;
      const defaultDate: string = "0001-01-01T00:00:00Z";
      if (!!startEntry.entryId) {
        sDateZ = evTimeZ;
        eDateZ = defaultDate;
        corID = UlasLogEntryLogConverter.guidToString(startEntry.entryId);
      } else if (!!endEntry.startEntryId) {
        sDateZ = defaultDate;
        eDateZ = evTimeZ;
        corID = UlasLogEntryLogConverter.guidToString(endEntry.startEntryId);
      } else {
        sDateZ = evTimeZ;
        eDateZ = evTimeZ;
        corID = UlasLogEntryLogConverter.guidToString(policyIds.correlationId);
      }

      // for now this is always 1
      const lVer: number = 1;

      const lSrc: string = UlasLogEntryLogConverter.logPostingSourceToString(entry.logPostingSource);
      const country: string = userProfile.usageCountryIso;

      const uType: string = UlasLogEntryLogConverter.usageTypeToString(entry.usageType);

      const uData = [];
      for (const att of entry.usageData) {
        uData.push({ name: att.name, value: att.value.toString() });
      }

      json.push({
        ultId, pid, imsID, hID, uID, polID, secID, prdid, fstr, ver, projID, corID,
        evTimeZ, lVer, lSrc, country, uType, ftrID, sDateZ, eDateZ, uData,
      });
    }
    return json;
  }

  private static toVersionNumber(version: ProductVersion): number {
    // version must be encoded into a single number where each version digit is padded out to 4 digits
    // and the version is always considered to have 4 digits.
    // Ex: 3.99.4 -> 3.99.4.0 -> 3009900040000
    let verNumber: number = !!version.sub2 ? version.sub2 : 0;
    verNumber += 10000 * (!!version.sub1 ? version.sub1 : 0);
    verNumber += Math.pow(10000, 2) * version.minor;
    verNumber += Math.pow(10000, 3) * version.major;
    return verNumber;
  }

  private static guidToString(guid: GuidProps): string {
    if (typeof (guid) === "string")
      return guid;

    return guid.toString();
  }

  private static prepareMachineName(machineName: string): string {
    if (!machineName || machineName.length === 0)
      return "";

    if (machineName === "::1" || machineName === "127.0.0.1")
      return "localhost";

    return machineName.toLowerCase();
  }

  private static prepareUserName(userName: string, machineName: string): string {
    if (!userName || userName.length === 0)
      return "";

    let preparedUserName: string = userName;

    const backslashPos: number = userName.indexOf("\\");
    if (backslashPos >= 0)
      preparedUserName = userName.substr(backslashPos + 1);
    else {
      const slashPos: number = userName.indexOf("/");
      if (slashPos >= 0)
        preparedUserName = userName.substr(slashPos + 1);
    }

    preparedUserName = preparedUserName.toLowerCase();
    if (!!machineName && machineName.length > 0 && (preparedUserName.includes("administrator") || preparedUserName.includes("system")))
      preparedUserName = `${machineName.toLowerCase()}\\${preparedUserName}`;

    return preparedUserName;
  }

  private static logPostingSourceToString(val: LogPostingSource): string {
    switch (val) {
      case LogPostingSource.Checkout:
        return "Checkout";
      case LogPostingSource.Offline:
        return "Offline";
      case LogPostingSource.RealTime:
        return "RealTime";
      default:
        throw new Error("Unhandled LogPostingSource enum value");
    }
  }

  private static usageTypeToString(val: UsageType): string {
    switch (val) {
      case UsageType.Beta:
        return "Beta";
      case UsageType.HomeUse:
        return "HomeUse";
      case UsageType.PreActivation:
        return "PreActivation";
      case UsageType.Production:
        return "Production";
      case UsageType.Trial:
        return "Trial";
      default:
        throw new Error("Unhandled UsageType enum value");
    }
  }
}

// Workaround until these values can be read from Policy API
class ImsPolicyIds {
  public readonly policyFileId: Guid;
  public readonly securableId: Guid;
  public readonly correlationId: Guid;

  public constructor() {
    this.policyFileId = new Guid(true);
    this.securableId = new Guid(true);
    this.correlationId = new Guid(true);
  }
}
