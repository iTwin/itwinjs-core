/*---------------------------------------------------------------------------------------------
|  $Copyright: (c) 2018 Bentley Systems, Incorporated. All rights reserved. $
 *--------------------------------------------------------------------------------------------*/
/** @module ToolSettings */

import * as classnames from "classnames";
import * as React from "react";
import CommonProps from "../../utilities/Props";
import "./ScrollableArea.scss";

/** Properties of [[ScrollableArea]] component. */
export interface ScrollableAreaProps extends CommonProps {
  /** Scrollable content. */
  content?: React.ReactNode;
}

/** State of [[ScrollableArea]] component. */
export interface ScrollableAreaState {
  /** Describes if bottom scroll indicator is visible. */
  isScrollBottomIndicatorVisible: boolean;
  /** Describes if top scroll indicator is visible. */
  isScrollTopIndicatorVisible: boolean;
}

/**
 * Scrollable area with no scroll bar showed. Scrolling is controlled with two arrow buttons.
 * @note Used as content in [[Settings]] and [[Nested]] components
 */
export default class ScrollableArea extends React.Component<ScrollableAreaProps, ScrollableAreaState> {
  public static readonly INDICATOR_HEIGHT = 20;
  private _content = React.createRef<HTMLDivElement>();

  public constructor(props: Readonly<ScrollableAreaProps>) {
    super(props);

    this.state = {
      isScrollBottomIndicatorVisible: false,
      isScrollTopIndicatorVisible: false,
    };
  }

  public componentDidMount() {
    this._updateScrollIndicatorVisibility();
  }

  public render() {
    const className = classnames(
      "nz-widget-toolSettings-scrollableArea",
      this.props.className);

    return (
      <div
        className={className}
        style={this.props.style}
      >
        <div
          className="nz-content"
          ref={this._content}
          onScroll={this._updateScrollIndicatorVisibility}
        >
          {this.props.children}
        </div>
        {!this.state.isScrollTopIndicatorVisible ? undefined :
          <div className="nz-indicator">
            <div
              className="nz-triangle"
              onClick={this._scrollTop}
            />
          </div>
        }
        {!this.state.isScrollBottomIndicatorVisible ? undefined :
          <div className="nz-indicator nz-bottom">
            <div
              className="nz-triangle"
              onClick={this._scrollBottom}
            />
          </div>
        }
      </div>
    );
  }

  private _updateScrollIndicatorVisibility = () => {
    this.setState(() => {
      const content = this._content.current;
      if (!content)
        return;

      const bottomOverflow = content.scrollHeight - content.clientHeight - content.scrollTop;
      return {
        isScrollBottomIndicatorVisible: (bottomOverflow > 0),
        isScrollTopIndicatorVisible: (content.scrollTop > 0),
      };
    });
  }

  private _scrollTop = () => {
    this.scroll(-1);
  }

  private _scrollBottom = () => {
    this.scroll(1);
  }

  private calculateOffset(content: HTMLDivElement) {
    return content.clientHeight - ScrollableArea.INDICATOR_HEIGHT * 2;
  }

  private scroll(offsetMultiplier: number) {
    const content = this._content.current;
    if (!content)
      return;

    const offset = this.calculateOffset(content) * offsetMultiplier;
    const from = content.scrollTop;
    const startTime = Date.now();
    const duration = 200;

    const scrollStep = () => {
      const time = Date.now();
      const timeFraction = Math.max(0, Math.min(1, (time - startTime) / duration));
      const top = from + timeFraction * offset;
      content.scrollTo({ top });

      if (timeFraction < 1)
        window.requestAnimationFrame(scrollStep);
    };
    window.requestAnimationFrame(scrollStep);
  }
}
