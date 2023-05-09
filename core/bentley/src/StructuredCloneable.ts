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
 * ###TODO this isn't really what we want - we want to constrain the types of properties permitted in an interface, not permit the getting/setting of arbitrarily-named properties...
 * @see [[StructuredCloneable]].
 * @alpha
 */
export type StructuredCloneableObject = { [key: string]: StructuredCloneable | undefined };

/** Describes any type that supports [structured cloning](https://developer.mozilla.org/en-US/docs/Web/API/Web_Workers_API/Structured_clone_algorithm#supported_types).
 * @alpha
 */
export type StructuredCloneable = StructuredCloneableCollection | StructuredCloneableObject | StructuredCloneablePrimitive;

/** Interface that collects objects that can be [transfered](https://developer.mozilla.org/en-US/docs/Web/API/Web_Workers_API/Transferable_objects) when using
 * structured cloning.
 * @see [[ToStructureCloneable.toStructuredCloneable]].
 * @alpha
 */
export interface Transferables extends Iterable<Transferable> {
  add(transferable: Transferable): void;
}

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
  toStructuredCloneable(transferables: Transferables): StructuredCloneable;
}
