/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
/** @module Core */

import { SelectionHandler } from "@bentley/presentation-frontend";
import { IPresentationDataProvider } from "./IPresentationDataProvider";

/**
 * An interface for all unified selection components
 * @public
 */
export interface IUnifiedSelectionComponent extends IPresentationDataProvider {
  selectionHandler?: SelectionHandler;
}
