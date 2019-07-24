/*---------------------------------------------------------------------------------------------
* Copyright (c) 2019 Bentley Systems, Incorporated. All rights reserved.
* Licensed under the MIT License. See LICENSE.md in the project root for license terms.
*--------------------------------------------------------------------------------------------*/
/** @module Cursor */

import * as React from "react";

import { CommonProps, UiEvent } from "@bentley/ui-core";
import { RelativePosition } from "@bentley/imodeljs-frontend";
import { Size, Point, Rectangle, TitleBar } from "@bentley/ui-ninezone";

import "./CursorPopup.scss";

/** Properties for the [[CursorPopup]] open method
 * @alpha
 */
export interface CursorPopupProps {
  title?: string;

  // called on popup close
  onClose?: () => void;

  // callback to apply changes
  onApply?: () => void;
}

/** State for the [[CursorPopup]] React component
 * @internal
 */
interface CursorPopupState extends CursorPopupProps {
  showPopup: boolean;
  content: React.ReactNode;
  pt: Point;
  offset: number;
  relativePosition: RelativePosition;
}

/** CursorPopup Open Event Args interface.
 * @internal
 */
interface CursorPopupOpenEventArgs {
  content: React.ReactNode;
  pt: Point;
  offset: number;
  relativePosition: RelativePosition;
  props?: CursorPopupProps;
}

/** CursorPopup Open Event class.
 * @internal
 */
class CursorPopupOpenEvent extends UiEvent<CursorPopupOpenEventArgs> { }

/** CursorPopup Update Position Event Args interface.
 * @internal
 */
interface CursorPopupUpdatePositionEventArgs {
  pt: Point;
  offset: number;
  relativePosition: RelativePosition;
}

/** CursorPopup Update Position Event class.
 * @internal
 */
class CursorPopupUpdatePositionEvent extends UiEvent<CursorPopupUpdatePositionEventArgs> { }

/** CursorPopup Close Event Args interface.
 * @internal
 */
interface CursorPopupCloseEventArgs {
  apply: boolean;
}

/** CursorPopup Close Event class.
 * @internal
 */
class CursorPopupCloseEvent extends UiEvent<CursorPopupCloseEventArgs> { }

/** CursorPopup component
 * @alpha
 */
export class CursorPopup extends React.Component<CommonProps, CursorPopupState> {

  private static readonly _onCursorPopupOpenEvent = new CursorPopupOpenEvent();
  private static readonly _onCursorPopupUpdatePositionEvent = new CursorPopupUpdatePositionEvent();
  private static readonly _onCursorPopupCloseEvent = new CursorPopupCloseEvent();

  /** Called to open popup with a new set of properties
   */
  public static open(content: React.ReactNode, pt: Point, offset: number, relativePosition: RelativePosition, props?: CursorPopupProps) {
    CursorPopup._onCursorPopupOpenEvent.emit({ content, pt, offset, relativePosition, props });
  }

  /** Called to update popup with a new set of properties
   */
  public static update(content: React.ReactNode, pt: Point, offset: number, relativePosition: RelativePosition) {
    CursorPopup._onCursorPopupOpenEvent.emit({ content, pt, offset, relativePosition });
  }

  /** Called to move the open popup to new location
   */
  public static updatePosition(pt: Point, offset: number, relativePosition: RelativePosition) {
    CursorPopup._onCursorPopupUpdatePositionEvent.emit({ pt, offset, relativePosition });
  }

  /** Called when tool wants to close the popup
   */
  public static close(apply: boolean) {
    CursorPopup._onCursorPopupCloseEvent.emit({ apply });
  }

  /////////////////////////////////////////////////////////////////////////////////////////////////

  private _isMounted: boolean = false;
  private _popupRef = React.createRef<HTMLDivElement>();

  /** @internal */
  constructor(props: CommonProps) {
    super(props);

    this.state = {
      showPopup: false,
      content: undefined,
      pt: new Point(),
      offset: 0,
      relativePosition: RelativePosition.TopRight,
    };
  }

