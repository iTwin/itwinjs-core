/*---------------------------------------------------------------------------------------------
* Copyright (c) 2019 Bentley Systems, Incorporated. All rights reserved.
* Licensed under the MIT License. See LICENSE.md in the project root for license terms.
*--------------------------------------------------------------------------------------------*/
/** @module StatusBar */

import * as React from "react";

/** Enum for StatusBar section.
 * @beta
 */
export enum StatusBarSection {
  Left,
  Center,
  Right,
}

/** Describes the data needed to insert an item into the StatusBar.
 * @beta
 */
export interface StatusBarItem {
  /** Required unique id of the item. To ensure uniqueness it is suggested that a namespace prefix be used. */
  readonly id: string;
  /** Section within the StatusBar. */
  readonly section: StatusBarSection;
  /** Priority within a section (recommend using values 1 through 100). */
  readonly itemPriority: number;
  /** React component for the StatusBar item. */
  readonly component: React.ReactNode;
}

/** Type for StatusBar Item Id
 * @beta
 */
export type StatusBarItemId = StatusBarItem["id"];
