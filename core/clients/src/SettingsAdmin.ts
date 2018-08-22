/*---------------------------------------------------------------------------------------------
|  $Copyright: (c) 2018 Bentley Systems, Incorporated. All rights reserved. $
 *--------------------------------------------------------------------------------------------*/
/** @module Settings */
import { AuthorizationToken } from "./Token";

export const enum SettingsStatus {
  SETTINGS_ERROR_BASE = 0x1b000,
  Success = 0,
  AuthorizationError = SETTINGS_ERROR_BASE + 1,
  UrlError = SETTINGS_ERROR_BASE + 2,
  ProjectInvalid = SETTINGS_ERROR_BASE + 3,
  IModelInvalid = SETTINGS_ERROR_BASE + 4,
  SettingNotFound = SETTINGS_ERROR_BASE + 5,
  ServerError = SETTINGS_ERROR_BASE + 6,
  UnknownError = SETTINGS_ERROR_BASE + 7,
}

export class SettingsResult {
  constructor(public status: SettingsStatus, public errorMessage?: string, public setting?: any) {
  }
}

/** Methods available to save and get Settings objects on behalf of combinations of the Application, Project, IModel, and User */
export interface SettingsAdmin {

  saveUserSetting(settings: any, type: string, version: number, authToken: AuthorizationToken, applicationSpecific: boolean, projectId?: string, iModelId?: string): Promise<SettingsResult>;

  getUserSetting(type: string, version: number, authToken: AuthorizationToken, applicationSpecific: boolean, projectId?: string, iModelId?: string): Promise<SettingsResult>;

  deleteUserSetting(type: string, version: number, authToken: AuthorizationToken, applicationSpecific: boolean, projectId?: string, iModelId?: string): Promise<SettingsResult>;

  saveSetting(settings: any, type: string, version: number, authToken: AuthorizationToken, applicationSpecific: boolean, projectId?: string, iModelId?: string): Promise<SettingsResult>;

  getSetting(type: string, version: number, authToken: AuthorizationToken, applicationSpecific: boolean, projectId?: string, iModelId?: string): Promise<SettingsResult>;

  deleteSetting(type: string, version: number, authToken: AuthorizationToken, applicationSpecific: boolean, projectId?: string, iModelId?: string): Promise<SettingsResult>;
}
