/*---------------------------------------------------------------------------------------------
|  $Copyright: (c) 2018 Bentley Systems, Incorporated. All rights reserved. $
 *--------------------------------------------------------------------------------------------*/
/** @module SnapMode */

import * as classnames from "classnames";
import * as React from "react";
import CommonProps, { NoChildrenProps } from "../../utilities/Props";
import TrianglePopover from "../../popup/popover/Triangle";
import "./Dialog.scss";
import { Direction } from "../../utilities/Direction";

/** Properties of [[SnapModeDialog]] component. */
export interface SnapModeDialogProps extends CommonProps, NoChildrenProps {
  /** Dialog title. */
  title?: string;
  /** Actual snap rows. See [[Snap]] component. */
  snaps?: React.ReactNode;
}

/** Dialog used in [[SnapModeIndicator]] component. */
export default class SnapModeDialog extends React.Component<SnapModeDialogProps> {
  public render() {
    const dialogClassName = classnames(
      "nz-footer-snapMode-dialog",
      this.props.className);

    return (
      <TrianglePopover
        direction={Direction.Top}
        className={dialogClassName}
        content={
          <>
            <div className="nz-title">
              {this.props.title}
            </div>
            <div className="nz-snaps">
              {this.props.snaps}
            </div>
          </>
        }
      />
    );
  }
}
