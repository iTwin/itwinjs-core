/*---------------------------------------------------------------------------------------------
|  $Copyright: (c) 2018 Bentley Systems, Incorporated. All rights reserved. $
 *--------------------------------------------------------------------------------------------*/
/** @module Theme */

import * as React from "react";
import Theme, { PrimaryTheme } from "./Theme";

export interface ThemeContextProps extends Theme {
  change?: (theme: Theme) => void;
}

// tslint:disable-next-line:variable-name
export const ThemeContext = React.createContext<ThemeContextProps>({
  name: PrimaryTheme.name,
  change: () => { },
});

export default ThemeContext;
