/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/

/** @packageDocumentation
 * @module Serialization
 */

/**
 * Utilities to compare json objects by searching through their properties.
 * @public
 */
export class DeepCompare {
  /** Statistical accumulations during searchers. */
  public typeCounts = {
    numbers: 0,
    arrays: 0,
    functions: 0,
    objects: 0,
    strings: 0,
    booleans: 0,
    undefined: 0,
  };
  /** Counts of property names encountered during various searches. */
  public propertyCounts: { [key: string]: number } = {};
  /** Array of error descriptions. */
  public errorTracker: any[] = [];
  /** relative tolerance for declaring numeric values equal. */
  public numberRelTol: number;
  /** Construct comparison object with relative tolerance. */
  public constructor(numberRelTol = 1.0e-12) { this.numberRelTol = numberRelTol; }

  /** Test if a and b are within tolerance.
   * * If not, push error message to errorTracker.
   */
  public compareNumber(a: number, b: number) {
    if (Math.abs(b - a) < this.numberRelTol * (1 + Math.abs(a) + Math.abs(b))) {
      return this.announce(true);
    } else {
      this.errorTracker.unshift(b);
      this.errorTracker.unshift(a);
      this.errorTracker.unshift(`In ${this.errorTracker[this.errorTracker.length - 1]} property: Mismatched values`);
      return this.announce(false);
    }
  }

  private compareArray(a: any[], b: any[]) {
    if (a.length !== b.length) {
      const aCounter: { [key: string]: any } = {};
      const bCounter: { [key: string]: any } = {};
      // Append object to tracker that counts the properties of each array element (which is an object) in b, ONLY AT THIS LEVEL
      for (const i of b) {
        if (typeof i === "object" && typeof i !== "function" && !Array.isArray(i)) {
          for (const property in i) {
            if (i.hasOwnProperty(property)) {
              // Add property to counter if not already there
              if (!bCounter.hasOwnProperty(property))
                bCounter[property] = 0;
              bCounter[property]++;
            }
          }
        }
      }
      this.errorTracker.unshift(bCounter);
      // Append object to tracker that counts the properties of each array element (which is an object) in a, ONLY AT THIS LEVEL
      for (const i of a) {
        if (typeof i === "object" && typeof i !== "function" && !Array.isArray(i)) {
          for (const property in i) {
            if (i.hasOwnProperty(property)) {
              // Add property to counter if not already there
              if (!aCounter.hasOwnProperty(property))
                aCounter[property] = 0;
              aCounter[property]++;
            }
          }
        }
      }
      this.errorTracker.unshift(aCounter);

      this.errorTracker.unshift(`Mismatched array lengths a: [${a.length}] b: [${b.length}]`);
      return this.announce(false);
    }
    // Keep track of result for each element of array
    let toReturn = true;
    for (let i = 0; i < a.length; i++) {
      if (!this.compareInternal(a[i], b[i])) {
        toReturn = false;
        this.errorTracker.unshift(`[${i.toString()}]`);
        break;
      }
    }
    return this.announce(toReturn);
  }

  private compareObject(a: any, b: any) {
    // Check that both objects contain the same amount of properties
    if (a == null && b == null)
      return this.announce(true);
    if ((Object.keys(a)).length !== (Object.keys(b)).length) {
      this.errorTracker.unshift(`Mismatched property lists [${Object.keys(a)}][${Object.keys(b)}`);
      return this.announce(false);
    }
    // Keep track of result for each property of object
    let toReturn = true;
    for (const property in a) {
      // Only check non-generic object properties
      if (a.hasOwnProperty(property)) {
        // If property does not exist in propertyCounter, add it
        if (!this.propertyCounts.hasOwnProperty(property)) {
          this.propertyCounts[property] = 0;
        }
        this.propertyCounts[property]++;

        // Check that same property exists in b
        if (!(b.hasOwnProperty(property))) {
          this.errorTracker.unshift(`Property ${property} of A not in B`);
          this.errorTracker.unshift(a);
          this.errorTracker.unshift(b);
          return this.announce(false);
        }
        if (!this.compareInternal(a[property], b[property])) {
          // If not true, push property and break the loop
          this.errorTracker.unshift(property);
          toReturn = false;
          break;
        }
      }
    }
    return this.announce(toReturn);
  }

  // this is a convenient place for a breakpoint on failures in areSameStructure.
  private announce(value: boolean): boolean {
    if (value)
      return true;
    return false;
  }

  /** Main entry for comparing deep json objects.
   * * errorTracker, typeCounts, and propertyCounts are cleared.
   */
  public compare(a: any, b: any, tolerance?: number): boolean {
    if (tolerance !== undefined)
      this.numberRelTol = tolerance;
    this.errorTracker.length = 0;
    this.typeCounts.numbers = this.typeCounts.arrays = this.typeCounts.functions = this.typeCounts.objects = this.typeCounts.strings = this.typeCounts.booleans = this.typeCounts.undefined = 0;
    this.propertyCounts = {};
    return this.compareInternal(a, b);
  }

  // Recursive function for comparing any two nodes in a json object "tree"
  private compareInternal(a: any, b: any): boolean {
    if (typeof a !== typeof b) {
      return this.announce(false);
    } else if ((typeof a === "number") && (typeof b === "number")) {
      this.typeCounts.numbers++;
      return this.compareNumber(a, b);
    } else if (Array.isArray(a) && Array.isArray(b)) {
      this.typeCounts.arrays++;
      return this.compareArray(a, b);
    } else if (typeof a === "function" && typeof b === "function") {
      // No current necessity to check functions
      this.typeCounts.functions++;
      return true;
    } else if (typeof a === "object" && typeof b === "object") {
      // Argument is object but not array or function
      this.typeCounts.objects++;
      return (a === b) ? true : this.compareObject(a, b);
    } else if (typeof a === "string" && typeof b === "string") {
      this.typeCounts.strings++;
      return a === b;
    } else if (typeof a === "boolean" && typeof b === "boolean") {
      this.typeCounts.booleans++;
      return a === b;
    } else if (typeof a === "undefined" && typeof b === "undefined") {
      // As long as both are undefined, return true
      this.typeCounts.undefined++;
      return true;
    } else {
      // Unsupported type
      return this.announce(false);
    }
  }
}
