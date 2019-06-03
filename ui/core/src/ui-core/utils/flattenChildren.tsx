/*---------------------------------------------------------------------------------------------
* Copyright (c) 2019 Bentley Systems, Incorporated. All rights reserved.
* Licensed under the MIT License. See LICENSE.md in the project root for license terms.
*--------------------------------------------------------------------------------------------*/
/** @module Utilities */

import * as React from "react";

/** Flattens React fragments.
 * @internal
 */
export const flattenChildren = (children: React.ReactNode): React.ReactNode => {
  const items = React.Children.map(children, (child) => {
    // istanbul ignore next
    if (!React.isValidElement<{ children?: React.ReactNode }>(child))
      return child;

    if (child.type === React.Fragment) {
      return child.props.children;
    }

    return child;
  });
  return items;
};
