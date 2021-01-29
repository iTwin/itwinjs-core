/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
/** @packageDocumentation
 * @module SpatialClassification
 */

import { SpatialClassificationProps } from "@bentley/imodeljs-common";

/** @internal */
export interface SpatialClassifiersContainer {
  classifiers?: SpatialClassificationProps.Properties[];
}

/** Exposes a list of classifiers that allow one [[ModelState]] to classify another [[SpatialModel]] or reality model.
 * A spatial model can have a list of any number of available classifiers; at most one of those classifiers may be "active" at a given time.
 * @see [[SpatialModel.classifiers]]
 * @beta
 */
export class SpatialClassifiers {
  private readonly _jsonContainer: SpatialClassifiersContainer;
  private _active?: SpatialClassificationProps.Properties;

  /** @internal */
  public constructor(jsonContainer: SpatialClassifiersContainer) {
    this._jsonContainer = jsonContainer;
    const json = jsonContainer.classifiers;
    if (undefined !== json) {
      for (const props of json) {
        if (props.isActive) {
          if (undefined === this._active)
            this._active = props;
          else
            props.isActive = false;
        }
      }
    }
  }

  /** The currently-active classifier, if any is active.
   * @note If the `Classifier` object supplied to the setter did not originate from this `SpatialClassifier`'s list but an equivalent entry exists in the list, that entry
   * will be set as active - **not** the object supplied to the setter.#S
   */
  public get active(): SpatialClassificationProps.Classifier | undefined {
    return this._active;
  }
  public set active(active: SpatialClassificationProps.Classifier | undefined) {
    if (undefined === active && undefined === this._active)
      return;
    else if (undefined !== active && undefined !== this._active && SpatialClassificationProps.equalClassifiers(active, this._active))
      return;

    if (undefined === active) {
      if (undefined !== this._active)
        this._active.isActive = false;

      this._active = undefined;
      return;
    }

    const classifiers = this._jsonContainer.classifiers;
    if (undefined === classifiers)
      return;

    for (const classifier of classifiers) {
      if (SpatialClassificationProps.equalClassifiers(classifier, active)) {
        if (undefined !== this._active)
          this._active.isActive = false;

        this._active = classifier;
        this._active.isActive = true;
        return;
      }
    }
  }

  /** Supplies an iterator over the list of available classifiers. */
  public [Symbol.iterator](): Iterator<SpatialClassificationProps.Classifier> {
    let classifiers = this._jsonContainer.classifiers;
    if (undefined === classifiers)
      classifiers = [];

    return classifiers[Symbol.iterator]();
  }

  /** The number of available classifiers. */
  public get length(): number {
    const classifiers = this._jsonContainer.classifiers;
    return undefined !== classifiers ? classifiers.length : 0;
  }

  /** Adds a new classifier to the list, if an equivalent classifier is not already present.
   * @param classifier JSON representation of the new classifier
   * @returns The copy of `classifier` that was added to the list, or undefined if an equivalent classifier already exists in the list.
   */
  public push(classifier: SpatialClassificationProps.Classifier): SpatialClassificationProps.Classifier | undefined {
    for (const existing of this)
      if (SpatialClassificationProps.equalClassifiers(existing, classifier))
        return undefined;

    let list = this._jsonContainer.classifiers;
    if (undefined === list) {
      list = [];
      this._jsonContainer.classifiers = list;
    }

    const props: SpatialClassificationProps.Properties = { ...classifier, isActive: false };
    list.push(props);
    return props;
  }
}
