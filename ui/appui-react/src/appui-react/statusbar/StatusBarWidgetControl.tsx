/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
/** @packageDocumentation
 * @module StatusBar
 */

import { ConfigurableCreateInfo, ConfigurableUiControlType } from "../configurableui/ConfigurableUiControl";
import { WidgetControl } from "../widgets/WidgetControl";

/** Status Bar Field type.
 * @public
 */
export type StatusBarFieldId = string | null;

/** Status Bar Widget Control render prop arguments.
 * @public
 */
export interface StatusBarWidgetControlArgs {
  /** Describes whether the footer is in widget or footer mode.
   * @deprecated In upcoming version, widget mode will be removed. Consider this parameter to always be true.
  */
  isInFooterMode: boolean;
  /** Currently open widget or null if no widget is open.
   * @deprecated In upcoming versions, this will be removed. Field will be have the freedom of handling their dialog behavior however they like.
  */
  openWidget: StatusBarFieldId;
  /** Function called when the widget is being opened or closed.
   * @deprecated In upcoming versions, this will be removed. Field will be have the freedom of handling their dialog behavior however they like.
  */
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
  public override getType(): ConfigurableUiControlType { return ConfigurableUiControlType.StatusBarWidget; }
}
