/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/

import { FormatsChangedArgs, FormatsProvider, UnitSystemKey } from "@itwin/core-quantity";

/** @internal */
export interface FormatsProviderChange {
  readonly baseProvider: FormatsProvider;
  readonly replacementProvider: FormatsProvider;
  readonly impliedUnitSystem?: UnitSystemKey;
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

interface ReloadCoordinatorHost {
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
  private _pendingProviderReload: ReloadIntent | undefined;
  private _reloadCaller: ReloadCaller | undefined;
  private _isDisposed = false;

  public constructor(private readonly _host: ReloadCoordinatorHost, private readonly _disposedError: Error) {}

  public dispose(): void {
    if (this._isDisposed)
      return;

    this._isDisposed = true;
    this._pendingReload = undefined;
    this._pendingProviderReload = undefined;
    this._rejectReloadCaller(this._disposedError);
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

    this._rejectReloadCaller(new ReloadSupersededError());
    this._reloadCaller = caller;

    try {
      action();
    } catch (error) {
      if (this._reloadCaller === caller)
        this._reloadCaller = undefined;
      throw error;
    }

    await reload;
  }

  /**
   * Schedules a reload and keeps the newest pending reload while another is running.
   * Provider replacement reloads are retained separately because the manager has already changed the active provider and the transaction must not be discarded by an unrelated reload.
   * If a reload is already running, this method returns immediately; use [[runAndWaitForReload]] when the caller must wait for completion.
   * @internal
   */
  public async scheduleReload(intent: ReloadIntent): Promise<void> {
    if (this._isDisposed || this._host.isDisposed()) {
      this._rejectReloadCaller(this._disposedError);
      return;
    }

    if (this._reloadInFlight) {
      this._queuePendingReload(intent);
      return;
    }

    this._reloadInFlight = true;
    let current: ReloadIntent | undefined = intent;
    while (current) {
      try {
        this._host.startReload();
        await this._host.executeReload(current);
      } catch (error) {
        if (this._stopAfterDisposal())
          return;

        if (!(error instanceof ReloadSupersededError))
          this._host.handleReloadFailure(error);

        current = this._takePendingReload();
        if (current)
          continue;

        this._reloadInFlight = false;
        this._rejectReloadCaller(error);
        return;
      }

      if (this._stopAfterDisposal())
        return;

      current = this._takePendingReload();
      if (current)
        continue;

      try {
        await this._host.finalizeReload();
      } catch (error) {
        if (this._stopAfterDisposal())
          return;

        this._host.handleReloadFailure(error);
        current = this._takePendingReload();
        if (current)
          continue;

        this._reloadInFlight = false;
        this._rejectReloadCaller(error);
        return;
      }

      if (this._stopAfterDisposal())
        return;

      current = this._takePendingReload();
    }

    this._reloadInFlight = false;
    this._resolveReloadCaller();
  }

  private _queuePendingReload(intent: ReloadIntent): void {
    if (intent.scope === "formatsChanged" && intent.providerChange)
      this._pendingProviderReload = intent;
    else
      this._pendingReload = intent;
  }

  /** Stops reload processing when this coordinator or its host is disposed. */
  private _stopAfterDisposal(): boolean {
    if (!this._isDisposed && !this._host.isDisposed())
      return false;

    this._reloadInFlight = false;
    this._pendingReload = undefined;
    this._pendingProviderReload = undefined;
    this._rejectReloadCaller(this._disposedError);
    return true;
  }

  /** Removes the newest pending reload, retaining provider transactions ahead of unrelated reloads. */
  private _takePendingReload(): ReloadIntent | undefined {
    if (this._pendingProviderReload) {
      const providerReload = this._pendingProviderReload;
      this._pendingProviderReload = undefined;
      return providerReload;
    }

    const nextReload = this._pendingReload;
    this._pendingReload = undefined;
    return nextReload;
  }

  /** Resolves the caller after the reload queue finishes successfully. */
  private _resolveReloadCaller(): void {
    const caller = this._reloadCaller;
    this._reloadCaller = undefined;
    caller?.resolve();
  }

  /** Rejects the caller when the reload queue fails or is superseded. */
  private _rejectReloadCaller(error: unknown): void {
    const caller = this._reloadCaller;
    this._reloadCaller = undefined;
    caller?.reject(error);
  }
}
