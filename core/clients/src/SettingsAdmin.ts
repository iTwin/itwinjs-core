/*---------------------------------------------------------------------------------------------
|  $Copyright: (c) 2018 Bentley Systems, Incorporated. All rights reserved. $
 *--------------------------------------------------------------------------------------------*/
/** @module Settings */

import { AuthorizationToken } from "./Token";
import { ActivityLoggingContext } from "@bentley/bentleyjs-core";

/** Possible values for SettingsResults.status  */
export const enum SettingsStatus {
  SETTINGS_ERROR_BASE = 0x1b000,
  /** The specified setting was successfully saved, deleted, or retrieved. */
  Success = 0,
  /** Access to the specified setting was blocked. */
  AuthorizationError = SETTINGS_ERROR_BASE + 1,
  /** The Url for the setting is not properly formed. Check the characters in the setting name. */
  UrlError = SETTINGS_ERROR_BASE + 2,
  /** An invalid projectId was specified. */
  ProjectInvalid = SETTINGS_ERROR_BASE + 3,
  /** An invalid iModelId was specified. */
  IModelInvalid = SETTINGS_ERROR_BASE + 4,
  /** The setting specified for deletion or retrieval does not exist. */
  SettingNotFound = SETTINGS_ERROR_BASE + 5,
  /** The settings server malfunctioned.  */
  ServerError = SETTINGS_ERROR_BASE + 6,
  /** An unexpected error occurred.  */
  UnknownError = SETTINGS_ERROR_BASE + 8,
}

/** The result of the SettingsAdmin methods to save, retrieve, and delete settings.
 *  These are constructed by the SettingsAdmin methods and examined by applications.
 */
export class SettingsResult {
  /** Construct a new SettingsResult
   * @param status The result of the settings method.
   * @param errorMessage An error message that is sometimes returned by the server.
   * @param setting The object returned by the Settings method. Used only in the "get" methods.
   */
  constructor(public status: SettingsStatus, public errorMessage?: string, public setting?: any) {
  }
}

/** Methods available to save and get Settings objects on behalf of combinations of the Application, Project, iModel, and User */
export interface SettingsAdmin {

  /** Saves a user-specific settings object to the settings service.
   * @param settings The object to be saved. It is saved as a JSON string.
   * @param namespace A program-supplied namespace that is used to organize settings and prevent name collisions.
   * @param name The name of the setting. Acceptable characters are alphanumeric and the period character.
   * @param authToken The authorization token return from logging in.
   * @param applicationSpecific Specifies whether the setting is specific to the current application, or used by all applications.
   * @param projectId The wsgId of the Project, if the settings is specific to a project, otherwise undefined.
   * @param iModelId The wsgId of the iModel, if the setting is specific to an iModel, otherwise undefined. The projectId must be specified if iModelId is specified.
   * @return The result of the save operation. The setting member is undefined for save operations.
   */
  saveUserSetting(alctx: ActivityLoggingContext, settings: any, namespace: string, name: string, authToken: AuthorizationToken, applicationSpecific: boolean, projectId?: string, iModelId?: string): Promise<SettingsResult>;

  /** Retrieves a user-specific settings object from the settings service.
   * @param namespace A program-supplied namespace that is used to organize settings and prevent name collisions.
   * @param name The name of the setting. Acceptable characters are alphanumeric and the period character.
   * @param authToken The authorization token return from logging in.
   * @param applicationSpecific Specifies whether the setting is specific to the current application, or used by all applications.
   * @param projectId The wsgId of the Project, if the settings is specific to a project, otherwise undefined.
   * @param iModelId The wsgId of the iModel, if the setting is specific to an iModel, otherwise undefined. The projectId must be specified if iModelId is specified.
   * @return The result of the retrieval operation. The setting member contains the setting if the operation succeeds.
   */
  getUserSetting(alctx: ActivityLoggingContext, namespace: string, name: string, authToken: AuthorizationToken, applicationSpecific: boolean, projectId?: string, iModelId?: string): Promise<SettingsResult>;

