/*---------------------------------------------------------------------------------------------
* Copyright (c) 2018 - present Bentley Systems, Incorporated. All rights reserved.
* Licensed under the MIT License. See LICENSE.md in the project root for license terms.
*--------------------------------------------------------------------------------------------*/
/** @module Widget */

import * as classnames from "classnames";
import * as React from "react";
import CommonProps, { NoChildrenProps } from "../utilities/Props";
import "./ToolSettings.scss";

/** Properties of [[ToolSettings]] component. */
export interface ToolSettingsProps extends CommonProps, NoChildrenProps {
  /** Content of this ToolSettings widget. See: [[Nested]], [[Settings]] */
  content?: React.ReactNode;
  /** Tab to control the content. See [[ToolSettingsTab]] */
  tab?: React.ReactNode;
}

/**
 * Tool settings widget is used to display Tool Settings and Tool Assistance (Zone 2 in 9-Zone UI).
 * @note Should be placed in [[Zone]] component.
 */
// tslint:disable-next-line:variable-name
export const ToolSettings: React.StatelessComponent<ToolSettingsProps> = (props: ToolSettingsProps) => {
  const className = classnames(
    "nz-widget-toolSettings",
    props.className);

  return (
    <div
      className={className}
      style={props.style}
    >
      {!props.content ? undefined :
        <div className="nz-content">
          {props.content}
        </div>
      }
      <div className="nz-tab">
        {props.tab}
      </div>
    </div>
  );
};

export default ToolSettings;
