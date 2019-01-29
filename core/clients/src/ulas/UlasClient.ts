/*---------------------------------------------------------------------------------------------
* Copyright (c) 2018 Bentley Systems, Incorporated. All rights reserved.
* Licensed under the MIT License. See LICENSE.md in the project root for license terms.
*--------------------------------------------------------------------------------------------*/
import { Logger, BentleyStatus, Guid, GuidString, LogLevel, ActivityLoggingContext } from "@bentley/bentleyjs-core";
import { AccessToken, IncludePrefix, AuthorizationToken } from "../Token";
import { request, Response, RequestOptions } from "../Request";
import { Client } from "../Client";
import { Config } from "../Config";
import { ImsDelegationSecureTokenClient } from "../ImsClients";
import { LogEntryConverter, UsageLogEntryJson, FeatureLogEntryJson } from "./LogEntryConverter";

/**
 * Usage Logging and Analysis Services Client.
 */

/**
 * Logging category for the UlasClient.
 */
const loggingCategory: string = "ulasclient";

/**
 * Represents one of the potential usage types.
 * See also
 *  - [[UsageLogEntry]], [[FeatureLogEntry]]
 *  - *UsageType* entry on [ULAS Swagger](https://qa-connect-ulastm.bentley.com/Bentley.ULAS.SwaggerUI/SwaggerWebApp/?urls.primaryName=ULAS%20Posting%20Service%20v1)
 *  site (section *Models*)
 */
export enum UsageType {
  Production, Trial, Beta, HomeUse, PreActivation,
}

/**
 * Represents the version of the product logging usage or features.
 * See also [[UsageLogEntry]], [[FeatureLogEntry]].
 */
export interface ProductVersion {
  major: number;
  minor: number;
  sub1?: number;
  sub2?: number;
}

/**
 * Information about the user for who usage is tracked with the ULAS Posting Service.
 * See [[UsageLogEntry]] and [[FeatureLogEntry]] for how to use it.
 * > You do not have to pass this to [[UlasClient]], if you have an OIDC access token from
 * > a client registration that includes the ULAS scope in its audiences.
 */
export interface UsageUserInfo {
  /** IMS User ID */
  imsId: GuidString;
  /** Ultimate ID, i.e. company ID in SAP */
  ultimateSite: number;
  /** Identifies the country where the client reporting the usage belongs to. */
  usageCountryIso: string;
  /* The user's login name.
  * > If omitted, the IMS user id will be used.
  */
  hostUserName?: string;
}

/**
 * Usage log entry data that is submitted to the ULAS Posting Service.
 * See also
 *  - [[UlasClient]]
 *  - *UsageLogEntry* entry on [ULAS Swagger](https://qa-connect-ulastm.bentley.com/Bentley.ULAS.SwaggerUI/SwaggerWebApp/?urls.primaryName=ULAS%20Posting%20Service%20v1)
 *  site (section *Models*)
 */
export class UsageLogEntry {
  /** The GUID of the project that the usage should be associated with. */
  public projectId?: GuidString;

  /** Information about the user for which usage is logged.
   * > This can be omitted if the OIDC access token includes the information already.
   * > This means the OIDC client registration must include the ULAS scope in its audiences.
   */
  public userInfo?: UsageUserInfo;

  /** Name of the client machine from which usage is logged */
  public readonly hostName: string;

  /** The product ID from the Global Product Registry (GPR) for which usage is being submitted. It is a 4-digit number.
   * > It can be omitted if the access token is an OIDC token which includes the client_id. In that case, ULAS will
   * > determine the GPR product ID from the client_id.
   */
  public productId?: number;

  /** Version of the product for which usage is logged. */
  public productVersion?: ProductVersion;

  /** The type of usage that occurred on the client. It is acting as a filter to eliminate records from log processing that
   * should not count towards a customer’s peak processing.
   */
  public readonly usageType: UsageType;

  /** Timestamp against which the usage is logged.
   * It is set at construction time of this object.
   */
  public readonly timestamp: string;

  /** Creates a new UsageLogEntry object.
   *  This also sets the timestamp against which the usage will be logged.
   *  @param hostName Name of the client machine from which usage is logged.
   *  @param usageType Usage type (see [[UsageType]])
   */
  public constructor(hostName: string, usageType: UsageType) {
    this.hostName = hostName;
    this.usageType = usageType;
    this.timestamp = new Date().toISOString();
  }
}

/**
 * Represents arbitrary metadata that can be attached to a
 * [[FeatureLogEntry]] when collecting information about feature usage.
 */
export interface FeatureLogEntryAttribute {
  name: string;
  value: any;
}

/**
 * Feature log entry data that is submitted to the ULAS Posting Service.
 * See also
 *  - [[UlasClient]]
 *  - *FeatureLogEntry* entry on [ULAS Swagger](https://qa-connect-ulastm.bentley.com/Bentley.ULAS.SwaggerUI/SwaggerWebApp/?urls.primaryName=ULAS%20Posting%20Service%20v1)
 *  site (section *Models*)
 */
