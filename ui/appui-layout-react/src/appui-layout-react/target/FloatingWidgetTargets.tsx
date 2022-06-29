/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
/** @packageDocumentation
 * @module Widget
 */

import "./FloatingWidgetTargets.scss";
import * as React from "react";
import { WidgetTarget } from "./WidgetTarget";
import { WidgetIdContext } from "../widget/Widget";
import { TargetContainer } from "./TargetContainer";

/** @internal */
export const FloatingWidgetTargets = React.memo(function FloatingWidgetTargets() { // eslint-disable-line @typescript-eslint/naming-convention, no-shadow
  const widgetId = React.useContext(WidgetIdContext);
  return (
    <TargetContainer
      className="nz-target-floatingWidgetTargets"
      direction="horizontal"
    >
      <WidgetTarget widgetId={widgetId} />
    </TargetContainer>
  );
});
