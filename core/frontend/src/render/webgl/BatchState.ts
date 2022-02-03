/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
/** @packageDocumentation
 * @module WebGL
 */

import type { Id64String} from "@itwin/core-bentley";
import { assert, Id64, lowerBound } from "@itwin/core-bentley";
import type { Feature } from "@itwin/core-common";
import type { IModelConnection } from "../../IModelConnection";
import type { BranchStack } from "./BranchStack";
import type { Batch } from "./Graphic";

/**
 * Assigns a transient, unique 32-bit integer ID to each Batch in a RenderCommands.
 * A batch ID of 0 means "no batch".
 * The first batch gets batch ID of 1.
 * The next batch gets the previous batch's ID plus the number of features in the previous batch's feature table
 * (or 1, if empty feature table).
 * The IDs are set temporarily as members on the Batch objects and reset to 0 immediately after rendering.
 * The currentBatch member identifies the batch containing primitives currently being drawn.
 * The combination of the current batch's ID (passed as uniform to shader) and the index of a given Feature within
 * its batch's FeatureTable (stored in vertex table) produce a unique ID for every feature rendered during a frame.
 * During rendering, the feature IDs are written to the "feature ID" color attachment.
 * The batch IDs remain valid during a call to Target.readPixels() so that they can be used to extract
 * Features from the Batch's FeatureTables.
 * @internal
 */
export class BatchState {
  private readonly _stack: BranchStack;
  private _batches: Batch[] = []; // NB: this list is ordered - but *not* indexed - by batch ID.
  private _curBatch?: Batch;

  public constructor(stack: BranchStack) {
    this._stack = stack;
  }

  public get currentBatch(): Batch | undefined { return this._curBatch; }
  public get currentBatchId(): number { return undefined !== this._curBatch ? this._curBatch.batchId : 0; }
  public get currentBatchIModel(): IModelConnection | undefined { return undefined !== this._curBatch ? this._curBatch.batchIModel : undefined; }
  public get isEmpty(): boolean { return 0 === this._batches.length; }

  public push(batch: Batch, allowAdd: boolean): void {
    assert(undefined === this.currentBatch, "batches cannot nest");
    this.getBatchId(batch, allowAdd);
    this._curBatch = batch;
  }

  public pop(): void {
    assert(undefined !== this.currentBatch);
    this._curBatch = undefined;
  }

  public reset(): void {
    assert(undefined === this.currentBatch);
    for (const batch of this._batches)
      batch.resetContext();

    this._batches.length = 0;
    this._curBatch = undefined;
  }

  public getElementId(featureId: number): Id64String {
    const batch = this.find(featureId);
    if (undefined === batch)
      return Id64.invalid;

    const featureIndex = featureId - batch.batchId;
    assert(featureIndex >= 0);

    const parts = batch.featureTable.getElementIdPair(featureIndex);
    return Id64.fromUint32Pair(parts.lower, parts.upper);
  }

  public getFeature(featureId: number): Feature | undefined {
    const batch = this.find(featureId);
    if (undefined === batch)
      return undefined;

    const featureIndex = featureId - batch.batchId;
    assert(featureIndex >= 0);

    return batch.featureTable.findFeature(featureIndex);
  }

  public get numFeatureIds() { return this.nextBatchId; }
  public get numBatches() { return this._batches.length; }

  public findBatchId(featureId: number) {
    const batch = this.find(featureId);
    return undefined !== batch ? batch.batchId : 0;
  }

  public get nextBatchId(): number {
    if (this.isEmpty)
      return 1;

    const prev = this._batches[this._batches.length - 1];
    assert(0 !== prev.batchId);

    let prevNumFeatures = prev.featureTable.numFeatures;
    if (0 === prevNumFeatures)
      prevNumFeatures = 1;

    return prev.batchId + prevNumFeatures;
  }

  private getBatchId(batch: Batch, allowAdd: boolean): number {
    if (allowAdd && 0 === batch.batchId) {
      batch.setContext(this.nextBatchId, this._stack.top.iModel);
      this._batches.push(batch);
    }

    return batch.batchId;
  }

  private indexOf(featureId: number): number {
    if (featureId <= 0)
      return -1;

    const found = lowerBound(featureId, this._batches, (lhs: number, rhs: Batch) => {
      // Determine if the requested feature ID is within the range of this batch.
      if (lhs < rhs.batchId)
        return -1;

      const numFeatures = rhs.featureTable.numFeatures;
      const nextBatchId = rhs.batchId + (numFeatures > 0 ? numFeatures : 1);
      return lhs < nextBatchId ? 0 : 1;
    });

    return found.index < this._batches.length ? found.index : -1;
  }

  public find(featureId: number): Batch | undefined {
    const index = this.indexOf(featureId);
    return -1 !== index ? this._batches[index] : undefined;
  }
}
