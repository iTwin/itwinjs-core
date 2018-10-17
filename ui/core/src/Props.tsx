/*---------------------------------------------------------------------------------------------
* Copyright (c) 2018 Bentley Systems, Incorporated. All rights reserved.
* Licensed under the MIT License. See LICENSE.md in the project root for license terms.
*--------------------------------------------------------------------------------------------*/
/** @module Utilities */

import * as React from "react";

/** Common props used by components. */
export interface CommonProps extends ClassNameProps {
  style?: React.CSSProperties;
}

/** Props used by components that expect class name to be passed in. */
export interface ClassNameProps {
  className?: string;
}