  /** @internal */
  public componentDidMount() {
    this._isMounted = true;
    CursorPopup._onCursorPopupOpenEvent.addListener(this._handleCursorPopupOpenEvent);
    CursorPopup._onCursorPopupUpdatePositionEvent.addListener(this._handleCursorPopupUpdatePositionEvent);
    CursorPopup._onCursorPopupCloseEvent.addListener(this._handleCursorPopupCloseEvent);
  }

  /** @internal */
  public componentWillUnmount() {
    this._isMounted = false;
    CursorPopup._onCursorPopupOpenEvent.removeListener(this._handleCursorPopupOpenEvent);
    CursorPopup._onCursorPopupUpdatePositionEvent.removeListener(this._handleCursorPopupUpdatePositionEvent);
    CursorPopup._onCursorPopupCloseEvent.removeListener(this._handleCursorPopupCloseEvent);
  }

  private _handleCursorPopupOpenEvent = (args: CursorPopupOpenEventArgs) => {
    // istanbul ignore next
    if (!this._isMounted)
      return;

    const title = args.props ? args.props.title : "";
    const onClose = args.props ? args.props.onClose : undefined;
    const onApply = args.props ? args.props.onApply : undefined;

    this.setState({
      showPopup: true,
      content: args.content,
      pt: args.pt,
      offset: args.offset,
      relativePosition: args.relativePosition,
      title,
      onClose,
      onApply,
    });
  }

  private _handleCursorPopupUpdatePositionEvent = (args: CursorPopupUpdatePositionEventArgs) => {
    // istanbul ignore next
    if (!this._isMounted)
      return;

    this.setState({
      pt: args.pt,
      offset: args.offset,
      relativePosition: args.relativePosition,
    });
  }

  private _handleCursorPopupCloseEvent = (args: CursorPopupCloseEventArgs) => {
    this._closeDialog(args.apply);
  }

  private _getPopupDimensions(): Size {
    let popupWidth = 0;
    let popupHeight = 0;

    // istanbul ignore else
    if (this._popupRef.current) {
      const popupRect = this._popupRef.current.getBoundingClientRect();
      popupWidth = popupRect.width;
      popupHeight = popupRect.height;
    }

    return new Size(popupWidth, popupHeight);
  }

  private _autoFlip = (inPos: RelativePosition, rect: Rectangle, windowWidth: number, windowHeight: number): { outPos: RelativePosition, flipped: boolean } => {
    let flipped = false;
    let outPos = inPos;

    if (rect.right > windowWidth) {
      flipped = true;
      switch (inPos) {
        case RelativePosition.Top:
        case RelativePosition.TopRight:
          outPos = RelativePosition.TopLeft;
          break;
        case RelativePosition.Right:
          outPos = RelativePosition.Left;
          break;
        case RelativePosition.Bottom:
        case RelativePosition.BottomRight:
          outPos = RelativePosition.BottomLeft;
          break;
      }
    }

    if (rect.left < 0) {
      flipped = true;
      switch (inPos) {
        case RelativePosition.Top:
        case RelativePosition.TopLeft:
          outPos = RelativePosition.TopRight;
          break;
        case RelativePosition.Left:
          outPos = RelativePosition.Right;
          break;
        case RelativePosition.Bottom:
        case RelativePosition.BottomLeft:
          outPos = RelativePosition.BottomRight;
          break;
      }
    }

    if (rect.bottom > windowHeight) {
      flipped = true;
      switch (inPos) {
        case RelativePosition.Left:
        case RelativePosition.BottomLeft:
          outPos = RelativePosition.TopLeft;
          break;
        case RelativePosition.Bottom:
          outPos = RelativePosition.Top;
          break;
        case RelativePosition.Right:
        case RelativePosition.BottomRight:
          outPos = RelativePosition.TopRight;
          break;
      }
    }

    if (rect.top < 0) {
      flipped = true;
      switch (inPos) {
        case RelativePosition.Left:
        case RelativePosition.TopLeft:
          outPos = RelativePosition.BottomLeft;
          break;
        case RelativePosition.Top:
          outPos = RelativePosition.Bottom;
          break;
        case RelativePosition.Right:
        case RelativePosition.TopRight:
          outPos = RelativePosition.BottomRight;
          break;
      }
    }

    return { outPos, flipped };
  }

