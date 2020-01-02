/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* Licensed under the MIT License. See LICENSE.md in the project root for license terms.
*--------------------------------------------------------------------------------------------*/
/** @module StatusBar */

import * as React from "react";

import { StatusFieldProps } from "../statusfields/StatusFieldProps";
import { StatusBarContext } from "./StatusBar";

/** HOC that injects values for [[StatusFieldProps]].
 * @beta
 */
export const withStatusFieldProps = <P extends StatusFieldProps, C>(
  // tslint:disable-next-line: variable-name
  Component: React.JSXElementConstructor<P> & C,
) => {
  type Props = JSX.LibraryManagedAttributes<C, Omit<P, keyof StatusFieldProps>>;
  return function WithStatusFieldProps(props: Props) {
    const statusBarContext = React.useContext(StatusBarContext);
    const { toastTargetRef, ...args } = statusBarContext;
    return (
      <Component
        {...props as any}
        {...args}
      />
    );
  };
};
