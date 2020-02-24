/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
/** @packageDocumentation
 * @module Popup
 */

import * as React from "react";

import { OnCancelFunc, RelativePosition, OnItemExecutedFunc, CommonToolbarItem, ConditionalBooleanValue } from "@bentley/ui-abstract";
import { DivWithOutsideClick, Orientation, Point, SizeProps, Size } from "@bentley/ui-core";
import { Toolbar as NZ_Toolbar } from "@bentley/ui-ninezone";

import { PositionPopup } from "./PositionPopup";
import { PopupManager, PopupPropsBase } from "./PopupManager";
import { CursorPopup } from "../cursor/cursorpopup/CursorPopup";
import { ToolbarHelper } from "../../ui-framework";

/** @alpha */
export interface ToolbarPopupProps extends PopupPropsBase {
  items: CommonToolbarItem[];
  relativePosition: RelativePosition;
  orientation: Orientation;
  onCancel: OnCancelFunc;
  onItemExecuted: OnItemExecutedFunc;
}

/** @internal */
interface ToolbarPopupState {
  size: Size;
}

/** Popup component for Input Editor
 * @alpha
 */
export class ToolbarPopup extends React.PureComponent<ToolbarPopupProps, ToolbarPopupState> {
  /** @internal */
  public readonly state = {
    size: new Size(-1, -1),
  };

  private _onSizeKnown = (newSize: SizeProps) => {
    // istanbul ignore else
    if (!this.state.size.equals(newSize))
      this.setState({ size: Size.create(newSize) });
  }

  private _handleKeyDown = (event: React.KeyboardEvent<HTMLDivElement>): void => {
    switch (event.key) {
      case "Escape":
        this._cancel();
        break;
    }
  }

  private _cancel() {
    // istanbul ignore else
    if (this.props.onCancel) {
      this.props.onCancel();
    }
  }

  public render() {
    let point = PopupManager.getPopupPosition(this.props.el, this.props.pt, new Point(), this.state.size);
    const popupRect = CursorPopup.getPopupRect(point, this.props.offset, this.state.size, this.props.relativePosition!);
    point = new Point(popupRect.left, popupRect.top);

    const toolbarItems = () => {
      const availableItems = this.props.items
        .filter((item) => !(ConditionalBooleanValue.getValue(item.isHidden)))
        .sort((a, b) => a.itemPriority - b.itemPriority);

      if (0 === availableItems.length)
        return null;

      const createdNodes = availableItems.map((item: CommonToolbarItem) => {
        return ToolbarHelper.createNodeForToolbarItem(item, this.props.onItemExecuted);
      });
      return createdNodes;
    };

    return (
      <PositionPopup key={this.props.id}
        className="uifw-no-border"
        point={point}
        onSizeKnown={this._onSizeKnown}
      >
        <DivWithOutsideClick onOutsideClick={this.props.onCancel} onKeyDown={this._handleKeyDown}>
          <NZ_Toolbar items={toolbarItems()} />
        </DivWithOutsideClick>
      </PositionPopup>
    );
  }
}
