/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* Licensed under the MIT License. See LICENSE.md in the project root for license terms.
*--------------------------------------------------------------------------------------------*/
/** @packageDocumentation
 * @module Features
 */

import { LDClient, LDUser, LDFlagValue, initialize } from "ldclient-js";
import { Guid, assert, Logger } from "@bentley/bentleyjs-core";
import { Config, AccessToken } from "@bentley/imodeljs-clients";
import { FrontendLoggerCategory } from "./FrontendLoggerCategory";

/** Client-side class for checking and toggling feature flags
 * The [[FeatureToggleClient]] includes methods for applications to do the following via Launch Darkly:
 *   * Set the current user
 *   * Check to see whether a specific feature flag is enabled
 *   * Toggle a feature flag
 *
 * @internal
 */
export class FeatureToggleClient  {
  /** App-defined options */
  /** App ids for Launch Darkly deployment environments environments */
  /** Direct reference to the Launch Darkly client in the event the app wants to make its own asynch calls */
  protected _ldClient?: LDClient;
  protected _offlineValue: boolean = false;

  protected readonly _loggingCategory = FrontendLoggerCategory.FeatureToggle;

/** initialize initializes the Launch Darkly client. Must be called by the app to set the proper environment and user id */
  public async initialize(envKey?: string): Promise<void> {
    if (!!this._ldClient)
      return;

    const imjsEnvKey: string | undefined = Config.App.get ("imjs_launch_darkly_key");
    const ldId = envKey === undefined ? imjsEnvKey : envKey;
    if (ldId === undefined)
      return;

    const ldClient: LDClient = initialize(ldId, { key: Guid.createValue(), anonymous: true });
    await ldClient.waitUntilReady();

    this._ldClient = ldClient;
  }

/** sets the Launch Darkly user info from the AccessToken */
  public async setUser(accessToken: AccessToken): Promise<void> {
    const userInfo = accessToken.getUserInfo();
    assert(userInfo !== undefined, "FeatureToggleClient unable get user id.");
    assert(!!this._ldClient, "FeatureToggleClient.initialize must be called first.");
    if (userInfo !== undefined) {
      const ldUser: LDUser = {key: userInfo.id};
      await this.ldClient.identify(ldUser);
    }
    Logger.logTrace(this._loggingCategory, "Changed LaunchDarkly Feature Flags user context to current user.", () => ({ userId: userInfo === undefined ? "undefined" : userInfo.id }));
  }

  /** Returns true is the flag specified by is enabled */
  public isFeatureEnabled(featureKey: string, defaultValue?: boolean): boolean {
    return this.evaluateFeature(featureKey, !!defaultValue ? defaultValue : this._offlineValue) as boolean;
  }

  /** Checks the status of the flag specified by featureKey */
  public evaluateFeature(featureKey: string, defaultValue?: LDFlagValue): LDFlagValue {
    assert(!!this._ldClient, "FeatureToggleClient.initialize hasn't been called yet.");
    const val: LDFlagValue = this.ldClient.variation(featureKey, defaultValue);
    Logger.logTrace(this._loggingCategory, "Evaluated feature flag.", () => ({featureKey, result: val}));
    return val;
  }

  /** The native LaunchDarkly client if the basic methods do not suffice. */
  public get ldClient(): LDClient { assert(!!this._ldClient, "FeatureToggleClient.initialize hasn't been called yet."); return this._ldClient!; }
}
