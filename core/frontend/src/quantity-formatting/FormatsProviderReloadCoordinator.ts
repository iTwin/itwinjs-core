/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/

import { FormatsChangedArgs, FormatsProvider, UnitSystemKey } from "@itwin/core-quantity";

/** @internal */
export interface FormatsProviderChange {
  readonly baseProvider: FormatsProvider;
  readonly replacementProvider: FormatsProvider;
  readonly targetUnitSystem: UnitSystemKey;
}

/** @internal */
export class ReloadSupersededError extends Error {
  public constructor() {
    super("QuantityFormatter reload was superseded by a newer request.");
    this.name = "ReloadSupersededError";
  }
}

/** @internal */
export type ReloadIntent =
  | { scope: "full" }
  | {
    scope: "formatsChanged";
    args: FormatsChangedArgs;
    provider: FormatsProvider;
    providerChange?: FormatsProviderChange;
    targetUnitSystem: UnitSystemKey;
  }
  | { scope: "activeSystem"; system: UnitSystemKey; emitSystemChanged?: boolean };

export interface ReloadCoordinatorHost {
  isDisposed(): boolean;
  startReload(): void;
  executeReload(intent: ReloadIntent): Promise<void>;
  finalizeReload(): Promise<void>;
  handleReloadFailure(error: unknown): void;
}

interface ReloadCaller {
  resolve: () => void;
  reject: (reason?: unknown) => void;
}

/**
 * Serializes formatting reloads, keeps the newest pending request, and resolves or rejects callers waiting for formatting to become ready.
 * @internal
 */
export class FormatsProviderReloadCoordinator {
  private _reloadInFlight = false;
  private _pendingReload: ReloadIntent | undefined;
  private _reloadCallers = new Set<ReloadCaller>();
  private _isDisposed = false;

  public constructor(private readonly _host: ReloadCoordinatorHost, private readonly _disposedError: Error) {}

  public dispose(): void {
    if (this._isDisposed)
      return;

    this._isDisposed = true;
    this._pendingReload = undefined;
    this._rejectReloadCallers(this._disposedError);
  }

  /**
   * Runs an action that schedules a reload and waits for the reload queue to drain.
   * A newer call rejects an older call that is still waiting.
   * @internal
   */
  public async runAndWaitForReload(action: () => void): Promise<void> {
    if (this._isDisposed || this._host.isDisposed())
      throw this._disposedError;

    let caller!: ReloadCaller;
    const reload = new Promise<void>((resolve, reject) => {
      caller = { resolve, reject };
    });

    // Register the caller before invoking the action. The action raises provider events synchronously,
    // and an event listener can start a second awaited request.
    this._rejectReloadCallers(new ReloadSupersededError());
    this._reloadCallers.add(caller);

    try {
      action();
    } catch (error) {
      this._reloadCallers.delete(caller);
      throw error;
    }

    await reload;
  }

  /**
   * Schedules a reload and keeps only the newest pending reload while another is running.
   * If a reload is already running, this method returns immediately; use [[runAndWaitForReload]] when the caller must wait for completion.
   * @internal
   */
  public async scheduleReload(intent: ReloadIntent): Promise<void> {
    if (this._isDisposed || this._host.isDisposed())
      return;

    if (this._reloadInFlight) {
      this._pendingReload = intent;
      return;
    }

    this._reloadInFlight = true;
    this._host.startReload();
    let continueWithPending = true;
    let nextReload: ReloadIntent | undefined;

    try {
      await this._host.executeReload(intent);
      if (this._stopAfterDisposal())
        return;

      nextReload = this._takePendingReload();
      if (!nextReload) {
        continueWithPending = false;
        await this._host.finalizeReload();
        if (this._stopAfterDisposal())
          return;

        nextReload = this._takePendingReload();
      }
    } catch (error) {
      return this._handleReloadFailure(error, continueWithPending);
    }

    if (nextReload)
      return this.scheduleReload(nextReload);

    this._reloadInFlight = false;
    this._resolveReloadCallers();
  }

  /** Stops reload processing when this coordinator or its host is disposed. */
  private _stopAfterDisposal(): boolean {
    if (!this._isDisposed && !this._host.isDisposed())
      return false;

    this._reloadInFlight = false;
    this._pendingReload = undefined;
    return true;
  }

  /** Removes the newest pending reload and marks the current reload complete before starting it. */
  private _takePendingReload(): ReloadIntent | undefined {
    const next = this._pendingReload;
    if (next) {
      this._pendingReload = undefined;
      this._reloadInFlight = false;
    }
    return next;
  }

  /** Handles a reload failure and, when appropriate, starts the newest pending reload. */
  private _handleReloadFailure(error: unknown, continueWithPending: boolean): Promise<void> | void {
    this._reloadInFlight = false;
    if (this._isDisposed || this._host.isDisposed()) {
      this._pendingReload = undefined;
      this._rejectReloadCallers(this._disposedError);
      return;
    }

    if (!continueWithPending || !(error instanceof ReloadSupersededError))
      this._host.handleReloadFailure(error);

    const next = continueWithPending ? this._takePendingReload() : undefined;
    if (next)
      return this.scheduleReload(next);

    this._rejectReloadCallers(error);
  }

  /** Resolves all callers after the reload queue finishes successfully. */
  private _resolveReloadCallers(): void {
    const callers = [...this._reloadCallers];
    this._reloadCallers.clear();
    for (const caller of callers)
      caller.resolve();
  }

  /** Rejects all callers when the reload queue fails or is superseded. */
  private _rejectReloadCallers(error: unknown): void {
    const callers = [...this._reloadCallers];
    this._reloadCallers.clear();
    for (const caller of callers)
      caller.reject(error);
  }
}
