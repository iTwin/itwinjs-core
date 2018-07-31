/*---------------------------------------------------------------------------------------------
| $Copyright: (c) 2018 Bentley Systems, Incorporated. All rights reserved. $
 *--------------------------------------------------------------------------------------------*/
/** @module StatusBar */

import WidgetControl from "./WidgetControl";
import { ConfigurableCreateInfo } from "./ConfigurableUiControl";

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
}
