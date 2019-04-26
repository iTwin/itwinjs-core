/*---------------------------------------------------------------------------------------------
* Copyright (c) 2019 Bentley Systems, Incorporated. All rights reserved.
* Licensed under the MIT License. See LICENSE.md in the project root for license terms.
*--------------------------------------------------------------------------------------------*/
/** @module ToolSettings */

import * as classnames from "classnames";
import * as React from "react";
import { CommonProps } from "@bentley/ui-core";
import "./Scrollable.scss";

/** Properties of [[ScrollableToolSettings]] component.
 * @beta
 */
export interface ScrollableToolSettingsProps extends CommonProps {
  /** Tool settings content. */
  children?: React.ReactNode;
}

/** State of [[ScrollableToolSettings]] component. */
interface ScrollableToolSettingsState {
  /** Describes if bottom scroll indicator is visible. */
  isBottomIndicatorVisible: boolean;
  /** Describes if top scroll indicator is visible. */
  isTopIndicatorVisible: boolean;
}

/** Used in [[ToolSettings]] or [[NestedToolSettings]] components to display scrollable tool settings.
 * @beta
 */
export class ScrollableToolSettings extends React.PureComponent<ScrollableToolSettingsProps, ScrollableToolSettingsState> {
  public static readonly INDICATOR_HEIGHT = 20;
  private _content = React.createRef<HTMLDivElement>();

  public readonly state: ScrollableToolSettingsState = {
    isBottomIndicatorVisible: false,
    isTopIndicatorVisible: false,
  };

  public componentDidMount() {
    this._updateScrollIndicatorVisibility();
  }

  public render() {
    const className = classnames(
      "nz-widget-toolSettings-scrollable",
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
        {!this.state.isTopIndicatorVisible ? undefined :
          <div className="nz-indicator">
            <div
              className="nz-triangle"
              onClick={this._scrollTop}
            />
          </div>
        }
        {!this.state.isBottomIndicatorVisible ? undefined :
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

      const bottomOverflow = Math.floor(content.scrollHeight - content.clientHeight - content.scrollTop);
      return {
        isBottomIndicatorVisible: (bottomOverflow > 0),
        isTopIndicatorVisible: (content.scrollTop > 0),
      };
    });
  }

  private _scrollTop = () => {
    this.scroll(-1);
  }

  private _scrollBottom = () => {
    this.scroll(1);
  }

  private calculateOffset(content: HTMLElement) {
    return Math.max(10, content.clientHeight - ScrollableToolSettings.INDICATOR_HEIGHT * 1.5);
  }

  private scroll(direction: number) {
    const content = this._content.current;
    if (!content)
      return;

    const offset = this.calculateOffset(content) * direction;
    const from = content.scrollTop;
    const startTime = Date.now();
    const duration = 200;

    const scrollStep = () => {
      const time = Date.now();
      const timeFraction = Math.max(0, Math.min(1, (time - startTime) / duration));
      const top = from + timeFraction * offset;
      content.scrollTop = top;

      if (timeFraction < 1)
        window.requestAnimationFrame(scrollStep);
    };
    window.requestAnimationFrame(scrollStep);
  }
}
