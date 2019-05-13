/*---------------------------------------------------------------------------------------------
* Copyright (c) 2019 Bentley Systems, Incorporated. All rights reserved.
* Licensed under the MIT License. See LICENSE.md in the project root for license terms.
*--------------------------------------------------------------------------------------------*/
/** @module Footer */

import * as classnames from "classnames";
import * as React from "react";
import { CommonProps, Popup, Position } from "@bentley/ui-core";
import "./Popup.scss";

/** Properties of [[ToolSettingsPopup]] component.
 * @beta
 */
export interface ToolSettingsPopupProps extends CommonProps {
  /** Popup content. */
  children?: React.ReactNode;
  /** Describes if the popup is open. */
  isOpen?: boolean;
  /** Function called when the popup is closed. */
  onClose?: () => void;
  /** Popup target. */
  target?: React.RefObject<HTMLElement>;
}

/** State of [[ToolSettingsPopup]] component. */
interface ToolSettingsPopupState {
  target: HTMLElement | null;
}

/** Popup component used in [[ToolSettings]] component.
 * @beta
 */
export class ToolSettingsPopup extends React.PureComponent<ToolSettingsPopupProps, ToolSettingsPopupState> {
  public readonly state: ToolSettingsPopupState = {
    target: null,
  };

  public componentDidMount() {
    this.setState((_, props) => ({ target: props.target ? props.target.current : null }));
  }

  public componentDidUpdate() {
    this.setState((_, props) => ({ target: props.target ? props.target.current : null }));
  }

  public render() {
    const { className, target, ...props } = this.props;
    return (
      <Popup
        className={classnames(
          "nz-widget-toolSettings-popup",
          className,
        )}
        position={Position.Bottom}
        showArrow
        showShadow={false}
        target={this.state.target}
        {...props}
      >
        <div className="nz-content">
          {this.props.children}
        </div>
      </Popup>
    );
  }
}
