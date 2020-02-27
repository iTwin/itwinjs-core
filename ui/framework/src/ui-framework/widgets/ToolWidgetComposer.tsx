/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* Licensed under the MIT License. See LICENSE.md in the project root for license terms.
*--------------------------------------------------------------------------------------------*/
/** @packageDocumentation
 * @module Widget
 */

import * as React from "react";

import { Tools as NZ_ToolsWidget, AppButton } from "@bentley/ui-ninezone";
import { UiShowHideManager } from "../utils/UiShowHideManager";
import { Icon } from "@bentley/ui-core";

import widgetIconSvg from "@bentley/icons-generic/icons/home.svg";
import { IconSpecUtilities } from "@bentley/ui-abstract";
import { Backstage } from "../backstage/Backstage";

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
// tslint:disable-next-line: variable-name
export const BackstageAppButton: React.FC<BackstageAppButtonProps> = (props) => {
  const [icon, setIcon] = React.useState(props.icon ? props.icon : IconSpecUtilities.createSvgIconSpec(widgetIconSvg));
  const isInitialMount = React.useRef(true);
  React.useEffect(() => {
    if (isInitialMount.current)
      isInitialMount.current = false;
    else {
      setIcon(props.icon ? props.icon : IconSpecUtilities.createSvgIconSpec(widgetIconSvg));
    }
  }, [props.icon]);

  return (
    <AppButton
      onClick={Backstage.backstageToggleCommand.execute} // tslint:disable-line:deprecation
      icon={
        <Icon iconSpec={icon} />
      }
    />
  );
};

/** Properties for the [[ToolbarComposer]] React components
 * @beta
 */
export interface ToolWidgetComposerProps {
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
 * select items. The vertical toolbar typically contain a more fixed list of tools.
 * @beta
 */
// tslint:disable-next-line: variable-name
export const ToolWidgetComposer: React.FC<ToolWidgetComposerProps> = (props) => {
  return (
    <NZ_ToolsWidget
      button={props.cornerItem}
      horizontalToolbar={props.horizontalToolbar}
      verticalToolbar={props.verticalToolbar}
      preserveSpace={true}
      isNavigation={false}
      onMouseEnter={UiShowHideManager.handleWidgetMouseEnter}
    />
  );
};
