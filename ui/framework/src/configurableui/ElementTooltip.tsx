/*---------------------------------------------------------------------------------------------
|  $Copyright: (c) 2018 Bentley Systems, Incorporated. All rights reserved. $
 *--------------------------------------------------------------------------------------------*/
/** @module ConfigurableUi */

import * as React from "react";
import * as ReactDOM from "react-dom";
import * as classnames from "classnames";

import { UiEvent } from "@bentley/ui-core";
import { XAndY } from "@bentley/geometry-core";
import { ToolTipOptions } from "@bentley/imodeljs-frontend";

import Css from "@bentley/ui-ninezone/lib/utilities/Css";
import "@bentley/ui-ninezone/lib/popup/tooltip/Tooltip.scss";
import "@bentley/ui-ninezone/lib/widget/tool-settings/Tooltip.scss";

/** [[ElementTooltip]] Props. */
export interface ElementTooltipProps {
  className?: string;
  style?: React.CSSProperties;
}

/** [[ElementTooltip]] State.
 */
export interface ElementTooltipState {
  isTooltipVisible: boolean;
  message: string;
  isTestingSize?: boolean;
  el?: HTMLElement;
  pt?: XAndY;
  options?: ToolTipOptions;
}

/** [[ElementTooltipChangedEvent]] arguments.
 */
export interface ElementTooltipChangedEventArgs {
  isTooltipVisible: boolean;
  message: string;
  el?: HTMLElement;
  pt?: XAndY;
  options?: ToolTipOptions;
}

/** ElementTooltip Changed Event class.
 */
export class ElementTooltipChangedEvent extends UiEvent<ElementTooltipChangedEventArgs> { }

/** ElementTooltip React component.
 */
export class ElementTooltip extends React.Component<ElementTooltipProps, ElementTooltipState> {
  private static _elementTooltipChangedEvent: ElementTooltipChangedEvent = new ElementTooltipChangedEvent();
  private static _isTooltipVisible: boolean;

  public static get onElementTooltipChangedEvent(): ElementTooltipChangedEvent { return ElementTooltip._elementTooltipChangedEvent; }
  public static get isTooltipVisible(): boolean { return ElementTooltip._isTooltipVisible; }

  public static showTooltip(el: HTMLElement, message: string, pt?: XAndY, options?: ToolTipOptions): void {
    ElementTooltip._isTooltipVisible = true;
    ElementTooltip.onElementTooltipChangedEvent.emit({ isTooltipVisible: true, el, message, pt, options });
  }

  public static hideTooltip(): void {
    ElementTooltip._isTooltipVisible = false;
    ElementTooltip.onElementTooltipChangedEvent.emit({ isTooltipVisible: false, message: "" });
  }

  /** hidden */
  public readonly state: Readonly<ElementTooltipState> = {
    message: "",
    isTooltipVisible: false,
  };

  public render() {
    const className = classnames(
      "nz-popup-tooltip-tooltip",
      "nz-widget-toolSettings-tooltip",
      this.state.isTooltipVisible && "nz-is-visible",
      "element-tooltip",
      this.state.isTestingSize && "invisible",
      this.props.className);

    if (this.state.isTooltipVisible) {
      return (
        <div
          className={className}
          style={this.props.style}
        >
          {this.state.message &&
            <div dangerouslySetInnerHTML={{ __html: this.state.message }} />
          }
        </div>
      );
    }

    return null;
  }

  public componentDidMount(): void {
    ElementTooltip.onElementTooltipChangedEvent.addListener(this._handleElementTooltipChangedEvent);
  }

  public componentWillUnmount(): void {
    ElementTooltip.onElementTooltipChangedEvent.removeListener(this._handleElementTooltipChangedEvent);
  }

  private _handleElementTooltipChangedEvent = (args: ElementTooltipChangedEventArgs) => {
    // Render it first as invisible (opacity: 0%) so we can get the size, then align it and re-render it with full opacity
    this.setState(
      () => ({
        isTooltipVisible: args.isTooltipVisible,
        isTestingSize: args.isTooltipVisible,
        message: args.message,
        el: args.el,
        pt: args.pt,
      }),
      () => {
        if (args.isTooltipVisible) {
          this.alignTooltip(this.state.el, this.state.pt);

          this.setState(() => ({
            isTooltipVisible: args.isTooltipVisible,
            isTestingSize: false,
            message: this.state.message,
          }));
        }
      },
    );
  }

  private alignTooltip(el?: HTMLElement, pt?: XAndY) {
    const me = ReactDOM.findDOMNode(this) as HTMLElement;

    const parent = el;
    if (!parent)
      return;

    const parentRect = parent.getBoundingClientRect();

    let mouseX = parentRect.left;
    let mouseY = parentRect.top;

    if (pt) {
      mouseX += pt.x;
      mouseY += pt.y;
    } else {
      mouseX += parentRect.width / 2;
      mouseY += parentRect.height / 2;
    }

    const offset = 8;
    let left = mouseX + offset;
    let top = mouseY + offset;

    let right = left + me.clientWidth;
    let bottom = top + me.clientHeight;

    const diffToContainRight = right - parentRect.right;
    const diffToContainBottom = bottom - parentRect.bottom;
    if (diffToContainRight > 0)
      left -= diffToContainRight;
    if (diffToContainBottom > 0)
      top -= diffToContainBottom;

    if (left < parentRect.left)
      left = parentRect.left;
    if (top < parentRect.top)
      top = parentRect.top;

    right = left + me.clientWidth;
    bottom = top + me.clientHeight;

    if (right > parentRect.right)
      left = parentRect.right - me.clientWidth;
    if (bottom > parentRect.bottom)
      top = parentRect.bottom - me.clientHeight;

    me.style.left = Css.toPx(left);
    me.style.top = Css.toPx(top);
  }
}
