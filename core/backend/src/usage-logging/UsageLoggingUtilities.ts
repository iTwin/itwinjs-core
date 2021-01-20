/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
import { BackendTelemetryEvent, ClientAuthDetail, ClientAuthIntrospectionManager } from "@bentley/backend-itwin-client";
import { Guid, GuidString, Logger } from "@bentley/bentleyjs-core";
import { IModelJsNative } from "@bentley/imodeljs-native";
import { AuthorizedClientRequestContext, IncludePrefix } from "@bentley/itwin-client";
import { TelemetryEvent } from "@bentley/telemetry-client";
import { LogEntryConverter } from "@bentley/usage-logging-client";
import * as os from "os";
import { BackendLoggerCategory } from "../BackendLoggerCategory";
import { IModelHost } from "../IModelHost";

/** @internal */
export interface UsageLoggingUtilitiesOptions {
  iModelJsNative?: typeof IModelJsNative;
  hostApplicationId?: string;
  hostApplicationVersion?: string;
  clientAuthManager?: ClientAuthIntrospectionManager;
}

/** @internal */
export class UsageLoggingUtilities {
  private static _options: UsageLoggingUtilitiesOptions = {};

  private constructor() {
  }

  public static configure(options: UsageLoggingUtilitiesOptions): void {
    UsageLoggingUtilities._options = Object.assign({}, options);
  }

  private static get nativePlatform(): typeof IModelJsNative {
    return UsageLoggingUtilities._options.iModelJsNative || IModelHost.platform;
  }

  public static checkEntitlement(requestContext: AuthorizedClientRequestContext, contextId: GuidString, authType: IModelJsNative.AuthType, productId: number, hostName: string): IModelJsNative.Entitlement {
    return UsageLoggingUtilities.nativePlatform.NativeUlasClient.checkEntitlement(
      requestContext.accessToken.toTokenString(IncludePrefix.No),
      UsageLoggingUtilities.getApplicationVersion(requestContext),
      contextId,
      authType,
      productId,
      UsageLoggingUtilities.prepareMachineName(hostName),
      UsageLoggingUtilities.getSessionId(requestContext));
  }

  /**
   * Attempts to send a single request to log user (billable) usage with the Bentley Usage Logging and Analysis Service
   * @throws When configurations are invalid or the request is rejected
   * @param requestContext
   * @param contextId
   * @param authType
   * @param usageType
   */
  public static async postUserUsage(requestContext: AuthorizedClientRequestContext, contextId: GuidString, authType: IModelJsNative.AuthType, hostName: string, usageType: IModelJsNative.UsageType): Promise<void> {
    return UsageLoggingUtilities.nativePlatform.NativeUlasClient.postUserUsage(
      requestContext.accessToken.toTokenString(IncludePrefix.No),
      UsageLoggingUtilities.getApplicationVersion(requestContext),
      contextId,
      authType,
      UsageLoggingUtilities.getApplicationId(requestContext),
      UsageLoggingUtilities.prepareMachineName(hostName),
      usageType,
      UsageLoggingUtilities.getSessionId(requestContext));
  }

  /**
   * Attempts to send a single request to log feature usage with the Bentley Usage Logging and Analysis Service
   * @throws When configurations are invalid or the request is rejected by ULAS
   * @param requestContext The client request context
   * @param featureId The unique id of the feature to be tracked
   * @param authType The authentication mechanism used to authorize the request
   * @param usageType The type of usage which occurred on the client.
   * @param contextId The context in which the feature was used (i.e. a specific projectId). When omitted, the Guid 99999999-9999-9999-9999-999999999999 is substituted internally.
   * @param startTime The time at which feature usage began. If both startTime and endTime are left undefined, then both will default to the current time. Otherwise these fields are passed as received.
   * @param endTime The time at which feature usage was completed. If both endTime and startTime are left undefined, then both will default to the current time. Otherwise these fields are passed as received.
   * @param additionalData A collection of arbitrary data that will be attached to the feature usage log
   */
  public static async postFeatureUsage(requestContext: AuthorizedClientRequestContext, featureId: string, authType: IModelJsNative.AuthType, hostName: string, usageType: IModelJsNative.UsageType, contextId?: GuidString, startTime?: Date, endTime?: Date, additionalData?: { [key: string]: string }): Promise<void> {
    const currentTime = new Date().toISOString();
    let startDateZ: string | undefined;
    let endDateZ: string | undefined;
    if (!startTime && !endTime) {
      startDateZ = currentTime;
      endDateZ = currentTime;
    } else {
      if (startTime) {
        startDateZ = startTime.toISOString();
      }
      if (endTime) {
        endDateZ = endTime.toISOString();
      }
    }

    const featureUserData: IModelJsNative.FeatureUserDataKeyValuePair[] = [];
    for (const propName in additionalData) { // eslint-disable-line guard-for-in
      featureUserData.push({
        key: propName,
        value: additionalData[propName],
      });
    }

    const featureEvent: IModelJsNative.NativeUlasClientFeatureEvent = {
      featureId,
      versionStr: UsageLoggingUtilities.getApplicationVersion(requestContext),
      projectId: contextId,
      startDateZ,
      endDateZ,
      featureUserData,
    };

    return UsageLoggingUtilities.nativePlatform.NativeUlasClient.postFeatureUsage(
      requestContext.accessToken.toTokenString(IncludePrefix.No),
      featureEvent,
      authType,
      UsageLoggingUtilities.getApplicationId(requestContext),
      UsageLoggingUtilities.prepareMachineName(hostName),
      usageType,
      UsageLoggingUtilities.getSessionId(requestContext),
    );
  }

