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
interface AdditionalFeatureData {
  iModelId?: GuidString,
  startTime: Date,
  endTime: Date,
}

/** @internal */
export class UlasUtilities {

  public static checkEntitlement(requestContext: AuthorizedClientRequestContext, contextId: string, authType: IModelJsNative.AuthType, productId: number, hostName: string): IModelJsNative.Entitlement {
    return IModelHost.platform.NativeUlasClient.checkEntitlement(
      requestContext.accessToken.toTokenString(IncludePrefix.No),
      requestContext.applicationVersion,
      contextId,
      authType,
      productId,
      UlasUtilities.prepareMachineName(hostName),
      Guid.createValue());
  }

  public static trackUsage(requestContext: AuthorizedClientRequestContext, contextId: string, authType: IModelJsNative.AuthType, hostName: string, usageType: IModelJsNative.UsageType): BentleyStatus {
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

  public static markFeature(requestContext: AuthorizedClientRequestContext, featureId: string, authType: IModelJsNative.AuthType, hostName: string, usageType: IModelJsNative.UsageType, contextId?: string, additionalData: AdditionalFeatureData): BentleyStatus {
    const featureUserData: IModelJsNative.FeatureUserDataKeyValuePair[] = [];
    for (const propName in additionalData) {
      featureUserData.push({
        key: propName,
        value: (additionalData as any)[propName],
      });
    }

    return IModelHost.platform.NativeUlasClient.markFeature(
      requestContext.accessToken.toTokenString(IncludePrefix.No),
      {
        featureId,
        versionStr: requestContext.applicationVersion,
        projectId: contextId,
        featureUserData: featureUserData,
      },
      authType,
      UlasUtilities.getApplicationId(requestContext),
      UlasUtilities.prepareMachineName(hostName),
      usageType,
      UlasUtilities.getSessionId(requestContext));
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
