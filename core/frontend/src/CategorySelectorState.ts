/*---------------------------------------------------------------------------------------------
* Copyright (c) 2018 - present Bentley Systems, Incorporated. All rights reserved.
* Licensed under the MIT License. See LICENSE.md in the project root for license terms.
*--------------------------------------------------------------------------------------------*/
/** @module Views */
import { Id64, Id64Arg, Id64String } from "@bentley/bentleyjs-core";
import { ElementState } from "./EntityState";
import { IModelConnection } from "./IModelConnection";
import { CategorySelectorProps } from "@bentley/imodeljs-common";

/** A set of Categories to be displayed in a [[ViewState]].
 * Elements belonging to categories not specified in the category selector will not be drawn in the view.
 * By default, geometry belonging to any [[SubCategory]] of a visible Category is also visible in the view,
 * unless the [[SubCategoryAppearance]] or [[SubCategoryOverride]] specifies that it should be invisible.
 * @note: To change the set of categories visible in a [[ViewState]] currently associated with a [[Viewport]],
 * use [[ViewState.changeCategoryDisplay]] to ensure the view updates appropriately on screen.
 * @see [[Category]]
 */
export class CategorySelectorState extends ElementState {
  public categories: Set<string> = new Set<string>();
  constructor(props: CategorySelectorProps, iModel: IModelConnection) {
    super(props, iModel);
    if (props.categories)
      props.categories.forEach((cat) => this.categories.add(cat));
  }

  public toJSON(): CategorySelectorProps {
    const val = super.toJSON() as CategorySelectorProps;
    val.categories = [];
    this.categories.forEach((cat) => val.categories.push(cat));
    return val;
  }

  public equalState(other: CategorySelectorState): boolean {
    if (this.categories.size !== other.categories.size)
      return false;

    if (this.name !== other.name)
      return false;

    const otherIter = other.categories.keys();
    let otherRes = otherIter.next();
    for (let thisIter = this.categories.keys(), thisRes = thisIter.next(); !thisRes.done; thisRes = thisIter.next(), otherRes = otherIter.next()) {
      if (thisRes.value !== otherRes.value)
        return false;
    }

    return true;
  }

  /** Get the name of this CategorySelector */
  public get name(): string { return this.code.getValue(); }

  /** Determine whether this CategorySelector includes the specified categoryId string */
  public has(id: Id64String): boolean { return this.categories.has(id.toString()); }

  /** Determine whether this CategorySelector includes the specified category */
  public isCategoryViewed(categoryId: Id64String): boolean { return this.has(categoryId); }

  /** Add a category to this CategorySelector */
  public addCategories(arg: Id64Arg): void { Id64.toIdSet(arg).forEach((id) => this.categories.add(id)); }

  /** Drop a category from this CategorySelector */
  public dropCategories(arg: Id64Arg) { Id64.toIdSet(arg).forEach((id) => this.categories.delete(id)); }

  /** Add or Drop categories to this CategorySelector */
  public changeCategoryDisplay(arg: Id64Arg, add: boolean): void { if (add) this.addCategories(arg); else this.dropCategories(arg); }
}
