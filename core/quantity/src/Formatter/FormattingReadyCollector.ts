/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
/** @module Quantity */

import { Logger } from "@itwin/core-bentley";
import { QuantityLoggerCategory } from "../QuantityLoggerCategory";

/** Collects async work from formatting providers during the pre-ready phase.
 * Providers call [[addPendingWork]] to register promises that the formatter
 * will await before signaling [[QuantityFormatter.onFormattingReady]].
 * @beta
 */
export class FormattingReadyCollector {
  private _promises: Promise<void>[] = [];

  /** Register async work that must complete before the formatter signals ready.
   * Call this from an `onBeforeFormattingReady` listener.
   */
  public addPendingWork(work: Promise<void>): void {
    this._promises.push(work);
  }

  /** @internal Await all registered work with a timeout. Logs warnings for rejections and timeouts. */
  public async awaitAll(timeoutMs: number = 20_000): Promise<void> {
    if (this._promises.length === 0)
      return;

    const timeout = new Promise<"timeout">((resolve) => setTimeout(() => resolve("timeout"), timeoutMs));
    const work = Promise.allSettled(this._promises).then((results) => {
      for (const result of results) {
        if (result.status === "rejected") {
          Logger.logWarning(QuantityLoggerCategory.Formatting, "FormattingReadyCollector: a provider's async work rejected", () => ({ reason: result.reason }));
        }
      }
      return "done" as const;
    });

    const outcome = await Promise.race([work, timeout]);
    if (outcome === "timeout") {
      Logger.logWarning(QuantityLoggerCategory.Formatting, `FormattingReadyCollector: timed out after ${timeoutMs}ms waiting for ${this._promises.length} provider(s). Proceeding with ready signal.`);
    }
  }
}
