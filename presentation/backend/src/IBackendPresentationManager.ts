/*---------------------------------------------------------------------------------------------
|  $Copyright: (c) 2017 Bentley Systems, Incorporated. All rights reserved. $
 *--------------------------------------------------------------------------------------------*/
/** @module Core */

import { IDisposable } from "@bentley/bentleyjs-core";
import { IModelDb } from "@bentley/imodeljs-backend";
import { IPresentationManager, IRulesetVariablesManager, IRulesetManager } from "@bentley/presentation-common";

/**
 * Properties that can be used to configure [[IBackendPresentationManager]]
 */
export interface Props {
  /**
   * A list of directories containing presentation rulesets.
   */
  rulesetDirectories?: string[];

  /**
   * A list of directories containing locale-specific localized
   * string files (in simplified i18next v3 format)
   */
  localeDirectories?: string[];

  /**
   * Sets the active locale to use when localizing presentation-related
   * strings. It can later be changed through [[PresentationManager]].
   */
  activeLocale?: string;
}

/**
 * Backend Presentation manager which pulls the presentation data from
 * an iModel.
 */
export default interface IBackendPresentationManager extends IPresentationManager<IModelDb>, IDisposable {
  /**
   * Get rulesets manager
   * @param clientId Id of the client requesting rulesets
   */
  rulesets(clientId?: string): IRulesetManager;

  /**
   * Get ruleset variables manager for specific ruleset
   * @param rulesetId Id of the ruleset to get variables manager for
   * @param clientId Id of the client requesting variables manager
   */
  vars(rulesetId: string, clientId?: string): IRulesetVariablesManager;
}
