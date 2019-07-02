/*---------------------------------------------------------------------------------------------
* Copyright (c) 2019 Bentley Systems, Incorporated. All rights reserved.
* Licensed under the MIT License. See LICENSE.md in the project root for license terms.
*--------------------------------------------------------------------------------------------*/
/** @module Common */

import * as React from "react";
import * as ReactDOM from "react-dom";

/** Properties for [[withOnOutsideClick]] React higher-order component
 * @public
 */
export interface WithOnOutsideClickProps {
  /** outside click callback function */
  onOutsideClick?: (event: MouseEvent) => any;
}

/** withOnOutsideClick is a React higher-order component that adds outside click support.
 * @public
 */
export const withOnOutsideClick = <ComponentProps extends {}>(
  // tslint:disable-next-line:variable-name
  Component: React.ComponentType<ComponentProps>,
  defaultOnOutsideClick?: (event: MouseEvent) => any,
  useCapture: boolean = true,
) => {
  return class WithOnOutsideClick extends React.PureComponent<ComponentProps & WithOnOutsideClickProps> {
    public ref: HTMLDivElement | undefined;

    public componentDidMount() {
      document.addEventListener("click", this.handleDocumentClick, useCapture);
    }

    public componentWillUnmount() {
      document.removeEventListener("click", this.handleDocumentClick, useCapture);
    }

    public handleDocumentClick = (e: MouseEvent) => {
      if (!this.ref)
        return;
      const componentElement = ReactDOM.findDOMNode(this.ref);
      if (componentElement && componentElement instanceof Element && !componentElement.contains(e.target as Node)) {
        if (this.props.onOutsideClick)
          return this.props.onOutsideClick(e);
        else if (defaultOnOutsideClick)
          return defaultOnOutsideClick(e);
      }
    }

    public setRef = (element: HTMLDivElement) => {
      this.ref = element;
    }

    public render() {
      const { onOutsideClick, ...props } = this.props; // todo: better solution to rest object of intersected type
      return (
        <div ref={this.setRef}>
          <Component {...props as ComponentProps} {...this.state} />
        </div>
      );
    }
  };
};
