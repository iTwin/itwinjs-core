/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
/** @packageDocumentation
 * @module UsageLogging
 */
import { Guid, GuidString, Logger } from "@bentley/bentleyjs-core";
import { AuthorizedClientRequestContext } from "@bentley/itwin-client";
import { FeatureLogEntry, ProductVersion, UsageLogEntry, UsageType } from "./UsageLoggingClient";
import { UsageLoggingClientLoggerCategory } from "./UsageLoggingClientLoggerCategories";

const loggerCategory: string = UsageLoggingClientLoggerCategory.Client;

/** Specifies the JSON format for a UsageLogEntry as expected by the ULAS REST API
 * (see https://connect-ulastm.bentley.com/Bentley.ULAS.SwaggerUI/SwaggerWebApp/?urls.primaryName=ULAS%20Posting%20Service%20v1)
 * @internal
 */
export interface UsageLogEntryJson {
  /** Ultimate ID, i.e. company ID in SAP */
  ultID?: number;
  /** The ID of the Principal that was granted access to the application */
  pid?: GuidString;
  /** The GUID of the IMS user accessing the product, maybe the same as the Principal. */
  imsID?: GuidString;
  /** The client’s machine name excluding domain information. */
  hID: string;
  /** The client’s login name excluding domain information */
  uID?: string;
  /** The GUID embedded in the policy file that allows us to track the entitlement history. */
  polID: GuidString;
  /** The ID of the securable. */
  secID: string;
  /** The product ID for which usage is being submitted. It is a 4-digit Product ID from the GPR. */
  prdid: number;
  /** A feature string further identifying the product for which available usage is being submitted. Not to be confused with feature IDs. */
  fstr: string;
  /** The version of the application producing the usage.
   *  Format: Pad all sections out to 4 digits padding is with zeros, e.g. 9.10.2.113 becomes 9001000020113.
   */
  ver: number;
  /** The GUID of the project that the usage should be associated with.
   *  If no project is selected, omit the field.
   */
  projID?: GuidString;
  /** The GUID that identifies a unique usage session, used to correlate data between feature usage and usage logs. */
  corID?: GuidString;
  /** The UTC time of the event. */
  evTimeZ?: string;
  /** The version of the schema which this log entry represents. */
  lVer: number;
  /** Identifies the source of the usage log entry: RealTime, Offline, Checkout */
  lSrc: string;
  /** Identifies the country where the client reporting the usage belongs to. */
  country?: string;
  /** The type of usage that occurred on the client. It is acting as a filter to eliminate records from log processing that
   *  should not count towards a customer’s peak processing. One of: Production, Trial, Beta, HomeUse, PreActivation
   */
  uType: string;
}

/** @internal */
export interface FeatureLogEntryAttributeJson {
  name: string;
  value: string;
}

/** Specifies the JSON format for a FeatureLogEntry as expected by the ULAS REST API
 * (see https://connect-ulastm.bentley.com/Bentley.ULAS.SwaggerUI/SwaggerWebApp/?urls.primaryName=ULAS%20Posting%20Service%20v1)
 * @internal
 */
export interface FeatureLogEntryJson extends UsageLogEntryJson {
  /** Gets the ID of the feature used (from the Global Feature Registry) */
  ftrID: GuidString;
  /** The start date in UTC when feature usage has started (for duration feature log entries) */
  sDateZ?: string;
  /** The end date in UTC when feature usage has started (for duration feature log entries) */
  eDateZ?: string;
  /** Additional user-defined metadata for the feature usage */
  uData?: FeatureLogEntryAttributeJson[];
}

/** @internal */
export class LogEntryConverter {
  // for now this is always 1
  private static readonly _logEntryVersion: number = 1;
  // this is a real-time client, i.e. it sends the requests right away without caching or aggregating.
  private static readonly _logPostingSource: string = "RealTime";
  // fStr argument is empty for now
  private static readonly _featureString: string = "";
  private static readonly _policyFileId: GuidString = Guid.createValue();
  private static readonly _securableId: string = Guid.createValue();

  /**
   * Extracts the application version from the supplied request context
   * @param requestContext The client request context
   * @returns The application version for the request context
   */
  public static getApplicationVersion(requestContext: AuthorizedClientRequestContext): ProductVersion {
    const applicationVersion = requestContext.applicationVersion;
    const defaultVersion = { major: 1, minor: 0 };
    if (!applicationVersion) {
      Logger.logWarning(loggerCategory, "ApplicationVersion was not specified. Set up IModelApp.applicationVersion for frontend applications, or IModelHost.applicationVersion for agents", () => ({ applicationVersion }));
      return defaultVersion;
    }

    const versionSplit = applicationVersion.split(".");
    const length = versionSplit.length;
    if (length < 2) {
      Logger.logWarning(loggerCategory, "ApplicationVersion is not valid", () => ({ applicationVersion }));
      return defaultVersion;
    }

    const major = parseInt(versionSplit[0], 10);
    if (typeof major === "undefined") {
      Logger.logWarning(loggerCategory, "ApplicationVersion is not valid", () => ({ applicationVersion }));
      return defaultVersion;
    }

    const minor = parseInt(versionSplit[1], 10);
    if (typeof minor === "undefined") {
      Logger.logWarning(loggerCategory, "ApplicationVersion is not valid", () => ({ applicationVersion }));
      return { major, minor: 0 };
    }

    let sub1: number | undefined;
    let sub2: number | undefined;
    if (length > 2) {
      sub1 = parseInt(versionSplit[2], 10);
      if (length > 3 && !isNaN(sub1)) {
        sub2 = parseInt(versionSplit[3], 10) || undefined;
      }
    }

    return { major, minor, sub1, sub2 };
  }

