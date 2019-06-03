/*---------------------------------------------------------------------------------------------
* Copyright (c) 2019 Bentley Systems, Incorporated. All rights reserved.
* Licensed under the MIT License. See LICENSE.md in the project root for license terms.
*--------------------------------------------------------------------------------------------*/
/** @module Icon */

import * as classnames from "classnames";
import * as React from "react";
import { CommonProps } from "../utils/Props";
import "./SvgSprite.scss";

/** Properties of [[SvgSprite]] component.
 * @public
 */
export interface SvgSpriteProps extends CommonProps {
  /** Source for the Svg */
  src: string;
}

/** Svg element wrapper.
 * @public
 */
export class SvgSprite extends React.PureComponent<SvgSpriteProps> {
  public render() {
    const className = classnames(
      "core-icons-svgSprite",
      this.props.className,
    );

    return (
      <svg className={className} style={this.props.style} width="100%" height="100%">
        <use xmlnsXlink="http://www.w3.org/1999/xlink" xlinkHref={this.props.src} />
      </svg>
    );
  }
}
