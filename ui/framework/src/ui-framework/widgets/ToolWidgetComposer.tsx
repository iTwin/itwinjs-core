/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* Licensed under the MIT License. See LICENSE.md in the project root for license terms.
*--------------------------------------------------------------------------------------------*/
/** @packageDocumentation
 * @module Widget
 */

import * as React from "react";

import { ToolsArea, AppButton } from "@bentley/ui-ninezone";
import { UiShowHideManager } from "../utils/UiShowHideManager";
import { Icon, CommonProps } from "@bentley/ui-core";

import widgetIconSvg from "@bentley/icons-generic/icons/home.svg";
import { IconSpecUtilities } from "@bentley/ui-abstract";
import { BackstageManager } from "../backstage/BackstageManager";
import { useFrameworkVersion } from "../hooks/useFrameworkVersion";

/** Properties for the [[BackstageAppButton]] React component
 * @beta
 */
export interface BackstageAppButtonProps {
  icon?: string;
}

/**
 * BackstageAppButton used to toggle display of Backstage.
 * @beta
 */
export function BackstageAppButton(props: BackstageAppButtonProps) {
  const backstageToggleCommand = BackstageManager.getBackstageToggleCommand(props.icon);
  const [icon, setIcon] = React.useState(props.icon ? props.icon : IconSpecUtilities.createSvgIconSpec(widgetIconSvg));
  const isInitialMount = React.useRef(true);
  const useSmallAppButton = "1" !== useFrameworkVersion();

  React.useEffect(() => {
    if (isInitialMount.current)
      isInitialMount.current = false;
    else {
      setIcon(props.icon ? props.icon : IconSpecUtilities.createSvgIconSpec(widgetIconSvg));
    }
  }, [props.icon]);

  return (
    <AppButton small={useSmallAppButton}
      onClick={backstageToggleCommand.execute}
      icon={
        <Icon iconSpec={icon} />
      }
    />
  );
}

/** Properties for the [[ToolbarComposer]] React components
 * @beta
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
 * @beta
 */
export function ToolWidgetComposer(props: ToolWidgetComposerProps) {
  const { cornerItem, horizontalToolbar, verticalToolbar, ...otherProps } = props;
  return (
    <ToolsArea
      button={cornerItem}
      horizontalToolbar={horizontalToolbar}
      verticalToolbar={verticalToolbar}
      {...otherProps}
      onMouseEnter={UiShowHideManager.handleWidgetMouseEnter}
    />
  );
}
