/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
/** @packageDocumentation
 * @module Loading
 */

import "./LoadingSpinner.scss";
import * as React from "react";
import { ProgressRadial, ProgressRadialProps } from "@itwin/itwinui-react";

/** Properties for [[LoadingSpinner]] component
 * @public
 */
export interface LoadingSpinnerProps extends ProgressRadialProps {
  /** Message (text) displayed */
  message?: string;
  /** Position the message above or below the spinner (defaults to bottom) */
  messageOnTop?: boolean;
}

/**
 * A loading spinner component that optionally shows a text message.
 * @public
 */
export class LoadingSpinner extends React.PureComponent<LoadingSpinnerProps> {
  public static defaultProps: Partial<LoadingSpinnerProps> = {
    messageOnTop: false,
  };

  public render() {
    const { message, messageOnTop, ...rest } = this.props;
    return (
      <div className="core-ls">
        {(message && messageOnTop) && <span className="ls-message-top">{message}</span>}
        <ProgressRadial {...rest} indeterminate />
        {(message && !messageOnTop) && <span className="ls-message-bottom">{message}</span>}
      </div>
    );
  }
}
