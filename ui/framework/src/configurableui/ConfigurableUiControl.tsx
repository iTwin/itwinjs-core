/*---------------------------------------------------------------------------------------------
| $Copyright: (c) 2018 Bentley Systems, Incorporated. All rights reserved. $
 *--------------------------------------------------------------------------------------------*/
/** @module ConfigurableUi */

import { FrontstageDef } from "./FrontstageDef";

/** Interface for a ConfigurableUi element
 */
export interface IConfigurable {
  adopt(other: IConfigurable): boolean;
  uniqueId: string;
  classId: string;
  name: string;

  // Request(requestId: string, options?: any, abortUpdate?: boolean): Promise<any>;
  // RegisterMessageListener(messageName: string, listenerFunction: IMessageListenerFunction): void;
  // UnregisterMessageListener(messageName: string, listenerFunction: IMessageListenerFunction): void;
  // BroadcastMessage(messageName: string, messageArguments?: any[]): void;
}

/** Information for creating a ConfigurableUi element
 */
export class ConfigurableCreateInfo {
  constructor(public readonly classId: string,
    public readonly uniqueId: string,
    public readonly id: string) {
  }
}

/** The base class for all ConfigurableUi elements
 */
export class Configurable implements IConfigurable {
  private _uniqueId: string;
  private _classId: string;
  private _name: string;

  constructor(info: ConfigurableCreateInfo, options: any) {
    this._uniqueId = info.uniqueId;
    this._classId = info.classId;
    this._name = (options && options.hasOwnProperty("name")) ? options.name : info.uniqueId;
  }

  /** @private */
  public adopt(other: IConfigurable): boolean {
    if (this === other)
      return true;

    if (!this._canAdopt(other))
      return false;

    this._adopt(other);

    // in case the "other" was adopted, the object is going to be disposed;
    // however, it may have created some listeners, etc. in its constructor, so we have to
    // call its OnDestroy callback to give it a chance to clean up
    const onDestroy = (other as any)._OnDestroy;
    if (onDestroy)
      onDestroy();

    return true;
  }

  protected _canAdopt(other: IConfigurable): boolean { return this._classId === other.classId; }
  protected _adopt(other: IConfigurable): void { this._uniqueId = other.uniqueId; }

  /** @private */
  public get uniqueId(): string { return this._uniqueId; }

  public get classId(): string { return this._classId; }

  /** Get internal name of Configurable item. If no name is defined in JSON configuration
   * then the name will match the UniqueId.
   */
  public get name(): string { return this._name; }
}

/** The base class for all ConfigurableUi elements that belong to a stage.
 */
export class StageConfigurable extends Configurable {
  private _stage: FrontstageDef | undefined;

  constructor(info: ConfigurableCreateInfo, options: any) {
    super(info, options);
  }

  protected _adopt(other: IConfigurable): void {
    super._adopt(other);

    const otherStageConfigurable = other as StageConfigurable;
    this.currentStage = otherStageConfigurable.currentStage;
  }

  /** @private
   */
  public set currentStage(stage: FrontstageDef | undefined) {
    if (stage === this._stage)
      return;

    this._stage = stage;
    this._onStageChanged();
  }

  public get currentStage(): FrontstageDef | undefined { return this._stage; }

  /** Called when the owning stage changes.
   */
  protected _onStageChanged(): void { }
}

/** The type of the ConfigurableUiControl.
 */
export enum ConfigurableUiControlType {
  Content,        /** Represents @ref ContentControl        */
  Widget,         /** Represents @ref WidgetControl         */
  ControlHost,    /** Represents @ref ConfigurableUiControlHost           */
  NavigationAid,  /** Represents @ref NavigationAid         */
}

/** The absract base class for all Frontstage controls.
 *
 * @note This is an abstract class which should not be derived from by the applications.
 * Instead, applications should derive from one of [[ContentControl]], [[WidgetControl]] or [[NavigationAidControl]].
 *
 */
export abstract class ConfigurableUiControl extends StageConfigurable {
  private _cid: string;

  /** Creates an instance of ConfigurableUiControl.
   * @param info         An object that the subclass must pass to this base class.
   * @param options      Options provided to the control
   * @note Subclasses must pass all arguments to the base class and not add themselves
   * to any container - the control is added automatically by the [[FrontstageComposer]].
   * @protected
   */
  constructor(info: ConfigurableCreateInfo, options: any) {
    super(info, options);
    this._cid = info.id;
  }

  /** @private
   */
  public initialize(): void { this._initialize(); }

  /** Called to initialize the ConfigurableUiControl. Instead of creating all the child views
   * in its constructor, ConfigurableUiControl should do that in this callback. The reason
   * is that in cases when a control is adopted, it's immediately destroyed, so creating the
   * view hierarchy is pointless.
   */
  protected _initialize(): void {
    // this.SetPlatformTargetId(this.m_cid);
  }

  /** Returns the ID of this ConfigurableUiControl.
   */
  public getConfigurableUiControlId(): string { return this._cid; }

  /** Get the type of this control.
   */
  public abstract getType(): ConfigurableUiControlType;

  /** Returns a promise that resolves when the control is ready for usage.
   */
  // public Ready(): Promise<void> { return Promise.Resolve<void>(0); }
}

export default ConfigurableUiControl;
