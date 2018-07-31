/*---------------------------------------------------------------------------------------------
|  $Copyright: (c) 2018 Bentley Systems, Incorporated. All rights reserved. $
 *--------------------------------------------------------------------------------------------*/
/** @module ToolSettings */

import * as classnames from "classnames";
import * as React from "react";
import CommonProps from "../../../../utilities/Props";
import "./ScrollableArea.scss";

export interface ScrollableAreaProps extends CommonProps {
  onScroll?: React.UIEventHandler<HTMLDivElement>;
  containerRef?: React.Ref<HTMLDivElement>;
}

/**
 * TODO: couldn't find a good way to get scrolling handled by browser without showing a scrollbar.
 * For now there is CSS hack applied, but it does not work well if one wants to have dynamic size content.
 * Probably will need to implement custom scrolling behavior.
 */
export default class ScrollableArea extends React.Component<ScrollableAreaProps> {
  public render() {
    const className = classnames(
      "nz-widget-toolSettings-settings-popover-scrollableArea",
      this.props.className);

    return (
      <div
        className={className}
        style={this.props.style}
      >
        <div
          className="nz-container"
          onScroll={this.props.onScroll}
          ref={this.props.containerRef}
        >
          {this.props.children}
        </div>
      </div>
    );
  }
}
