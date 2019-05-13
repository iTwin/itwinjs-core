/*---------------------------------------------------------------------------------------------
* Copyright (c) 2019 Bentley Systems, Incorporated. All rights reserved.
* Licensed under the MIT License. See LICENSE.md in the project root for license terms.
*--------------------------------------------------------------------------------------------*/
/** @module Utilities */

import * as React from "react";
import { Omit } from "@bentley/ui-core";

/** Props used by components that do not expect children to be passed in.
 * @alpha Move to ui-core
 */
export interface NoChildrenProps {
  children?: undefined;
}

/** Omit children property from T.
 * @internal
 */
export type OmitChildrenProp<T extends { children?: React.ReactNode; }> = Omit<T, "children">;

/** Flattens react fragments.
 * @internal
 */
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
