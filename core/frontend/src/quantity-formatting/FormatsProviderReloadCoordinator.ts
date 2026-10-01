/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/

import { FormatsChangedArgs } from "@itwin/core-quantity";

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
  | { scope: "formatsChanged"; args: FormatsChangedArgs }
  | { scope: "activeSystem" };

type FormatsChangedIntent = Extract<ReloadIntent, { scope: "formatsChanged" }>;

interface ReloadCoordinatorHost {
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
 * Serializes formatting reloads and resolves or rejects the caller waiting for formatting to become ready.
 * @internal
 */
export class FormatsProviderReloadCoordinator {
  private _reloadInFlight = false;
  private _pendingReload: ReloadIntent | undefined;
  private _pendingFormatsChange: FormatsChangedIntent | undefined;
  private _reloadCaller: ReloadCaller | undefined;
  private _isDisposed = false;

  public constructor(private readonly _host: ReloadCoordinatorHost, private readonly _disposedError: Error) {}

  public dispose(): void {
    if (this._isDisposed)
      return;

    this._isDisposed = true;
    this._pendingReload = undefined;
    this._pendingFormatsChange = undefined;
    this._rejectReloadCaller(this._disposedError);
  }

  /**
   * Runs an action that schedules a reload and waits for the reload queue to drain.
   * A newer call rejects an older call that is still waiting.
   */
  public async runAndWaitForReload(action: () => void): Promise<void> {
    if (this._isDisposed)
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
   * Runs a reload now, or queues it if one is already running.
   * Pending format changes are merged and kept apart from other pending reloads, so a later unit-system or units-provider reload cannot drop a provider change.
   * If a reload is already running, this method returns immediately; use [[runAndWaitForReload]] when the caller must wait for completion.
   * The waiting caller is rejected if any reload fails before the queue drains.
   */
  public async scheduleReload(intent: ReloadIntent): Promise<void> {
    if (this._isDisposed)
      return;

    if (this._reloadInFlight) {
      if (intent.scope === "formatsChanged")
        this._pendingFormatsChange = mergeFormatsChanges(this._pendingFormatsChange, intent);
      else
        this._pendingReload = intent;
      return;
    }

    this._reloadInFlight = true;
    let failure: { error: unknown } | undefined;
    let current: ReloadIntent | undefined = intent;
    while (current) {
      try {
        this._host.startReload();
        await this._host.executeReload(current);
        if (this._stopAfterDisposal())
          return;

        current = this._takePendingReload();
        if (!current) {
          await this._host.finalizeReload();
          if (this._stopAfterDisposal())
            return;
          current = this._takePendingReload();
        }
      } catch (error) {
        if (this._stopAfterDisposal())
          return;

        // Keep draining so queued work still runs, but report the failure to the waiting caller.
        this._host.handleReloadFailure(error);
        failure = { error };
        current = this._takePendingReload();
      }
    }

    this._reloadInFlight = false;
    if (failure)
      this._rejectReloadCaller(failure.error);
    else
      this._resolveReloadCaller();
  }

  private _stopAfterDisposal(): boolean {
    if (!this._isDisposed)
      return false;

    this._reloadInFlight = false;
    return true;
  }

  private _takePendingReload(): ReloadIntent | undefined {
    const next = this._pendingFormatsChange ?? this._pendingReload;
    if (next === this._pendingFormatsChange)
      this._pendingFormatsChange = undefined;
    else
      this._pendingReload = undefined;
    return next;
  }

  private _resolveReloadCaller(): void {
    const caller = this._reloadCaller;
    this._reloadCaller = undefined;
    caller?.resolve();
  }

  private _rejectReloadCaller(error: unknown): void {
    const caller = this._reloadCaller;
    this._reloadCaller = undefined;
    caller?.reject(error);
  }
}

function mergeFormatsChanges(pending: FormatsChangedIntent | undefined, next: FormatsChangedIntent): FormatsChangedIntent {
  if (!pending)
    return next;

  const pendingNames = pending.args.formatsChanged;
  const nextNames = next.args.formatsChanged;
  const formatsChanged = pendingNames === "all" || nextNames === "all" ? "all" : [...new Set([...pendingNames, ...nextNames])];
  return { scope: "formatsChanged", args: { formatsChanged } };
}
