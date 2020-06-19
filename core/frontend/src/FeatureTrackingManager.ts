/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
/** @packageDocumentation
 * @module Features
 */
import { AuthorizedFrontendRequestContext } from "./FrontendRequestContext";
import { FeatureLogBatchClient } from "./FeatureLogBatchClient";
import { FrontendLoggerCategory } from "./FrontendLoggerCategory";
import { IModelConnection } from "./IModelConnection";
import { Logger } from "@bentley/bentleyjs-core";
import { FeatureLogEntry, UsageType } from "@bentley/usage-logging-client";

const loggerCategory: string = FrontendLoggerCategory.FeatureTracking;

/** Properties that specify the feature data to be tracked.
 * @alpha
 */
export interface FeatureTrackingProps {
  /** Unique name of feature to be tracked */
  featureName: string;
  /** Optional GUID used to track feature in ULAS. If not specified FeatureTrackingManager will determine based on featureName.  */
  ulasFeatureId?: string;
  /** Optional iModelConnection which can be used to add more context to tracking logs. */
  iModelConnection?: IModelConnection;
  /** Arbitrary application data that can be used to supply additional information to tracking logs. */
  applicationData?: Map<string, any>;
}

/** Class that offers a default implementation of Feature Tracking, using a batch client to minimize traffic.
 * @alpha
 */
export class FeatureTrackingManager {
  /** Client that batches up tracking requests to limit traffic */
  protected _client: FeatureLogBatchClient;
  /** Host of the current app */
  protected _hostName: string;
  /** Fallback name to use in the event hostname can't be determined */
  protected _hostFallbackName = "imodeljs-frontend";
  /** Current Ulas usage type
   * See also
   *  - [[UsageLogEntry]]
   */
  protected _usageType = UsageType.Beta;

  constructor() {
    this._client = new FeatureLogBatchClient(async () => AuthorizedFrontendRequestContext.create());
    this._hostName = typeof window !== "undefined" ? window.location.host : this._hostFallbackName;
  }

  /** Expected to be overriden and if the intention is to post to ulas, return a FeatureLogEntry  */
  protected trackFeature(_props: FeatureTrackingProps): FeatureLogEntry | undefined {
    return undefined;
  }

  /** Basic tracking function to be overridden by an app. By default, iModelApp does not know the context to log track features.  */
  public track(props: FeatureTrackingProps) {
    Logger.logInfo(loggerCategory, `Tracking Feature:${props.featureName}`, () => ({ ...props }));
    const entry = this.trackFeature(props);
    // tslint:disable-next-line: no-floating-promises
    if (undefined !== entry) this._client.queueLog(entry);
  }
}
