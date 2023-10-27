/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/

/** @packageDocumentation
 * @module CartesianGeometry
 */

export class BestYet<T>{
  public item: T | undefined;
  public value: number;
  constructor(item: T | undefined, value: number = Number.MAX_VALUE) {
    this.item = item;
    this.value = value;
  }
  public testToReduce(item: T | undefined, value: number | undefined) {
    if (value !== undefined && value < this.value) {
      this.value = value;
      this.item = item;
    }
  }
}
