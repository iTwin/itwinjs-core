/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
/** @module Features */
import { FeatureLogEntry, UsageType } from "@bentley/imodeljs-clients";
import { AuthorizedFrontendRequestContext } from "./FrontendRequestContext";
import { GuidString } from "@bentley/bentleyjs-core";
import { FeatureLogBatchClient } from "./FeatureLogBatchClient";

/** Class that offers a default implementation of Feature Tracking, using a batch client to minimize traffic.
 * @internal
 */
export class FeatureTrackingManager {
  protected _client: FeatureLogBatchClient;
  protected _hostName: string;
  protected _hostFallbackName = "imodeljs-frontend";
  protected _usageType = UsageType.Beta;

  constructor() {
    this._client = new FeatureLogBatchClient(async () => AuthorizedFrontendRequestContext.create());
    this._hostName = (typeof (window) !== "undefined") ? window.location.host : this._hostFallbackName;
  }

  public async trackFeature(featureId: GuidString, contextId: string) {
    const entry = new FeatureLogEntry(featureId, this._hostName, this._usageType, contextId);
    return this._client.queueLog(entry);
  }
}
