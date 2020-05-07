/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
/** @packageDocumentation
 * @module Widget
 */

import * as React from "react";
import { SendBack } from "./SendBack";

/** @internal */
export const TabBarButtons = React.memo(function TabBarButtons() { // tslint:disable-line: variable-name no-shadowed-variable
  return (
    <>
      <SendBack />
    </>
  );
});
