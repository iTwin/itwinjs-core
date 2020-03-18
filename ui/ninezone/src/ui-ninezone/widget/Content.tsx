/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
/** @module Widget */

import * as React from "react";
import { WidgetContentNodeContext } from "../widget-panels/Panels";
import "./Content.scss";

/** @internal */
export const WidgetContentComponent = React.memo(function WidgetContentComponent() { // tslint:disable-line: no-shadowed-variable variable-name
  const widgetContent = React.useContext(WidgetContentNodeContext);
  return (
    <div
      className="nz-widget-content"
    >
      {widgetContent}
    </div>
  );
});
