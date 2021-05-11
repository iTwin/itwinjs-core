/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
/** @packageDocumentation
 * @module Widget
 */

import "./SendBack.scss";
import classnames from "classnames";
import * as React from "react";
import { NineZoneDispatchContext, useLabel } from "../base/NineZone";
import { FloatingWidgetContext } from "./FloatingWidget";
import { assert } from "@bentley/bentleyjs-core";

/** @internal */
export const SendBack = React.memo(function SendBack() { // eslint-disable-line @typescript-eslint/naming-convention, no-shadow
  const floatingWidget = React.useContext(FloatingWidgetContext);
  const dispatch = React.useContext(NineZoneDispatchContext);
  const title = useLabel("sendWidgetHomeTitle");
  assert(!!floatingWidget);
  const className = classnames(
    "nz-widget-sendBack",
    floatingWidget.home.side && `nz-${floatingWidget.home.side}`,
  );
  return (
    <button
      className={className}
      onClick={() => {
        dispatch({
          type: "FLOATING_WIDGET_SEND_BACK",
          id: floatingWidget.id,
        });
      }}
      title={title}
    >
      <i />
    </button >
  );
});