export class FeatureLogEntry {
  /** The GUID of the project that the usage should be associated with. */
  public projectId?: GuidString;

  /** ID of the feature to log (from the Global Feature Registry). */
  public readonly featureId: GuidString;

  /** Additional user-defined metadata for the feature usage. */
  public usageData: FeatureLogEntryAttribute[];

  /** Information about the user for which usage is logged.
   * > This can be omitted if the OIDC access token includes the information already.
   * > This means the OIDC client registration must include the ULAS scope in its audiences.
   */
  public userInfo?: UsageUserInfo;

  /** Name of the client machine from which usage is logged. */
  public readonly hostName: string;

  /** Version of the product for which the feature is logged. */
  public productVersion?: ProductVersion;

  /** The product ID from the Global Product Registry (GPR) for which usage is being submitted. It is a 4-digit number.
   * > It can be omitted if the access token is an OIDC token which includes the client_id. In that case, ULAS will
   * > determine the GPR product ID from the client_id.
   */
  public productId?: number;

  /** The type of usage that occurred on the client. It is acting as a filter to eliminate records from log processing that
   * should not count towards a customer’s peak processing.
   */
  public readonly usageType: UsageType;

  /** Timestamp against which the feature is logged.
   * It is set at construction time of this object.
   */
  public readonly timestamp: string;

  /** Creates a new FeatureLogEntry object.
   *  This also sets the timestamp against which the feature will be logged.
   *  @param featureId Feature ID from the Global Feature Registry which is being logged.
   *  @param hostName Name of the client machine from which the feature is being logged.
   *  @param usageType Usage type (see [[UsageType]])
   */
  public constructor(featureId: GuidString, hostName: string, usageType: UsageType) {
    this.featureId = featureId;
    this.hostName = hostName;
    this.usageType = usageType;
    this.usageData = [];
    this.timestamp = new Date().toISOString();
  }
}

/**
 * Start point of a duration Feature log entry that is submitted to the ULAS Posting Service.
 * See also
 *  - [[UlasClient]]
 *  - [[FeatureLogEntry]]
 *  - *FeatureLogEntry* entry on [ULAS Swagger](https://qa-connect-ulastm.bentley.com/Bentley.ULAS.SwaggerUI/SwaggerWebApp/?urls.primaryName=ULAS%20Posting%20Service%20v1)
 *  site (section *Models*)
 */
export class FeatureStartedLogEntry extends FeatureLogEntry {
  /** ID of this entry which must be passed to the respective [[FeatureEndedLogEntry]] to
   * correlate start and end entry.
   */
  public readonly entryId: GuidString;

  /** Creates a new FeatureStartedLogEntry object.
   *  @param featureId Feature ID from the Global Feature Registry which is being logged.
   *  @param hostName Name of the client machine from which the feature is being logged.
   *  @param usageType Usage type (see [[UsageType]])
   */
  public constructor(featureId: GuidString, hostName: string, usageType: UsageType) {
    super(featureId, hostName, usageType);
    this.entryId = Guid.createValue();
  }
}

/**
 * End point of a duration Feature log entry that is submitted to the ULAS Posting Service.
 * See also
 *  - [[UlasClient]]
 *  - [[FeatureStartedLogEntry]]
 *  - *FeatureLogEntry* entry on [ULAS Swagger](https://qa-connect-ulastm.bentley.com/Bentley.ULAS.SwaggerUI/SwaggerWebApp/?urls.primaryName=ULAS%20Posting%20Service%20v1)
 *  site (section *Models*)
 */
export class FeatureEndedLogEntry extends FeatureLogEntry {
  /* ID of the corresponding [[FeatureStartedLogEntry]].
   * See [[FeatureStartedLogEntry.entryId]]
   */
  public readonly startEntryId: GuidString;

  /** Creates a new FeatureEndedLogEntry object.
   *  @param featureId Feature ID from the Global Feature Registry which is being logged.
   *  @param startEntryId ID of the corresponding [[FeatureStartedLogEntry]]
   *  @param hostName Name of the client machine from which the feature is being logged.
   *  @param usageType Usage type (see [[UsageType]])
   */
  public constructor(featureId: GuidString, startEntryId: GuidString, hostName: string, usageType: UsageType) {
    super(featureId, hostName, usageType);
    this.startEntryId = startEntryId;
  }

  /** Creates a new FeatureEndedLogEntry from the specified FeatureStartedLogEntry.
   *  @param startEntry Corresponding [[FeatureStartedLogEntry]]
   *  @return Corresponding FeatureEndedLogEntry.
   */
  public static fromStartEntry(startEntry: FeatureStartedLogEntry): FeatureEndedLogEntry {
    const endEntry = new FeatureEndedLogEntry(startEntry.featureId, startEntry.entryId,
      startEntry.hostName, startEntry.usageType);

    endEntry.projectId = startEntry.projectId;
    endEntry.usageData = startEntry.usageData;
    endEntry.productId = startEntry.productId;
    endEntry.productVersion = startEntry.productVersion;
    endEntry.userInfo = startEntry.userInfo;

    return endEntry;
  }
}