  /**
   * Attempts to send a single request to log feature usage with the Bentley Usage Logging and Analysis Service
   * @throws When configurations are invalid or the request is rejected by ULAS
   * @param requestContext The client request context
   * @param telemetryEvent Core data specific to the feature/telemetry event
   * @param usageType The type of usage which occurred on the client.
   */
  public static async postFeatureUsageFromTelemetry(requestContext: AuthorizedClientRequestContext, telemetryEvent: TelemetryEvent, usageType: IModelJsNative.UsageType): Promise<void> {
    if (!telemetryEvent.eventId || !Guid.isGuid(telemetryEvent.eventId)) {
      throw new Error("Cannot post feature usage without a defined featureId Guid");
    }

    let clientAuth: ClientAuthDetail | undefined;
    try {
      clientAuth = UsageLoggingUtilities._options.clientAuthManager
        ? await UsageLoggingUtilities._options.clientAuthManager.getClientAuthDetails(requestContext)
        : undefined;
    } catch (err) {
      Logger.logWarning(BackendLoggerCategory.UsageLogging, `Unable to obtain client auth details from request context`, () => err);
    }
    const backendTelemetryEvent = new BackendTelemetryEvent(telemetryEvent, requestContext, undefined, UsageLoggingUtilities._options.hostApplicationId, UsageLoggingUtilities._options.hostApplicationVersion, clientAuth);

    return UsageLoggingUtilities.postFeatureUsage(
      requestContext,
      telemetryEvent.eventId,
      IModelJsNative.AuthType.OIDC,
      os.hostname(),
      usageType,
      telemetryEvent.contextId,
      telemetryEvent.time?.startTime,
      telemetryEvent.time?.endTime,
      backendTelemetryEvent.getProperties());
  }

  /**
   * Extracts the application id from the supplied request context
   * @param requestContext The client request context
   * @returns The application id for the request context
   */
  private static getApplicationId(requestContext: AuthorizedClientRequestContext): number {
    const defaultId = 2686; // iModel.js
    if (!requestContext.applicationId) {
      Logger.logWarning(BackendLoggerCategory.UsageLogging, "ApplicationId was not specified. Set up IModelApp.applicationId for frontend applications, or IModelHost.applicationId for agents");
      return defaultId;
    }

    return parseInt(requestContext.applicationId, 10) || defaultId;
  }

  private static getApplicationVersion(requestContext: AuthorizedClientRequestContext): string {
    const applicationVersion = LogEntryConverter.getApplicationVersion(requestContext);

    let versionStr = `${applicationVersion.major}.${applicationVersion.minor}`;
    if (applicationVersion.sub1 !== undefined) {
      versionStr = `${versionStr}.${applicationVersion.sub1}`;
      if (applicationVersion.sub2 !== undefined) {
        versionStr = `${versionStr}.${applicationVersion.sub2}`;
      }
    }

    return versionStr;
  }

  /**
   * Extracts the session id from the supplied request context
   * @param requestContext The client request context
   * @returns The session id for the request context
   */
  private static getSessionId(requestContext: AuthorizedClientRequestContext): GuidString {
    if (!Guid.isGuid(requestContext.sessionId)) {
      Logger.logWarning(BackendLoggerCategory.UsageLogging, "Specified sessionId is not a valid Guid. Set up IModelApp.sessionId for frontend applications, or IModelHost.sessionId for agents");
      return Guid.empty;
    }

    return requestContext.sessionId;
  }

  /**
   * Formats the provided machine name string to be more readable
   * @param machineName The base machine name
   */
  private static prepareMachineName(machineName: string): string {
    if (!machineName || machineName.length === 0)
      return "";

    if (machineName === "::1" || machineName === "127.0.0.1")
      return "localhost";

    return machineName.toLowerCase();
  }
}