  /** Deletes a user-specific settings object from the settings service.
   * @param namespace A program-supplied namespace that is used to organize settings and prevent name collisions.
   * @param name The name of the setting. Acceptable characters are alphanumeric and the period character.
   * @param authToken The authorization token return from logging in.
   * @param applicationSpecific Specifies whether the setting is specific to the current application, or used by all applications.
   * @param projectId The wsgId of the Project, if the settings is specific to a project, otherwise undefined.
   * @param iModelId The wsgId of the iModel, if the setting is specific to an iModel, otherwise undefined. The projectId must be specified if iModelId is specified.
   * @return The result of the save operation. The setting member is undefined for delete operations. If the setting specified for deletion
   * does not exists, the SettingsResult.status is SettingsStatus.SettingNotFound.
   */
  deleteUserSetting(alctx: ActivityLoggingContext, namespace: string, name: string, authToken: AuthorizationToken, applicationSpecific: boolean, projectId?: string, iModelId?: string): Promise<SettingsResult>;

  /** Saves a non-user-specific settings object to the settings service.
   * @param settings The object to be saved. It is saved as a JSON string.
   * @param namespace A program-supplied namespace that is used to organize settings and prevent name collisions.
   * @param name The name of the setting. Acceptable characters are alphanumeric and the period character.
   * @param authToken The authorization token return from logging in.
   * @param applicationSpecific Specifies whether the setting is specific to the current application, or used by all applications.
   * @param projectId The wsgId of the Project, if the settings is specific to a project, otherwise undefined.
   * @param iModelId The wsgId of the iModel, if the setting is specific to an iModel, otherwise undefined. The projectId must be specified if iModelId is specified.
   * @return The result of the save operation. The setting member is undefined for save operations.
   * @note The logged in user must have the appropriate permissions to save a non-user-specific setting.
   */
  saveSetting(alctx: ActivityLoggingContext, settings: any, namespace: string, name: string, authToken: AuthorizationToken, applicationSpecific: boolean, projectId?: string, iModelId?: string): Promise<SettingsResult>;

  /** Retrieves a non-user-specific settings object from the settings service.
   * @param namespace A program-supplied namespace that is used to organize settings and prevent name collisions.
   * @param name The name of the setting. Acceptable characters are alphanumeric and the period character.
   * @param authToken The authorization token return from logging in.
   * @param applicationSpecific Specifies whether the setting is specific to the current application, or used by all applications.
   * @param projectId The wsgId of the Project, if the settings is specific to a project, otherwise undefined.
   * @param iModelId The wsgId of the iModel, if the setting is specific to an iModel, otherwise undefined. The projectId must be specified if iModelId is specified.
   * @return The result of the retrieval operation. The setting member contains the setting if the operation succeeds.
   */
  getSetting(alctx: ActivityLoggingContext, namespace: string, name: string, authToken: AuthorizationToken, applicationSpecific: boolean, projectId?: string, iModelId?: string): Promise<SettingsResult>;

  /** Deletes a non-user-specific settings object from the settings service.
   * @param namespace A program-supplied namespace that is used to organize settings and prevent name collisions.
   * @param name The name of the setting. Acceptable characters are alphanumeric and the period character.
   * @param authToken The authorization token return from logging in.
   * @param applicationSpecific Specifies whether the setting is specific to the current application, or used by all applications.
   * @param projectId The wsgId of the Project, if the settings is specific to a project, otherwise undefined.
   * @param iModelId The wsgId of the iModel, if the setting is specific to an iModel, otherwise undefined. The projectId must be specified if iModelId is specified.
   * @return The result of the save operation. The setting member is undefined for delete operations. If the setting specified for deletion
   * does not exists, the SettingsResult.status is SettingsStatus.SettingNotFound.
   * @note The logged in user must have the appropriate permissions to delete a non-user-specific setting.
   */
  deleteSetting(alctx: ActivityLoggingContext, namespace: string, name: string, authToken: AuthorizationToken, applicationSpecific: boolean, projectId?: string, iModelId?: string): Promise<SettingsResult>;
}
