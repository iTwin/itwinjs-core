/*---------------------------------------------------------------------------------------------
* Copyright (c) 2019 Bentley Systems, Incorporated. All rights reserved.
* Licensed under the MIT License. See LICENSE.md in the project root for license terms.
*--------------------------------------------------------------------------------------------*/
/** @module Footer */

import * as classnames from "classnames";
import * as React from "react";
import { CommonProps, Popup, Position } from "@bentley/ui-core";
import "./Popup.scss";

/** Available footer popup content types.
 * @beta
 */
export enum FooterPopupContentType {
  /** Indicates that popup is used to host a dialog. */
  Dialog = "nz-content-dialog",
  /** Indicates that popup is used to host a panel. */
  Panel = "nz-content-panel",
}

/** Properties of [[FooterPopup]] component.
 * @beta
 */
export interface FooterPopupProps extends CommonProps {
  /** Popup content. */
  children?: React.ReactNode;
  /** Describes content type. */
  contentType: FooterPopupContentType;
  /** Describes if the popup is open. */
  isOpen?: boolean;
  /** Function called when the popup is closed. */
  onClose?: () => void;
  /** Function called when user clicks outside of the popup.  */
  onOutsideClick?: (e: MouseEvent) => void;
  /** Popup target. */
  target?: React.RefObject<HTMLElement>;
}

/** Default properties of [[FooterPopup]] component.
 * @beta
 */
export type FooterPopupDefaultProps = Pick<FooterPopupProps, "contentType">;

/** State of [[FooterPopup]] component. */
interface FooterPopupState {
  target: HTMLElement | null;
}

/** Popup component used in [[Footer]] component.
 * @beta
 */
export class FooterPopup extends React.PureComponent<FooterPopupProps, FooterPopupState> {
  public static readonly defaultProps: FooterPopupDefaultProps = {
    contentType: FooterPopupContentType.Dialog,
  };

  public readonly state: FooterPopupState = {
    target: null,
  };

  public componentDidMount() {
    this.setState((_, props) => ({ target: props.target ? props.target.current : null }));
  }

  public render() {
    const { className, contentType, target, ...props } = this.props;
    return (
      <Popup
        className={classnames(
          "nz-footer-popup",
          contentType,
          className,
        )}
        position={Position.Top}
        showArrow
        showShadow={false}
        target={this.state.target}
        {...props}
      >
        {this.props.children}
      </Popup>
    );
  }
}
