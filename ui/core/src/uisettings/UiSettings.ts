/*---------------------------------------------------------------------------------------------
|  $Copyright: (c) 2018 Bentley Systems, Incorporated. All rights reserved. $
 *--------------------------------------------------------------------------------------------*/
/** @module UiSettings */

export interface UiSettings {
  getSetting(settingNamespace: string, settingName: string): UiSettingsResult;
  saveSetting(settingNamespace: string, settingName: string, setting: any): UiSettingsResult;
  deleteSetting(settingNamespace: string, settingName: string): UiSettingsResult;
}
export enum UiSettingsStatus {
    Sucess = 0,
    NotFound = 1,
    UnknownError = 2,
}

export interface UiSettingsResult {
  status: UiSettingsStatus;
  setting?: any;
}
