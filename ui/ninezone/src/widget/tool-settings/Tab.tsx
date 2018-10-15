/*---------------------------------------------------------------------------------------------
* Copyright (c) 2018 Bentley Systems, Incorporated. All rights reserved.
* Licensed under the MIT License. See LICENSE.md in the project root for license terms.
*--------------------------------------------------------------------------------------------*/
/** @module Widget */

import * as classnames from "classnames";
import * as React from "react";
import CommonProps from "../../utilities/Props";
import "./Tab.scss";

/** Properties of [[ToolSettings]] component. */
export interface ToolSettingsTabProps extends CommonProps {
  /** Tab icon. */
  children?: React.ReactNode;
  /** Describes if the tab is active. */
  isActive?: boolean;
  /** Function called when the tab is clicked. */
  onClick?: () => void;
}

/**
 * Tool settings widget tab.
 * @note Used in [[ToolSettings]] component.
 */
// tslint:disable-next-line:variable-name
export const ToolSettingsTab: React.StatelessComponent<ToolSettingsTabProps> = (props: ToolSettingsTabProps) => {
  const className = classnames(
    "nz-widget-toolSettings-tab",
    props.isActive && "nz-is-active",
    props.className);

  return (
    <div
      className={className}
      style={props.style}
      onClick={props.onClick}
    >
      {props.children}
    </div>
  );
};

export default ToolSettingsTab;
