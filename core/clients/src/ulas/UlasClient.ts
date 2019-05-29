/*---------------------------------------------------------------------------------------------
* Copyright (c) 2019 Bentley Systems, Incorporated. All rights reserved.
* Licensed under the MIT License. See LICENSE.md in the project root for license terms.
*--------------------------------------------------------------------------------------------*/
import { BentleyStatus, ClientRequestContext, Guid, GuidString, Logger, LogLevel } from "@bentley/bentleyjs-core";
import { AuthorizedClientRequestContext } from "../AuthorizedClientRequestContext";
import { Client } from "../Client";
import { Config } from "../Config";
import { ImsDelegationSecureTokenClient } from "../ImsClients";
import { ClientsLoggerCategory } from "../ClientsLoggerCategory";
import { request, RequestOptions, Response } from "../Request";
import { AccessToken, AuthorizationToken, IncludePrefix } from "../Token";
import { FeatureLogEntryJson, LogEntryConverter, UsageLogEntryJson } from "./LogEntryConverter";

const loggerCategory: string = ClientsLoggerCategory.UlasClient;

/** Represents one of the potential usage types.
 * See also
 *  - [[UsageLogEntry]], [[FeatureLogEntry]]
 *  - *UsageType* entry on [ULAS Swagger](https://qa-connect-ulastm.bentley.com/Bentley.ULAS.SwaggerUI/SwaggerWebApp/?urls.primaryName=ULAS%20Posting%20Service%20v1)
 *  site (section *Models*)
 * @internal
 */
export enum UsageType {
  Production, Trial, Beta, HomeUse, PreActivation,
}

/** Represents the version of the product logging usage or features.
 * See also [[UsageLogEntry]], [[FeatureLogEntry]].
 * @internal
 */
export interface ProductVersion {
  major: number;
  minor: number;
  sub1?: number;
  sub2?: number;
}

/**
 * Usage log entry data that is submitted to the ULAS Posting Service.
 * See also
 *  - [[UlasClient]]
 *  - *UsageLogEntry* entry on [ULAS Swagger](https://qa-connect-ulastm.bentley.com/Bentley.ULAS.SwaggerUI/SwaggerWebApp/?urls.primaryName=ULAS%20Posting%20Service%20v1)
 *  site (section *Models*)
 * @internal
 */
export class UsageLogEntry {
  /** The GUID of the context that the usage should be associated with. */
  public contextId?: GuidString;

  /** Name of the client machine from which usage is logged */
  public readonly hostName: string;

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
   *  @param contextId The GUID of the context that the usage should be associated with.
   */
  public constructor(hostName: string, usageType: UsageType, contextId?: GuidString) {
    this.hostName = hostName;
    this.usageType = usageType;
    this.contextId = contextId;
    this.timestamp = new Date().toISOString();
  }
}

/**
 * Represents arbitrary metadata that can be attached to a
 * [[FeatureLogEntry]] when collecting information about feature usage.
 * @internal
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
 * @internal
 */
export class FeatureLogEntry {
  /** The GUID of the context that the usage should be associated with. */
  public contextId?: GuidString;

  /** ID of the feature to log (from the Global Feature Registry). */
  public readonly featureId: GuidString;

  /** Additional user-defined metadata for the feature usage. */
  public usageData: FeatureLogEntryAttribute[];

