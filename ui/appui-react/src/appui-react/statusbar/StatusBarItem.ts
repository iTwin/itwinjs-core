/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
/** @packageDocumentation
 * @module StatusBar
 */

import type * as React from "react";
import type { AbstractStatusBarCustomItem, CommonStatusBarItem } from "@itwin/appui-abstract";

/** Describes the data needed to insert an item into the StatusBar.
 * @public
 */
export interface StatusBarItem extends AbstractStatusBarCustomItem {
  /** React node for the StatusBar item. */
  readonly reactNode: React.ReactNode;
}

/** StatusBarItem type guard.
 * @public
 */
export const isStatusBarItem = (item: CommonStatusBarItem): item is StatusBarItem => {
  return (!!(item as AbstractStatusBarCustomItem).isCustom) && ("reactNode" in item);
};
