/*---------------------------------------------------------------------------------------------
* Copyright (c) 2019 Bentley Systems, Incorporated. All rights reserved.
* Licensed under the MIT License. See LICENSE.md in the project root for license terms.
*--------------------------------------------------------------------------------------------*/
/** @module Loading */

import * as React from "react";
import "./LoadingSpinner.scss";

/** Properties for [[LoadingSpinner]] component */
export interface LoadingSpinnerProps {
  /** Message (text) displayed */
  message?: string;
  /** Position the message above or below the spinner (defaults to bottom) */
  messageOnTop: boolean;
}

/**
 * A loading spinner component.
 */
export class LoadingSpinner extends React.Component<LoadingSpinnerProps> {
  public static defaultProps: Partial<LoadingSpinnerProps> = {
    messageOnTop: false,
  };

  public render() {
    return (
      <div className="core-ls">
        {(this.props.message && this.props.messageOnTop) && <span className="ls-message-top">{this.props.message}</span>}
        <svg className="ls-spinner" viewBox="0 0 50 50">
          <circle className="shape" cx="25" cy="25" r="20" fill="none" strokeWidth="4"></circle>
          <circle className="fill" cx="25" cy="25" r="20" fill="none" strokeWidth="4"></circle>
        </svg>
        {(this.props.message && !this.props.messageOnTop) && <span className="ls-message-bottom">{this.props.message}</span>}
      </div>
    );
  }
}

export default LoadingSpinner;
