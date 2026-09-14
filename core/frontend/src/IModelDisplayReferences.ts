/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
/** @packageDocumentation
 * @module Views
 */

import { BeEvent, Id64String } from "@itwin/core-bentley";
import { _backingView, _implementationProhibited } from "./common/internal/Symbols";
import { IModelConnection } from "./IModelConnection";
import { IModelDisplayReference, IModelDisplayReference2d, SpatialIModelDisplayReference } from "./IModelDisplayReference";
import { SubCategoriesCache } from "./SubCategoriesCache";
import { ModelClipGroups } from "@itwin/core-common";
import { IModelDisplayOverridesProps, SpatialIModelDisplayOverridesProps } from "./IModelDisplayOverrides";
import { ViewState2d } from "./ViewState";
import { SpatialViewState } from "./SpatialViewState";

/** Arguments supplied to [[SpatialIModelDisplayReferences.link]].
 * @beta
 */
export interface LinkSpatialIModelArgs {
  iModel: IModelConnection;
  viewedCategories?: Iterable<Id64String>;
  excludedElements?: Iterable<Id64String>;
  viewedModel?: never;
  viewedModels?: Iterable<Id64String>;
  modelClipGroups?: ModelClipGroups;
  overrides?: SpatialIModelDisplayOverridesProps;
}

export interface IModelDisplayReferences2d extends Iterable<IModelDisplayReference2d> {
  readonly [_implementationProhibited]: unknown;

  readonly [_backingView]: ViewState2d;

  readonly is2d: true;
  readonly isSpatial?: never;

  readonly primary: IModelDisplayReference2d;
  readonly subcategories: SubCategoriesCache.Queue;

  readonly iModels: Iterable<IModelConnection>;
}

export interface SpatialIModelDisplayReferences extends Iterable<SpatialIModelDisplayReference> {
  readonly [_implementationProhibited]: unknown;

  readonly [_backingView]: SpatialViewState;

  readonly isSpatial: true;
  readonly is2d?: never;

  readonly primary: SpatialIModelDisplayReference;
  readonly linked: Iterable<SpatialIModelDisplayReference>;
  readonly subcategories: SubCategoriesCache.Queue;
  readonly iModels: Iterable<IModelConnection>;

  readonly onLinked: BeEvent<(ref: SpatialIModelDisplayReference) => void>;
  readonly onUnlinked: BeEvent<(ref: SpatialIModelDisplayReference) => void>;

  link(args: LinkSpatialIModelArgs): SpatialIModelDisplayReference;
  unlink(ref: IModelDisplayReference): void;
}

/** Represents the set of [[IModelConnection]]'s displayed by a [[ViewState]] and interactble with via a [[Viewport]].
 * A view always has exactly one "primary" iModel reference, which cannot be changed.
 * Any number of additional iModel references can be freely linked to and unlinked from the view.
 * The primary iModel determines the coordinate system for the view; the contents of all linked iModels
 * are transformed into the primary iModel's coordinate space.
 * @see [[ViewState.iModelRefs]] to inspect or modify the iModel references associated with a view.
 * @note Currently, linking additional iModels is only supported for spatial views, not 2d views.
 * @beta
 */
export type IModelDisplayReferences = IModelDisplayReferences2d | SpatialIModelDisplayReferences;
