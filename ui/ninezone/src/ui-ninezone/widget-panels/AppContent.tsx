/*---------------------------------------------------------------------------------------------
* Copyright (c) 2019 Bentley Systems, Incorporated. All rights reserved.
* Licensed under the MIT License. See LICENSE.md in the project root for license terms.
*--------------------------------------------------------------------------------------------*/
/** @module WidgetPanels */

import * as React from "react";
import { WidgetPanelsContent } from "./Content";
import { PanelsStateContext } from "../base/NineZone";
import { ContentNodeContext } from "./Panels";

/** Main app content (i.e. viewport) that will change bounds based on panel pinned settings.
 * @internal
 */
export const AppContent = React.memo(function AppContent() { // tslint:disable-line: variable-name no-shadowed-variable
  const panels = React.useContext(PanelsStateContext);
  const content = React.useContext(ContentNodeContext);
  return (
    <WidgetPanelsContent
      children={content}
      pinnedLeft={panels.left.pinned}
      pinnedRight={panels.right.pinned}
      pinnedTop={panels.top.pinned}
      pinnedBottom={panels.bottom.pinned}
    />
  );
});
