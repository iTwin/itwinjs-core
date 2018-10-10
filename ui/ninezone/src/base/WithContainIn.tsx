/*---------------------------------------------------------------------------------------------
* Copyright (c) 2018 Bentley Systems, Incorporated. All rights reserved.
* Licensed under the MIT License. See LICENSE.md in the project root for license terms.
*--------------------------------------------------------------------------------------------*/
/** @module Base */

import * as React from "react";
import * as ReactDOM from "react-dom";
import Css from "../utilities/Css";
import Rectangle from "../utilities/Rectangle";

/** Properties of [[withContainIn]] HOC. */
export interface WithContainInProps {
  /** Container in which the wrapped component is contained. */
  container?: React.RefObject<React.ReactInstance>;
  /** Disables vertical containment and allows wrapped component to move out of bounds vertically. */
  noVerticalContainment?: boolean;
  /** Disables horizontal containment and allows wrapped component to move out of bounds horizontally. */
  noHorizontalContainment?: boolean;
}

/** HOC which will ensure, that wrapped component bounds are contained in specified container bounds. */
export const withContainIn = <ComponentProps extends {}>(
  // tslint:disable-next-line:variable-name
  Component: React.ComponentType<ComponentProps>,
) => {
  return class WithContainIn extends React.Component<ComponentProps & WithContainInProps> {
    public getContainerBounds(): Rectangle {
      if (!this.props.container)
        return new Rectangle();
      if (!this.props.container.current)
        return new Rectangle();
      const container = ReactDOM.findDOMNode(this.props.container.current);
      if (!(container instanceof HTMLElement)) {
        return new Rectangle();
      }

      const containerBounds = container.getBoundingClientRect();
      const containerStyle = window.getComputedStyle(container);
      const topPadding = containerStyle.paddingTop ? parseFloat(containerStyle.paddingTop) : 0;
      const leftPadding = containerStyle.paddingLeft ? parseFloat(containerStyle.paddingLeft) : 0;
      const top = containerBounds.top + topPadding;
      const left = containerBounds.left + leftPadding;
      return new Rectangle(top, left, containerBounds.right, containerBounds.bottom);
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
      const copyProps = Object.assign({}, this.props);
      delete (copyProps as WithContainInProps).noVerticalContainment;
      delete (copyProps as WithContainInProps).noHorizontalContainment;

      return (
        <Component
          {...copyProps}
          {...this.state}
        />
      );
    }
  };
};

export default withContainIn;
