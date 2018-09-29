/*---------------------------------------------------------------------------------------------
* Copyright (c) 2018 - present Bentley Systems, Incorporated. All rights reserved.
* Licensed under the MIT License. See LICENSE.md in the project root for license terms.
*--------------------------------------------------------------------------------------------*/
/** @module Utilities */

import * as React from "react";

/**
 * Common props used by all components.
 * @note Every 9-Zone component has these props.
 */
export default interface CommonProps extends ClassNameProps {
  style?: React.CSSProperties;
}

/** Props used by components that expect class name to be passed in. */
export interface ClassNameProps {
  className?: string;
}

/** Props used by components that do not expect children to be passed in. */
export interface NoChildrenProps {
  children?: undefined;
}

/** Omit K properties from T */
export type Omit<T, K extends keyof T> = Pick<T, Exclude<keyof T, K>>;

/** Omit children property from T. */
export type OmitChildrenProp<T extends { children?: any; }> = Omit<T, "children">;

/** @returns Children with react fragments flattened. */
// tslint:disable-next-line:variable-name
export const FlattenChildren = (children: React.ReactNode): React.ReactNode => {
  const items = React.Children.map(children, (child) => {
    if (!React.isValidElement<{ children?: React.ReactNode }>(child))
      return child;

    if (child.type === React.Fragment) {
      return child.props.children;
    }

    return child;
  });
  return items;
};
