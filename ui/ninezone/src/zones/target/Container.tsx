/*---------------------------------------------------------------------------------------------
|  $Copyright: (c) 2018 Bentley Systems, Incorporated. All rights reserved. $
 *--------------------------------------------------------------------------------------------*/
/** @module Zone */

import * as classnames from "classnames";
import * as React from "react";
import Props from "../../utilities/Props";
import "./Container.scss";

export default class Container extends React.Component<Props> {
  public render() {
    const childrenCount = React.Children.count(this.props.children);
    const isSingleTarget = childrenCount === 1;

    const className = classnames(
      "nz-zones-target-container",
      isSingleTarget && "nz-single-target",
      this.props.className);

    return (
      <div
        className={className}
        style={this.props.style}
      >
        {
          isSingleTarget ?
            this.props.children :
            React.Children.map(this.props.children, (target) => {
              return (
                <div className="nz-target">
                  {target}
                </div>
              );
            })
        }
      </div>
    );
  }
}
