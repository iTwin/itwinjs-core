/*---------------------------------------------------------------------------------------------
* Copyright (c) 2019 Bentley Systems, Incorporated. All rights reserved.
* Licensed under the MIT License. See LICENSE.md in the project root for license terms.
*--------------------------------------------------------------------------------------------*/
/** @module StatusBar */

import * as React from "react";

import { StatusBarContext } from "./StatusBar";
import { MessageCenterFieldProps } from "../statusfields/MessageCenter";

/** HOC that injects values for [[MessageCenterFieldProps]].
 * @beta
 */
export const withMessageCenterFieldProps = <P extends MessageCenterFieldProps, C>(
  // tslint:disable-next-line: variable-name
  Component: React.JSXElementConstructor<P> & C,
) => {
  type Props = JSX.LibraryManagedAttributes<C, Omit<P, keyof MessageCenterFieldProps>>;
  return function WithMessageCenterFieldProps(props: Props) {
    const statusBarContext = React.useContext(StatusBarContext);
    const { toastTargetRef, ...args } = statusBarContext;
    return (
      <Component
        {...props as any}
        {...args}
        targetRef={toastTargetRef}
      />
    );
  };
};
