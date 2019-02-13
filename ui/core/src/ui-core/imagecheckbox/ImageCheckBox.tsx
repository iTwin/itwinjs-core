/*---------------------------------------------------------------------------------------------
* Copyright (c) 2019 Bentley Systems, Incorporated. All rights reserved.
* Licensed under the MIT License. See LICENSE.md in the project root for license terms.
*--------------------------------------------------------------------------------------------*/
/** @module ImageCheckBox */

import * as React from "react";
import * as classnames from "classnames";
import { CommonProps } from "../utils/Props";
import "./ImageCheckBox.scss";

/** Properties for the [[ImageCheckBox]] component */
export interface ImageCheckBoxProps extends CommonProps  {
  /** Image for the "checked" state */
  imageOn: string;
  /** Image for the "unchecked" (default) state */
  imageOff: string;
  /** Determine if the item is checked or not */
  checked?: boolean;
  /** Determine if the item is disabled or not */
  disabled?: boolean;
  /** Function called when item is clicked. */
  onClick?: () => any;
}

/**
 * ImageCheckBox React component
 * Component to show a checked or unchecked image'
 */
export class ImageCheckBox extends React.Component<ImageCheckBoxProps> {

  /** @hidden */
  public render() {
    const checkBoxClass = classnames ("core-image-checkbox", this.props.className);
    const imageClass = classnames ("image icon", this.props.checked ? this.props.imageOn : this.props.imageOff);
    return (
      <label className={checkBoxClass}>
        <input type="checkbox" checked={this.props.checked} disabled={this.props.disabled} onChange={this.props.onClick}/>
        <span className={imageClass}/>
      </label>
    );
  }
}

export default ImageCheckBox;
