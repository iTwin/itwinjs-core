/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
/** @packageDocumentation
 * @module UiSettings
 */

import { AuthorizedFrontendRequestContext, IModelApp } from "@bentley/imodeljs-frontend";
import { UiSettingsResult, UiSettingsStatus, UiSettingsStorage } from "@bentley/ui-core";

/**
 * Implementation of [[UiSettings]] that uses settings admin from `IModelApp.settings`.
 * @public
 */
export class UserSettingsStorage implements UiSettingsStorage {
  public async getSetting(namespace: string, name: string): Promise<UiSettingsResult | undefined> {
    if (!this.isSignedIn)
      return { status: UiSettingsStatus.AuthorizationError };
    const requestContext = await AuthorizedFrontendRequestContext.create();
    const result = await IModelApp.userPreferences.get({
      token: async () => requestContext.accessToken,
      key: `${namespace}.${name}`,
    });
    return result;
  }

  public async saveSetting(namespace: string, name: string, setting: any): Promise<UiSettingsResult> {
    if (!this.isSignedIn)
      return { status: UiSettingsStatus.AuthorizationError };
    const requestContext = await AuthorizedFrontendRequestContext.create();
    await IModelApp.userPreferences.save({
      token: async () => requestContext.accessToken,
      key: `${namespace}.${name}`,
      content: setting
    });
    const status = settingsStatusToUiSettingsStatus(result.status);
    return {
      status,
      setting: result.setting,
    };
  }

  public async deleteSetting(namespace: string, name: string): Promise<UiSettingsResult> {
    if (!this.isSignedIn)
      return { status: UiSettingsStatus.AuthorizationError };
    const requestContext = await AuthorizedFrontendRequestContext.create();
    const result = await IModelApp.settings.deleteUserSetting(requestContext, namespace, name, true);
    const status = settingsStatusToUiSettingsStatus(result.status);
    return {
      status,
      setting: result.setting,
    };
  }

  private get isSignedIn(): boolean {
    return !!IModelApp.authorizationClient && IModelApp.authorizationClient.hasSignedIn;
  }
}

/** Alias for [[UserSettingsStorage]]
 * @beta
 * @deprecated use UserSettingsStorage
 */
export class IModelAppUiSettings extends UserSettingsStorage {
}
