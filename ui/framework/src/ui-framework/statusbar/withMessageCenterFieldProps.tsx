/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
/** @packageDocumentation
 * @module StatusBar
 */

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
