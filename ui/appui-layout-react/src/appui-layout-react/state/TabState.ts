/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
/** @packageDocumentation
 * @module Base
 */

import { IconSpec, SizeProps } from "@itwin/core-react";
import { PanelSide } from "../widget-panels/Panel";

/** `WidgetDef` is equivalent structure in `appui-react`.
 * @internal
 */
export interface TabState {
  readonly id: string;
  readonly label: string;
  readonly iconSpec?: IconSpec;
  readonly preferredFloatingWidgetSize?: SizeProps;
  readonly preferredPanelWidgetSize?: "fit-content";
  readonly allowedPanelTargets?: PanelSide[];
  readonly canPopout?: boolean;
  readonly userSized?: boolean;
  readonly isFloatingStateWindowResizable?: boolean;
  readonly hideWithUiWhenFloating?: boolean;
}
