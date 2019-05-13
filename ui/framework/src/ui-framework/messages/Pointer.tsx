/*---------------------------------------------------------------------------------------------
* Copyright (c) 2019 Bentley Systems, Incorporated. All rights reserved.
* Licensed under the MIT License. See LICENSE.md in the project root for license terms.
*--------------------------------------------------------------------------------------------*/
/** @module Notification */

import * as React from "react";
import * as classnames from "classnames";
import { UiEvent, CommonProps } from "@bentley/ui-core";
import { XAndY } from "@bentley/geometry-core";
import { offsetAndContainInContainer, Point, PointProps, Rectangle, SizeProps, Tooltip } from "@bentley/ui-ninezone";
import { RelativePosition, NotifyMessageDetails, OutputMessagePriority } from "@bentley/imodeljs-frontend";
import "./Pointer.scss";

/** Properties of [[PointerMessage]] component.
 * @public
 */
export interface PointerMessageProps extends CommonProps {
  /** Text to display */
  message?: string;
}

/** [[PointerMessage]] state.
 * @internal
 */
interface PointerMessageState {
  isVisible: boolean;
  priority: OutputMessagePriority;
  message: string;
  detailedMessage?: string;
  position: PointProps;
}

/** [[PointerMessageChangedEvent]] arguments.
 * @public
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

/** Pointer Message Changed Event emitted by the [[PointerMessage]] component
 * @public
 */
export class PointerMessageChangedEvent extends UiEvent<PointerMessageChangedEventArgs> { }

/** Pointer message pops up near pointer when attempting an invalid interaction.
 * @public
 */
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
      <Tooltip
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
            className="uifw-popup-message-brief"
            dangerouslySetInnerHTML={{ __html: this.state.message }}
          />
        }
        {
          this.state.detailedMessage &&
          <div
            className="uifw-popup-message-detailed"
            dangerouslySetInnerHTML={{ __html: this.state.detailedMessage }}
          />
        }
      </Tooltip>
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
    const adjustmentOffset = 50;
    let offset: PointProps | undefined;
    switch (this._relativePosition) {
      case RelativePosition.Top:
        offset = { x: 0, y: -adjustmentOffset };
        break;
      case RelativePosition.TopRight:
        offset = { x: adjustmentOffset, y: -adjustmentOffset };
        break;
      case RelativePosition.Right:
        offset = { x: adjustmentOffset, y: 0 };
        break;
      case RelativePosition.BottomRight:
        offset = { x: adjustmentOffset, y: adjustmentOffset };
        break;
      case RelativePosition.Bottom:
        offset = { x: 0, y: adjustmentOffset };
        break;
      case RelativePosition.BottomLeft:
        offset = { x: -adjustmentOffset, y: adjustmentOffset };
        break;
      case RelativePosition.Left:
        offset = { x: -adjustmentOffset, y: 0 };
        break;
      case RelativePosition.TopLeft:
        offset = { x: -adjustmentOffset, y: -adjustmentOffset };
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

      const adjustedPosition = offsetAndContainInContainer(relativeBounds, containerBounds.getSize(), offset);
      const position = adjustedPosition.offset(viewportOffset);

      if (Point.create(position).equals(prevState.position))
        return null;

      return {
        position,
      };
    });
  }
}
