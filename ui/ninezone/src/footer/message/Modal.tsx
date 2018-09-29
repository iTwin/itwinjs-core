/*---------------------------------------------------------------------------------------------
* Copyright (c) 2018 - present Bentley Systems, Incorporated. All rights reserved.
* Licensed under the MIT License. See LICENSE.md in the project root for license terms.
*--------------------------------------------------------------------------------------------*/
/** @module Message */

import * as classnames from "classnames";
import * as React from "react";
import * as ReactDOM from "react-dom";
import CommonProps, { NoChildrenProps } from "../../utilities/Props";
import "./Modal.scss";

/** Properties of [[Modal]] component. */
export interface ModalProps extends CommonProps, NoChildrenProps {
  /** Dialog of modal message. I.e. [[Dialog]] */
  dialog?: React.ReactNode;
  /** Function called to determine to which element the modal message should be rendered. */
  renderTo?: () => HTMLElement;
}

/** Default properties for [[ModalProps]] used in [[Modal]] component. */
export interface ModalDefaultProps extends ModalProps {
  /** Defaults to body of document. */
  renderTo: () => HTMLElement;
}

/** Modal message as defined in 9-Zone UI spec. */
export default class Modal extends React.Component<ModalProps> {
  public static readonly defaultProps: ModalDefaultProps = {
    renderTo: () => document.body,
  };

  private isWithDefaultProps(): this is { props: ModalDefaultProps } {
    if (this.props.renderTo === undefined)
      return false;
    return true;
  }

  public render() {
    const className = classnames(
      "nz-footer-message-modal",
      this.props.className);

    if (!this.isWithDefaultProps())
      return null;

    return ReactDOM.createPortal(
      (
        <div
          className={className}
          style={this.props.style}
        >
          <div className="nz-dialog">
            {this.props.dialog}
          </div>
        </div>
      ), this.props.renderTo());
  }
}
