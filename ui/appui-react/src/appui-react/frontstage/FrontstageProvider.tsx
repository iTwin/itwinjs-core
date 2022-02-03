/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
/** @packageDocumentation
 * @module Frontstage
 */

import type * as React from "react";
import type { FrontstageProps } from "./Frontstage";

/** Provides a Frontstage as a React based definition
 * @public
 */
export abstract class FrontstageProvider {
  /** Get the Frontstage React based definition */
  public abstract get id(): string;
  public abstract get frontstage(): React.ReactElement<FrontstageProps>;
}
