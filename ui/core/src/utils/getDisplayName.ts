/*---------------------------------------------------------------------------------------------
|  $Copyright: (c) 2017 Bentley Systems, Incorporated. All rights reserved. $
 *--------------------------------------------------------------------------------------------*/
/** @module Utilities */

import * as React from "react";

export const getDisplayName = (component: React.ComponentType<any>): string => {
  if (component.displayName)
    return component.displayName;
  if (component.name)
    return component.name;
  return "Component";
};
