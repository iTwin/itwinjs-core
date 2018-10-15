/*---------------------------------------------------------------------------------------------
* Copyright (c) 2018 Bentley Systems, Incorporated. All rights reserved.
* Licensed under the MIT License. See LICENSE.md in the project root for license terms.
*--------------------------------------------------------------------------------------------*/
/** @module Base */

import * as classnames from "classnames";
import * as React from "react";
import CommonProps from "../utilities/Props";
import "./SvgSprite.scss";

/** Properties of [[SvgSprite]] component. */
export interface SvgSpriteProps extends CommonProps {
  src: string;
}

/** SvgElement wrapper. */
export default class SvgSprite extends React.Component<SvgSpriteProps> {
  public render() {
    const className = classnames(
      "nz-base-svgSprite",
      this.props.className);

    return (
      <svg className={className} style={this.props.style} width="100%" height="100%">
        <use xmlnsXlink="http://www.w3.org/1999/xlink" xlinkHref={this.props.src} />
      </svg>
    );
  }
}
