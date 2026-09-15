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

/** Selectively overrides applied aspects of a view's [[DisplayStyleState]] when displaying
 * a specific [[IModelDisplayReference]].
 * @see [[IModelDisplayReference.overrides]] to control the overrides for a specific iModel reference.
 * @beta
 */
export interface IModelDisplayOverrides {
  /** @internal */
  readonly [_implementationProhibited]: unknown;

  /** Alters specific view flags when displaying the iModel reference. */
  viewFlags: ViewFlagOverrides;
  /** Event dispatched just after assignment to [[viewFlags]]. */
  readonly onViewFlagsChanged: BeEvent<() => void>;

  /** If defined, replaces the display style's clip style. */
  clipStyle?: ClipStyle;
  /** Event dispatched just after assignment to [[clipStyle]]. */
  readonly onClipStyleChanged: BeEvent<() => void>;
}

/** Selectively overrides aspects of a [[SpatialViewState]]'s display style when displaying a
 * specific [[SpatialIModelDisplayReference]].
 * @beta
 */
export interface SpatialIModelDisplayOverrides extends IModelDisplayOverrides {
  /** If defined, replaces the display style's hidden line settings. */
  hiddenLineSettings?: HiddenLine.Settings;
  /** Event dispatched just after assignment to [[hiddenLineSettings]]. */
  readonly onHiddenLineSettingsChanged: BeEvent<() => void>;
}

/** JSON representation of [[IModelDisplayOverrides]].
 * @beta
 */
export type IModelDisplayOverridesProps = Partial<Pick<IModelDisplayOverrides, "viewFlags" | "clipStyle">>;

/** JSON representation of [[SpatialIModelDisplayOverrides]].
 * @beta
 */
export type SpatialIModelDisplayOverridesProps = IModelDisplayOverridesProps & Pick<SpatialIModelDisplayOverrides, "hiddenLineSettings">;
