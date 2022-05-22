/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
/** @packageDocumentation
 * @module Widget
 */

import * as React from "react";
import { FrontstageManager } from "../frontstage/FrontstageManager";
import { StatusBarComposer } from "../statusbar/StatusBarComposer";
import { StatusBarWidgetControl } from "../statusbar/StatusBarWidgetControl";

/**
 * StatusBarWidgetComposerControl provides status bar to specified [[Frontstage]] that allows status bar items to be populated
 * via UiItemsProviders. See [[StandardStatusbarItemsProvider]] that can be used to populate this status bar with a common
 * set of status fields.
 * @example
 * ```
 *       statusBar={
 *         <Zone
 *           widgets={
 *             [
 *               <Widget isStatusBar={true} control={StatusBarWidgetComposerControl}  />
 *             ]}
 *         />
 *       }
 * ```
 * @public
 */
export class StatusBarWidgetComposerControl extends StatusBarWidgetControl {
  public static controlId = "uifw:StatusBarWidgetComposerControl";
  public readonly id = StatusBarWidgetComposerControl.controlId;

  public getReactNode(): React.ReactNode {
    return (
      <StatusBarComposer key={FrontstageManager.activeFrontstageId} items={[]} />
    );
  }
}
