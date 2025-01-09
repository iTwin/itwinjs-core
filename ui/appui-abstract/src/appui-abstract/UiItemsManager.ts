/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
/* eslint-disable @typescript-eslint/no-deprecated */
/** @packageDocumentation
 * @module UiItemsProvider
 */

import { BeEvent, Logger, MarkRequired } from "@itwin/core-bentley";
import { BackstageItem } from "./backstage/BackstageItem";
import { CommonStatusBarItem } from "./statusbar/StatusBarItem";
import { CommonToolbarItem, ToolbarOrientation, ToolbarUsage } from "./toolbars/ToolbarItem";
import { AbstractWidgetProps } from "./widget/AbstractWidgetProps";
import { AbstractZoneLocation, StagePanelLocation, StagePanelSection } from "./widget/StagePanel";
import { UiItemsProvider } from "./UiItemsProvider";

const loggerCategory = "appui-abstract.UiItemsManager";
/** Action taken by the application on item provided by a UiItemsProvider
 * @public @deprecated in 3.2. This was only used by the previously removed UiItemsArbiter.
 */
export enum UiItemsApplicationAction {
  /** Allow the change to the item */
  Allow,
  /** Disallow the change to the item */
  Disallow,
  /** Update the item during the change */
  Update,
}
