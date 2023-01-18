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
import { CommonProps } from "@itwin/core-react";

/** Properties of [[FooterIndicator]] component.
 * @deprecated in 3.x. Props of a deprecated component.
 * @beta
 */
export interface FooterIndicatorProps extends CommonProps {
  /** Indicator content. */
  children?: React.ReactNode;
  /** Describes whether the footer is in footer or widget mode.
   * @deprecated in 3.x. In upcoming version, widget mode will be removed. Consider this parameter to always be true.
  */
  isInFooterMode?: boolean;
  /** Title for the indicator */
  title?: string;
  /** Function called when the indicator is clicked */
  onClick?: (event: React.MouseEvent) => void;
}

/** Indicator used in [[Footer]] component.
 * @deprecated in 3.x. Use [StatusBarIndicator]($appui-react) instead.
 * @beta
 */
export const FooterIndicator = React.forwardRef<HTMLDivElement, FooterIndicatorProps>(function FooterIndicator(props, ref) {
  const { isInFooterMode, children, ...attributes } = props;

  const className = classnames(
    "nz-footer-indicator",
    (isInFooterMode ?? true) && "nz-footer-mode",
    props.className
  );

  return (
    <div ref={ref} {...{ ...attributes, className }}>
      {children}
    </div>
  );
});