  /** Name of the client machine from which usage is logged. */
  public readonly hostName: string;

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
   *  @param contextId The GUID of the context that the usage should be associated with.
   */
  public constructor(featureId: GuidString, hostName: string, usageType: UsageType, contextId?: GuidString) {
    this.featureId = featureId;
    this.hostName = hostName;
    this.usageType = usageType;
    this.contextId = contextId;
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
 * @internal
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
   *  @param contextId The GUID of the context that the usage should be associated with.
   */
  public constructor(featureId: GuidString, hostName: string, usageType: UsageType, contextId?: GuidString) {
    super(featureId, hostName, usageType, contextId);
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
 * @internal
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
   *  @param contextId The GUID of the context that the usage should be associated with.
   */
  public constructor(featureId: GuidString, startEntryId: GuidString, hostName: string, usageType: UsageType, contextId?: GuidString) {
    super(featureId, hostName, usageType, contextId);
    this.startEntryId = startEntryId;
  }

  /** Creates a new FeatureEndedLogEntry from the specified FeatureStartedLogEntry.
   *  @param startEntry Corresponding [[FeatureStartedLogEntry]]
   *  @return Corresponding FeatureEndedLogEntry.
   */
  public static fromStartEntry(startEntry: FeatureStartedLogEntry): FeatureEndedLogEntry {
    const endEntry = new FeatureEndedLogEntry(startEntry.featureId, startEntry.entryId,
      startEntry.hostName, startEntry.usageType, startEntry.contextId);

    endEntry.usageData = startEntry.usageData;

    return endEntry;
  }
}

/**
 * Response from posting a [[UsageLogEntry]] or [[FeatureLogEntry]] with the [[UlasClient]].
 * See also *LogPostingResponse* entry on [ULAS Swagger](https://qa-connect-ulastm.bentley.com/Bentley.ULAS.SwaggerUI/SwaggerWebApp/?urls.primaryName=ULAS%20Posting%20Service%20v1)
 * site (section *Models*)
 * @internal
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
 * @internal
 */
export class UlasClient extends Client {
  private static readonly _buddiSearchKey: string = "UsageLoggingServices.RealtimeLogging.Url";
  private static readonly _configRelyingPartyUri = "imjs_ulas_relying_party_uri";
  private static readonly _configDefaultRelyingPartyUri = "imjs_default_relying_party_uri";

  /** Creates an instance of UlasClient. */
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
   * @param requestContext The client request context.
   * @param authTokenInfo Access token.
   * @returns Resolves to the (delegation) access token.
   * @internal
   */
  public async getAccessToken(requestContext: ClientRequestContext, authorizationToken: AuthorizationToken): Promise<AccessToken> {
    const imsClient = new ImsDelegationSecureTokenClient();
    return imsClient.getToken(requestContext, authorizationToken, this.getRelyingPartyUrl());
  }

  /**
   * Logs usage via the ULAS service
   * @param requestContext The client request context.
   * @param hostName The client host name.
   * @param usageType The client usage type
   * @returns Response from the service.
   */
  public async logUsage(requestContext: AuthorizedClientRequestContext, entry: UsageLogEntry): Promise<LogPostingResponse> {
    requestContext.enter();
    const entryJson: UsageLogEntryJson = LogEntryConverter.toUsageLogJson(requestContext, entry);
    return this.logEntry(requestContext, entryJson, false);
  }

  /**
   * Logs one ore more feature entries via the ULAS service
   * @param requestContext The client request context.
   * @param entries One or more feature log entries.
   * @returns Response from the service.
   */
  public async logFeature(requestContext: AuthorizedClientRequestContext, ...entries: FeatureLogEntry[]): Promise<LogPostingResponse> {
    requestContext.enter();
    if (entries.length === 0)
      throw new Error("At least one FeatureLogEntry must be passed to UlasClient.logFeatures.");

    const entriesJson: FeatureLogEntryJson[] = LogEntryConverter.toFeatureLogJson(requestContext, entries);
    return this.logEntry(requestContext, entriesJson, true);
  }

  private async logEntry(requestContext: AuthorizedClientRequestContext, entryJson: UsageLogEntryJson | FeatureLogEntryJson[], isFeatureEntry: boolean): Promise<LogPostingResponse> {
    requestContext.enter();
    let postUrl: string = (await this.getUrl(requestContext));
    requestContext.enter();
    if (isFeatureEntry)
      postUrl += "/featureLog";

    const token = requestContext.accessToken;
    const authString: string = !token.getSamlAssertion() ? token.toTokenString() : "SAML " + token.toTokenString(IncludePrefix.No);
    const options: RequestOptions = {
      method: "POST",
      headers: { authorization: authString },
      body: entryJson,
    };

    await this.setupOptionDefaults(options);
    requestContext.enter();
    if (Logger.isEnabled(loggerCategory, LogLevel.Trace))
      Logger.logTrace(loggerCategory, `Sending ${isFeatureEntry ? "Feature" : "Usage"} Log REST request...`, () => ({ url: postUrl, body: entryJson }));

    const resp: Response = await request(requestContext, postUrl, options);
    requestContext.enter();
    const requestDetails = { url: postUrl, body: entryJson, response: resp };
    if (Logger.isEnabled(loggerCategory, LogLevel.Trace))
      Logger.logTrace(loggerCategory, `Sent ${isFeatureEntry ? "Feature" : "Usage"} Log REST request.`, () => requestDetails);

    const respBody: any = resp.body;
    if (!respBody || !respBody.status || respBody.status.toLowerCase() !== "success")
      throw new Error(`Post ${isFeatureEntry ? "Feature" : "Usage"} Log REST request failed ${!!respBody.msg ? ": " + respBody.msg : ""}. Details: ${JSON.stringify(requestDetails)}`);

    return { status: BentleyStatus.SUCCESS, message: !!respBody.msg ? respBody.msg : "", time: !!respBody.time ? respBody.time : -1, requestId: respBody.reqID };
  }
}
