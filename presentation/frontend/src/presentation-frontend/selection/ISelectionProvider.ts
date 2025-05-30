/*---------------------------------------------------------------------------------------------
 * Copyright (c) Bentley Systems, Incorporated. All rights reserved.
 * See LICENSE.md in the project root for license terms and full copyright notice.
 *--------------------------------------------------------------------------------------------*/
/* eslint-disable @typescript-eslint/no-deprecated */
/** @packageDocumentation
 * @module UnifiedSelection
 */

import { IModelConnection } from "@itwin/core-frontend";
import { KeySet } from "@itwin/presentation-common";
import { SelectionChangeEvent } from "./SelectionChangeEvent.js";

/**
 * Selection provider interface which provides main selection and sub-selection.
 * @public
 * @deprecated in 5.0. Use `SelectionStorage` from [@itwin/unified-selection](https://github.com/iTwin/presentation/blob/master/packages/unified-selection/README.md) package instead.
 */
export interface ISelectionProvider {
  /** An event that's fired when selection changes */
  selectionChange: SelectionChangeEvent;

  /** Get the selection stored in the provider.
   * @param imodel iModel connection which the selection is associated with.
   * @param level Level of the selection (see [selection levels documentation section]($docs/presentation/unified-selection/index#selection-levels))
   */
  getSelection(imodel: IModelConnection, level: number): Readonly<KeySet>;
}
