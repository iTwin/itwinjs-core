/*---------------------------------------------------------------------------------------------
|  $Copyright: (c) 2018 Bentley Systems, Incorporated. All rights reserved. $
 *--------------------------------------------------------------------------------------------*/
/** @module Hierarchies */

import { IModelConnection } from "@bentley/imodeljs-frontend";
/**
 * ECPresentation data provider
 */
export default interface IECPresentationDataProvider {
  /**
   * [[IModelConnection]] used by this data provider
   */
  readonly connection: IModelConnection;

  /**
   * Id of the ruleset used by this data provider
   */
  readonly rulesetId: string;
}
