/*---------------------------------------------------------------------------------------------
|  $Copyright: (c) 2018 Bentley Systems, Incorporated. All rights reserved. $
 *--------------------------------------------------------------------------------------------*/
/** @module Message */

import * as classnames from "classnames";
import * as React from "react";
import * as ReactDOM from "react-dom";

import CommonProps, { NoChildrenProps } from "../../utilities/Props";
import "./Modal.scss";

export interface ModalProps extends CommonProps, NoChildrenProps {
  dialog?: React.ReactNode;
  renderTo?: () => HTMLElement;
}

export interface ModalModalDefaultProps extends ModalProps {
  renderTo: () => HTMLElement;
}

export default class Modal extends React.Component<ModalProps> {
  public static defaultProps: ModalModalDefaultProps = {
    renderTo: () => document.body,
  };

  public static isWithDefaultProps(props: ModalProps): props is ModalModalDefaultProps {
    if (props.renderTo)
      return true;
    return false;
  }

  public isWithDefaultProps(): this is { props: ModalModalDefaultProps } {
    return Modal.isWithDefaultProps(this.props);
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
