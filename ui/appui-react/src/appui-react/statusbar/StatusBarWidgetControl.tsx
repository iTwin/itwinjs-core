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

/** Status Bar Widget Control.
 * @public
 */
export abstract class StatusBarWidgetControl extends WidgetControl {
  constructor(info: ConfigurableCreateInfo, options: any) {
    super(info, options);
  }

  /** Gets the React node associated with this StatusBar Widget Control */
  public abstract getReactNode(): React.ReactNode;

  /** Gets the type of ConfigurableUiControl, which is 'StatusBarWidget' in this case */
  public override getType(): ConfigurableUiControlType { return ConfigurableUiControlType.StatusBarWidget; }
}
