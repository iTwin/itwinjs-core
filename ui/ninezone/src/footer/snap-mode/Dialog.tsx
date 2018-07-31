/*---------------------------------------------------------------------------------------------
|  $Copyright: (c) 2018 Bentley Systems, Incorporated. All rights reserved. $
 *--------------------------------------------------------------------------------------------*/
/** @module SnapMode */

import * as classnames from "classnames";
import * as React from "react";
import Dialog, { DialogProps } from "../indicator-dialog/Dialog";
import "./Dialog.scss";

export interface SnapModeDialogProps extends DialogProps {
  title?: string;
  snaps?: React.ReactNode;
  isOpen?: boolean;
}

export default class SnapModeDialog extends React.Component<SnapModeDialogProps> {
  public render() {
    const { children, ...props } = this.props;
    const dialogClassName = classnames(
      "nz-footer-snapMode-dialog",
      this.props.className);

    return (
      <Dialog
        {...props}
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
