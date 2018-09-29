/*---------------------------------------------------------------------------------------------
* Copyright (c) 2018 - present Bentley Systems, Incorporated. All rights reserved.
* Licensed under the MIT License. See LICENSE.md in the project root for license terms.
*--------------------------------------------------------------------------------------------*/
/** @module Unified Selection */

import { IModelConnection } from "@bentley/imodeljs-frontend";
import { SelectionHandler } from "@bentley/presentation-frontend";

export default interface IUnifiedSelectionComponent {
  imodel: IModelConnection;
  rulesetId: string;
  selectionHandler?: SelectionHandler;
}