  private _getPopupRect(pt: Point, offset: number, popupSize: Size, relativePosition: RelativePosition): Rectangle {
    const popupRect = { top: 0, left: 0, right: 0, bottom: 0 };

    switch (relativePosition) {
      case RelativePosition.Top:
        popupRect.bottom = pt.y - offset;
        popupRect.left = pt.x - (popupSize.width / 2);
        popupRect.top = popupRect.bottom - popupSize.height;
        popupRect.right = popupRect.left + popupSize.width;
        break;
      case RelativePosition.Left:
        popupRect.right = pt.x - offset;
        popupRect.top = pt.y - (popupSize.height / 2);
        popupRect.left = popupRect.right - popupSize.width;
        popupRect.bottom = popupRect.top + popupSize.height;
        break;
      case RelativePosition.Right:
        popupRect.left = pt.x + offset;
        popupRect.top = pt.y - (popupSize.height / 2);
        popupRect.right = popupRect.left + popupSize.width;
        popupRect.bottom = popupRect.top + popupSize.height;
        break;
      case RelativePosition.Bottom:
        popupRect.top = pt.y + offset;
        popupRect.left = pt.x - (popupSize.width / 2);
        popupRect.bottom = popupRect.top + popupSize.height;
        popupRect.right = popupRect.left + popupSize.width;
        break;
      case RelativePosition.TopLeft:
        popupRect.bottom = pt.y - offset;
        popupRect.right = pt.x - offset;
        popupRect.top = popupRect.bottom - popupSize.height;
        popupRect.left = popupRect.right - popupSize.width;
        break;
      case RelativePosition.TopRight:
        popupRect.bottom = pt.y - offset;
        popupRect.left = pt.x + offset;
        popupRect.top = popupRect.bottom - popupSize.height;
        popupRect.right = popupRect.left + popupSize.width;
        break;
      case RelativePosition.BottomLeft:
        popupRect.top = pt.y + offset;
        popupRect.right = pt.x - offset;
        popupRect.bottom = popupRect.top + popupSize.height;
        popupRect.left = popupRect.right - popupSize.width;
        break;
      case RelativePosition.BottomRight:
        popupRect.top = pt.y + offset;
        popupRect.left = pt.x + offset;
        popupRect.bottom = popupRect.top + popupSize.height;
        popupRect.right = popupRect.left + popupSize.width;
        break;
    }

    return Rectangle.create(popupRect);
  }

  private _closeDialog = (apply: boolean) => {
    // istanbul ignore next
    if (!this._isMounted)
      return;

    this.setState({
      showPopup: false,
    }, () => {
      if (apply && this.state.onApply)
        this.state.onApply();

      if (this.state.onClose)
        this.state.onClose();
    });
  }

  /** @internal */
  public render() {
    if (!this.state.showPopup)
      return null;

    const popupSize = this._getPopupDimensions();
    let popupRect = this._getPopupRect(this.state.pt, this.state.offset, popupSize, this.state.relativePosition);
    const { outPos, flipped } = this._autoFlip(this.state.relativePosition, popupRect, window.innerWidth, window.innerHeight);

    if (flipped)
      popupRect = this._getPopupRect(this.state.pt, this.state.offset, popupSize, outPos);

    const positioningStyle: React.CSSProperties = {
      left: popupRect.left,
      top: popupRect.top,
    };

    return (
      <div className="uifw-cursorpopup" ref={this._popupRef} style={positioningStyle}>
        {this.state.title &&
          <TitleBar
            title={this.state.title}
            className="uifw-cursorpopup-title" />
        }

        <div className="uifw-cursorpopup-content">
          {this.state.content}
        </div>
      </div>
    );
  }

}
