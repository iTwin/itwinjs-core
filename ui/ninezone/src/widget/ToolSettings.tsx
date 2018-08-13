/*---------------------------------------------------------------------------------------------
|  $Copyright: (c) 2018 Bentley Systems, Incorporated. All rights reserved. $
 *--------------------------------------------------------------------------------------------*/
/** @module Widget */

import * as classnames from "classnames";
import * as React from "react";
import CommonProps, { NoChildrenProps } from "../utilities/Props";
import "./ToolSettings.scss";

/** Properties of [[ToolSettings]] component. */
export interface ToolSettingsProps extends CommonProps, NoChildrenProps {
  /** Content of this ToolSettings widget. See: [[Nested]], [[Settings]], [[NoSettings]], [[Assistance]] */
  content?: React.ReactNode;
  /** Toolbar to control the content. See [[Toolbar]] */
  toolbar?: React.ReactNode;
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
      <div className="nz-toolbar">
        {props.toolbar}
      </div>
    </div>
  );
};

export default ToolSettings;
