/*---------------------------------------------------------------------------------------------
* Copyright (c) 2019 Bentley Systems, Incorporated. All rights reserved.
* Licensed under the MIT License. See LICENSE.md in the project root for license terms.
*--------------------------------------------------------------------------------------------*/
/** @module StatusBar */

import * as classnames from "classnames";
import * as React from "react";
import { CommonProps } from "@bentley/ui-core";
import "./Indicator.scss";

/** Properties of [[Indicator]] component. */
interface IndicatorProps extends CommonProps {
  /** Label of balloon icon. */
  balloonLabel?: string;
  /** Dialog that is opened when indicator is clicked. */
  dialog?: React.ReactChild;
  /** Describes if the indicator label is visible. */
  isLabelVisible?: boolean;
  /** Icon to use in the footer */
  iconName?: string;
  /** Indicator label. */
  label?: string;
  /** Function called when indicator is clicked. */
  onClick?: () => void;
  /** Determines if indicator has been opened to show contained dialog */
  opened: boolean;
}

/** General-purpose [[Footer]] indicator.
 * @beta
 */
// TODO: Add testing as soon as possible - needed for Risk Management Plugin frontstage
// istanbul ignore next
export class Indicator extends React.Component<IndicatorProps, any> {
  constructor(props: IndicatorProps) {
    super(props);
  }

  public render() {
    const className = classnames(
      "uifw-footer-indicator",
      this.props.className);

    const getDialog = () => {
      if (this.props.opened)
        return (
          <div className="nz-dialog">
            {this.props.dialog}
          </div>
        );
      else
        return <div />;
    };

    const iconClassNames = classnames(
      "icon",
      "uifw-indicator-icon",
      this.props.iconName ? this.props.iconName : "icon-placeholder",
    );

    return (
      <div
        className={className}
        style={this.props.style}>
        <div className="nz-balloon-container">
          <div>
            {getDialog()}
          </div>
          <div
            className={iconClassNames}
            onClick={this._handleOnIndicatorClick}>
          </div>
        </div>
      </div>
    );
  }

  private _handleOnIndicatorClick = () => {
    if (this.props.onClick)
      this.props.onClick();
  }
}
