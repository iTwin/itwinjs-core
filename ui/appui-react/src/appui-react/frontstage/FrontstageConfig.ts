/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
/** @packageDocumentation
 * @module Frontstage
 */

import { CommonProps } from "@itwin/core-react";
import { ContentGroup, ContentGroupProvider } from "../content/ContentGroup";
import { ToolItemDef } from "../shared/ToolItemDef";
import { PanelConfig } from "../stagepanels/PanelConfig";
import { WidgetConfig } from "../widgets/WidgetConfig";

/** Configuration from which a frontstage is created.
 * @beta
 */
export interface FrontstageConfig extends CommonProps {
  /** Id for the Frontstage */
  readonly id: string;
  /** Tool that is started once the Frontstage is activated */
  readonly defaultTool: ToolItemDef;
  /** The Content Group providing the Content Views */
  readonly contentGroup: ContentGroup | ContentGroupProvider;
  /** Id of the Content View to be activated initially */
  readonly defaultContentId?: string;
  /** Any application data to attach to this Frontstage. */
  readonly applicationData?: any;
  /** Usage type for this Frontstage. */
  readonly usage?: string;
  /** Frontstage version. Used to force saved layout reinitialization after changes to frontstage.
   * @note This value should be increased when changes are made to Frontstage.
   * Increasing the value will make sure to reinitialize App layout instead of restoring to old layout.
   * Version increase is required when widgets are added/removed.
   */
  readonly version?: number;
  /** if isIModelIndependent then frontstage is independent from any iModel. */
  readonly isIModelIndependent?: boolean;

  /** The Zone in the top-left corner that shows tools typically used to query and modify content. */
  readonly contentManipulation?: WidgetConfig;
  /** The Zone the that shows settings for the active tool. */
  readonly toolSettings?: WidgetConfig;
  /** The Zone in the top-right corner that shows view navigation tools. */
  readonly viewNavigation?: WidgetConfig;
  /** The status bar Zone shown as the application footer. */
  readonly statusBar?: WidgetConfig;

  /** Top panel of the AppUi. */
  readonly topPanel?: PanelConfig;
  /** Left panel of the AppUi. */
  readonly leftPanel?: PanelConfig;
  /** Right panel of the AppUi. */
  readonly rightPanel?: PanelConfig;
  /** Bottom panel of the AppUi. */
  readonly bottomPanel?: PanelConfig;
}
