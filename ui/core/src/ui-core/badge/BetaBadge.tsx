/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
/** @packageDocumentation
 * @module Utilities
 */

import * as React from "react";
import { Badge } from "./Badge";
import { CommonProps } from "../utils/Props";

import betaBadgeIcon from "./technical-preview-badge.svg?sprite";

/** Beta Badge React component
 * @internal
 */
export function BetaBadge(props: CommonProps) {
  return <Badge {...props} svg={betaBadgeIcon} />;
}
