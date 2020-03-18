/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
/** @packageDocumentation
 * @module StatusBar
 */

import classnames from "classnames";
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
  /** Describes whether the footer is in footer or widget mode. */
  isInFooterMode?: boolean;
  /** Tooltip text */
  toolTip?: string;
}

/** General-purpose [[Footer]] indicator. Shows an icon and supports an optional popup dialog.
 * @beta
 */
export class Indicator extends React.Component<IndicatorProps, any> {
  constructor(props: IndicatorProps) {
    super(props);
  }

  public render() {
    const className = classnames(
      "uifw-footer-indicator",
      this.props.isInFooterMode && "nz-footer-mode",
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
      this.props.iconName ? this.props.iconName : /* istanbul ignore next */ "icon-placeholder",
    );

    return (
      <div
        className={className}
        title={this.props.toolTip ? this.props.toolTip : this.props.label}
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
    // istanbul ignore else
    if (this.props.onClick)
      this.props.onClick();
  }
}
