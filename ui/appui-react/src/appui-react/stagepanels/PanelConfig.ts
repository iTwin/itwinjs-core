/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
/* eslint-disable deprecation/deprecation */
/** @packageDocumentation
 * @module Frontstage
 */

import * as React from "react";
import { WidgetConfig } from "../widgets/WidgetConfig";
import { StagePanelMaxSizeSpec } from "./StagePanel";
import { StagePanelState as StagePanelState } from "./StagePanelDef";

/** Configuration from which a panel is created.
 * @beta
 */
export interface PanelConfig {
  /** Any application data to attach to this Panel. */
  readonly applicationData?: any;
  /** Default Panel state. Controls how the panel is initially displayed. Defaults to StagePanelState.Open. */
  readonly defaultState?: StagePanelState;
  /** Panel header. */
  readonly header?: React.ReactNode;
  /** Maximum size of the panel. */
  readonly maxSize?: StagePanelMaxSizeSpec;
  /** Minimum size of the panel. */
  readonly minSize?: number;
  /** Indicates whether the panel is pinned. Defaults to true. */
  readonly pinned?: boolean;
  /** Indicates whether the panel is resizable. Defaults to true. */
  readonly resizable?: boolean;
  /** Default size of the panel. */
  readonly size?: number;
  /** Configuration of the panel sections. */
  readonly sections?: PanelSectionsConfig;
}

/** Configuration from which a panel section is created.
 * @beta
 */
export interface PanelSectionConfig {
  /** Widget configurations of this section. */
  readonly widgets: ReadonlyArray<WidgetConfig>;
  /** Any application data to attach to this Zone. */
  readonly applicationData?: any;
}

/** Configuration from which panel sections are created.
 * @beta
 */
export interface PanelSectionsConfig {
  /** Configuration of the `start` section. */
  readonly start?: PanelSectionConfig;
  /** Configuration of the `end` section. */
  readonly end?: PanelSectionConfig;
}
