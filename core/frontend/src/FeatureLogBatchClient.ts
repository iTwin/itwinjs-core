/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
/** @module Features */
import { UlasClient, FeatureLogEntry, AuthorizedClientRequestContext, ClientsLoggerCategory } from "@bentley/imodeljs-clients";
import { Logger } from "@bentley/bentleyjs-core";

const loggerCategory: string = ClientsLoggerCategory.UlasClient;

/**
 * Options for FeatureLogBatchClient
 * *See also
 *  - [[FeatureLogBatchClient]]
 * @internal
 */
export interface FeatureLogBatchOptions {
  maxBatchInterval: number; // maximum time between batched submissions
  maxBatchSize: number; // maximum number of FeatureLogEntries to be batched
}

/**
 * Wraps UlasClient for processing batched FeatureLogEntries
 * *See also
 *  - [[FeatureLogEntry]], [[UlasClient]]
 * @internal
 */
export class FeatureLogBatchClient {
  private _queue: FeatureLogEntry[] = [];
  private _options: FeatureLogBatchOptions;
  private _timerId: any | undefined = undefined; // used to clear the automatic batch submissions

  private readonly _defaultOptions = {
    maxBatchInterval: 5000, // 5 seconds
    maxBatchSize: 100, // or 100 logs
  };

  /** Creates a new FeatureLogBatchClient instance.
   *  @param _getRequestContext method to get an AuthorizedClientRequestContext used when submitting batches (see [[AuthorizedClientRequestContext]])
   *  @param options used to override any of the default options (see [[FeatureLogBatchOptions]])
   *  @param _client client used to submit feature logs to ULAS (see [[UlasClient]])
   */
  constructor(
    private _getRequestContext: () => Promise<AuthorizedClientRequestContext>,
    options: Partial<FeatureLogBatchOptions> = {},
    private _client: UlasClient = new UlasClient(),
    ) {
    this._options = { ...this._defaultOptions, ...options };
  }
  /** slices the queue of feature logs in batches limited by the maxBatchSize option then submit them using the UlasClient */
  private async _submitBatchedLogs() {
    try {
      // save off and empty queue to prevent new logs from being added during while loop
      const queue = this._queue.slice();
      this._queue = [];

      while (queue.length > 0) {
        const logs = queue.splice(0, this._options.maxBatchSize);
        const context = await this._getRequestContext();
        await this._client.logFeature(context, ...logs);
      }
    } catch (ex) {
      Logger.logError(loggerCategory, "Error submitting feature log entries", () => ex);
    }
  }

  /** starts the automatic batch submission based on the interval controlled by the maxBatchInterval option */
  public setupAutomaticBatchSubmission() {
    // Initialize timer Id
    this._timerId = setInterval(async () => { await this._submitBatchedLogs(); }, this._options.maxBatchInterval);
  }

  /** stops automatic batch submission */
  public clearAutomaticBatchSubmission(reset?: boolean) {
    clearInterval(this._timerId);

    if (reset)
      this.setupAutomaticBatchSubmission();
  }

  /** Pushes feature logs entries onto the queue for submission during next batch interval
   *  @param entries one or many feature log entries to be batched (see [[FeatureLogEntry]])
   */
  public async queueLog(...entries: FeatureLogEntry[]) {
    if (this._timerId === undefined)
      this.setupAutomaticBatchSubmission();

    this._queue.push(...entries);
    if (this._queue.length > this._options.maxBatchSize)
      await this._submitBatchedLogs();
  }
}
