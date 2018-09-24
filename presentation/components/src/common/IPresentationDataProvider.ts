/*---------------------------------------------------------------------------------------------
|  $Copyright: (c) 2018 Bentley Systems, Incorporated. All rights reserved. $
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
