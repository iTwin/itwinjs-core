/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
/** @packageDocumentation
 * @module Utilities
 */

import "./BetaBadge.scss";
import classnames from "classnames";
import * as React from "react";
import type { CommonProps } from "../utils/Props";
import { Badge } from "./Badge";
import betaBadgeIcon from "./technical-preview-badge.svg?sprite";

/** Beta Badge React component
 * @internal
 */
export function BetaBadge(props: CommonProps) {
  const className = classnames("core-badge-betaBadge",
    props.className,
  );
  return <Badge
    {...props}
    svg={betaBadgeIcon}
    className={className}
  />;
}
