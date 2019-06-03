/*---------------------------------------------------------------------------------------------
* Copyright (c) 2019 Bentley Systems, Incorporated. All rights reserved.
* Licensed under the MIT License. See LICENSE.md in the project root for license terms.
*--------------------------------------------------------------------------------------------*/
/** @module Utilities */

import * as React from "react";
import { Omit } from "./typeUtils";

/** Props used by components that expect class name to be passed in.
 * @public
 */
export interface ClassNameProps {
  /** Custom CSS class name */
  className?: string;
}

/** Common props used by components.
 * @public
 */
export interface CommonProps extends ClassNameProps {
  /** Custom CSS style properties */
  style?: React.CSSProperties;
}

/** Common properties using a div element
 * @public
 */
export interface CommonDivProps extends React.AllHTMLAttributes<HTMLDivElement>, CommonProps { }

/** Props used by components that do not expect children to be passed in.
 * @beta
 */
export interface NoChildrenProps {
  children?: undefined;
}

/** Omit children property from T.
 * @beta
 */
export type OmitChildrenProp<T extends { children?: React.ReactNode; }> = Omit<T, "children">;
