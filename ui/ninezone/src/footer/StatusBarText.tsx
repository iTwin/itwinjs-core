/*---------------------------------------------------------------------------------------------
|  $Copyright: (c) 2018 Bentley Systems, Incorporated. All rights reserved. $
 *--------------------------------------------------------------------------------------------*/
/** @module StatusBarText */

import * as classnames from "classnames";
import * as React from "react";
import CommonProps, { NoChildrenProps } from "../utilities/Props";
import "./StatusBarText.scss";

/** Properties of [[StatusBarText]] component.  */
export interface StatusBarTextProps extends CommonProps, NoChildrenProps {
  /** Describes if the snap row is active. */
  isInFooterMode?: boolean;
  /** Label of snap row. */
  label?: string;
}

/** Generic Text used in [[StatusBar]] component. */
export default class Snap extends React.Component<StatusBarTextProps> {
  public render() {
    const combinedClassName = classnames(
      "nz-footer-text",
      this.props.isInFooterMode && "nz-is-in-footer-mode",
      this.props.className);

    return (
      <div
        className={combinedClassName}
        style={this.props.style}
      >
        {this.props.label}
      </div>
    );
  }
}
