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

/** Status Bar Widget Control render prop arguments.
 * @public
 */
export interface StatusBarWidgetControlArgs {
  /** Describes whether the footer is in widget or footer mode. */
  isInFooterMode: boolean;
  /** Currently open widget or null if no widget is open. */
  openWidget: StatusBarFieldId;
  /** Function called when the widget is being opened or closed. */
  onOpenWidget: (widget: StatusBarFieldId) => void;
  /** Element reference to which the toast will animate out to. */
  toastTargetRef: React.Ref<HTMLElement>;
}

/** Status Bar Widget Control.
 * @public
 */
export abstract class StatusBarWidgetControl extends WidgetControl {
  constructor(info: ConfigurableCreateInfo, options: any) {
    super(info, options);
  }

  /** Gets the React node associated with this StatusBar Widget Control */
  public abstract getReactNode(args: StatusBarWidgetControlArgs): React.ReactNode;

  /** Gets the type of ConfigurableUiControl, which is 'StatusBarWidget' in this case */
  public getType(): ConfigurableUiControlType { return ConfigurableUiControlType.StatusBarWidget; }
}
