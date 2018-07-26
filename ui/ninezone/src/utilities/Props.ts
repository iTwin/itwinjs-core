/*---------------------------------------------------------------------------------------------
|  $Copyright: (c) 2018 Bentley Systems, Incorporated. All rights reserved. $
 *--------------------------------------------------------------------------------------------*/
/** @module Utilities */

/** Common props used by all components. */
export default interface CommonProps extends ClassNameProps {
  style?: React.CSSProperties;
}

export interface ClassNameProps {
  className?: string;
}

/** Props used by components that do not expect children to be passed in. */
export interface NoChildrenProps {
  children?: undefined;
}
