/*---------------------------------------------------------------------------------------------
* Copyright (c) 2018 - present Bentley Systems, Incorporated. All rights reserved.
* Licensed under the MIT License. See LICENSE.md in the project root for license terms.
*--------------------------------------------------------------------------------------------*/
/** @module SnapMode */

import * as classnames from "classnames";
import * as React from "react";
import { Div } from "@bentley/ui-core";
import withContainInViewport from "../../base/WithContainInViewport";
import CommonProps, { NoChildrenProps } from "../../utilities/Props";
import Popover from "../../popup/popover/Triangle";
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
export default class SnapModeDialog extends React.Component<SnapModeDialogProps> {
  public render() {
    const dialogClassName = classnames(
      "nz-footer-snapMode-dialog",
      this.props.className);

    return (
      <Popover
        direction={Direction.Top}
        className={dialogClassName}
        content={
          <DivWithContainIn
            noVerticalContainment
          >
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
