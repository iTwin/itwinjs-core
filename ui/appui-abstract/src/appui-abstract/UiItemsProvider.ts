/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
/* eslint-disable deprecation/deprecation */
/** @packageDocumentation
 * @module UiItemsProvider
 */

import { BackstageItem } from "./backstage/BackstageItem";
import { CommonStatusBarItem } from "./statusbar/StatusBarItem";
import { CommonToolbarItem, ToolbarOrientation, ToolbarUsage } from "./toolbars/ToolbarItem";
import { AbstractWidgetProps } from "./widget/AbstractWidgetProps";
import { AbstractZoneLocation, StagePanelLocation, StagePanelSection } from "./widget/StagePanel";

/** Describes interface of objects that want to provide UI component to the running IModelApp.
 * @public
 */
export interface UiItemsProvider {
  /** id of provider */
  readonly id: string;

  /** UiItemsManager calls following method to get items to populate specific toolbars */
  provideToolbarButtonItems?: (stageId: string, stageUsage: string, toolbarUsage: ToolbarUsage, toolbarOrientation: ToolbarOrientation, stageAppData?: any) => CommonToolbarItem[];
  /** UiItemsManager calls following method to augment base statusbar for stages that allow it. */
  provideStatusBarItems?: (stageId: string, stageUsage: string, stageAppData?: any) => CommonStatusBarItem[];
  /** UiItemsManager calls following method to augment backstage items. */
  provideBackstageItems?: () => BackstageItem[];
  /** UiItemsManager calls following method to augment Widget lists.
   * @note Returned widgets must provide unique `AbstractWidgetProps["id"]` to correctly save/restore App layout.
   */
  provideWidgets?: (stageId: string, stageUsage: string, location: StagePanelLocation, section?: StagePanelSection,
    zoneLocation?: AbstractZoneLocation, stageAppData?: any) => ReadonlyArray<AbstractWidgetProps>;
  /** Function called when the provider is unregistered via `ItemsManager.unregister` to allow provider to do cleanup. */
  onUnregister?: () => void;
}
