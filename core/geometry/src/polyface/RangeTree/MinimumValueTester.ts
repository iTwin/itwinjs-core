/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/

/** @packageDocumentation
 * @module CartesianGeometry
 */
/**
 * Data carrier for use when repeatedly testing items (of parameterized type T) to determine the one with a minimum associated value.
 * * Optionally also records arrays items and values whose values are less than a given trigger.
 * * When comparing a potential minimum value to an undefined value, the number is always accepted as "less than" the undefined value.
 * @internal
 */
export class MinimumValueTester<T>{
  public itemAtMinValue: T | undefined;
  public minValue: number | undefined;
  public triggerForSavingToArray: number | undefined;
  public savedItems: T[] | undefined;
  public savedValues: number[] | undefined;
  /**
   * Capture the given item with undefined item and value, and optional maxValueForSavingToArray.
   */
  private constructor(maxValueForSavingToArray?: number) {
    this.resetMinValueAndItem(undefined, undefined);
    this.resetTriggerValueForSavingToArray(maxValueForSavingToArray, true);
  }
  /**
   * static method to create a tester.
   * @param maxValueForSavingToArray optional numeric value limiting items to save to the optional array.
   * @returns new tester.
   */
  public static create<T>(maxValueForSavingToArray?: number): MinimumValueTester<T> {
    return new MinimumValueTester<T>(maxValueForSavingToArray);
  }
  /**
   * install new values (possibly undefined) for the saved item and value.
   * * the existing arrays of saved items and values, and the triggerValueForSavingToArray, are unaffected.
   * @param item
   * @param value
   */
  public resetMinValueAndItem(item: T | undefined = undefined, value: number | undefined = undefined) {
    this.itemAtMinValue = item;
    this.minValue = value;
  }

  public resetTriggerValueForSavingToArray(value: number | undefined, reinitializeArrays: boolean = false) {
    this.triggerForSavingToArray = value;
    if (reinitializeArrays) {
      this.savedItems = [];
      this.savedValues = [];
    }
  }
  /**
   * Test a new item with value.
   * * save the new item and value if either
   *   * this.value is undefined
   *   * new value is less than this.value.
   * * add the new item to the array of saved items if both
   *   * a maxValueToSavingToArray is present
   *   * the new value is less than or equal to that value.
   * @param item item to be saved if value conditions are met
   * @param value numeric value being minimized.
   * @returns true if the new value is less than prior values.
   */
  public testAndSave(item: T, value: number): boolean {

    if (this.triggerForSavingToArray !== undefined && value <= this.triggerForSavingToArray) {
      this.savedValues!.push(value);
      this.savedItems!.push(item);
    }

    if (this.minValue === undefined || value < this.minValue) {
      this.minValue = value;
      this.itemAtMinValue = item;
      return true;
    }
    return false;
  }
  public isNewMinValue(value: number): boolean {
    return this.minValue === undefined || value < this.minValue;
  }
  public isNewMinOrTrigger(value: number): boolean {
    if (this.minValue === undefined || value < this.minValue)
      return true;
    if (this.triggerForSavingToArray === undefined || value < this.triggerForSavingToArray)
      return true;
    return false;
  }
}
