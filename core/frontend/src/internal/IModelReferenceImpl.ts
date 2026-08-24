/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
/** @packageDocumentation
 * @module Views
 */

import { DisplayStyleSettings, SpatialViewDefinitionProps, ViewStateProps } from "@itwin/core-common";
import { ExcludedElements, IModelReference, IModelReference2d, SpatialIModelReference } from "../IModelReference";
import { BeEvent, Id64, Id64String } from "@itwin/core-bentley";
import { _implementationProhibited } from "./cross-package";
import { ViewState, ViewState2d } from "../ViewState";
import { SpatialViewState } from "../SpatialViewState";
import { IModelConnection } from "../IModelConnection";
import { CategorySelectorState } from "../CategorySelectorState";
import { DisplayStyle3dState } from "../DisplayStyleState";

class ExcludedElementsImpl implements ExcludedElements {
  public readonly onChanged = new BeEvent<() => void>();

  public constructor(private readonly _settings: DisplayStyleSettings) {
    this._settings.onExcludedElementsChanged.addListener(
      () => this.onChanged.raiseEvent()
    );
  }

  public [Symbol.iterator](): Iterator<Id64String> {
    return this._settings.excludedElementIds[Symbol.iterator]();
  }

  public addIds(ids: Iterable<Id64String>): void {
    this._settings.addExcludedElements(ids);
  }

  public deleteIds(ids: Iterable<Id64String>): void {
    this._settings.dropExcludedElements(ids);
  }

  public clear(): void {
    this._settings.clearExcludedElements();
  }
}

abstract class IModelReferenceImpl implements IModelReference {
  public readonly [_implementationProhibited] = undefined;

  protected abstract get _view(): ViewState;

  public readonly excludedElements: ExcludedElements;

  public constructor(view: ViewState) {
    this.excludedElements = new ExcludedElementsImpl(view.displayStyle.settings);
  }

  public get iModel() {
    return this._view.iModel;
  }

  public get viewedCategories() {
    return this._view.categorySelector.observableCategories;
  }

  public get isLoadingComplete() {
    return this._view.areAllTileTreesLoaded;
  }

  public get tileTreeRefs() {
    return this._view.getTileTreeRefs();
  }

  public abstract isSpatial(): this is SpatialIModelReference;
  public abstract is2d(): this is IModelReference2d;

  public readonly displaySettings = { } as unknown as any; // ###TODO
}

class IModelReference2dImpl extends IModelReferenceImpl implements IModelReference2d {
  #view: ViewState2d;

  public constructor(view: ViewState2d) {
    super(view);
    this.#view = view;
  }

  protected override get _view() { return this.#view; }

  public override is2d(): this is IModelReference2d { return true; }
  public override isSpatial(): this is SpatialIModelReference { return false; }

  public get viewedModel() {
    return this.#view.model;
  }
}

class SpatialIModelReferenceImpl extends IModelReferenceImpl implements SpatialIModelReference {
  #view: SpatialViewState;

  public constructor(view: SpatialViewState) {
    super(view);
    this.#view = view;
  }

  protected override get _view() { return this.#view; }

  public override is2d(): this is IModelReference2d { return false; }
  public override isSpatial(): this is SpatialIModelReference { return true; }

  public get viewedModels() {
    return this.#view.modelSelector.observableModels;
  }

  // ###TODO display settings 3d
}

/** @internal */
export function createPrimaryIModelReference(view: ViewState2d | SpatialViewState): IModelReference {
  return view.is2d() ? new IModelReference2dImpl(view) : new SpatialIModelReferenceImpl(view);
}

export function createLinkedSpatialIModelReference(iModel: IModelConnection, _primaryRef: SpatialIModelReference): SpatialIModelReference {
  const elementProps = {
    model: Id64.invalid,
    code: {
      spec: Id64.invalid,
      scope: Id64.invalid,
    },
  };

  const viewDefinitionProps: SpatialViewDefinitionProps = {
    ...elementProps,
    modelSelectorId: Id64.invalid,
    cameraOn: false,
    origin: [0, 0, 0],
    extents: [1, 1, 1],
    camera: {
      lens: { degrees: 90 },
      focusDist: 1,
      eye: [0, 0, 0],
    },
    categorySelectorId: Id64.invalid,
    displayStyleId: Id64.invalid,
    classFullName: SpatialViewState.classFullName,
  };

  const viewStateProps: ViewStateProps = {
    viewDefinitionProps,
    categorySelectorProps: {
      ...elementProps,
      classFullName: CategorySelectorState.classFullName,
      categories: [],
    },
    displayStyleProps: {
      ...elementProps,
      classFullName: DisplayStyle3dState.classFullName,
    },
  };

  const view = SpatialViewState.createFromProps(viewStateProps, iModel);
  return new SpatialIModelReferenceImpl(view);
}
