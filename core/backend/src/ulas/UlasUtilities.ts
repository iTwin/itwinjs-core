/*---------------------------------------------------------------------------------------------
* Copyright (c) 2019 Bentley Systems, Incorporated. All rights reserved.
* Licensed under the MIT License. See LICENSE.md in the project root for license terms.
*--------------------------------------------------------------------------------------------*/
import { Guid, GuidString, Logger, BentleyStatus } from "@bentley/bentleyjs-core";
import { AuthorizedClientRequestContext, ClientsLoggerCategory, IncludePrefix } from "@bentley/imodeljs-clients";
import { IModelHost } from "../IModelHost";
import { IModelJsNative } from "@bentley/imodeljs-native";

const loggerCategory: string = ClientsLoggerCategory.UlasClient;

/**
 * @internal
 * Defines a base set of additional properties that might be useful to attach to feature logs
 */
export interface AdditionalFeatureData {
  iModelId?: GuidString;
  iModelJsVersion?: string;
}

/** @internal */
export class UlasUtilities {

  public static checkEntitlement(requestContext: AuthorizedClientRequestContext, contextId: GuidString, authType: IModelJsNative.AuthType, productId: number, hostName: string): IModelJsNative.Entitlement {
    return IModelHost.platform.NativeUlasClient.checkEntitlement(
      requestContext.accessToken.toTokenString(IncludePrefix.No),
      requestContext.applicationVersion,
      contextId,
      authType,
      productId,
      UlasUtilities.prepareMachineName(hostName),
      UlasUtilities.getSessionId(requestContext));
  }

  /**
   * @deprecated use postUserUsage instead
   * Attempts to send a single request to log user usage with the Bentley Usage Logging and Analysis Service
   * @param requestContext
   * @param contextId
   * @param authType
   * @param hostName
   * @param usageType
   */
  public static trackUsage(requestContext: AuthorizedClientRequestContext, contextId: GuidString, authType: IModelJsNative.AuthType, hostName: string, usageType: IModelJsNative.UsageType): BentleyStatus {
    return IModelHost.platform.NativeUlasClient.trackUsage(
      requestContext.accessToken.toTokenString(IncludePrefix.No),
      requestContext.applicationVersion,
      contextId,
      authType,
      UlasUtilities.getApplicationId(requestContext),
      UlasUtilities.prepareMachineName(hostName),
      usageType,
      UlasUtilities.getSessionId(requestContext));
  }

  /**
   * Attempts to send a single request to log user usage with the Bentley Usage Logging and Analysis Service
   * @throws When configurations are invalid or the request is rejected
   * @param requestContext
   * @param contextId
   * @param authType
   * @param hostName
   * @param usageType
   */
  public static async postUserUsage(requestContext: AuthorizedClientRequestContext, contextId: GuidString, authType: IModelJsNative.AuthType, hostName: string, usageType: IModelJsNative.UsageType): Promise<void> {
    return IModelHost.platform.NativeUlasClient.postUserUsage(
      requestContext.accessToken.toTokenString(IncludePrefix.No),
      requestContext.applicationVersion,
      contextId,
      authType,
      UlasUtilities.getApplicationId(requestContext),
      UlasUtilities.prepareMachineName(hostName),
      usageType,
      UlasUtilities.getSessionId(requestContext));
  }

  /**
   * @deprecated use postFeatureUsage instead
   * Attempts to send a single request to log feature usage with the Bentley Usage Logging and Analysis Service
   * @param requestContext The client request context
   * @param featureId The unique id of the feature to be tracked
   * @param authType The authentication mechanism used to authorize the request
   * @param hostName The name of the machine which utilized the feature
   * @param usageType The type of usage which occurred on the client.
   * @param contextId The context in which the feature was used (i.e. a specific projectId). When omitted, the Guid 99999999-9999-9999-9999-999999999999 is substituted internally.
   * @param startTimeZ The time at which feature usage began
   * @param endTimeZ The time at which feature usage was completed
   * @param additionalData A collection of arbitrary data that will be attached to the feature usage log
   */
  public static markFeature(requestContext: AuthorizedClientRequestContext, featureId: string, authType: IModelJsNative.AuthType, hostName: string, usageType: IModelJsNative.UsageType, contextId?: GuidString, startDateZ?: Date, endDateZ?: Date, additionalData?: AdditionalFeatureData): BentleyStatus {
    const featureUserData: IModelJsNative.FeatureUserDataKeyValuePair[] = [];
    for (const propName in additionalData) { // tslint:disable-line: forin
      featureUserData.push({
        key: propName,
        value: (additionalData as any)[propName],
      });
    }

    const featureEvent: IModelJsNative.NativeUlasClientFeatureEvent = {
      featureId,
      versionStr: requestContext.applicationVersion,
      projectId: contextId,
      startDateZ: startDateZ ? startDateZ.toISOString() : undefined,
      endDateZ: endDateZ ? endDateZ.toISOString() : undefined,
      featureUserData,
    };

    return IModelHost.platform.NativeUlasClient.markFeature(
      requestContext.accessToken.toTokenString(IncludePrefix.No),
      featureEvent,
      authType,
      UlasUtilities.getApplicationId(requestContext),
      UlasUtilities.prepareMachineName(hostName),
      usageType,
      UlasUtilities.getSessionId(requestContext),
    );
  }

  /**
   * Attempts to send a single request to log feature usage with the Bentley Usage Logging and Analysis Service
   * @throws When configurations are invalid or the request is rejected
   * @param requestContext The client request context
   * @param featureId The unique id of the feature to be tracked
   * @param authType The authentication mechanism used to authorize the request
   * @param hostName The name of the machine which utilized the feature
   * @param usageType The type of usage which occurred on the client.
   * @param contextId The context in which the feature was used (i.e. a specific projectId). When omitted, the Guid 99999999-9999-9999-9999-999999999999 is substituted internally.
   * @param startTimeZ The time at which feature usage began
   * @param endTimeZ The time at which feature usage was completed
   * @param additionalData A collection of arbitrary data that will be attached to the feature usage log
   */
  public static async postFeatureUsage(requestContext: AuthorizedClientRequestContext, featureId: string, authType: IModelJsNative.AuthType, hostName: string, usageType: IModelJsNative.UsageType, contextId?: GuidString, startDateZ?: Date, endDateZ?: Date, additionalData?: AdditionalFeatureData): Promise<void> {
    const featureUserData: IModelJsNative.FeatureUserDataKeyValuePair[] = [];
    for (const propName in additionalData) { // tslint:disable-line: forin
      featureUserData.push({
        key: propName,
        value: (additionalData as any)[propName],
      });
    }

    const featureEvent: IModelJsNative.NativeUlasClientFeatureEvent = {
      featureId,
      versionStr: requestContext.applicationVersion,
      projectId: contextId,
      startDateZ: startDateZ ? startDateZ.toISOString() : undefined,
      endDateZ: endDateZ ? endDateZ.toISOString() : undefined,
      featureUserData,
    };

    return IModelHost.platform.NativeUlasClient.postFeatureUsage(
      requestContext.accessToken.toTokenString(IncludePrefix.No),
      featureEvent,
      authType,
      UlasUtilities.getApplicationId(requestContext),
      UlasUtilities.prepareMachineName(hostName),
      usageType,
      UlasUtilities.getSessionId(requestContext),
    );
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
