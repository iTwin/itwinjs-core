/*---------------------------------------------------------------------------------------------
* Copyright (c) 2019 Bentley Systems, Incorporated. All rights reserved.
* Licensed under the MIT License. See LICENSE.md in the project root for license terms.
*--------------------------------------------------------------------------------------------*/
/** @module Cursor */

import * as React from "react";

import { CommonProps, CommonDivProps, Div } from "@bentley/ui-core";
import { RelativePosition } from "@bentley/imodeljs-frontend";
import { Size, Point, Rectangle, TitleBar } from "@bentley/ui-ninezone";

import "./CursorPopup.scss";
import { CursorPopupManager, CursorPopupProps, CursorPopupOpenEventArgs, CursorPopupUpdatePositionEventArgs, CursorPopupCloseEventArgs } from "./CursorPopupManager";
import classnames = require("classnames");

/** Enum for showing CursorPopup
 * @internal - unit testing
 */
export enum CursorPopupShow {
  Close,
  Open,
  FadeOut,
}

/** State for the [[CursorPopup]] React component
 * @internal
 */
interface CursorPopupState extends CursorPopupProps {
  showPopup: CursorPopupShow;
  content: React.ReactNode;
  pt: Point;
  offset: number;
  relativePosition: RelativePosition;
}

/** CursorPopup component
 * @alpha
 */
export class CursorPopup extends React.Component<CommonProps, CursorPopupState> {

  private _isMounted: boolean = false;
  private _popupRef = React.createRef<HTMLDivElement>();
  private _fadeOutTime = 500;

  /** @internal */
  constructor(props: CommonProps) {
    super(props);

    this.state = {
      showPopup: CursorPopupShow.Close,
      content: undefined,
      pt: new Point(),
      offset: 0,
      relativePosition: RelativePosition.TopRight,
    };
  }

  /** @internal */
  public componentDidMount() {
    this._isMounted = true;
    CursorPopupManager.onCursorPopupOpenEvent.addListener(this._handleCursorPopupOpenEvent);
    CursorPopupManager.onCursorPopupUpdatePositionEvent.addListener(this._handleCursorPopupUpdatePositionEvent);
    CursorPopupManager.onCursorPopupCloseEvent.addListener(this._handleCursorPopupCloseEvent);
  }

  /** @internal */
  public componentWillUnmount() {
    this._isMounted = false;
    CursorPopupManager.onCursorPopupOpenEvent.removeListener(this._handleCursorPopupOpenEvent);
    CursorPopupManager.onCursorPopupUpdatePositionEvent.removeListener(this._handleCursorPopupUpdatePositionEvent);
    CursorPopupManager.onCursorPopupCloseEvent.removeListener(this._handleCursorPopupCloseEvent);
  }

  private _handleCursorPopupOpenEvent = (args: CursorPopupOpenEventArgs) => {
    // istanbul ignore next
    if (!this._isMounted)
      return;

    const title = args.props ? args.props.title : "";
    const onClose = args.props ? args.props.onClose : undefined;
    const onApply = args.props ? args.props.onApply : undefined;
    const shadow = args.props ? args.props.shadow : false;

    this.setState({
      showPopup: CursorPopupShow.Open,
      content: args.content,
      pt: args.pt,
      offset: args.offset,
      relativePosition: args.relativePosition,
      title,
      onClose,
      onApply,
      shadow,
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
    this._closePopup(args.apply, args.fadeOut);
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

  private _closePopup = (apply: boolean, fadeOut?: boolean) => {
    // istanbul ignore next
    if (!this._isMounted)
      return;

    this.setState({
      showPopup: fadeOut ? CursorPopupShow.FadeOut : CursorPopupShow.Close,
    }, () => {
      if (apply && this.state.onApply)
        this.state.onApply();

      if (this.state.onClose)
        this.state.onClose();

      if (fadeOut) {
        setTimeout(() => {
          if (this._isMounted)
            this.setState({ showPopup: CursorPopupShow.Close });
        }, this._fadeOutTime);
      }
    });
  }

  /** @internal */
  public render() {
    if (this.state.showPopup === CursorPopupShow.Close)
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

    const classNames = classnames(
      "uifw-cursorpopup",
      this.state.shadow && "core-popup-shadow",
      this.state.showPopup === CursorPopupShow.FadeOut && "uifw-cursorpopup-fadeOut",
    );

    return (
      <div className={classNames} ref={this._popupRef} style={positioningStyle}>
        {this.state.title &&
          <TitleBar
            title={this.state.title}
            className="uifw-cursorpopup-title" />
        }
        {this.state.content}
      </div>
    );
  }
}

/** CursorPrompt content with padding
 * @alpha
 */
// tslint:disable-next-line:variable-name
export const CursorPopupContent: React.FunctionComponent<CommonDivProps> = (props: CommonDivProps) => {
  return <Div {...props} mainClassName="uifw-cursorpopup-content" />;
};
