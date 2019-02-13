/*---------------------------------------------------------------------------------------------
* Copyright (c) 2019 Bentley Systems, Incorporated. All rights reserved.
* Licensed under the MIT License. See LICENSE.md in the project root for license terms.
*--------------------------------------------------------------------------------------------*/
/** @module Properties */

import * as React from "react";
import { isPromiseLike } from "@bentley/ui-core";
import { PropertyValueRendererContext } from "../../ValueRendererManager";

const internalWithContextStyle = (node: React.ReactNode, context?: PropertyValueRendererContext) => {
  if (!context || !context.style)
    return node;
  return (<span style={context.style}>{node}</span>);
};

export const withContextStyle = (value: React.ReactNode | Promise<React.ReactNode>, context?: PropertyValueRendererContext) => {
  if (isPromiseLike(value))
    return value.then((v) => internalWithContextStyle(v, context));
  return internalWithContextStyle(value, context);
};
