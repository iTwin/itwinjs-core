/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
/** @packageDocumentation
 * @module Footer
 */

import "./Popup.scss";
import classnames from "classnames";
import * as React from "react";
import { RelativePosition } from "@bentley/ui-abstract";
import { PopupProps, CommonProps, Popup } from "@bentley/ui-core";

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
  /** Indicates if the popup is open. */
  isOpen?: boolean;
  /** Indicates whether to close the popup when Enter is pressed (defaults to true) */
  closeOnEnter?: boolean;
  /** Function called when the popup is closed. */
  onClose?: () => void;
  /** Function called when user clicks outside of the popup.  */
  onOutsideClick?: (e: MouseEvent) => void;
  /** Popup target. */
  target?: HTMLElement | null;
  /** Indicates if the popup is pinned. */
  isPinned?: boolean;
}

/** Default properties of [[FooterPopup]] component.
 * @beta
 */
export type FooterPopupDefaultProps = Pick<FooterPopupProps, "contentType">;

/** Popup component used in [[Footer]] component.
 * @beta
 */
export class FooterPopup extends React.PureComponent<FooterPopupProps> {
  public static readonly defaultProps: FooterPopupDefaultProps = {
    contentType: FooterPopupContentType.Dialog,
  };

  public render() {
    const { className, contentType, ...props } = this.props;
    return (
      <Popup
        className={classnames("nz-footer-popup", contentType, className)}
        position={RelativePosition.Top}
        showArrow
        showShadow={false}
        {...props}
      >
        {this.props.children}
      </Popup>
    );
  }
}
