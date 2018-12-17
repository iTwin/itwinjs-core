/*---------------------------------------------------------------------------------------------
* Copyright (c) 2018 Bentley Systems, Incorporated. All rights reserved.
* Licensed under the MIT License. See LICENSE.md in the project root for license terms.
*--------------------------------------------------------------------------------------------*/
/** @module Properties */

import React from "react";
import { PropertyValueRendererContext } from "../../ValueRendererManager";

const internalWithContextStyle = (node: React.ReactNode, context?: PropertyValueRendererContext) => {
  if (!context || !context.style)
    return node;
  return (<span style={context.style}>{node}</span>);
};

const isPromise = (value: React.ReactNode | Promise<React.ReactNode>): value is Promise<React.ReactNode> => {
  return (undefined !== value) && (undefined !== (value as Promise<any>).then);
};

export const withContextStyle = (value: React.ReactNode | Promise<React.ReactNode>, context?: PropertyValueRendererContext) => {
  if (isPromise(value))
    return value.then((v) => internalWithContextStyle(v, context));
  return internalWithContextStyle(value, context);
};
