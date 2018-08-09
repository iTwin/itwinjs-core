/*---------------------------------------------------------------------------------------------
|  $Copyright: (c) 2018 Bentley Systems, Incorporated. All rights reserved. $
 *--------------------------------------------------------------------------------------------*/
/** @module Common */

import * as React from "react";
import Timer from "../utils/Timer";

/** Props for withTimeout React higher-order component */
export interface WithTimeoutProps {
  /** Indicates whether to start the timeout */
  startTimeout?: boolean;
  /** Timeout duration in milliseconds */
  timeout: number;
  /** Callback function for timeout */
  onTimeout?: () => void;
}

/** withTimeout is a React higher-order component that adds timeout support. */
export const withTimeout = <ComponentProps extends {}>(
  // tslint:disable-next-line:variable-name
  Component: React.ComponentType<ComponentProps>,
) => {
  return class WithTimeout extends React.Component<ComponentProps & WithTimeoutProps> {
    public _timer: Timer | undefined = undefined;

    public componentDidMount(): void {
      this._timer = new Timer(this.props.timeout);
      this._timer.setOnExecute(() => this.props.onTimeout && this.props.onTimeout());

      this.startTimeout();
    }

    public componentWillUnmount(): void {
      if (!this._timer)
        return;
      this._timer.stop();
    }

    public componentWillReceiveProps(_nextProps: Readonly<WithTimeoutProps>): void {
      if (!this._timer)
        return;
      this._timer.delay = this.props.timeout;
      this.startTimeout();
    }

    public render() {
      const { startTimeout, timeout, onTimeout, ...props } = this.props as WithTimeoutProps;
      return (
        <div>
          <Component {...props} {...this.state} />
        </div>
      );
    }

    public startTimeout() {
      if (!this._timer)
        return;
      if (!this.props.startTimeout)
        return;
      if (this._timer.isRunning)
        return;

      this._timer.start();
    }
  };
};

export default withTimeout;
