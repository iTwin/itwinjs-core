/*---------------------------------------------------------------------------------------------
|  $Copyright: (c) 2018 Bentley Systems, Incorporated. All rights reserved. $
 *--------------------------------------------------------------------------------------------*/
/** @module Utils */

import * as React from "react";

/**
 * Common props used by components.
 */
export default interface CommonProps extends ClassNameProps {
  style?: React.CSSProperties;
}

/** Props used by components that expect class name to be passed in. */
export interface ClassNameProps {
  className?: string;
}
