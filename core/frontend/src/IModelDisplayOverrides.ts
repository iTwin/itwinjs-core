/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
/** @packageDocumentation
 * @module Views
 */

import { BeEvent } from "@itwin/core-bentley";
import { _implementationProhibited } from "./common/internal/Symbols";
import { ClipStyle, HiddenLine, ViewFlagOverrides } from "@itwin/core-common";

/** Selectively overrides applied to a view's [[DisplayStyleState]] when displaying
 * a specific [[IModelDisplayReference]].
 * @beta
 */
export interface IModelDisplayOverrides {
  readonly [_implementationProhibited]: unknown;

  viewFlags: ViewFlagOverrides;
  readonly onViewFlagsChanged: BeEvent<() => void>;

  clipStyle?: ClipStyle;
  readonly onClipStyleChanged: BeEvent<() => void>;
}

export interface SpatialIModelDisplayOverrides extends IModelDisplayOverrides {
  hiddenLineSettings?: HiddenLine.Settings;
  readonly onHiddenLineSettingsChanged: BeEvent<() => void>;
}

export type IModelDisplayOverridesProps = Partial<Pick<IModelDisplayOverrides, "viewFlags" | "clipStyle">>;

export type SpatialIModelDisplayOverridesProps = IModelDisplayOverridesProps & Pick<SpatialIModelDisplayOverrides, "hiddenLineSettings">;
