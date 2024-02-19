/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/

/* This proxying approach is a misstep.
import { Id64, Id64Arg, Id64Set, Id64String, ObservableSet } from "@itwin/core-bentley";
import {
  IIModelView, ViewCategorySelector, ViewModelSelector,
} from "../IModelView";
import { ViewState } from "../../ViewState";

function equalIdSets(lhs: Id64Set, rhs: Id64Set): boolean {
  if (lhs.size !== rhs.size)
    return false;

  for (const cat of lhs)
    if (!rhs.has(cat))
      return false;

  return true;
}

class CategorySelectorImpl implements ViewCategorySelector {
  private readonly _categories: ObservableSet<Id64String>;

  constructor(categories: ObservableSet<Id64String>) {
    this._categories = categories;
  }

  get categories(): Set<Id64String> { return this._categories; }
  set categories(categories: Set<Id64String>) {
    this.categories.clear();
    for (const cat of categories)
      this.categories.add(cat);
  }

  addCategories(arg: Id64Arg): void {
    for (const id of Id64.iterable(arg))
      this.categories.add(id);
  }

  dropCategories(arg: Id64Arg) {
    for (const id of Id64.iterable(arg))
      this.categories.delete(id);
  }

  changeCategoryDisplay(arg: Id64Arg, add: boolean): void {
    if (add)
      this.addCategories(arg);
    else
      this.dropCategories(arg);
  }

  equals(other: ViewCategorySelector): boolean {
    return equalIdSets(this.categories, other.categories);
  }
}

class ModelSelectorImpl implements ViewModelSelector {
  private readonly _models: ObservableSet<Id64String>;

  constructor(models: ObservableSet<Id64String>) {
    this._models = models;
  }

  get models(): Id64Set { return this._models; }
  set models(models: Id64Set) {
    this.models.clear;
    for (const model of models)
      this.models.add(model);
  }

  addModels(arg: Id64Arg): void {
    for (const id of Id64.iterable(arg))
      this.models.add(id);
  }

  dropModels(arg: Id64Arg): void {
    for (const id of Id64.iterable(arg))
      this.models.delete(id);
  }

  equals(other: ViewModelSelector): boolean {
    return equalIdSets(this.models, other.models);
  }
}

abstract class View implements IIModelView {
  private readonly _state: ViewState;
  pr
  public readonly categorySelector: ViewCategorySelector;

  protected constructor(state: ViewState) {
    this._state = state;
    this.categorySelector = new CategorySelectorImpl(state.categorySelector.observableCategories);
  }
}
*/
