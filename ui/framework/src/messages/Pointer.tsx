/*---------------------------------------------------------------------------------------------
* Copyright (c) 2018 Bentley Systems, Incorporated. All rights reserved.
* Licensed under the MIT License. See LICENSE.md in the project root for license terms.
*--------------------------------------------------------------------------------------------*/
/** @module Notification */

import * as React from "react";
import * as classnames from "classnames";
import { UiEvent } from "@bentley/ui-core";
import { XAndY } from "@bentley/geometry-core";
import CommonProps from "@bentley/ui-ninezone/lib/utilities/Props";

import ToolSettingsTooltip from "@bentley/ui-ninezone/lib/widget/tool-settings/Tooltip";

import "./Pointer.scss";
import Tooltip, { offsetAndContainInContainer } from "@bentley/ui-ninezone/lib/popup/tooltip/Tooltip";
import { RelativePosition, NotifyMessageDetails } from "@bentley/imodeljs-frontend";

/** Properties of [[Pointer]] component. */
export interface PointerProps extends CommonProps {
  /** Text to display */
  message?: string;
}

/** [[Pointer]] state.
 */
export interface PointerMessageState {
  isVisible: boolean;
  message: string;
  detailedMessage?: string;
  relativePosition?: RelativePosition;
  viewport?: HTMLElement;
  pt?: XAndY;
}

/** [[PointerMessageChangedEvent]] arguments.
 */
export interface PointerMessageChangedEventArgs {
  isVisible: boolean;
  message: string;
  detailedMessage?: string;
  relativePosition?: RelativePosition;
  viewport?: HTMLElement;
  pt?: XAndY;
}

/** Pointer Message Changed Event emitted by the [[Pointer]] component
 */
export class PointerMessageChangedEvent extends UiEvent<PointerMessageChangedEventArgs> { }

/** Pointer message pops up near pointer when attempting an invalid interaction. */
export class Pointer extends React.Component<PointerProps> {
  private static _pointerMessageChangedEvent: PointerMessageChangedEvent = new PointerMessageChangedEvent();

  public static get onPointerMessageChangedEvent(): PointerMessageChangedEvent { return Pointer._pointerMessageChangedEvent; }

  public static showMessage(message: NotifyMessageDetails): void {
    Pointer.onPointerMessageChangedEvent.emit({
      isVisible: true,
      message: message.briefMessage,
      detailedMessage: message.detailedMessage,
      relativePosition: message.relativePosition,
      viewport: message.viewport,
      pt: message.displayPoint,
    });
  }

  public static hideMessage(): void {
    Pointer.onPointerMessageChangedEvent.emit({
      isVisible: false,
      message: "",
    });
  }

  public readonly state: Readonly<PointerMessageState> = {
    message: "",
    isVisible: false,
  };

  public render(): React.ReactNode {
    if (!this.state.isVisible)
      return null;

    const className = classnames(
      "nz-popup-message-pointer",
      this.props.className);

    return (
      <ToolSettingsTooltip
        className={className}
        style={this.props.style}
        position={this.state.pt}
        containIn={this._handleContainIn}
        adjustPosition={this._adjustTooltipPosition()}
      >
        {
          this.state.message &&
          <div
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
    Pointer.onPointerMessageChangedEvent.addListener(this._handlePointerMessageChangedEvent);
  }

  public componentWillUnmount(): void {
    Pointer.onPointerMessageChangedEvent.removeListener(this._handlePointerMessageChangedEvent);
  }

  private _handleContainIn = (message: HTMLElement) => {
    if (this.state.viewport)
      return this.state.viewport;
    return Tooltip.defaultProps.containIn(message);
  }

  private _handlePointerMessageChangedEvent = (args: PointerMessageChangedEventArgs) => {
    this.setState(() => ({
      isVisible: args.isVisible,
      message: args.message,
      detailedMessage: args.detailedMessage,
      relativePosition: args.relativePosition,
      viewport: args.viewport,
      pt: args.pt,
    }));
  }

  private _adjustTooltipPosition(): any {
    let tooltipAdjustment = offsetAndContainInContainer();

    if (!this.state)
      return tooltipAdjustment;

    const adjustmentOffset = 50;
    switch (this.state.relativePosition) {
      case RelativePosition.Top:
        tooltipAdjustment = offsetAndContainInContainer({ x: 0, y: -adjustmentOffset });
        break;
      case RelativePosition.TopRight:
        tooltipAdjustment = offsetAndContainInContainer({ x: adjustmentOffset, y: -adjustmentOffset });
        break;
      case RelativePosition.Right:
        tooltipAdjustment = offsetAndContainInContainer({ x: adjustmentOffset, y: 0 });
        break;
      case RelativePosition.BottomRight:
        tooltipAdjustment = offsetAndContainInContainer({ x: adjustmentOffset, y: adjustmentOffset });
        break;
      case RelativePosition.Bottom:
        tooltipAdjustment = offsetAndContainInContainer({ x: 0, y: adjustmentOffset });
        break;
      case RelativePosition.BottomLeft:
        tooltipAdjustment = offsetAndContainInContainer({ x: -adjustmentOffset, y: adjustmentOffset });
        break;
      case RelativePosition.Left:
        tooltipAdjustment = offsetAndContainInContainer({ x: -adjustmentOffset, y: 0 });
        break;
      case RelativePosition.TopLeft:
        tooltipAdjustment = offsetAndContainInContainer({ x: -adjustmentOffset, y: -adjustmentOffset });
        break;
    }
    return tooltipAdjustment;
  }
}

export default Pointer;
