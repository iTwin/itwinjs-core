/*---------------------------------------------------------------------------------------------
* Copyright (c) 2019 Bentley Systems, Incorporated. All rights reserved.
* Licensed under the MIT License. See LICENSE.md in the project root for license terms.
*--------------------------------------------------------------------------------------------*/
/** @module State */

import * as React from "react";
import { SafeAreaInsets } from "@bentley/ui-ninezone";

/**
 * Context used to manage safe area (feature used by devices with non-rectangular screens).
 * @alpha
 */
// tslint:disable-next-line: variable-name
export const SafeAreaContext = React.createContext<SafeAreaInsets>(SafeAreaInsets.None);
