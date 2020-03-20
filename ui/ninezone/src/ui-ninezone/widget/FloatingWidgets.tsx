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
import { assert } from "../base/assert";

/** This component renders all floating widgets.
 * @internal
 */
export const FloatingWidgets = React.memo(function FloatingWidgets() { // tslint:disable-line: variable-name no-shadowed-variable
  const floatingWidgets = React.useContext(FloatingWidgetsStateContext);
  const widgets = React.useContext(WidgetsStateContext);
  const floatingWidgetsValues = Object.values(floatingWidgets);
  return (
    <>
      {floatingWidgetsValues.map((floatingWidget) => {
        assert(floatingWidget);
        const widget = widgets[floatingWidget.id];
        return <FloatingWidget
          floatingWidget={floatingWidget}
          key={floatingWidget.id}
          widget={widget}
        />;
      })}
    </>
  );
});
