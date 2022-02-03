/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/

/*---------------------------------------------------------------------------------------------
* This code has been adapted from
* [react-data-grid-addons](https://github.com/adazzle/react-data-grid/tree/master/packages/react-data-grid-addons).
*--------------------------------------------------------------------------------------------*/

import React from "react";
import type { AutoCompleteFilterProps } from "./AutoCompleteFilter";
import { AutoCompleteFilter } from "./AutoCompleteFilter";

/* istanbul ignore next */
/** @internal */
export function MultiSelectFilter(props: AutoCompleteFilterProps) {
  return <AutoCompleteFilter {...props} multiSelection={true} />;
}
