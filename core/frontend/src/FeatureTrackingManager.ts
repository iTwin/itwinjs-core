/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
/** @packageDocumentation
 * @module Features
 */
import { UsageType } from "@bentley/imodeljs-clients";
import { AuthorizedFrontendRequestContext } from "./FrontendRequestContext";
import { FeatureLogBatchClient } from "./FeatureLogBatchClient";
import { IModelConnection } from "./IModelConnection";

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
    this._hostName = (typeof (window) !== "undefined") ? window.location.host : this._hostFallbackName;
  }

  /** Basic tracking function to be overridden by an app. By default, iModelApp does not know the context to log track features.  */
  public track(_iModelConnection: IModelConnection, _featureId: string, _featureName?: string) {
    return;
  }
}
