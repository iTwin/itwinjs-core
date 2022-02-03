/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
/** @packageDocumentation
 * @module Utilities
 */

import "./NewBadge.scss";
import classnames from "classnames";
import * as React from "react";
import type { CommonProps } from "../utils/Props";
import { Badge } from "./Badge";
import newBadgeIcon from "./new-feature-badge.svg?sprite";

/** New Badge React component
 * @internal
 */
export function NewBadge(props: CommonProps) {
  const { className, ...badgeProps } = props;
  return <Badge {...badgeProps} className={classnames("core-new-badge", className)} svg={newBadgeIcon} />;
}
