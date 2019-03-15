/*---------------------------------------------------------------------------------------------
* Copyright (c) 2019 Bentley Systems, Incorporated. All rights reserved.
* Licensed under the MIT License. See LICENSE.md in the project root for license terms.
*--------------------------------------------------------------------------------------------*/
/** @module Notification */

import * as React from "react";
import * as classnames from "classnames";
import { UiEvent } from "@bentley/ui-core";
import { XAndY } from "@bentley/geometry-core";
import { CommonProps, ToolSettingsTooltip, offsetAndContainInContainer, PointProps, SizeProps, Rectangle, Point } from "@bentley/ui-ninezone";
import { RelativePosition, NotifyMessageDetails, OutputMessagePriority } from "@bentley/imodeljs-frontend";
import "./Pointer.scss";

/** Properties of [[PointerMessage]] component. */
export interface PointerMessageProps extends CommonProps {
  /** Text to display */
  message?: string;
}

/** [[PointerMessage]] state.
 */
export interface PointerMessageState {
  isVisible: boolean;
  priority: OutputMessagePriority;
  message: string;
  detailedMessage?: string;
  position: PointProps;
}

/** [[PointerMessageChangedEvent]] arguments.
 */
export interface PointerMessageChangedEventArgs {
  isVisible: boolean;
  priority: OutputMessagePriority;
  message: string;
  detailedMessage?: string;
  relativePosition?: RelativePosition;
  viewport?: HTMLElement;
  pt?: XAndY;
}

const adjustmentOffset = 50;
const adjustPosition = offsetAndContainInContainer();
const adjustTopPosition = offsetAndContainInContainer({ x: 0, y: -adjustmentOffset });
const adjustTopRightPosition = offsetAndContainInContainer({ x: adjustmentOffset, y: -adjustmentOffset });
const adjustRightPosition = offsetAndContainInContainer({ x: adjustmentOffset, y: 0 });
const adjustBottomRightPosition = offsetAndContainInContainer({ x: adjustmentOffset, y: adjustmentOffset });
const adjustBottomPosition = offsetAndContainInContainer({ x: 0, y: adjustmentOffset });
const adjustBottomLeftPosition = offsetAndContainInContainer({ x: -adjustmentOffset, y: adjustmentOffset });
const adjustLeftPosition = offsetAndContainInContainer({ x: -adjustmentOffset, y: 0 });
const adjustTopLeftPosition = offsetAndContainInContainer({ x: -adjustmentOffset, y: -adjustmentOffset });

/** Pointer Message Changed Event emitted by the [[PointerMessage]] component
 */
export class PointerMessageChangedEvent extends UiEvent<PointerMessageChangedEventArgs> { }

/** Pointer message pops up near pointer when attempting an invalid interaction. */
export class PointerMessage extends React.Component<PointerMessageProps, PointerMessageState> {
  private static _pointerMessageChangedEvent: PointerMessageChangedEvent = new PointerMessageChangedEvent();

  public static get onPointerMessageChangedEvent(): PointerMessageChangedEvent { return PointerMessage._pointerMessageChangedEvent; }

  public static showMessage(message: NotifyMessageDetails): void {
    PointerMessage.onPointerMessageChangedEvent.emit({
      isVisible: true,
      priority: message.priority,
      message: message.briefMessage,
      detailedMessage: message.detailedMessage,
      relativePosition: message.relativePosition,
      viewport: message.viewport,
      pt: message.displayPoint,
    });
  }

  public static hideMessage(): void {
    PointerMessage.onPointerMessageChangedEvent.emit({
      isVisible: false,
      priority: OutputMessagePriority.None,
      message: "",
    });
  }

  public readonly state: Readonly<PointerMessageState> = {
    message: "",
    isVisible: false,
    priority: OutputMessagePriority.None,
    position: {
      x: 0,
      y: 0,
    },
  };

  private _relativePosition?: RelativePosition;
  private _viewport?: HTMLElement;
  private _position?: XAndY;
  private _size: SizeProps = {
    height: 0,
    width: 0,
  };

  public render(): React.ReactNode {
    if (!this.state.isVisible)
      return null;

    const className = classnames(
      "uifw-popup-message-pointer",
      this.props.className);

    return (
      <ToolSettingsTooltip
        className={className}
        onSizeChanged={this._handleSizeChanged}
        position={this.state.position}
        style={this.props.style}
      >
        {this.state.priority === OutputMessagePriority.Warning ? <span className="icon icon-status-warning" /> : <span />}
        {this.state.priority === OutputMessagePriority.Error ? <span className="icon icon-status-error" /> : <span />}
        {
          this.state.message &&
          <span
            className="popup-message-brief"
            dangerouslySetInnerHTML={{ __html: this.state.message }}
          />
        }
        {
          this.state.detailedMessage &&
          <div
            className="popup-message-detailed"
            dangerouslySetInnerHTML={{ __html: this.state.detailedMessage }}
          />
        }
      </ToolSettingsTooltip>
    );
  }

  public componentDidMount(): void {
    PointerMessage.onPointerMessageChangedEvent.addListener(this._handlePointerMessageChangedEvent);
  }

  public componentWillUnmount(): void {
    PointerMessage.onPointerMessageChangedEvent.removeListener(this._handlePointerMessageChangedEvent);
  }

  private _handleSizeChanged = (size: SizeProps) => {
    this._size = size;
    this.updatePosition();
  }

  private _handlePointerMessageChangedEvent = (args: PointerMessageChangedEventArgs) => {
    this._relativePosition = args.relativePosition;
    this._viewport = args.viewport;
    this._position = args.pt;
    this.setState(() => ({
      isVisible: args.isVisible,
      priority: args.priority,
      message: args.message,
      detailedMessage: args.detailedMessage,
    }));
    this.updatePosition();
  }

  private updatePosition() {
    let adjust = adjustPosition;
    switch (this._relativePosition) {
      case RelativePosition.Top:
        adjust = adjustTopPosition;
        break;
      case RelativePosition.TopRight:
        adjust = adjustTopRightPosition;
        break;
      case RelativePosition.Right:
        adjust = adjustRightPosition;
        break;
      case RelativePosition.BottomRight:
        adjust = adjustBottomRightPosition;
        break;
      case RelativePosition.Bottom:
        adjust = adjustBottomPosition;
        break;
      case RelativePosition.BottomLeft:
        adjust = adjustBottomLeftPosition;
        break;
      case RelativePosition.Left:
        adjust = adjustLeftPosition;
        break;
      case RelativePosition.TopLeft:
        adjust = adjustTopLeftPosition;
        break;
    }

    this.setState((prevState) => {
      if (!this._viewport)
        return null;
      if (!this._position)
        return null;

      const containerBounds = Rectangle.create(this._viewport.getBoundingClientRect());
      const relativeBounds = Rectangle.createFromSize(this._size).offset(this._position);
      const viewportOffset = new Point().getOffsetTo(containerBounds.topLeft());

      const adjustedPosition = adjust(relativeBounds, containerBounds.getSize());
      const position = adjustedPosition.offset(viewportOffset);

      if (Point.create(position).equals(prevState.position))
        return null;

      return {
        position,
      };
    });
  }
}

export default PointerMessage;
