/*---------------------------------------------------------------------------------------------
* Copyright (c) 2019 Bentley Systems, Incorporated. All rights reserved.
* Licensed under the MIT License. See LICENSE.md in the project root for license terms.
*--------------------------------------------------------------------------------------------*/
/** @module Accudraw */

import * as React from "react";
import * as classnames from "classnames";

import { CommonProps, PointProps, SizeProps, Size, CommonDivProps, Div } from "@bentley/ui-core";

import "./PositionPopup.scss";

/** @alpha */
export interface PositionPopupProps extends CommonProps {
  /** Center point */
  point: PointProps;
  /** Function called when size is known. */
  onSizeKnown?: (size: SizeProps) => void;
}

/** @alpha */
export class PositionPopup extends React.PureComponent<PositionPopupProps> {

  constructor(props: PositionPopupProps) {
    super(props);
  }

  public render() {
    const { point, className, style, onSizeKnown, ...props } = this.props;

    const divStyle: React.CSSProperties = {
      ...style,
      top: point.y,
      left: point.x,
    };

    return (
      <div {...props} className={classnames("uifw-position-popup", className)} style={divStyle} ref={(e) => this.setDivRef(e)}>
        {this.props.children}
      </div>
    );
  }

  private setDivRef(div: HTMLDivElement | null) {
    // istanbul ignore else
    if (div) {
      const rect = div.getBoundingClientRect();
      const size = new Size(rect.width, rect.height);

      // istanbul ignore else
      if (this.props.onSizeKnown)
        this.props.onSizeKnown(size);
    }
  }

}

/** PositionPopup content with padding
 * @beta
 */
// tslint:disable-next-line:variable-name
export const PositionPopupContent: React.FunctionComponent<CommonDivProps> = (props: CommonDivProps) => {
  return <Div {...props} mainClassName="uifw-position-popup-content" />;
};
