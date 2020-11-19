/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
/** @packageDocumentation
 * @module Notification
 */

import * as React from "react";
import { Icon, IconProps } from "@bentley/ui-core";

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
