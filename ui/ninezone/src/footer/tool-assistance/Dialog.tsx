/*---------------------------------------------------------------------------------------------
|  $Copyright: (c) 2018 Bentley Systems, Incorporated. All rights reserved. $
 *--------------------------------------------------------------------------------------------*/
/** @module Footer */

import * as classnames from "classnames";
import * as React from "react";
import Direction from "../../utilities/Direction";
import { Omit } from "../../utilities/Props";
import Popover, { TrianglePopoverProps } from "../../popup/popover/Triangle";
import "./Dialog.scss";

/** Properties of [[ToolAssistanceDialog]] component. */
export interface ToolAssistanceDialogProps extends Omit<TrianglePopoverProps, "direction"> {
}

/** Common dialog used by footer indicators. */
export default class ToolAssistanceDialog extends React.Component<ToolAssistanceDialogProps> {
  public render() {
    const className = classnames(
      "nz-footer-toolAssistance-dialog",
      this.props.className);

    return (
      <Popover
        {...this.props}
        className={className}
        direction={Direction.Top}
      />
    );
  }
}
