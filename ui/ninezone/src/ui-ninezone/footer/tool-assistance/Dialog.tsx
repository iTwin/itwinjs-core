/*---------------------------------------------------------------------------------------------
* Copyright (c) 2019 Bentley Systems, Incorporated. All rights reserved.
* Licensed under the MIT License. See LICENSE.md in the project root for license terms.
*--------------------------------------------------------------------------------------------*/
/** @module Footer */

import * as classnames from "classnames";
import * as React from "react";
import { TrianglePopover } from "../../popup/popover/Triangle";
import { Direction } from "../../utilities/Direction";
import { CommonProps, NoChildrenProps } from "../../utilities/Props";
import { Dialog } from "../message/content/dialog/Dialog";
import { TitleBar } from "../message/content/dialog/TitleBar";
import { DialogTitle } from "../message/content/dialog/Title";
import { ToolAssistanceContent } from "./Content";
import "./Dialog.scss";

/** Properties of [[ToolAssistanceDialog]] component. */
export interface ToolAssistanceDialogContentProps extends CommonProps, NoChildrenProps {
  /** Items and separators of tool assistance. I.e. [[ToolAssistanceItem]], [[ToolAssistanceSeparator]] */
  items?: React.ReactNode;
  /** Dialog title. */
  title?: string;
}

/** Dialog content used in [[ToolAssistanceDialog]] component. */
export class ToolAssistanceDialogContent extends React.PureComponent<ToolAssistanceDialogContentProps> {
  public render() {
    return (
      <Dialog
        className={this.props.className}
        content={
          <ToolAssistanceContent>
            {this.props.items}
          </ToolAssistanceContent>
        }
        style={this.props.style}
        titleBar={
          <TitleBar
            title={
              <DialogTitle text={this.props.title} />
            }
          />
        }
      />
    );
  }
}

/** Properties of [[ToolAssistanceDialog]] component. */
export interface ToolAssistanceDialogProps extends CommonProps, NoChildrenProps {
  /** Dialog content. See [[SnapModeDialogContent]] */
  content?: React.ReactNode;
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
        content={this.props.content}
        direction={Direction.Top}
        style={this.props.style}
      />
    );
  }
}
