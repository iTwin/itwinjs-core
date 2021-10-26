/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
/** @packageDocumentation
 * @module Utilities
 */

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
