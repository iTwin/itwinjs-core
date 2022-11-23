/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
/* eslint-disable deprecation/deprecation */
/** @packageDocumentation
 * @module Frontstage
 */

import { WidgetConfig } from "../widgets/WidgetConfig";
import { StagePanelMaxSizeSpec } from "./StagePanel";
import { StagePanelState as StagePanelState } from "./StagePanelDef";

/** Configuration from which a panel is created.
 * @beta
 */
export interface PanelConfig {
  /** Default Panel state. Controls how the panel is initially displayed. Defaults to StagePanelState.Open. */
  readonly defaultState?: StagePanelState;
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
export type PanelSectionConfig = ReadonlyArray<WidgetConfig>;

/** Configuration from which panel sections are created.
 * @beta
 */
export interface PanelSectionsConfig {
  /** Configuration of the `start` section. */
  readonly start?: PanelSectionConfig;
  /** Configuration of the `end` section. */
  readonly end?: PanelSectionConfig;
}
