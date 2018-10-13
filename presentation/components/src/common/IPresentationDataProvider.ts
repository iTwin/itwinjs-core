/*---------------------------------------------------------------------------------------------
* Copyright (c) 2018 Bentley Systems, Incorporated. All rights reserved.
* Licensed under the MIT License. See LICENSE.md in the project root for license terms.
*--------------------------------------------------------------------------------------------*/
/** @module Core */

import { IModelConnection } from "@bentley/imodeljs-frontend";

/**
 * Presentation data provider
 */
export default interface IPresentationDataProvider {
  /**
   * [[IModelConnection]] used by this data provider
   */
  readonly connection: IModelConnection;

  /**
   * Id of the ruleset used by this data provider
   */
  readonly rulesetId: string;
}
