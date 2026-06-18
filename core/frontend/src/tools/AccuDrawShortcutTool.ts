/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
/** @packageDocumentation
 * @module Tools
 */

import { AccuDrawFlags } from "../AccuDraw";
import { IModelApp } from "../IModelApp";
import { DecorateContext } from "../ViewContext";
import { BeButtonEvent, CoordinateLockOverrides, EventHandled, InputCollector, Tool } from "./Tool";
import { ViewTool } from "./ViewTool";

/** @internal */
export abstract class AccuDrawShortcutImplementation {
  protected _complete = false;

  protected get allowShortcut(): boolean { return this.wantActivateOnStart ? IModelApp.accuDraw.isEnabled : true; }
  protected get wantActivateOnStart(): boolean { return false; } // Whether to automatically enable AccuDraw before the 1st data button...
  protected get wantAdditionalInput(): boolean { return true; } // Whether additional input is required from user...

  protected onInitialize(): void { }
  protected onComplete(): AccuDrawFlags { return AccuDrawFlags.SetRMatrix; }

  public doDecorate(_context: DecorateContext): void { }
  public abstract doManipulation(ev: BeButtonEvent | undefined, isMotion: boolean): boolean;

  public doDataButtonDown(ev: BeButtonEvent): boolean {
    return (this._complete = this.doManipulation(ev, false));
  }

  public doInstall(): boolean {
    return this.allowShortcut;
  }

  public doPostInstall(): boolean {
    if (this.wantActivateOnStart)
      IModelApp.accuDraw.activate();

    this.onInitialize();

    if (!this.wantAdditionalInput && this.doManipulation(undefined, false)) {
      this._complete = true;
      return true;
    }

    return false;
  }

  public doCleanup(): AccuDrawFlags | undefined {
    return this._complete ? this.onComplete() : undefined;
  }
}

/** @internal */
class AccuDrawShortcutInputCollector extends InputCollector {
  public constructor(private readonly _impl: AccuDrawShortcutImplementation) {
    super();
  }

  public override async onInstall(): Promise<boolean> {
    if (!this._impl.doInstall())
      return false;
    return super.onInstall();
  }

  public override async onPostInstall(): Promise<void> {
    await super.onPostInstall();
    if (this._impl.doPostInstall())
      return this.exitTool();

    IModelApp.locateManager.initLocateOptions();
    this.changeLocateState(false, true, undefined, CoordinateLockOverrides.None);
    this._impl.doManipulation(undefined, true);
  }

  public override async onCleanup(): Promise<void> {
    const flags = this._impl.doCleanup();
    if (undefined !== flags)
      IModelApp.accuDraw.savedStateInputCollector.ignoreFlags = flags;
    return super.onCleanup();
  }

  public override async exitTool(): Promise<void> {
    await super.exitTool();
    IModelApp.accuDraw.requestInputFocus(); // re-grab focus when auto-focus tool setting set...
  }

  public override async onDataButtonDown(ev: BeButtonEvent): Promise<EventHandled> {
    if (this._impl.doDataButtonDown(ev))
      await this.exitTool();
    return EventHandled.No;
  }

  public override async onMouseMotion(ev: BeButtonEvent): Promise<void> {
    this._impl.doManipulation(ev, true);
  }

  public override decorate(context: DecorateContext): void {
    this._impl.doDecorate(context);
  }
}

/** @internal */
class AccuDrawShortcutViewTool extends ViewTool {
  public constructor(private readonly _impl: AccuDrawShortcutImplementation) {
    super();
  }

  public override async onInstall(): Promise<boolean> {
    if (!this._impl.doInstall())
      return false;
    return super.onInstall();
  }

  public override async onPostInstall(): Promise<void> {
    await super.onPostInstall();
    if (this._impl.doPostInstall())
      return this.exitTool();

    IModelApp.locateManager.initLocateOptions();
    this.changeLocateState(false, true, undefined, CoordinateLockOverrides.None);

    this._impl.doManipulation(undefined, true);
  }

  public override async onCleanup(): Promise<void> {
    const flags = this._impl.doCleanup();
    if (undefined !== flags)
      IModelApp.accuDraw.savedStateViewTool.ignoreFlags = flags;
    return super.onCleanup();
  }

  public override async exitTool(): Promise<void> {
    await super.exitTool();
    IModelApp.accuDraw.requestInputFocus(); // re-grab focus when auto-focus tool setting set...
  }

  public override async onDataButtonDown(ev: BeButtonEvent): Promise<EventHandled> {
    if (this._impl.doDataButtonDown(ev))
      await this.exitTool();
    return EventHandled.No;
  }

  public override async onMouseMotion(ev: BeButtonEvent): Promise<void> {
    this._impl.doManipulation(ev, true);
  }

  public override decorate(context: DecorateContext): void {
    this._impl.doDecorate(context);
  }
}

/** @internal */
export abstract class AccuDrawShortcutTool extends Tool {
  protected abstract createImplementation(): AccuDrawShortcutImplementation;

  protected get useViewTool(): boolean {
    // Support interactive shortcut when another InputCollector is active (ex. EditManipulator.HandleTool)...
    return IModelApp.toolAdmin.activeTool instanceof InputCollector;
  }

  public override async run(..._args: any[]): Promise<boolean> {
    const impl = this.createImplementation();
    return this.useViewTool ? new AccuDrawShortcutViewTool(impl).run() : new AccuDrawShortcutInputCollector(impl).run();
  }
}