/*---------------------------------------------------------------------------------------------
|  $Copyright: (c) 2018 Bentley Systems, Incorporated. All rights reserved. $
 *--------------------------------------------------------------------------------------------*/
/** @module Common */

import * as React from "react";

/** Props for withIsPressed React higher-order component */
export interface WithIsPressedProps {
  /** initial value for pressed status */
  isPressed?: boolean;
  /** callback function for [isPressed] change */
  onIsPressedChange?: (isPressed: boolean) => void;
}

/** withIsPressed is a React higher-order component that adds pointer and mouse events. */
export const withIsPressed = <ComponentProps extends {}>(
  // tslint:disable-next-line:variable-name
  Component: React.ComponentType<ComponentProps>,
) => {
  return class WithIsPressed extends React.Component<ComponentProps & WithIsPressedProps> {
    public handleOnPointerDown = () => {
      this.changeIsPressed(true);
    }

    public handleOnPointerUp = () => {
      this.changeIsPressed(false);
    }

    public handleOnMouseLeave = () => {
      this.changeIsPressed(false);
    }

    public changeIsPressed = (isPressed: boolean) => {
      if (this.props.isPressed === isPressed)
        return;

      this.props.onIsPressedChange && this.props.onIsPressedChange(isPressed);
    }

    public render() {
      const { isPressed, onIsPressedChange, ...props } = this.props as WithIsPressedProps; // todo: better solution to rest object of intersected type
      return (
        <div
          onMouseDown={this.handleOnPointerDown}
          onMouseUp={this.handleOnPointerUp}
          onTouchStart={this.handleOnPointerDown}
          onTouchEnd={this.handleOnPointerUp}
          onMouseLeave={this.handleOnMouseLeave}
        >
          <Component {...props} {...this.state} />
        </div>
      );
    }
  };
};

export default withIsPressed;
