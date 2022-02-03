/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
/** @packageDocumentation
 * @module Widget
 */

import * as React from "react";
import type { CommonProps} from "@itwin/core-react";
import { useProximityToMouse, WidgetElementSet, WidgetOpacityContext } from "@itwin/core-react";
import { ToolsArea } from "@itwin/appui-layout-react";
import { UiShowHideManager } from "../utils/UiShowHideManager";

/** Properties for the [[ToolbarComposer]] React components
 * @public
 */
export interface ToolWidgetComposerProps extends CommonProps {
  /** Optional Corner Item which for most stages is the [[BackstageAppButton]] used to toggle the display of the backstage menu. */
  cornerItem?: React.ReactNode;
  /** Optional Horizontal Toolbar */
  horizontalToolbar?: React.ReactNode;
  /** Optional Vertical Toolbar */
  verticalToolbar?: React.ReactNode;
}

/**
 * ToolWidget component that supports use of ToolbarComposer-based Toolbars. The ToolWidget is shown in the top left of the content area
 * and typically holds tools to manipulate or interrogate content. The horizontal toolbar often includes context specific tools based on
 * selected items. The vertical toolbar typically contains a more fixed list of tools.
 * @public
 */
export function ToolWidgetComposer(props: ToolWidgetComposerProps) {
  const { cornerItem, horizontalToolbar, verticalToolbar, ...otherProps } = props;
  const [elementSet] = React.useState(new WidgetElementSet());
  const handleChildRef = React.useCallback((elementRef: React.RefObject<Element>) => {
    elementSet.add(elementRef);
  }, [elementSet]);
  const proximityScale = useProximityToMouse(elementSet, UiShowHideManager.snapWidgetOpacity);

  return (
    <WidgetOpacityContext.Provider
      value={{
        onElementRef: handleChildRef,
        proximityScale,
      }}
    >
      <ToolsArea
        button={cornerItem}
        horizontalToolbar={horizontalToolbar}
        verticalToolbar={verticalToolbar}
        {...otherProps}
        onMouseEnter={UiShowHideManager.handleWidgetMouseEnter}
      />
    </WidgetOpacityContext.Provider>
  );
}
