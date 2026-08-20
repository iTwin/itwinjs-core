/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
/** @packageDocumentation
 * @module Views
 */

import { _implementationProhibited } from "../core-frontend";
import { SceneContent } from "./SceneContent";
import { ScenePresentation } from "./ScenePresentation";
import { SceneVolume } from "./SceneVolume";

export interface ViewportScene {
  /** @internal */
  readonly [_implementationProhibited]: unknown;

  readonly volume: SceneVolume;
  readonly content: SceneContent;
  readonly presentation: ScenePresentation;
}
