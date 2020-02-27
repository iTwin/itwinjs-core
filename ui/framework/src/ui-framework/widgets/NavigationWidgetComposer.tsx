/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* Licensed under the MIT License. See LICENSE.md in the project root for license terms.
*--------------------------------------------------------------------------------------------*/
/** @packageDocumentation
 * @module Widget
 */

import * as React from "react";

import { Tools as NZ_ToolsWidget } from "@bentley/ui-ninezone";
import { UiShowHideManager } from "../utils/UiShowHideManager";
import { FrontstageManager } from "../frontstage/FrontstageManager";
import { NavigationAidControl } from "../navigationaids/NavigationAidControl";
import { ContentViewManager } from "../content/ContentViewManager";
import { ContentControlActivatedEventArgs, ContentControl } from "../content/ContentControl";
import { ViewClassFullNameChangedEventArgs, ViewportComponentEvents } from "@bentley/ui-components";
import { ConfigurableUiManager } from "../configurableui/ConfigurableUiManager";
import { UiFramework } from "../UiFramework";

function createNavigationAidControl(activeContentControl: ContentControl | undefined, navigationAidId: string): NavigationAidControl | undefined {
  // istanbul ignore else
  if (!activeContentControl || !navigationAidId)
    return undefined;

  const viewport = activeContentControl.viewport;
  const imodel = viewport ? viewport.iModel : UiFramework.getIModelConnection();
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
// tslint:disable-next-line: variable-name
export const NavigationAidHost: React.FC<NavigationAidHostProps> = (props) => {
  const [activeContentControl, setActiveContentControl] = React.useState(() => ContentViewManager.getActiveContentControl());
  const [navigationAidId, setNavigationAidId] = React.useState(() => activeContentControl ? activeContentControl.navigationAidControl : "");

  React.useEffect(() => {
    const handleContentControlActivated = (args: ContentControlActivatedEventArgs) => {
      setActiveContentControl(args.activeContentControl);
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
    const handleViewClassFullNameChange = (args: ViewClassFullNameChangedEventArgs) => {
      setActiveViewClass(args.newName);
    };

    ViewportComponentEvents.onViewClassFullNameChangedEvent.addListener(handleViewClassFullNameChange);
    return () => {
      ViewportComponentEvents.onViewClassFullNameChangedEvent.removeListener(handleViewClassFullNameChange);
    };
  }, [activeViewClass]);

  const navigationAidControl = React.useMemo(() => createNavigationAidControl(activeContentControl, navigationAidId), [activeContentControl, navigationAidId]);

  const divStyle: React.CSSProperties = { minWidth: props.minWidth ? props.minWidth : "64px", minHeight: props.minHeight ? props.minHeight : "64px" };
  return (
    <div style={divStyle}>
      {navigationAidControl && navigationAidControl.reactElement}
    </div>
  );
};

/** Properties for the [[NavigationWidgetComposer]] React components
 * @beta
 */
export interface NavigationWidgetComposerProps {
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
// tslint:disable-next-line: variable-name
export const NavigationWidgetComposer: React.FC<NavigationWidgetComposerProps> = (props) => {
  const navigationAidHost = props.navigationAidHost ? props.navigationAidHost : <NavigationAidHost />;

  return (
    <NZ_ToolsWidget isNavigation
      button={navigationAidHost}
      horizontalToolbar={props.horizontalToolbar}
      verticalToolbar={props.verticalToolbar}
      preserveSpace={true}
      onMouseEnter={UiShowHideManager.handleWidgetMouseEnter}
    />
  );
};
