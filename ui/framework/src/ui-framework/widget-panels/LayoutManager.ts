/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
/** @packageDocumentation
 * @module Frontstage
 */

import { WidgetDef } from "../widgets/WidgetDef";
import { UiEvent } from "@bentley/ui-core";
import { FrontstageDef } from "../frontstage/FrontstageDef";

/** @internal */
export type LayoutManagerDispatchActionEventArgs =
  LayoutManagerShowWidgetAction |
  LayoutManagerExpandWidgetAction |
  LayoutManagerRestoreLayoutAction;

interface LayoutManagerShowWidgetAction {
  widgetId: WidgetDef["id"];
  type: "show";
}

interface LayoutManagerExpandWidgetAction {
  widgetId: WidgetDef["id"];
  type: "expand";
}

interface LayoutManagerRestoreLayoutAction {
  frontstageId: FrontstageDef["id"];
  type: "restore";
}

/** @internal */
export class LayoutManagerDispatchActionEvent extends UiEvent<LayoutManagerDispatchActionEventArgs> { }

/** Layout manager used to modify App layout.
 * @beta
 */
export class LayoutManager {
  /** @internal */
  public readonly onLayoutManagerDispatchActionEvent = new LayoutManagerDispatchActionEvent();

  /** Makes widget of active frontstage visible to the user.
   * I.e. opens the stage panel or brings floating widget to front of the screen.
   */
  public showWidget(widgetId: WidgetDef["id"]) {
    this.onLayoutManagerDispatchActionEvent.emit({ type: "show", widgetId });
  }

  /** Expands widget of active frontstage. */
  public expandWidget(widgetId: WidgetDef["id"]) {
    this.onLayoutManagerDispatchActionEvent.emit({ type: "expand", widgetId });
  }

  /** Restores frontstage layout and deletes saved layout settings. */
  public restoreLayout(frontstageId: FrontstageDef["id"]) {
    this.onLayoutManagerDispatchActionEvent.emit({ type: "restore", frontstageId });
  }
}
