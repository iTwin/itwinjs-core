/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
/** @packageDocumentation
 * @module Collections
 */

/** Partitions an array in-place according to some criterion, such that elements that fulfill the criterion are grouped in the lower
 * portion of the array, and those that fail to fulfill the criterion are grouped in the upper portion of the array.
 * @param array The array to be partitioned.
 * @param criterion A function invoked for each element of the array, returning whether the element fulfills the criterion.
 * @returns The index of the upper partition, i.e., of the first element that fails the criterion. If all elements fulfill the criterion, this is the length of the array.
 * @note The relative ordering of elements within each partition is unspecified.
 * Example:
 * ```ts
 * function isEven(n: number) { return 0 === n % 2; }
 * const list = [ 1, 2, 3, 4, 5 ];
 * const firstOddIndex = partitionArray(list, isEven); // firstOddIndex = 2
 * // 2 and 4 now appear before 1, 3, and 5 in the list; their ordering is otherwise unspecified.
 * for (let i = 0; i < list.length; i++)
 *   assert(isEven(list[i]) === i < firstOddIndex);
 * ```
 * @public
 */
export function partitionArray<T>(array: T[], criterion: (element: T) => boolean): number {
  let index = 0;
  let partition = array.length;
  while (index < partition) {
    const elem = array[index];
    if (criterion(elem)) {
      ++index;
    } else {
      array[index] = array[--partition];
      array[partition] = elem;
    }
  }

  return partition;
}
