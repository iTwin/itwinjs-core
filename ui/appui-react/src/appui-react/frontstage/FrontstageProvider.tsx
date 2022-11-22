/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
/** @packageDocumentation
 * @module Frontstage
 */

import * as React from "react";
import { FrontstageProps } from "./Frontstage";
import { FrontstageConfig } from "./FrontstageConfig";

/** Provides a Frontstage as a React based definition
 * @public
 */
export abstract class FrontstageProvider {
  /** Get the Frontstage React based definition */
  public abstract get id(): string;
  /** Return an element that describes a frontstage.
   * @deprecated Implement using `frontstageConfig` instead.
   */
  public abstract get frontstage(): React.ReactElement<FrontstageProps>; // eslint-disable-line deprecation/deprecation
  /** Return the frontstage configuration.
   * @beta This method will be required in upcoming version, this method will be prioritized if it exists over `frontstage`.
   */
  public frontstageConfig?(): FrontstageConfig;
}
