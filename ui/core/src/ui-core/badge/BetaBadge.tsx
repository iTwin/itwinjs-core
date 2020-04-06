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

const betaBadgeIcon = require("./technical-preview-badge.svg"); // tslint:disable-line: no-var-requires

/** Beta Badge React component
 * @internal
 */
export function BetaBadge(props: CommonProps) {
  return <Badge {...props} svg={betaBadgeIcon} />;
}
