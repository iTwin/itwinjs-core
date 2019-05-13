/*---------------------------------------------------------------------------------------------
* Copyright (c) 2019 Bentley Systems, Incorporated. All rights reserved.
* Licensed under the MIT License. See LICENSE.md in the project root for license terms.
*--------------------------------------------------------------------------------------------*/
/** @module Footer */

import * as classnames from "classnames";
import * as React from "react";
import { CommonProps } from "@bentley/ui-core";
import { Dialog } from "../dialog/Dialog";
import { TitleBar } from "../dialog/TitleBar";
import "./Dialog.scss";

/** Properties of [[ToolAssistanceDialog]] component.
 * @beta
 */
export interface ToolAssistanceDialogProps extends CommonProps {
  /** Items and separators of tool assistance. I.e. [[ToolAssistanceItem]], [[ToolAssistanceSeparator]] */
  children?: React.ReactNode;
  /** Dialog title. */
  title?: string;
}

/** Tool assistance dialog used with [[ToolAssistance]] component.
 * @note This is a presentational component and should be aligned with [[ToolAssistance]] component.
 * I.e. use [[FooterPopup]] to handle alignment.
 * @beta
 */
export class ToolAssistanceDialog extends React.PureComponent<ToolAssistanceDialogProps> {
  public render() {
    const className = classnames(
      "nz-footer-toolAssistance-dialog",
      this.props.className);

    return (
      <Dialog
        className={className}
        style={this.props.style}
        titleBar={
          <TitleBar
            title={this.props.title}
          />
        }
      >
        <div className="nz-content">
          {this.props.children}
        </div>
      </Dialog>
    );
  }
}
