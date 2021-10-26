/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
/** @packageDocumentation
 * @module UiSettings
 */

import { IModelApp } from "@itwin/core-frontend";
import { SettingsStatus } from "@bentley/product-settings-client";
import { UiSettingsResult, UiSettingsStatus, UiSettingsStorage } from "@itwin/core-react";

/**
 * Implementation of [[UiSettings]] that uses settings admin from `IModelApp.settings`.
 * @public
 */
export class UserSettingsStorage implements UiSettingsStorage {
  public async getSetting(namespace: string, name: string): Promise<UiSettingsResult> {
    if (undefined === IModelApp.authorizationClient)
      return { status: UiSettingsStatus.AuthorizationError };
    const accessToken = await IModelApp.getAccessToken();
    if (accessToken === "")
      return { status: UiSettingsStatus.AuthorizationError };
    const result = await IModelApp.settings.getUserSetting(accessToken, namespace, name, true);
    const status = settingsStatusToUiSettingsStatus(result.status);
    return {
      status,
      setting: result.setting,
    };
  }

  public async saveSetting(namespace: string, name: string, setting: any): Promise<UiSettingsResult> {
    const accessToken = await IModelApp.getAccessToken();
    if (accessToken === "")
      return { status: UiSettingsStatus.AuthorizationError };
    const result = await IModelApp.settings.saveUserSetting(accessToken, setting, namespace, name, true);
    const status = settingsStatusToUiSettingsStatus(result.status);
    return {
      status,
      setting: result.setting,
    };
  }

  public async deleteSetting(namespace: string, name: string): Promise<UiSettingsResult> {
    const accessToken = await IModelApp.getAccessToken();
    if (accessToken === "")
      return { status: UiSettingsStatus.AuthorizationError };
    const result = await IModelApp.settings.deleteUserSetting(accessToken, namespace, name, true);
    const status = settingsStatusToUiSettingsStatus(result.status);
    return {
      status,
      setting: result.setting,
    };
  }
}

/** @internal */
export function settingsStatusToUiSettingsStatus(status: SettingsStatus): UiSettingsStatus {
  if (status === SettingsStatus.Success)
    return UiSettingsStatus.Success;
  else if (status === SettingsStatus.SettingNotFound)
    return UiSettingsStatus.NotFound;
  else if (status === SettingsStatus.AuthorizationError)
    return UiSettingsStatus.AuthorizationError;
  return UiSettingsStatus.UnknownError;
}

/** Alias for [[UserSettingsStorage]]
 * @beta
 * @deprecated use UserSettingsStorage
 */
export class IModelAppUiSettings extends UserSettingsStorage {
}
