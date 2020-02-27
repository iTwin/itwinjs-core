/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
/** @packageDocumentation
 * @module Core
 */

import { SelectionHandler } from "@bentley/presentation-frontend";
import { IModelConnection } from "@bentley/imodeljs-frontend";

/**
 * An interface for all unified selection components
 * @public
 */
export interface IUnifiedSelectionComponent {
  /** [[IModelConnection]] used by this data provider */
  readonly imodel: IModelConnection;

  /** Selection handler used by this component */
  readonly selectionHandler?: SelectionHandler;
}
