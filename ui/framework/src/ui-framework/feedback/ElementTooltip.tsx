/*---------------------------------------------------------------------------------------------
* Copyright (c) 2019 Bentley Systems, Incorporated. All rights reserved.
* Licensed under the MIT License. See LICENSE.md in the project root for license terms.
*--------------------------------------------------------------------------------------------*/
/** @module Notification */

import * as React from "react";
import * as classnames from "classnames";

import { UiEvent, CommonProps } from "@bentley/ui-core";
import { XAndY } from "@bentley/geometry-core";
import { ToolTipOptions } from "@bentley/imodeljs-frontend";

import { ToolSettingsTooltip, offsetAndContainInContainer, PointProps, SizeProps, Rectangle, Point } from "@bentley/ui-ninezone";

/** [[ElementTooltip]] State.
 * @internal
 */
interface ElementTooltipState {
  isVisible: boolean;
  message: HTMLElement | string;
  position: PointProps;
  options?: ToolTipOptions;
}

/** [[ElementTooltipChangedEvent]] arguments.
 * @public
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
 * @public
 */
export class ElementTooltipChangedEvent extends UiEvent<ElementTooltipChangedEventArgs> { }

/** ElementTooltip React component.
 * @public
 */
export class ElementTooltip extends React.Component<CommonProps, ElementTooltipState> {
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

  private _size: SizeProps = {
    height: 0,
    width: 0,
  };
  private _element?: HTMLElement;
  private _position?: PointProps;

  /** @internal */
  public readonly state: Readonly<ElementTooltipState> = {
    message: "",
    isVisible: false,
    position: {
      x: 0,
      y: 0,
    },
  };

  constructor(props: CommonProps) {
    super(props);
  }

  public render() {
    if (!this.state.isVisible)
      return null;

    const className = classnames(
      "uifw-element-tooltip",
      this.props.className);

    let message: React.ReactNode;
    if (typeof this.state.message === "string")
      message = <div dangerouslySetInnerHTML={{ __html: this.state.message }} />;
    else
      message = <div dangerouslySetInnerHTML={{ __html: this.state.message.outerHTML }} />;

    return (
      <div className="uifw-element-tooltip-container">
        <ToolSettingsTooltip
          className={className}
          style={this.props.style}
          position={this.state.position}
          onSizeChanged={this._handleSizeChanged}
        >
          {message}
        </ToolSettingsTooltip>
      </div>
    );
  }

  public componentDidMount(): void {
    ElementTooltip.onElementTooltipChangedEvent.addListener(this._handleElementTooltipChangedEvent);
  }

  public componentWillUnmount(): void {
    ElementTooltip.onElementTooltipChangedEvent.removeListener(this._handleElementTooltipChangedEvent);
  }

  private _handleElementTooltipChangedEvent = (args: ElementTooltipChangedEventArgs) => {
    this._element = args.el;
    this._position = args.pt;
    this.setState({
      isVisible: args.isTooltipVisible,
      message: args.message,
    });
    this.updatePosition();
  }

  private _handleSizeChanged = (size: SizeProps) => {
    this._size = size;
    this.updatePosition();
  }

  private updatePosition() {
    this.setState((prevState) => {
      if (!this._element)
        return null;
      if (!this._position)
        return null;

      const containerBounds = Rectangle.create(this._element.getBoundingClientRect());
      const relativeBounds = Rectangle.createFromSize(this._size).offset(this._position);
      const adjustedPosition = adjustPosition(relativeBounds, containerBounds.getSize());
      const position = adjustedPosition.offset(containerBounds.topLeft());

      if (Point.create(position).equals(prevState.position))
        return null;

      return {
        position,
      };
    });
  }
}
