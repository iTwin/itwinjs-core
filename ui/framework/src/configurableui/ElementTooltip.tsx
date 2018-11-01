/*---------------------------------------------------------------------------------------------
* Copyright (c) 2018 Bentley Systems, Incorporated. All rights reserved.
* Licensed under the MIT License. See LICENSE.md in the project root for license terms.
*--------------------------------------------------------------------------------------------*/
/** @module Notification */

import * as React from "react";
import * as classnames from "classnames";

import { UiEvent } from "@bentley/ui-core";
import { XAndY } from "@bentley/geometry-core";
import { ToolTipOptions } from "@bentley/imodeljs-frontend";

import ToolSettingsTooltip from "@bentley/ui-ninezone/lib/widget/tool-settings/Tooltip";
import Tooltip, { offsetAndContainInContainer } from "@bentley/ui-ninezone/lib/popup/tooltip/Tooltip";

/** [[ElementTooltip]] Props. */
export interface ElementTooltipProps {
  className?: string;
  style?: React.CSSProperties;
}

/** [[ElementTooltip]] State.
 */
export interface ElementTooltipState {
  isTooltipVisible: boolean;
  message: HTMLElement | string;
  el?: HTMLElement;
  pt?: XAndY;
  options?: ToolTipOptions;
}

/** [[ElementTooltipChangedEvent]] arguments.
 */
export interface ElementTooltipChangedEventArgs {
  isTooltipVisible: boolean;
  message: HTMLElement | string;
  el?: HTMLElement;
  pt?: XAndY;
  options?: ToolTipOptions;
}

const adjustPosition = offsetAndContainInContainer({ x: 8, y: 8 });

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

  public static showTooltip(el: HTMLElement, message: HTMLElement | string, pt?: XAndY, options?: ToolTipOptions): void {
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
    if (!this.state.isTooltipVisible)
      return null;

    const className = classnames(
      "element-tooltip",
      this.props.className);

    let message: React.ReactNode;
    if (typeof this.state.message === "string")
      message = <div dangerouslySetInnerHTML={{ __html: this.state.message }} />;
    else
      message = <div dangerouslySetInnerHTML={{ __html: this.state.message.outerHTML }} />;

    return (
      <ToolSettingsTooltip
        className={className}
        style={this.props.style}
        position={this.state.pt}
        adjustPosition={adjustPosition}
        containIn={this._handleContainIn}
      >
        {message}
      </ToolSettingsTooltip>
    );
  }

  public componentDidMount(): void {
    ElementTooltip.onElementTooltipChangedEvent.addListener(this._handleElementTooltipChangedEvent);
  }

  public componentWillUnmount(): void {
    ElementTooltip.onElementTooltipChangedEvent.removeListener(this._handleElementTooltipChangedEvent);
  }

  private _handleContainIn = (tooltip: HTMLElement) => {
    if (this.state.el)
      return this.state.el;
    return Tooltip.defaultProps.containIn(tooltip);
  }

  private _handleElementTooltipChangedEvent = (args: ElementTooltipChangedEventArgs) => {
    this.setState(() => ({
      isTooltipVisible: args.isTooltipVisible,
      message: args.message,
      el: args.el,
      pt: args.pt,
    }));
  }
}
