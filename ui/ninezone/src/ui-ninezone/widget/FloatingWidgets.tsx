/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
/** @packageDocumentation
 * @module Widget
 */

import * as React from "react";
import { FloatingWidgetsStateContext, WidgetsStateContext } from "../base/NineZone";
import { FloatingWidget } from "./FloatingWidget";
import { FloatingTab } from "./FloatingTab";

/** This component renders all floating widgets.
 * @internal
 */
export const FloatingWidgets = React.memo(function FloatingWidgets() { // eslint-disable-line @typescript-eslint/naming-convention, no-shadow
  const floatingWidgets = React.useContext(FloatingWidgetsStateContext);
  const widgets = React.useContext(WidgetsStateContext);
  return (
    <>
      {floatingWidgets.allIds.map((floatingWidgetId) => {
        const widget = widgets[floatingWidgetId];
        const floatingWidget = floatingWidgets.byId[floatingWidgetId];
        return <FloatingWidget
          floatingWidget={floatingWidget}
          key={floatingWidgetId}
          widget={widget}
        />;
      })}
      <FloatingTab />
    </>
  );
});
