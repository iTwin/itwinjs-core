/*---------------------------------------------------------------------------------------------
* Copyright (c) 2019 Bentley Systems, Incorporated. All rights reserved.
* Licensed under the MIT License. See LICENSE.md in the project root for license terms.
*--------------------------------------------------------------------------------------------*/
/** @module SnapMode */

import * as classnames from "classnames";
import * as React from "react";
import { Div } from "@bentley/ui-core";
import { withContainInViewport } from "../../base/WithContainInViewport";
import { CommonProps, NoChildrenProps } from "../../utilities/Props";
import { TrianglePopover } from "../../popup/popover/Triangle";
import { Direction } from "../../utilities/Direction";
import "./Dialog.scss";

// tslint:disable-next-line:variable-name
const DivWithContainIn = withContainInViewport(Div);

/** Properties of [[SnapModeDialog]] component. */
export interface SnapModeDialogProps extends CommonProps, NoChildrenProps {
  /** Dialog title. */
  title?: string;
  /** Actual snap rows. See Snap component. */
  snaps?: React.ReactNode;
}

/** Dialog used in [[SnapModeIndicator]] component. */
export class SnapModeDialog extends React.PureComponent<SnapModeDialogProps> {
  public render() {
    const dialogClassName = classnames(
      "nz-footer-snapMode-dialog",
      this.props.className);

    return (
      <TrianglePopover
        direction={Direction.Top}
        className={dialogClassName}
        content={
          <DivWithContainIn noVerticalContainment={true}>
            <div className="nz-title">
              {this.props.title}
            </div>
            <div className="nz-snaps">
              {this.props.snaps}
            </div>
          </DivWithContainIn>
        }
      />
    );
  }
}
