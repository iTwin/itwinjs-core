/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
/** @packageDocumentation
 * @module UiSettings
 */

import { UiSettings, UiSettingsStatus, UiSettingsResult } from "@bentley/ui-core";
import { SettingsStatus } from "@bentley/imodeljs-clients";
import { AuthorizedFrontendRequestContext, IModelApp } from "@bentley/imodeljs-frontend";

/**
 * Implementation of [[UiSettings]] that uses settings admin from [[IModelApp.settings]].
 * @alpha
 */
export class IModelAppUiSettings implements UiSettings {
  public async getSetting(namespace: string, name: string): Promise<UiSettingsResult> {
    const requestContext = await AuthorizedFrontendRequestContext.create();
    const result = await IModelApp.settings.getUserSetting(requestContext, namespace, name, true);
    const status = settingsStatusToUiSettingsStatus(result.status);
    return {
      status,
      setting: result.setting,
    };
  }

  public async saveSetting(namespace: string, name: string, setting: any): Promise<UiSettingsResult> {
    const requestContext = await AuthorizedFrontendRequestContext.create();
    const result = await IModelApp.settings.saveUserSetting(requestContext, setting, namespace, name, true);
    const status = settingsStatusToUiSettingsStatus(result.status);
    return {
      status,
      setting: result.setting,
    };
  }

  public async deleteSetting(namespace: string, name: string): Promise<UiSettingsResult> {
    const requestContext = await AuthorizedFrontendRequestContext.create();
    const result = await IModelApp.settings.deleteUserSetting(requestContext, namespace, name, true);
    const status = settingsStatusToUiSettingsStatus(result.status);
    return {
      status,
      setting: result.setting,
    };
  }
}

/** @internal */
export function settingsStatusToUiSettingsStatus(status: SettingsStatus) {
  if (status === SettingsStatus.Success)
    return UiSettingsStatus.Success;
  else if (status === SettingsStatus.SettingNotFound)
    return UiSettingsStatus.NotFound;
  return UiSettingsStatus.UnknownError;
}
