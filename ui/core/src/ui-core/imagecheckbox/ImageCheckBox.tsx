/*---------------------------------------------------------------------------------------------
* Copyright (c) 2019 Bentley Systems, Incorporated. All rights reserved.
* Licensed under the MIT License. See LICENSE.md in the project root for license terms.
*--------------------------------------------------------------------------------------------*/
/** @module ImageCheckBox */

import * as React from "react";
import * as classnames from "classnames";
import { CommonProps } from "../utils/Props";
import "./ImageCheckBox.scss";

/** Properties for the [[ImageCheckBox]] component
 * @public
 */
export interface ImageCheckBoxProps extends CommonProps {
  /** Image for the "checked" state */
  imageOn: string;
  /** Image for the "unchecked" (default) state */
  imageOff: string;
  /** Determine if the item is checked or not */
  checked?: boolean;
  /** Determine if the item is disabled or not */
  disabled?: boolean;
  /** Function called when item is clicked. */
  onClick?: (checked: boolean) => any;
}

/**
 * ImageCheckBox React component
 * Component to show a checked or unchecked image'
 * @public
 */
export class ImageCheckBox extends React.Component<ImageCheckBoxProps> {

  private _onChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.stopPropagation)
      e.stopPropagation();

    if (this.props.onClick) {
      this.props.onClick(e.target.checked);
    }
  }

  private _onInputClick = (e: React.MouseEvent<HTMLInputElement>) => {
    e.stopPropagation();
  }

  private _onLabelClick = (e: React.MouseEvent<HTMLLabelElement>) => {
    e.stopPropagation();
  }

  /** @internal */
  public render() {
    const checkBoxClass = classnames("core-image-checkbox", this.props.className);
    const imageClass = classnames("image icon", this.props.checked ? this.props.imageOn : this.props.imageOff);
    return (
      <label className={checkBoxClass} onClick={this._onLabelClick}>
        <input type="checkbox" checked={this.props.checked} disabled={this.props.disabled} onChange={this._onChange} onClick={this._onInputClick} />
        <span className={imageClass} />
      </label>
    );
  }
}
