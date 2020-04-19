/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
/** @packageDocumentation
 * @module Widget
 */
import * as React from "react";
import { TabIdContext } from "@bentley/ui-ninezone";
import { useActiveFrontstageDef } from "../frontstage/Frontstage";
import { WidgetDef } from "../widgets/WidgetDef";

/** @internal */
export function WidgetContent() {
  const widget = useWidgetDef();
  return (
    <>
      {widget?.reactNode}
    </>
  );
}

/** @internal */
export function useWidgetDef(): WidgetDef | undefined {
  const tabId = React.useContext(TabIdContext);
  const frontstage = useActiveFrontstageDef();
  const widgetDef = frontstage?.findWidgetDef(tabId);
  return widgetDef;
}
