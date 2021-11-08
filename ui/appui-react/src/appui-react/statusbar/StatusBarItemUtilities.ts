/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
/** @packageDocumentation
 * @module StatusBar
 */

import * as React from "react";
import { StatusBarSection } from "@itwin/appui-abstract";
import { StatusBarItem } from "./StatusBarItem";

/** Utility methods for creating and maintaining StatusBar items.
 * @public
 */
export class StatusBarItemUtilities {

  /** Creates a StatusBar item */
  public static createStatusBarItem = (id: string, section: StatusBarSection, itemPriority: number, reactNode: React.ReactNode, itemProps?: Partial<StatusBarItem>): StatusBarItem => ({
    id, section, itemPriority, reactNode,
    isCustom: true,
    ...itemProps ? itemProps : {},
  });

}
