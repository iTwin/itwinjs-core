/*---------------------------------------------------------------------------------------------
* Copyright (c) 2019 Bentley Systems, Incorporated. All rights reserved.
* Licensed under the MIT License. See LICENSE.md in the project root for license terms.
*--------------------------------------------------------------------------------------------*/
/** @module Popup */

import * as React from "react";

import { PopupManager, PopupPropsBase } from "./PopupManager";
import { MenuButton } from "../accudraw/MenuButton";

/** @alpha */
export interface MenuButtonPopupProps extends PopupPropsBase {
  content: React.ReactNode;
}

/** Popup component for Menu Buttons
 * @alpha
 */
export class MenuButtonPopup extends React.PureComponent<MenuButtonPopupProps> {

  public render() {
    const point = PopupManager.getPopupPosition(this.props.el, this.props.pt, this.props.offset, this.props.size);

    return (
      <MenuButton key={this.props.id}
        point={point}
        onSizeKnown={this.props.onSizeKnown}
      >
        {this.props.content}
      </MenuButton>
    );
  }
}
