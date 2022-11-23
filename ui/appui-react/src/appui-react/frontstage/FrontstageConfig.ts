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
  /** Usage type for this Frontstage. */
  readonly usage?: string;
  /** Frontstage version. Used to force saved layout reinitialization after changes to frontstage.
   * @note This value should be increased when changes are made to the Frontstage.
   * Increasing the value will make sure to reinitialize App layout instead of restoring to old layout.
   */
  readonly version: number;

  /** The top-left corner that shows tools typically used to query and modify content. */
  readonly contentManipulation?: WidgetConfig;
  /** The settings of the active tool. */
  readonly toolSettings?: WidgetConfig;
  /** The top-right corner that shows view navigation tools. */
  readonly viewNavigation?: WidgetConfig;
  /** The status bar of the application. */
  readonly statusBar?: WidgetConfig;

  /** Top panel of the application. */
  readonly topPanel?: PanelConfig;
  /** Left panel of the application. */
  readonly leftPanel?: PanelConfig;
  /** Right panel of the application. */
  readonly rightPanel?: PanelConfig;
  /** Bottom panel of the application. */
  readonly bottomPanel?: PanelConfig;
}
