/*---------------------------------------------------------------------------------------------
* Copyright (c) 2019 Bentley Systems, Incorporated. All rights reserved.
* Licensed under the MIT License. See LICENSE.md in the project root for license terms.
*--------------------------------------------------------------------------------------------*/
/** @module StatusBar */

import { WidgetControl } from "./WidgetControl";
import { ConfigurableCreateInfo, ConfigurableUiControlType } from "../configurableui/ConfigurableUiControl";

/** Status Bar Field type.
 * @public
 */
export type StatusBarFieldId = string | null;

/** Status Bar interface.
 * @public
 */
export interface IStatusBar {
  setOpenWidget(openWidget: StatusBarFieldId): void;
  setFooterMessages(footerMessages: any): void;
}

/** Status Bar Widget Control.
 * @public
 */
export abstract class StatusBarWidgetControl extends WidgetControl {
  constructor(info: ConfigurableCreateInfo, options: any) {
    super(info, options);
  }

  /** Gets the React node associated with this StatusBar Widget Control */
  public abstract getReactNode(statusBar: IStatusBar, isInFooterMode: boolean, openWidget: StatusBarFieldId): React.ReactNode;

  /** Gets the type of ConfigurableUiControl, which is 'StatusBarWidget' in this case */
  public getType(): ConfigurableUiControlType { return ConfigurableUiControlType.StatusBarWidget; }
}
