/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
/** @packageDocumentation
 * @module StatusBar
 */

import "./Indicator.scss";
import classnames from "classnames";
import * as React from "react";
import { CommonProps } from "@itwin/core-react";
import { FooterIndicator, FooterPopup } from "@itwin/appui-layout-react";

/** Properties of [[StatusBarIndicator]] component.
 * @beta
 */
export interface StatusBarIndicatorProps extends CommonProps {
  /** Indicator content. */
  children?: React.ReactNode;
  /** Content to display in a popup when indicator is clicked. */
  popup?: React.ReactNode;
  /** Function called when indicator is clicked. */
  onClick?: () => void;
  /** Default state of an indicator popup. */
  defaultIsOpen?: boolean;
  /** Title of an indicator. */
  title?: string;
}

/** General-purpose [[StatusBar]] indicator.
 * @beta
 */
export function StatusBarIndicator(props: StatusBarIndicatorProps) {
  const hasClickAction = !!props.onClick || !!props.popup;
  const [isOpen, setIsOpen] = React.useState(!!props.defaultIsOpen);
  const handleOnIndicatorClick = () => {
    setIsOpen(!isOpen);
    props.onClick?.();
  };
  const target = React.useRef<HTMLDivElement>(null);
  const classNames = classnames(
    "uifw-statusbar-indicator",
    hasClickAction && "uifw-action",
    props.className,
  );
  return (
    <>
      <FooterIndicator
        ref={target}
        className={classNames}
        title={props.title}
        style={props.style}
        onClick={handleOnIndicatorClick}
        {...{
          role: "button",
          tabIndex: -1,
        }}
      >
        {props.children}
      </FooterIndicator>
      {props.popup && <FooterPopup
        target={target.current}
        onClose={() => setIsOpen(false)}
        isOpen={isOpen}
      >
        {props.popup}
      </FooterPopup>}
    </>
  );
}
