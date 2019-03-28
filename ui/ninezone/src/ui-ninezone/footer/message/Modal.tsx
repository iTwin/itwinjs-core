/*---------------------------------------------------------------------------------------------
* Copyright (c) 2019 Bentley Systems, Incorporated. All rights reserved.
* Licensed under the MIT License. See LICENSE.md in the project root for license terms.
*--------------------------------------------------------------------------------------------*/
/** @module Message */

import * as classnames from "classnames";
import * as React from "react";
import { CommonProps, NoChildrenProps } from "../../utilities/Props";
import "./Modal.scss";

/** Properties of [[Modal]] component. */
export interface ModalProps extends CommonProps, NoChildrenProps {
  /** Dialog of modal message. I.e. [[Dialog]] */
  dialog?: React.ReactNode;
}

/** Modal message as defined in 9-Zone UI spec. */
export class Modal extends React.PureComponent<ModalProps> {
  public render() {
    const className = classnames(
      "nz-footer-message-modal",
      this.props.className);

    return (
      <div
        className={className}
        style={this.props.style}
      >
        <div className="nz-dialog">
          {this.props.dialog}
        </div>
      </div>
    );
  }
}
