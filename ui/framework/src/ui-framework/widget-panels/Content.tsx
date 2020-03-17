/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
/** @packageDocumentation
 * @module Widget
 */
import * as React from "react";
import { WidgetStateContext, assert } from "@bentley/ui-ninezone";
import { useActiveFrontstageDef } from "../frontstage/Frontstage";
import { WidgetDef } from "../widgets/WidgetDef";

/** @internal */
export function WidgetContent() {
  const widget = useWidgetDef();
  return (
    <>
      {widget?.reactElement}
    </>
  );
}

/** @internal */
export function useWidgetDef(): WidgetDef | undefined {
  const widget = React.useContext(WidgetStateContext);
  assert(widget);
  const frontstage = useActiveFrontstageDef();
  const widgetDef = widget.activeTabId ? frontstage?.findWidgetDef(widget.activeTabId) : undefined;
  return widgetDef;
}
