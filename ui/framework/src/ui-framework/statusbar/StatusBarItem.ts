/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
/** @module StatusBar */

import * as React from "react";
import { AbstractStatusBarCustomItem, CommonStatusBarItem, StatusBarItemType } from "@bentley/ui-abstract";

/** Describes the data needed to insert an item into the StatusBar.
 * @beta
 */
export interface StatusBarItem extends AbstractStatusBarCustomItem {
  /** React node for the StatusBar item. */
  readonly reactNode: React.ReactNode;
}

/** StatusBarItem type guard.
 * @alpha
 */
export const isStatusBarItem = (item: CommonStatusBarItem): item is StatusBarItem => {
  return item.type === StatusBarItemType.CustomItem && ("reactNode" in item);
};
