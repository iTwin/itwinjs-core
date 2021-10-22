/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
/** @packageDocumentation
 * @module Button
 */

import "./UnderlinedButton.scss";
import classnames from "classnames";
import * as React from "react";
import { SpecialKey } from "@itwin/appui-abstract";

/** Properties for the [[UnderlinedButton]] React component
 * @public
 */
export interface UnderlinedButtonProps {
  /** String that will be rendered by the button */
  children: string | React.ReactNode;
  /** Additional className */
  className?: string;
  /** Title of the button */
  title?: string;
  /** Callback to onClick event */
  onClick?: (e: React.MouseEvent) => void;
  /** Callback to activate */
  onActivate?: () => void;
}

/** A React component that makes text clickable and underlined
 * @public
 */
export function UnderlinedButton(props: UnderlinedButtonProps) {
  const handleKeyUp = React.useCallback((event: React.KeyboardEvent) => {
    const key = event.key;

    switch (key) {
      case SpecialKey.Enter:
      case SpecialKey.Space:
        props.onActivate && props.onActivate();
        break;
    }
  }, [props]);

  const handleClick = React.useCallback((e: React.MouseEvent) => {
    props.onClick && props.onClick(e);
    props.onActivate && props.onActivate();
  }, [props]);

  const className = classnames(
    "core-underlined-button",
    props.className ? props.className : undefined,
  );

  return (
    <span
      className={className}
      title={props.title}
      onClick={handleClick}
      onKeyUp={handleKeyUp}
      tabIndex={0}
      role="link"
    >
      {props.children}
    </span>
  );
}
