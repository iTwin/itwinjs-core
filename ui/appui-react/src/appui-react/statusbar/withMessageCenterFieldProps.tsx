/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
/** @packageDocumentation
 * @module StatusBar
 */

import * as React from "react";
import { MessageCenterFieldProps } from "../statusfields/MessageCenter";
import { StatusBarContext } from "./StatusBar";

/** HOC that injects values for [[MessageCenterFieldProps]].
 * @public @deprecated in 3.3. Use `MessageManager.registerAnimateOutToElement` to register this ref in the related component.
 */
export const withMessageCenterFieldProps = <P extends MessageCenterFieldProps, C>(
  // eslint-disable-next-line @typescript-eslint/naming-convention
  Component: React.JSXElementConstructor<P> & C,
) => {
  type InjectedProps = Pick<MessageCenterFieldProps, "isInFooterMode" | "onOpenWidget" | "openWidget" | "targetRef">;
  type Props = React.JSX.LibraryManagedAttributes<C, Omit<P, keyof InjectedProps>>;
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
