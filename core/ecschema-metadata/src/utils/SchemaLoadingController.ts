/*---------------------------------------------------------------------------------------------
 * Copyright (c) Bentley Systems, Incorporated. All rights reserved.
 * See LICENSE.md in the project root for license terms and full copyright notice.
 *--------------------------------------------------------------------------------------------*/

/**
 * Assists in tracking the loading progress of Schemas and SchemaItems. An instance of this
 * class is set in Schema and SchemaItem instances.
 * @internal
 */
export class SchemaLoadingController {
  private _complete;
  private _inProgress;
  private _promise?: Promise<void>;

  /**
   * Indicates of the Schema or SchemaItem has been fully loaded.
   */
  public get isComplete() {
    return this._complete;
  }

  /**
   * Marks that a Schema or SchemaItem has been fully loaded.
   */
  public set isComplete(value: boolean) {
    this._complete = value;
  }

  /**
   * Indicates that the loading of a Schema or SchemaItem is still in progress
   */
  public get inProgress() {
    return this._inProgress;
  }

  /**
   * Initializes a new SchemaLoadingController instance.
   */
  constructor() {
    this._complete = false;
    this._inProgress = false;
  }

  /**
   * Call this method when starting to load a Schema or SchemaItem
   * @param promise The promise used to update the controller state when the promise is resolved.
   */
  public start(promise: Promise<void>) {
    this._inProgress = true;
    void promise.then(() => {
      this._complete = true;
      this._inProgress = false;
    }).catch(() => {
      // Errors are handled when wait() is called. This catch prevents unhandled rejection warnings.
      this._inProgress = false;
    });
    this._promise = promise;
  }

  /**
   * Waits on the Promise given in SchemaLoadingController.start().
   * @returns A Promised that can be awaited while the Schema or SchemaItem is being loaded.
   */
  public async wait(): Promise<void> {
    if (!this._promise)
      throw new Error("LoadingController 'start' must be called before 'wait'");
    return this._promise;
  }
}