/*---------------------------------------------------------------------------------------------
|  $Copyright: (c) 2018 Bentley Systems, Incorporated. All rights reserved. $
 *--------------------------------------------------------------------------------------------*/
/** @module ToolSettings */

import * as classnames from "classnames";
import * as React from "react";
import Props from "../../../../utilities/Props";
import ScrollableArea from "./ScrollableArea";
import "./Overflow.scss";

export interface ToolSettingsOverflowState {
  isScrollBottomIndicatorVisible?: boolean;
  isScrollTopIndicatorVisible?: boolean;
}

export default class ToolSettingsOverflow extends React.Component<Props, ToolSettingsOverflowState> {
  private _content: HTMLDivElement | undefined = undefined;
  private _scrollableContainer: HTMLDivElement | undefined = undefined;
  // private _observer: MutationObserver | undefined;

  public readonly state: ToolSettingsOverflowState = {
    isScrollBottomIndicatorVisible: false,
  };

  public componentDidMount() {
    this.hideOrShowScrollIndicators();

    /**
     * TODO: need a faster way to hide/show the overflow indicator.
     */
    /*this._observer = new MutationObserver((mutations: MutationRecord[], observer: MutationObserver) => {
      this.hideOrShowScrollIndicators();
    });

    const options: MutationObserverInit = {
      attributeOldValue: true,
      attributes: true,
      characterData: true,
      characterDataOldValue: true,
      childList: true,
      subtree: true,
    };

    this._observer.observe(document, options);*/
  }

  /*public componentWillUnmount() {
    if (!this._observer)
      return;
    this._observer.disconnect();
  }*/

  public render() {
    const isInVerticalScroll = this.state.isScrollBottomIndicatorVisible || this.state.isScrollTopIndicatorVisible;
    const className = classnames(
      "nz-widget-toolSettings-settings-popover-overflow",
      isInVerticalScroll && "nz-is-in-vertical-scroll",
      this.state.isScrollTopIndicatorVisible && "nz-is-scroll-top-indicator-visible",
      this.state.isScrollBottomIndicatorVisible && "nz-is-scroll-bottom-indicator-visible",
      this.props.className);

    return (
      <div
        className={className}
        style={this.props.style}
      >
        <ScrollableArea
          className="nz-scrollableArea"
          onScroll={this.hideOrShowScrollIndicators}
          containerRef={(div) => div && (this._scrollableContainer = div)}
        >
          <div
            className="nz-content"
            ref={(div) => div && (this._content = div)}
          >
            {this.props.children}
          </div>
        </ScrollableArea>

        <div className="nz-top-indicator">
          <div className="nz-triangle" />
        </div>
        <div className="nz-bottom-indicator">
          <div className="nz-triangle" />
        </div>
      </div>
    );
  }

  private hideOrShowScrollIndicators = () => {
    if (!this._content)
      return;
    if (!this._scrollableContainer)
      return;

    const scrolledElement = this._scrollableContainer;
    const bottomOverflow = this._content.clientHeight - scrolledElement.clientHeight - scrolledElement.scrollTop;
    const topOverflow = scrolledElement.scrollTop;

    this.setState(() => {
      return {
        isScrollBottomIndicatorVisible: (bottomOverflow > 0),
        isScrollTopIndicatorVisible: (topOverflow > 0),
      };
    });
  }
}
