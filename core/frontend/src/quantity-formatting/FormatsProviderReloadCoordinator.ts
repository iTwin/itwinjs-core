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

interface ReloadWaiter {
  resolve: () => void;
  reject: (reason?: unknown) => void;
}

/** Serializes formatting reloads, keeps the newest pending request, and completes or rejects callers waiting for formatting to become ready. @internal */
export class FormatsProviderReloadCoordinator {
  private _reloadInFlight = false;
  private _pendingReload: ReloadIntent | undefined;
  private _reloadWaiters = new Set<ReloadWaiter>();
  private _isDisposed = false;

  public constructor(private readonly _host: ReloadCoordinatorHost, private readonly _disposedError: Error) {}

  public dispose(): void {
    if (this._isDisposed)
      return;

    this._isDisposed = true;
    this._pendingReload = undefined;
    this._rejectReloadWaiters(this._disposedError);
  }

  public async runAndWaitForReload(action: () => void): Promise<void> {
    if (this._isDisposed || this._host.isDisposed())
      throw this._disposedError;

    let waiter!: ReloadWaiter;
    const reload = new Promise<void>((resolve, reject) => {
      waiter = { resolve, reject };
    });

    // Register the waiter before invoking the action. The action raises provider events synchronously,
    // and an event listener can start a second awaited request.
    this._rejectReloadWaiters(new ReloadSupersededError());
    this._reloadWaiters.add(waiter);

    try {
      action();
    } catch (error) {
      this._reloadWaiters.delete(waiter);
      throw error;
    }

    await reload;
  }

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
    this._resolveReloadWaiters();
  }

  private _stopAfterDisposal(): boolean {
    if (!this._isDisposed && !this._host.isDisposed())
      return false;

    this._reloadInFlight = false;
    this._pendingReload = undefined;
    return true;
  }

  private _takePendingReload(): ReloadIntent | undefined {
    const next = this._pendingReload;
    if (next) {
      this._pendingReload = undefined;
      this._reloadInFlight = false;
    }
    return next;
  }

  private _handleReloadFailure(error: unknown, continueWithPending: boolean): Promise<void> | void {
    this._reloadInFlight = false;
    if (this._isDisposed || this._host.isDisposed()) {
      this._pendingReload = undefined;
      this._rejectReloadWaiters(this._disposedError);
      return;
    }

    if (!continueWithPending || !(error instanceof ReloadSupersededError))
      this._host.handleReloadFailure(error);

    const next = continueWithPending ? this._takePendingReload() : undefined;
    if (next)
      return this.scheduleReload(next);

    this._rejectReloadWaiters(error);
  }

  private _resolveReloadWaiters(): void {
    const waiters = [...this._reloadWaiters];
    this._reloadWaiters.clear();
    for (const waiter of waiters)
      waiter.resolve();
  }

  private _rejectReloadWaiters(error: unknown): void {
    const waiters = [...this._reloadWaiters];
    this._reloadWaiters.clear();
    for (const waiter of waiters)
      waiter.reject(error);
  }
}
