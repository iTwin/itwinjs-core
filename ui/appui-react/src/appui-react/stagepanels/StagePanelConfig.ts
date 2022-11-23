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

/** Configuration from which a stage panel is created.
 * @beta
 */
export interface StagePanelConfig {
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
  readonly sections?: StagePanelSectionsConfig;
}

/** Configuration from which a stage panel section is created.
 * @beta
 */
export type StagePanelSectionConfig = ReadonlyArray<WidgetConfig>;

/** Configuration from which stage panel sections are created.
 * @beta
 */
export interface StagePanelSectionsConfig {
  /** Configuration of the `start` section. */
  readonly start?: StagePanelSectionConfig;
  /** Configuration of the `end` section. */
  readonly end?: StagePanelSectionConfig;
}
