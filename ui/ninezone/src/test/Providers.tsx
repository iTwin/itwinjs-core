/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
import * as React from "react";
import { PaneContext } from "../ui-ninezone";
import { PaneContextArgs, paneContextDefaultValue } from "../ui-ninezone/widget-panels/Panes";

// tslint:disable: completed-docs

export function PaneContextProvider(props: { children: React.ReactNode } & Partial<PaneContextArgs>) {
  const { children, ...args } = props;
  return <PaneContext.Provider
    children={props.children}
    value={{
      ...paneContextDefaultValue,
      ...args,
    }}
  />;
}
