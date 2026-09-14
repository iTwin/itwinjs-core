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
  /** The iModel to display. */
  iModel: IModelConnection;
  /** The categories that should be visible when displaying the iModel. */
  viewedCategories?: Iterable<Id64String>;
  /** An optional set of elements that should never be displayed in the view. */
  excludedElements?: Iterable<Id64String>;
  /** The models that should be visible when displaying the iModel. */
  viewedModels?: Iterable<Id64String>;
  /** Clip volumes to be applied to groups of models when displayed through the linked [[SpatialIModelDisplayReference]]. */
  modelClipGroups?: ModelClipGroups;
  /** Selective overrides applied to aspects of the display style when displaying the iModel. */
  overrides?: SpatialIModelDisplayOverridesProps;
}

/** The implementation of [[IModelDisplayReferences]] for 2d views.
 * In its present form, it supports only a single iModel reference - the [[primary]] iModel.
 * @beta
 */
export interface IModelDisplayReferences2d extends Iterable<IModelDisplayReference2d> {
  /** @internal */
  readonly [_implementationProhibited]: unknown;

  /** @internal */
  readonly [_backingView]: ViewState2d;

  /** Allows apps to discriminate between spatial and 2d IModelDisplayReferences. */
  readonly is2d: true;
  /** Allows apps to discriminate between spatial and 2d IModelDisplayReferences. */
  readonly isSpatial?: never;

  /** The reference primary (and only) iModel displayed in the view. */
  readonly primary: IModelDisplayReference2d;
  /** @internal */
  readonly subcategories: SubCategoriesCache.Queue;

  /** The set of iModels displayed by this view (only one, in its present implementation). */
  readonly iModels: Iterable<IModelConnection>;
}

/** The collection of iModels displayed by a [[SpatialViewState]] and interactable with via a [[Viewport]].
 * A spatial view always has exactly one "primary" iModel reference, which cannot be changed.
 * Any number of additional iModel references can be freely linked to and unlinked from the view.
 * The primary iModel determines the coordinate system for the view; the contents of all linked iModels
 * are transformed into the primary iModel's coordinate space.
 * By default, [[Tool]]s only interact with the primary iModel, but they can opt in to receiving
 * [[HitDetail]]s from linked iModels using [[LocateOptions.allowExternalIModels]].
 * @beta
 */
export interface SpatialIModelDisplayReferences extends Iterable<SpatialIModelDisplayReference> {
  /** @internal */
  readonly [_implementationProhibited]: unknown;

  /** @internal */
  readonly [_backingView]: SpatialViewState;

  /** Allows apps to discriminate between spatial and 2d IModelDisplayReferences. */
  readonly isSpatial: true;
  /** Allows apps to discriminate between spatial and 2d IModelDisplayReferences. */
  readonly is2d?: never;

  /** The iModel that serves as the main content for the view. It cannot be changed or replaced. */
  readonly primary: SpatialIModelDisplayReference;
  /** The set of additional iModels that have been added to the view. */
  readonly linked: Iterable<SpatialIModelDisplayReference>;
  /** @internal */
  readonly subcategories: SubCategoriesCache.Queue;
  /** The set of iModels - both primary and linked - displayed by the view. */
  readonly iModels: Iterable<IModelConnection>;

  /** Event dispatched just after `ref` is [[link]]ed to the view. */
  readonly onLinked: BeEvent<(ref: SpatialIModelDisplayReference) => void>;
  /** Event dispatched just after `ref` is [[unlink]]ed from the view. */
  readonly onUnlinked: BeEvent<(ref: SpatialIModelDisplayReference) => void>;

  /** Add an iModel reference to the view. */
  link(args: LinkSpatialIModelArgs): SpatialIModelDisplayReference;
  /** Remove a previously-[[link]]ed iModel reference from the view. */
  unlink(ref: IModelDisplayReference): void;
}

/** Represents the set of [[IModelConnection]]'s displayed by a [[ViewState]] and interactble with via a [[Viewport]].
 * A view always has exactly one "primary" iModel reference, which cannot be removed or replaced.
 * Spatial views also support linking any number of additional iModels to be presented in the context of
 * the primary iModel.
 * @see [[ViewState.iModelRefs]] to inspect or modify the iModel references associated with a view.
 * @beta
 */
export type IModelDisplayReferences = IModelDisplayReferences2d | SpatialIModelDisplayReferences;
