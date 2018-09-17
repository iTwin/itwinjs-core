/*---------------------------------------------------------------------------------------------
|  $Copyright: (c) 2017 Bentley Systems, Incorporated. All rights reserved. $
 *--------------------------------------------------------------------------------------------*/
/** @module Unified Selection */

import { IModelConnection } from "@bentley/imodeljs-frontend";
import { SelectionHandler } from "@bentley/presentation-frontend";

export default interface IUnifiedSelectionComponent {
  imodel: IModelConnection;
  rulesetId: string;
  selectionHandler?: SelectionHandler;
}
