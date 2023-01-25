/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
/* eslint-disable deprecation/deprecation */
/** @packageDocumentation
 * @module Icon
 */

import "./SvgSprite.scss";
import classnames from "classnames";
import * as React from "react";
import { CommonProps } from "../utils/Props";

/** Properties of [[SvgSprite]] component.
 * @public @deprecated in 3.2.
 */
export interface SvgSpriteProps extends CommonProps {
  /** Source for the Svg */
  src: string;
}

/** Svg element wrapper.
 * This component is deprecate -- use IconComponent
 * @public @deprecated in 3.2.
 */
export class SvgSprite extends React.PureComponent<SvgSpriteProps> {
  public override render() {
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
