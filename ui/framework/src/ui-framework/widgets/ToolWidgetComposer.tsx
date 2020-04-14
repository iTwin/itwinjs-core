/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* Licensed under the MIT License. See LICENSE.md in the project root for license terms.
*--------------------------------------------------------------------------------------------*/
/** @packageDocumentation
 * @module Widget
 */

import * as React from "react";

import { IconSpecUtilities } from "@bentley/ui-abstract";
import { Icon, CommonProps, useProximityToMouse } from "@bentley/ui-core";
import { ToolsArea, AppButton } from "@bentley/ui-ninezone";

import { BackstageManager } from "../backstage/BackstageManager";
import { useFrameworkVersion } from "../hooks/useFrameworkVersion";
import { UiShowHideManager } from "../utils/UiShowHideManager";
import { UiFramework } from "../UiFramework";

import widgetIconSvg from "@bentley/icons-generic/icons/home.svg?sprite";

/** Properties for the [[BackstageAppButton]] React component
 * @beta
 */
export interface BackstageAppButtonProps {
  /** Icon specification for the App button */
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

  const ref = React.useRef<HTMLDivElement>(null);
  const proximity = useProximityToMouse(ref);
  const divStyle: React.CSSProperties = {};

  if ("1" !== useFrameworkVersion() && UiShowHideManager.useProximityOpacity && !UiFramework.isMobile()) {
    const threshold = 100;
    const scale = ((proximity < threshold) ? threshold - proximity : 0) / threshold;
    const appButtonOpacity = (0.50 * scale) + 0.50;

    divStyle.opacity = `${appButtonOpacity}`;
  }

  return (
    <div style={divStyle} ref={ref}>
      <AppButton small={useSmallAppButton}
        onClick={backstageToggleCommand.execute}
        icon={
          <Icon iconSpec={icon} />
        }
      />
    </div>
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
