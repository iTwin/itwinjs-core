/*---------------------------------------------------------------------------------------------
|  $Copyright: (c) 2018 Bentley Systems, Incorporated. All rights reserved. $
 *--------------------------------------------------------------------------------------------*/
/** @module Widget */

import * as classnames from "classnames";
import * as React from "react";
import CommonProps, { NoChildrenProps } from "../utilities/Props";
import "./Tools.scss";

/** Properties of [[Tools]] component. */
export interface ToolsProps extends CommonProps, NoChildrenProps {
  /**
   * Button displayed between horizontal and vertical toolbars.
   * I.e. [[AppButton]] in Tools zone or navigation aid control in Navigation zone.
   */
  button?: React.ReactNode;
  /** Horizontal toolbar. See [[Toolbar]] */
  horizontalToolbar?: React.ReactNode;
  /**
   * True if this widget is used in Navigation zone.
   * Controls how the toolbars and button are aligned.
   */
  isNavigation?: boolean;
  /** Vertical toolbar. See [[Toolbar]] */
  verticalToolbar?: React.ReactNode;
  /** Pass true to reduce the distance between toolbars when [[ToolsProps.button]] is not provided. */
  preserveSpace?: boolean;
}

/**
 * Tools widget is used in Tools (Zone 1) and Navigation (Zone 3) zones of 9-Zone UI.
 * @note Should be placed in [[Zone]] component.
 */
// tslint:disable-next-line:variable-name
export const Tools: React.StatelessComponent<ToolsProps> = (props: ToolsProps) => {
  const singleToolbar = (props.verticalToolbar && !props.horizontalToolbar) ||
    (!props.verticalToolbar && props.horizontalToolbar);
  const noGap = singleToolbar && !props.button;
  const reducedGap = !singleToolbar && !props.button && props.preserveSpace;
  const className = classnames(
    "nz-widget-tools",
    noGap && "nz-no-gap",
    reducedGap && "nz-reduced-gap",
    props.isNavigation && "nz-is-navigation",
    props.className);

  return (
    <div className={className} style={props.style}>
      <div className="nz-app-button">
        {props.button}
      </div>
      <div className="nz-horizontal-toolbar">
        {props.horizontalToolbar}
      </div>
      <div className="nz-vertical-toolbar">
        {props.verticalToolbar}
      </div>
    </div>
  );
};

export default Tools;
