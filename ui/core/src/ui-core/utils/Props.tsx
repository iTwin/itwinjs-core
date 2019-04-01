/*---------------------------------------------------------------------------------------------
* Copyright (c) 2019 Bentley Systems, Incorporated. All rights reserved.
* Licensed under the MIT License. See LICENSE.md in the project root for license terms.
*--------------------------------------------------------------------------------------------*/
/** @module Utilities */

import * as React from "react";

/** Common props used by components.
 * @public
 */
export interface CommonProps extends ClassNameProps {
  style?: React.CSSProperties;
}

/** Props used by components that expect class name to be passed in.
 * @public
 */
export interface ClassNameProps {
  className?: string;
}
