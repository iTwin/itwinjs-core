/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
/** @packageDocumentation
 * @module CartesianGeometry
 */

/**
 * Data carrier for use when repeatedly testing items (of parameterized type T) to determine the one with a minimum associated value.
 * * Optionally pushes to arrays of items and values when the value does not exceed a given trigger.
 * * * The item at minimum value is still recorded, even if the minimum value exceeds the trigger value.
 * * When comparing a potential minimum value to an undefined value, the number is always accepted as the new minimum.
 * @internal
 */
export class MinimumValueTester<T>{
  public itemAtMinValue: T | undefined;
  public minValue: number | undefined;
  public triggerForSavingToArray: number | undefined;
  public savedItems: T[] = [];
  public savedValues: number[] = [];
  /**
   * Capture the given item with undefined item and value, and optional maxValueForSavingToArray.
   */
  private constructor(maxValueForSavingToArray?: number) {
    this.resetMinValueAndItem(undefined, undefined);
    this.resetTriggerValueForSavingToArray(maxValueForSavingToArray, false);
  }
  /**
   * Static method to create a tester.
   * @param maxValueForSavingToArray optional numeric value limiting items to save to the optional array.
   * @returns new tester.
   */
  public static create<T>(maxValueForSavingToArray?: number): MinimumValueTester<T> {
    return new MinimumValueTester<T>(maxValueForSavingToArray);
  }
  /**
   * Install new minimum value and associated item, both possibly undefined.
   * * The existing arrays of saved items and values, and the trigger value, are unaffected.
   * @param item object to associate with the new minimum value
   * @param value new minimum value
   */
  public resetMinValueAndItem(item: T | undefined = undefined, value: number | undefined = undefined) {
    this.itemAtMinValue = item;
    this.minValue = value;
  }
  /**
   * Set the trigger value.
   * @param value new trigger value
   * @param reinitializeArrays whether to clear the arrays of saved items and values
   */
  public resetTriggerValueForSavingToArray(value: number | undefined, reinitializeArrays: boolean = false) {
    this.triggerForSavingToArray = value;
    if (reinitializeArrays) {
      this.savedItems = [];
      this.savedValues = [];
    }
  }
  /**
   * Test a new item with value.
   * * Push the new item and value to the saved arrays if both:
   *   * `this.triggerForSavingToArray` is defined
   *   * the new value is less than or equal to `this.triggerForSavingToArray`.
   * * Save the new item and value if either:
   *   * `this.minValue` is undefined
   *   * new value is less than `this.minValue`.
   * @param item item to be saved (captured!) if value conditions are met
   * @param value numeric value being minimized.
   * @returns true if and only if the input value is the new minimum value.
   */
  public testAndSave(item: T, value: number): boolean {
    if (this.doesValueTrigger(value)) {
      this.savedValues.push(value);
      this.savedItems.push(item);
    }
    if (this.isNewMinValue(value)) {
      this.minValue = value;
      this.itemAtMinValue = item;
      return true;
    }
    return false;
  }
  /** Whether the input value is small enough to be saved to this instance. */
  public doesValueTrigger(value: number): boolean {
    return this.triggerForSavingToArray !== undefined && value <= this.triggerForSavingToArray;
  }
  /** Whether the input value is smaller than the last recorded minimum value. */
  public isNewMinValue(value: number): boolean {
    return this.minValue === undefined || value < this.minValue;
  }
  /** Whether the input value is small enough to be the new minimum or to be saved to this instance. */
  public isNewMinOrTrigger(value: number): boolean {
    return this.isNewMinValue(value) || this.doesValueTrigger(value);
  }
}
