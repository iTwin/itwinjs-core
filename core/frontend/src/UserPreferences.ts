/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/

/** @packageDocumentation
 * @module UserPreferences
 */

import { AccessToken, GuidString } from "@itwin/core-bentley";

/** Arguments supplied to [[UserPreferencesAccess]] methods to specify a single user preference.
 * @public
 */
export interface UserPreferenceKeyArgs {
  /** If supplied, indicates the user preference is defined at the level of this iTwin. */
  iTwinId?: GuidString;
  /** If supplied, indicates the user preference is defined at the level of this iModel. */
  iModelId?: GuidString;
  accessToken?: AccessToken;
  /** A unique namespace for [[key]]. */
  namespace?: string;
  /** The key that identifies the user preference. */
  key: string;
}

/** Arguments supplied to [[UserPreferencesAccess.save]].
 * @public
 */
export interface SaveUserPreferenceArgs extends UserPreferenceKeyArgs {
  /** The value to associate with the user preference. */
  content?: any;
}

/** User preferences provide a way to get, store and delete preferences for an application at
 * the level of an iTwin and/or iModel. They apply to a **single user**, as opposed to
 * [Workspace settings]($docs/learning/backend/Workspace.md) which are shared across multiple users.
 *
 * An object satisfying this interface can be supplied via [[IModelAppOptions.userPreferences]] when invoking [[IModelApp.startup]],
 * and accessed during the session via [[IModelApp.userPreferences]].
 * @public
 */
export interface UserPreferencesAccess {
  /** Obtain the value associated with a preference key.
   * If an iModelId is specified and a preference value is defined for that iModel, that value will be returned.
   * Otherwise, the method will attempt to look up the preference value at the iTwin level.
   * @returns the value corresponding to the preference key, or undefined if no such value was found.
   * @throws if an error occurs during retrieval.
   */
  get: (args: UserPreferenceKeyArgs) => Promise<any>;

  /** Deletes the specified preference by key, if it exists, within the level provided.
   * If both iTwinId and iModelId are provided, the key will be deleted from both levels.
   * If the key does not exist in either level provided, then this function will do nothing.
   * @throws if any error occurs when deleting the preference.
   */
  delete: (args: UserPreferenceKeyArgs) => Promise<void>;

  /** Saves the value of a preference, overwriting any pre-existing value.
   * If both iTwinId and iModelId are provided, the key will be saved to both levels.
   * @throws if any error occurs while saving.
   */
  save: (args: SaveUserPreferenceArgs) => Promise<void>;
}
