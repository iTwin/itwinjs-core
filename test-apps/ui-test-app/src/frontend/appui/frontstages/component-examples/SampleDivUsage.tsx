/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
import * as React from "react";
import { CommonDivProps, Div } from "@bentley/ui-core";

export function Centered(props: CommonDivProps) {
  return <Div {...props} mainClassName="my-css-class" />;
}
