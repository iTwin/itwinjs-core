/*---------------------------------------------------------------------------------------------
* Copyright (c) 2018 - present Bentley Systems, Incorporated. All rights reserved.
* Licensed under the MIT License. See LICENSE.md in the project root for license terms.
*--------------------------------------------------------------------------------------------*/
/** @module Base */

import * as React from "react";
import * as ReactDOM from "react-dom";
import Css from "../utilities/Css";
import Rectangle from "../utilities/Rectangle";

/** Properties of [[withContainInViewport]] HOC. */
export interface WithContainInViewportProps {
  /** Disables vertical containment and allows wrapped component to move out of bounds vertically. */
  noVerticalContainment?: boolean;
  /** Disables horizontal containment and allows wrapped component to move out of bounds horizontally. */
  noHorizontalContainment?: boolean;
}

/** HOC which will ensure, that wrapped component bounds are contained in viewport bounds. */
export const withContainInViewport = <ComponentProps extends {}>(
  // tslint:disable-next-line:variable-name
  Component: React.ComponentType<ComponentProps>,
) => {
  return class WithContainInViewport extends React.Component<ComponentProps & WithContainInViewportProps> {
    public getContainerBounds(): Rectangle {
      return new Rectangle(0, 0, window.innerWidth, window.innerHeight);
    }

    public getComponentBounds(root: HTMLElement): Rectangle {
      const bounds = root.getBoundingClientRect();
      return Rectangle.create(bounds);
    }

    public componentDidMount() {
      const root = ReactDOM.findDOMNode(this);
      if (!(root instanceof HTMLElement)) {
        return;
      }

      const component = this.getComponentBounds(root);
      const container = this.getContainerBounds();

      let contained = component;
      if (!this.props.noVerticalContainment && !this.props.noHorizontalContainment)
        contained = component.containIn(container);
      else if (this.props.noVerticalContainment)
        contained = component.containHorizontallyIn(container);
      else if (this.props.noHorizontalContainment)
        contained = component.containVerticallyIn(container);

      const offset = component.topLeft().getOffsetTo(contained.topLeft());
      root.style.position = "relative";
      root.style.top = Css.toPx(offset.y);
      root.style.left = Css.toPx(offset.x);
    }

    public render() {
      return (
        <Component
          {...this.props}
          {...this.state}
        />
      );
    }
  };
};

export default withContainInViewport;
