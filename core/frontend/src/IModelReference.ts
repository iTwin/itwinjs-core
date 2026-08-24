/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
/** @packageDocumentation
 * @module Views
 */

import { Id64String, ObservableSet } from "@itwin/core-bentley";
import { _implementationProhibited } from "./common/internal/Symbols";
import { IModelConnection } from "./IModelConnection";
import { IModelDisplaySettings, IModelDisplaySettings3d } from "./IModelDisplaySettings";

export interface IModelReference {
  readonly [_implementationProhibited]: unknown;

  readonly iModel: IModelConnection;
  readonly displaySettings: IModelDisplaySettings;

  readonly viewedCategories: ObservableSet<Id64String>;
  // excluded elements

  readonly isSpatial: () => this is SpatialIModelReference;
  readonly is2d: () => this is IModelReference2d;
}

export interface IModelReference2d extends IModelReference {
  readonly viewedModel: Id64String;
}

export interface SpatialIModelReference extends IModelReference {
  readonly viewedModels: ObservableSet<Id64String>;

  readonly displaySettings: IModelDisplaySettings3d;
}
