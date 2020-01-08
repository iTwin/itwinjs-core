/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
/** @module Popup */

import * as React from "react";

import { OnCancelFunc, RelativePosition } from "@bentley/ui-abstract";
import { DivWithOutsideClick, Orientation, Point, SizeProps, Size } from "@bentley/ui-core";
import { Toolbar as NZ_Toolbar } from "@bentley/ui-ninezone";

import { PositionPopup } from "./PositionPopup";
import { PopupManager, PopupPropsBase } from "./PopupManager";
import { ItemList } from "../shared/ItemMap";
import { ItemDefBase } from "../shared/ItemDefBase";
import { ActionButtonItemDef } from "../shared/ActionButtonItemDef";
import { ConditionalItemDef } from "../shared/ConditionalItemDef";
import { CursorPopup } from "../cursor/cursorpopup/CursorPopup";

/** @alpha */
export interface ToolbarPopupProps extends PopupPropsBase {
  items: ItemList;
  relativePosition: RelativePosition;
  orientation: Orientation;
  onCancel: OnCancelFunc;
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

    const actionItems = new Array<ActionButtonItemDef>();

    // Filter on ActionButtonItemDef
    this.props.items.forEach((item: ItemDefBase) => {
      if (item.isVisible) {
        if (item instanceof ActionButtonItemDef) {
          actionItems.push(item);
        } else {
          // istanbul ignore else
          if (item instanceof ConditionalItemDef) {
            const visibleItems = item.getVisibleItems();
            visibleItems.forEach((childItem: ActionButtonItemDef) => {
              actionItems.push(childItem);
            });
          }
        }
      }
    });

    // Populate the toolbar items
    const toolbarItems = actionItems.map((item: ActionButtonItemDef, index: number) => {
      return item.toolbarReactNode(index);
    });

    return (
      <PositionPopup key={this.props.id}
        className="uifw-no-border"
        point={point}
        onSizeKnown={this._onSizeKnown}
      >
        <DivWithOutsideClick onOutsideClick={this.props.onCancel} onKeyDown={this._handleKeyDown}>
          <NZ_Toolbar items={toolbarItems} />
        </DivWithOutsideClick>
      </PositionPopup>
    );
  }
}
