/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
/** @packageDocumentation
 * @module Views
 */

import { _implementationProhibited } from "../common/internal/Symbols";
import { IModelSceneObject } from "./SceneObject";

export interface SceneContent {
  readonly [_implementationProhibited]: unknown;

  readonly root: IModelSceneObject;
}