  /**
   * Extracts the application id from the supplied request context
   * @param requestContext The client request context
   * @returns The application id for the request context
   */
  private static getApplicationId(requestContext: AuthorizedClientRequestContext): number {
    const defaultId = 2686; // iModel.js
    if (!requestContext.applicationId) {
      Logger.logWarning(loggerCategory, "ApplicationId was not specified. Set up IModelApp.applicationId for frontend applications, or IModelHost.applicationId for agents");
      return defaultId;
    }

    return parseInt(requestContext.applicationId, 10) || defaultId;
  }

  /**
   * Extracts the session id from the supplied request context
   * @param requestContext The client request context
   * @returns The session id for the request context
   */
  private static getSessionId(requestContext: AuthorizedClientRequestContext): GuidString {
    if (!Guid.isGuid(requestContext.sessionId)) {
      Logger.logWarning(loggerCategory, "Specified sessionId is not a valid Guid. Set up IModelApp.sessionId for frontend applications, or IModelHost.sessionId for agents");
      return Guid.empty;
    }

    return requestContext.sessionId;
  }

  /**
   * @internal
   * @param requestContext
   * @param entry
   */
  public static toUsageLogJson(requestContext: AuthorizedClientRequestContext, entry: UsageLogEntry): UsageLogEntryJson {
    const productId: number = LogEntryConverter.getApplicationId(requestContext);
    const productVersion: ProductVersion = LogEntryConverter.getApplicationVersion(requestContext);
    const sessionId: GuidString = LogEntryConverter.getSessionId(requestContext);

    const machineName: string = LogEntryConverter.prepareMachineName(entry.hostName);
    const versionNumber: number = LogEntryConverter.toVersionNumber(productVersion);
    const usageType: string = LogEntryConverter.usageTypeToString(entry.usageType);

    return {
      hID: machineName,
      polID: LogEntryConverter._policyFileId,
      secID: LogEntryConverter._securableId,
      prdid: productId,
      fstr: LogEntryConverter._featureString,
      ver: versionNumber,
      projID: entry.contextId,
      corID: sessionId,
      lVer: LogEntryConverter._logEntryVersion,
      lSrc: LogEntryConverter._logPostingSource,
      uType: usageType,
    };
  }

  /**
   * @internal
   * @param requestContext
   * @param entry
   */
  public static toFeatureLogJson(requestContext: AuthorizedClientRequestContext, entry: FeatureLogEntry): FeatureLogEntryJson {
    const productId: number = LogEntryConverter.getApplicationId(requestContext);
    const productVersion: ProductVersion = LogEntryConverter.getApplicationVersion(requestContext);
    const sessionId: GuidString = LogEntryConverter.getSessionId(requestContext);

    const versionNumber: number | undefined = LogEntryConverter.toVersionNumber(productVersion);
    const machineName: string = LogEntryConverter.prepareMachineName(entry.hostName);
    const usageType: string = LogEntryConverter.usageTypeToString(entry.usageType);

    const startDateZ = entry.startTime?.toISOString();
    const endDateZ = entry.endTime?.toISOString();

    const featureMetaData: FeatureLogEntryAttributeJson[] = [];
    for (const att in entry.additionalData) { // eslint-disable-line guard-for-in
      featureMetaData.push({ name: att, value: entry.additionalData[att] });
    }

    const contextId = entry.contextId ?? "99999999-9999-9999-9999-999999999999"; // All iTwin applications are obligated by ULAS to send the 9-Guid (instead of the 0-Guid or undefined) to denote a global project scope.

    const entryJson: FeatureLogEntryJson = {
      hID: machineName,
      polID: LogEntryConverter._policyFileId,
      secID: LogEntryConverter._securableId,
      prdid: productId,
      fstr: LogEntryConverter._featureString,
      ver: versionNumber,
      projID: contextId,
      corID: sessionId,
      lVer: LogEntryConverter._logEntryVersion,
      lSrc: LogEntryConverter._logPostingSource,
      uType: usageType,
      ftrID: entry.featureId,
      sDateZ: startDateZ,
      eDateZ: endDateZ,
      uData: featureMetaData,
    };

    return entryJson;
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

  private static prepareMachineName(machineName: string): string {
    if (!machineName || machineName.length === 0)
      return "";

    if (machineName === "::1" || machineName === "127.0.0.1")
      return "localhost";

    return machineName.toLowerCase();
  }

  /* private static prepareUserName(userName: string, machineName: string): string {
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
  } */

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
