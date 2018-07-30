/*---------------------------------------------------------------------------------------------
|  $Copyright: (c) 2018 Bentley Systems, Incorporated. All rights reserved. $
 *--------------------------------------------------------------------------------------------*/
/** @module Footer */

import * as classnames from "classnames";
import * as React from "react";
import Direction from "../../utilities/Direction";
import Popover, { TriangleProps } from "../../popup/popover/Triangle";
export { TriangleProps as DialogProps } from "../../popup/popover/Triangle";

import "./Dialog.scss";

export default class IndicatorDialog extends React.Component<TriangleProps> {
  public render() {
    const { children, ...props } = this.props;
    const className = classnames(
      "nz-footer-indicatorDialog-dialog",
      this.props.className);

    return (
      <Popover
        {...props}
        className={className}
        direction={Direction.Top}
      />
    );
  }
}
