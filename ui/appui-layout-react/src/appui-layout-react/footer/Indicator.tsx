/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
/** @packageDocumentation
 * @module Footer
 */

import "./Indicator.scss";
import classnames from "classnames";
import * as React from "react";
import type { CommonProps } from "@itwin/core-react";

/** Properties of [[FooterIndicator]] component.
 * @beta
 */
export interface FooterIndicatorProps extends CommonProps {
  /** Indicator content. */
  children?: React.ReactNode;
  /** Describes whether the footer is in footer or widget mode. */
  isInFooterMode?: boolean;
  /** Title for the indicator */
  title?: string;
  /** Function called when the indicator is clicked */
  onClick?: (event: React.MouseEvent) => void;
}

/** Indicator used in [[Footer]] component.
 * @beta
 */
export function FooterIndicator(props: FooterIndicatorProps) {

  const { isInFooterMode, children, ...attributes } = props;

  const className = classnames(
    "nz-footer-indicator",
    isInFooterMode && "nz-footer-mode",
    props.className
  );

  return (
    <div {...{ ...attributes, className }}>
      {children}
    </div>
  );
}
