/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
/** @packageDocumentation
 * @module Views
 */

import { Id64String } from "@itwin/core-bentley";
import { _implementationProhibited } from "./common/internal/Symbols";
import { IModelConnection } from "./IModelConnection";
import { IModelDisplayReference, IModelDisplayReference2d, SpatialIModelDisplayReference } from "./IModelDisplayReference";
import { SubCategoriesCache } from "./SubCategoriesCache";
import { ClipStyle, HiddenLine, ModelClipGroups, ViewFlagOverrides } from "@itwin/core-common";

export interface LinkIModelArgs {
  iModel: IModelConnection;
  viewedCategories?: Iterable<Id64String>;
  excludedElements?: Iterable<Id64String>;
  viewFlagOverrides?: ViewFlagOverrides;
  clipStyle?: ClipStyle;
}

export interface LinkIModel2dArgs extends LinkIModelArgs {
  viewedModel: Id64String;
}

export interface LinkSpatialIModelArgs extends LinkIModelArgs {
  viewedModel?: never;
  viewedModels?: Iterable<Id64String>;
  hiddenLineSettings?: HiddenLine.Settings;
  modelClipGroups?: ModelClipGroups;
}

export interface IModelDisplayReferences2d extends Iterable<IModelDisplayReference2d> {
  readonly [_implementationProhibited]: unknown;

  readonly is2d: true;
  readonly isSpatial?: never;

  readonly primary: IModelDisplayReference2d;
  readonly linked: Iterable<IModelDisplayReference2d>;
  readonly subcategories: SubCategoriesCache.Queue;

  link(args: LinkIModel2dArgs): IModelDisplayReference2d;
  unlink(ref: IModelDisplayReference2d): void;
}

export interface SpatialIModelDisplayReferences extends Iterable<SpatialIModelDisplayReference> {
  readonly [_implementationProhibited]: unknown;

  readonly isSpatial: true;
  readonly is2d?: never;

  readonly primary: SpatialIModelDisplayReference;
  readonly linked: Iterable<SpatialIModelDisplayReference>;
  readonly subcategories: SubCategoriesCache.Queue;

  link(args: LinkSpatialIModelArgs): SpatialIModelDisplayReference;
  unlink(ref: SpatialIModelDisplayReference): void;
}

export type IModelDisplayReferences = IModelDisplayReferences2d | SpatialIModelDisplayReferences;
