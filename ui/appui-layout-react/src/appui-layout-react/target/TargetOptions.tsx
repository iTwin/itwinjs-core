/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
/** @packageDocumentation
 * @module Widget
 */

import * as React from "react";

/** @internal */
export interface TargetOptions {
  version: "1" | "2";
}

const defaultValue: TargetOptions = {
  version: "1",
};

/** @internal */
export const TargetOptionsContext = React.createContext<TargetOptions>(defaultValue); // eslint-disable-line: completed-docs @typescript-eslint/naming-convention
TargetOptionsContext.displayName = "nz:TargetOptionsContext";
