/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
/** @packageDocumentation
 * @module Item
 */

import * as React from "react";

/** Context used to enable toolbar drag interaction.
 * @beta
 */
export const ToolbarDragInteractionContext = React.createContext(false); // eslint-disable-line @typescript-eslint/naming-convention
