/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
/** @packageDocumentation
 * @module Utilities
 */

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
  /** Optional unique identifier for item. If defined it will be added to DOM Element attribute as data-item-id */
  itemId?: string;
}

/** Common properties using a div element.
 * @public
 */
export interface CommonDivProps extends React.AllHTMLAttributes<HTMLDivElement>, CommonProps { }

/** Props used by components that do not expect children to be passed in.
 * @public
 */
export interface NoChildrenProps {
  children?: undefined;
}

/** Omit children property from T.
 * @public
 */
export type OmitChildrenProp<T extends { children?: React.ReactNode }> = Omit<T, "children">;