/**
 * Response from posting a [[UsageLogEntry]] or [[FeatureLogEntry]] with the [[UlasClient]].
 * See also *LogPostingResponse* entry on [ULAS Swagger](https://qa-connect-ulastm.bentley.com/Bentley.ULAS.SwaggerUI/SwaggerWebApp/?urls.primaryName=ULAS%20Posting%20Service%20v1)
 * site (section *Models*)
 */
export interface LogPostingResponse {
  /* The overall status of the request. */
  status: BentleyStatus;
  /* The message localized in client's language. */
  message: string;
  /* The time in milliseconds it took to complete the request submitted by the client. */
  time: number;
  /* The unique ID of the request assigned by the server when handling the client's request. */
  requestId: GuidString;
}

/**
 * Client for the Bentley Usage Logging & Analysis Services (ULAS).
 * See also the two `POST` requests on [ULAS Swagger](https://qa-connect-ulastm.bentley.com/Bentley.ULAS.SwaggerUI/SwaggerWebApp/?urls.primaryName=ULAS%20Posting%20Service%20v1)
 */
export class UlasClient extends Client {
  private static readonly _buddiSearchKey: string = "UsageLoggingServices.RealtimeLogging.Url";
  private static readonly _configRelyingPartyUri = "imjs_ulas_relying_party_uri";
  private static readonly _configDefaultRelyingPartyUri = "imjs_default_relying_party_uri";

  /**
   * Creates an instance of UlasClient.
   */
  constructor() { super(); }

  /**
   * Gets name/key to query the service URLs from the URL Discovery Service ("Buddi")
   * @returns Search key for the URL.
   */
  protected getUrlSearchKey(): string { return UlasClient._buddiSearchKey; }

  protected async setupOptionDefaults(options: RequestOptions): Promise<void> {
    await super.setupOptionDefaults(options);
    options.useCorsProxy = true;
  }

  /**
   * Gets theRelyingPartyUrl for the service.
   * @returns RelyingPartyUrl for the service.
   */
  private getRelyingPartyUrl(): string {
    if (Config.App.has(UlasClient._configRelyingPartyUri))
      return Config.App.get(UlasClient._configRelyingPartyUri) + "/";
    else
      return Config.App.get(UlasClient._configDefaultRelyingPartyUri) + "/";
  }

  /**
   * Gets the (delegation) access token to access the service
   * @param authTokenInfo Access token.
   * @returns Resolves to the (delegation) access token.
   */
  public async getAccessToken(alctx: ActivityLoggingContext, authorizationToken: AuthorizationToken): Promise<AccessToken> {
    const imsClient = new ImsDelegationSecureTokenClient();
    return imsClient.getToken(alctx, authorizationToken, this.getRelyingPartyUrl());
  }

  /**
   * Logs usage via the ULAS service
   * @param alctx Activity logging context.
   * @param token Access token.
   * @param entry Usage log entry.
   * @returns Response from the service.
   */
  public async logUsage(alctx: ActivityLoggingContext, token: AccessToken, entry: UsageLogEntry): Promise<LogPostingResponse> {
    alctx.enter();
    const entryJson: UsageLogEntryJson = LogEntryConverter.toUsageLogJson(entry);
    return this.logEntry(alctx, token, entryJson, false);
  }

  /**
   * Logs one ore more feature entries via the ULAS service
   * @param alctx Activity logging context.
   * @param token Access token.
   * @param entries One or more feature log entries.
   * @returns Response from the service.
   */
  public async logFeature(alctx: ActivityLoggingContext, token: AccessToken, ...entries: FeatureLogEntry[]): Promise<LogPostingResponse> {
    alctx.enter();
    if (entries.length === 0)
      throw new Error("At least one FeatureLogEntry must be passed to UlasClient.logFeatures.");

    const entriesJson: FeatureLogEntryJson[] = LogEntryConverter.toFeatureLogJson(entries);
    return this.logEntry(alctx, token, entriesJson, true);
  }

  private async logEntry(alctx: ActivityLoggingContext, token: AccessToken, entryJson: UsageLogEntryJson | FeatureLogEntryJson[], isFeatureEntry: boolean): Promise<LogPostingResponse> {
    alctx.enter();
    let postUrl: string = (await this.getUrl(alctx));
    alctx.enter();
    if (isFeatureEntry)
      postUrl += "/featureLog";

    const authString: string = !token.getSamlAssertion() ? token.toTokenString() : "SAML " + token.toTokenString(IncludePrefix.No);
    const options: RequestOptions = {
      method: "POST",
      headers: { authorization: authString },
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
    if (!respBody || !respBody.status || respBody.status.toLowerCase() !== "success")
      throw new Error(`Post ${isFeatureEntry ? "Feature" : "Usage"} Log REST request failed ${!!respBody.msg ? ": " + respBody.msg : ""}. Details: ${JSON.stringify(requestDetails)}`);

    return { status: BentleyStatus.SUCCESS, message: !!respBody.msg ? respBody.msg : "", time: !!respBody.time ? respBody.time : -1, requestId: respBody.reqID };
  }
}
