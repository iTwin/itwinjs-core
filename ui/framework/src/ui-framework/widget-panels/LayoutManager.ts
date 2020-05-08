/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
/** @packageDocumentation
 * @module Frontstage
 */

import { WidgetDef } from "../widgets/WidgetDef";
import { UiEvent } from "@bentley/ui-core";

/** @internal */
export interface LayoutManagerDispatchActionEventArgs {
  widgetId: WidgetDef["id"];
  action: "show" | "expand";
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
    this.onLayoutManagerDispatchActionEvent.emit({ widgetId, action: "show" });
  }

  /** Expands widget of active frontstage. */
  public expandWidget(widgetId: WidgetDef["id"]) {
    this.onLayoutManagerDispatchActionEvent.emit({ widgetId, action: "expand" });
  }
}
