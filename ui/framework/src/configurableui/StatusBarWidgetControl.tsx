/*---------------------------------------------------------------------------------------------
* Copyright (c) 2018 - present Bentley Systems, Incorporated. All rights reserved.
* Licensed under the MIT License. See LICENSE.md in the project root for license terms.
*--------------------------------------------------------------------------------------------*/
/** @module StatusBar */

import WidgetControl from "./WidgetControl";
import { ConfigurableCreateInfo, ConfigurableUiControlType } from "./ConfigurableUiControl";

/** Status Bar Field type.
 */
export type StatusBarFieldId = string | null;

/** Status Bar interface.
 */
export interface IStatusBar {
  setOpenWidget(openWidget: StatusBarFieldId): void;
  setFooterMessages(footerMessages: any): void;
}

/** Status Bar Widget Control.
 */
export abstract class StatusBarWidgetControl extends WidgetControl {
  constructor(info: ConfigurableCreateInfo, options: any) {
    super(info, options);
  }

  public abstract getReactNode(statusBar: IStatusBar, isInFooterMode: boolean, openWidget: StatusBarFieldId): React.ReactNode;

  public getType(): ConfigurableUiControlType { return ConfigurableUiControlType.StatusBarWidget; }
}
