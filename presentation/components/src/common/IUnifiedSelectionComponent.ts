/*---------------------------------------------------------------------------------------------
* Copyright (c) 2019 Bentley Systems, Incorporated. All rights reserved.
* Licensed under the MIT License. See LICENSE.md in the project root for license terms.
*--------------------------------------------------------------------------------------------*/
/** @module Unified Selection */

import { SelectionHandler } from "@bentley/presentation-frontend";
import { IPresentationDataProvider } from "./IPresentationDataProvider";

/**
 * An interface for all unified selection components
 * @public
 */
export interface IUnifiedSelectionComponent extends IPresentationDataProvider {
  selectionHandler?: SelectionHandler;
}
