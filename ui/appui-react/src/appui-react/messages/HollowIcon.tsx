/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
/** @packageDocumentation
 * @module Notification
 */

import * as React from "react";
import type { IconProps } from "@itwin/core-react";
import { Icon } from "@itwin/core-react";

/** Icon for Message
 * @internal
 */
export function HollowIcon(props: IconProps) {
  return (
    <span className="uifw-statusbar-hollow-icon">
      <Icon {...props} />
    </span>
  );
}
