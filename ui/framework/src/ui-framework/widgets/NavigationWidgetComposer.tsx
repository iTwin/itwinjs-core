/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
/** @packageDocumentation
 * @module Widget
 */

import * as React from "react";
import { ScreenViewport } from "@bentley/imodeljs-frontend";
import { ViewClassFullNameChangedEventArgs, ViewportComponentEvents } from "@bentley/ui-components";
import { CommonProps, useProximityToMouse, useWidgetOpacityContext, WidgetElementSet, WidgetOpacityContext } from "@bentley/ui-core";
import { NavigationArea } from "@bentley/ui-ninezone";
import { ConfigurableUiManager } from "../configurableui/ConfigurableUiManager";
import { ContentControl, ContentControlActivatedEventArgs } from "../content/ContentControl";
import { ContentViewManager } from "../content/ContentViewManager";
import { FrontstageManager } from "../frontstage/FrontstageManager";
import { useFrameworkVersion } from "../hooks/useFrameworkVersion";
import { NavigationAidControl } from "../navigationaids/NavigationAidControl";
import { UiFramework } from "../UiFramework";
import { UiShowHideManager } from "../utils/UiShowHideManager";

function createNavigationAidControl(activeContentControl: ContentControl | undefined, navigationAidId: string, activeViewport: ScreenViewport | undefined): NavigationAidControl | undefined {
  // istanbul ignore else
  if (!activeContentControl || !navigationAidId || (activeViewport !== activeContentControl.viewport))
    return undefined;

  const viewport = activeContentControl.viewport;
  const imodel = viewport ? viewport.iModel : /* istanbul ignore next */ UiFramework.getIModelConnection();
  const navigationAidControl = ConfigurableUiManager.createControl(navigationAidId, navigationAidId, { imodel, viewport }) as NavigationAidControl;

  navigationAidControl.initialize();
  return navigationAidControl;
}

/** Properties for the [[NavigationAidHost]] React component
 * @beta
 */
export interface NavigationAidHostProps {
  // defaults to "64px"
  minWidth?: string;
  // defaults to "64px"
  minHeight?: string;
}

/**
 * NavigationAidHost is a component that hosts a NavigationAid that is specific to the active content control.
 * @beta
 */
export function NavigationAidHost(props: NavigationAidHostProps) {
  const [activeContentControl, setActiveContentControl] = React.useState(() => ContentViewManager.getActiveContentControl());
  const [activeContentViewport, setActiveContentViewport] = React.useState(() => /* istanbul ignore next */ activeContentControl?.viewport);
  const [navigationAidId, setNavigationAidId] = React.useState(() => activeContentControl ? activeContentControl.navigationAidControl : /* istanbul ignore next */ "");

  React.useEffect(() => {
    // istanbul ignore next
    const handleContentControlActivated = (args: ContentControlActivatedEventArgs) => {
      setActiveContentControl(args.activeContentControl);
      setActiveContentViewport(args.activeContentControl.viewport);
      setNavigationAidId(args.activeContentControl.navigationAidControl);
    };

    FrontstageManager.onContentControlActivatedEvent.addListener(handleContentControlActivated);
    return () => {
      FrontstageManager.onContentControlActivatedEvent.removeListener(handleContentControlActivated);
    };
  }, []);

  const [activeViewClass, setActiveViewClass] = React.useState(() => {
    const content = ContentViewManager.getActiveContentControl();
    if (content && content.viewport)
      return content.viewport.view.classFullName;
    return "";
  });

  React.useEffect(() => {
    // istanbul ignore next
    const handleViewClassFullNameChange = (args: ViewClassFullNameChangedEventArgs) => {
      setActiveViewClass(args.newName);
    };

    ViewportComponentEvents.onViewClassFullNameChangedEvent.addListener(handleViewClassFullNameChange);
    return () => {
      ViewportComponentEvents.onViewClassFullNameChangedEvent.removeListener(handleViewClassFullNameChange);
    };
  }, [activeViewClass]);

  const navigationAidControl = React.useMemo(() => createNavigationAidControl(activeContentControl, navigationAidId, activeContentViewport), [activeContentControl, navigationAidId, activeContentViewport]);

  const ref = React.useRef<HTMLDivElement>(null);

  const isInitialMount = React.useRef(true);
  const { onElementRef, proximityScale } = useWidgetOpacityContext();

  React.useEffect(() => {
    // istanbul ignore else
    if (isInitialMount.current) {
      isInitialMount.current = false;
      onElementRef(ref);
    }
  }, [onElementRef]);

  const divStyle: React.CSSProperties = {
    minWidth: props.minWidth ? /* istanbul ignore next */ props.minWidth : "64px",
    minHeight: props.minHeight ? /* istanbul ignore next */ props.minHeight : "64px",
  };

  if ("1" !== useFrameworkVersion() && UiShowHideManager.useProximityOpacity && !UiFramework.isMobile()) {
    const navigationAidOpacity = (0.30 * proximityScale) + 0.70;

    divStyle.opacity = `${navigationAidOpacity}`;
  }

  return (
    <div style={divStyle} ref={ref}>
      {navigationAidControl && navigationAidControl.reactNode}
    </div>
  );
}

/** Properties for the [[NavigationWidgetComposer]] React components
 * @beta
 */
export interface NavigationWidgetComposerProps extends CommonProps {
  /** Optional Horizontal Toolbar */
  horizontalToolbar?: React.ReactNode;
  /** Optional Vertical Toolbar */
  verticalToolbar?: React.ReactNode;
  /** Optional Navigation Aid host. If not specified a default host is provided which will use registered Navigation Aids and the active content control to determine which if any Navigation Aid to display. */
  navigationAidHost?: React.ReactNode;
}

/**
 * Component that Composes a NavigationWidget typically using toolbars generated via [[ToolbarComposer]] class. The Navigation widget is shown in the top right of the content area
 * and typically holds tools to visually navigate, orient, and zoom to specific content.
 * @beta
 */
export function NavigationWidgetComposer(props: NavigationWidgetComposerProps) {
  const { navigationAidHost, horizontalToolbar, verticalToolbar, ...otherProps } = props;
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
      <NavigationArea
        navigationAid={navigationAidHost ? /* istanbul ignore next */ navigationAidHost : <NavigationAidHost />}
        horizontalToolbar={horizontalToolbar}
        verticalToolbar={verticalToolbar}
        {...otherProps}
        onMouseEnter={UiShowHideManager.handleWidgetMouseEnter}
      />
    </WidgetOpacityContext.Provider>
  );
}
