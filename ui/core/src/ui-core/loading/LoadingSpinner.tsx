/*---------------------------------------------------------------------------------------------
* Copyright (c) 2019 Bentley Systems, Incorporated. All rights reserved.
* Licensed under the MIT License. See LICENSE.md in the project root for license terms.
*--------------------------------------------------------------------------------------------*/
/** @module Loading */

import * as React from "react";
import "./LoadingSpinner.scss";
import { Spinner, SpinnerProps } from "./Spinner";

/** Properties for [[LoadingSpinner]] component
 * @beta
 */
export interface LoadingSpinnerProps extends SpinnerProps {
  /** Message (text) displayed */
  message?: string;
  /** Position the message above or below the spinner (defaults to bottom) */
  messageOnTop?: boolean;
}

/**
 * A loading spinner component.
 * @beta
 */
export class LoadingSpinner extends React.PureComponent<LoadingSpinnerProps> {
  public static defaultProps: Partial<LoadingSpinnerProps> = {
    messageOnTop: false,
  };

  public render() {
    return (
      <div className="core-ls">
        {(this.props.message && this.props.messageOnTop) && <span className="ls-message-top">{this.props.message}</span>}
        <Spinner size={this.props.size} sizeClass={this.props.sizeClass} />
        {(this.props.message && !this.props.messageOnTop) && <span className="ls-message-bottom">{this.props.message}</span>}
      </div>
    );
  }
}
