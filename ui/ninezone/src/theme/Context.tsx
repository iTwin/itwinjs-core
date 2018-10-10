/*---------------------------------------------------------------------------------------------
* Copyright (c) 2018 Bentley Systems, Incorporated. All rights reserved.
* Licensed under the MIT License. See LICENSE.md in the project root for license terms.
*--------------------------------------------------------------------------------------------*/
/** @module Theme */

import * as React from "react";
import Theme, { PrimaryTheme } from "./Theme";

/** Properties of [[ThemeContext]]. */
export interface ThemeContextProps extends Theme {
  /**
   * Function called when [[Theme]] change is requested.
   * @note [[ThemeContext]] consumers can call this function to initiate [[Theme]] change.
   */
  change?: (theme: Theme) => void;
}

/** Theme context of 9-Zone UI. Used to provide [[Theme]] property to every themed component. */
// tslint:disable-next-line:variable-name
export const ThemeContext = React.createContext<ThemeContextProps>({
  name: PrimaryTheme.name,
  change: () => { },
});

export default ThemeContext;
