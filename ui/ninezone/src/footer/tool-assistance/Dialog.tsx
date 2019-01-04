/*---------------------------------------------------------------------------------------------
* Copyright (c) 2019 Bentley Systems, Incorporated. All rights reserved.
* Licensed under the MIT License. See LICENSE.md in the project root for license terms.
*--------------------------------------------------------------------------------------------*/
/** @module Footer */

import * as classnames from "classnames";
import * as React from "react";
import { withContainInViewport } from "../../base/WithContainInViewport";
import { TrianglePopover } from "../../popup/popover/Triangle";
import { Direction } from "../../utilities/Direction";
import { CommonProps } from "../../utilities/Props";
import { Dialog } from "../message/content/dialog/Dialog";
import { TitleBar } from "../message/content/dialog/TitleBar";
import { DialogTitle } from "../message/content/dialog/Title";
import { ToolAssistanceContent } from "./Content";
import "./Dialog.scss";

// tslint:disable-next-line:variable-name
const DialogWithContainIn = withContainInViewport(Dialog);

/** Properties of [[ToolAssistanceDialog]] component. */
export interface ToolAssistanceDialogProps extends CommonProps {
  /** Dialog title. */
  title?: string;
  /** Items and separators of tool assistance. I.e. [[ToolAssistanceItem]], [[ToolAssistanceSeparator]] */
  items?: React.ReactNode;
}

/** Tool assistance dialog used in [[ToolAssistanceIndicator]] component. */
export class ToolAssistanceDialog extends React.PureComponent<ToolAssistanceDialogProps> {
  public render() {
    const className = classnames(
      "nz-footer-toolAssistance-dialog",
      this.props.className);

    return (
      <TrianglePopover
        className={className}
        direction={Direction.Top}
        content={
          <DialogWithContainIn
            noVerticalContainment
            titleBar={
              <TitleBar
                title={
                  <DialogTitle text={this.props.title} />
                }
              />
            }
            content={
              <ToolAssistanceContent>
                {this.props.items}
              </ToolAssistanceContent>
            }
          />
        }
      />
    );
  }
}
