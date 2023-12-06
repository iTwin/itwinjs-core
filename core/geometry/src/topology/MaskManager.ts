/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/

/** @packageDocumentation
 * @module Topology
 */
/**
 * Methods to "grab and drop" mask bits.
 * * Caller code (e.g. HalfEdgeGraph) initializes with a block of bits to be managed.
 * * Callers borrow and return masks with "grabMask" and "dropMask".
 * * Callers must exercise grab/drop balance discipline.
 * @internal
 */
export class MaskManager {
  private _freeMasks: number;
  private _originalFreeMasks: number;
  private _firstFreeMask: number;
  /**
   * Constructor
   * @param freeMasks caller-defined block of bits that are to be managed.
   * @param firstFreeMask the first free mask in the freeMasks bits block.
   */
  private constructor(freeMasks: number, firstFreeMask: number) {
    this._freeMasks = freeMasks;
    this._originalFreeMasks = freeMasks;
    this._firstFreeMask = firstFreeMask;
  }
  /**
   * Create a MaskManager.
   * Typical use: MaskManager.create(0xFFFF0000)
   * * This makes bits 16 through 31 available to be borrowed, with lower bits available for fixed usage.
   */
  public static create(freeMasks: number): MaskManager | undefined {
    // look for first bit up to bit 31
    let firstFree = 0;
    let testBit = 0x01;
    for (let i = 0; i < 32; i++) {
      if ((testBit & freeMasks) !== 0) {
        firstFree = testBit;
        break;
      }
      testBit = (testBit << 1);
    }
    if (firstFree === 0)
      return undefined;
    return new MaskManager(freeMasks, firstFree);
  }
  /** Find a mask bit that is not "in use" in order to borrow that mask. */
  public grabMask(): number {
    if (this._freeMasks === 0)
      return 0;
    let mask = this._firstFreeMask;
    while (!(mask & this._freeMasks))
      mask = mask << 1;
    this._freeMasks &= ~mask;
    return mask;
  }
  /** Return the borrowed mask so it is not "in use" anymore. */
  public dropMask(mask: number) {
    mask &= this._originalFreeMasks; // prevent "drop" of mask that is not in the pool.
    this._freeMasks |= mask;
  }
}
