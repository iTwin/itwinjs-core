/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
/** @packageDocumentation
 * @module Utils
 */

/** A union of the base types that support [structured cloning](https://developer.mozilla.org/en-US/docs/Web/API/Web_Workers_API/Structured_clone_algorithm#supported_types).
 * @see [[StructuredCloneable]].
 * @alpha
 */
export type StructuredCloneablePrimitive = ArrayBuffer | ArrayBufferView | bigint | boolean | DataView | Date | Error | number | RegExp | string;

/** A union of the collection types that support [structured cloning](https://developer.mozilla.org/en-US/docs/Web/API/Web_Workers_API/Structured_clone_algorithm#supported_types).
 * @see [[StructuredCloneable]].
 * @alpha
 */
export type StructuredCloneableCollection = Map<StructuredCloneable, StructuredCloneable> | Set<StructuredCloneable> | StructuredCloneable[][];

/** Interface describing an object that consists solely of properties that support [structured cloning](https://developer.mozilla.org/en-US/docs/Web/API/Web_Workers_API/Structured_clone_algorithm#supported_types).
 * @see [[StructuredCloneable]].
 * @alpha
 */
export type StructuredCloneableObject = { [key: string]: StructuredCloneable | undefined };

/** Describes any type that supports [structured cloning](https://developer.mozilla.org/en-US/docs/Web/API/Web_Workers_API/Structured_clone_algorithm#supported_types).
 * @alpha
 */
export type StructuredCloneable = StructuredCloneableCollection | StructuredCloneableObject | StructuredCloneablePrimitive;

/** Interface adopted by an object that can produce a [[StructuredCloneable]] representation of itself.
 * @alpha
 */
export interface ToStructuredCloneable {
  /** Produces a representation of this object that can be serialized by [structuredClone](https://developer.mozilla.org/en-US/docs/Web/API/structuredClone) without producing
   * errors.
   * Any transferable objects (for example, the backing ArrayBuffer for a Uint32Array property) should be added to `transferables` - they will be transferred instead of copied.
   * @param transferables An array of transferable objects to be transferred instead of copied.
   * @returns the cloneable representation.
   */
  toStructuredCloneable(transferables: Transferable[]): StructuredCloneable;
}
