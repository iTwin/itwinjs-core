/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
/** @packageDocumentation
 * @module Widget
 */

import * as React from "react";
import widgetIconSvg from "@bentley/icons-generic/icons/home.svg?sprite";
import { IconSpecUtilities } from "@itwin/appui-abstract";
import { CommonProps, Icon, useProximityToMouse, useWidgetOpacityContext, WidgetElementSet, WidgetOpacityContext } from "@itwin/core-react";
import { AppButton, ToolsArea } from "@itwin/appui-layout-react";
import { BackstageManager } from "../backstage/BackstageManager";
import { useFrameworkVersion } from "../hooks/useFrameworkVersion";
import { UiFramework } from "../UiFramework";
import { UiShowHideManager } from "../utils/UiShowHideManager";

/** Properties for the [[BackstageAppButton]] React component
 * @public
 */
export interface BackstageAppButtonProps {
  /** Icon specification for the App button */
  icon?: string;
}

/**
 * BackstageAppButton used to toggle display of Backstage.
 * @public
 */
export function BackstageAppButton(props: BackstageAppButtonProps) {
  const backstageLabel = React.useRef(UiFramework.translate("buttons.openBackstageMenu"));
  const backstageToggleCommand = BackstageManager.getBackstageToggleCommand(props.icon);
  const [icon, setIcon] = React.useState(props.icon ? props.icon : IconSpecUtilities.createSvgIconSpec(widgetIconSvg));
  const isInitialMount = React.useRef(true);
  const useSmallAppButton = "1" !== useFrameworkVersion();
  const divClassName = useSmallAppButton ? "uifw-app-button-small" : undefined;
  const { onElementRef, proximityScale } = useWidgetOpacityContext();
  const ref = React.useRef<HTMLDivElement>(null);

  React.useEffect(() => {
    if (isInitialMount.current) {
      isInitialMount.current = false;
      onElementRef(ref);
    } else {
      setIcon(props.icon ? props.icon : IconSpecUtilities.createSvgIconSpec(widgetIconSvg));
    }
  }, [props.icon, onElementRef]);

  let buttonProximityScale: number | undefined;

  if ("1" !== useFrameworkVersion() && UiShowHideManager.useProximityOpacity && !UiFramework.isMobile()) {
    buttonProximityScale = proximityScale;
  }

  return (
    <div ref={ref} className={divClassName}>
      <AppButton
        small={useSmallAppButton}
        mouseProximity={buttonProximityScale}
        onClick={backstageToggleCommand.execute}
        icon={
          <Icon iconSpec={icon} />
        }
        title={backstageToggleCommand.tooltip || backstageLabel.current}
      />
    </div>
  );
}

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
