/*---------------------------------------------------------------------------------------------
* Copyright (c) 2018 Bentley Systems, Incorporated. All rights reserved.
* Licensed under the MIT License. See LICENSE.md in the project root for license terms.
*--------------------------------------------------------------------------------------------*/
/** @module ConfigurableUi */

/** Interface for a ConfigurableUi element
 */
export interface ConfigurableUiElement {
  uniqueId: string;
  classId: string;
  name: string;
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
export class ConfigurableBase implements ConfigurableUiElement {
  private _uniqueId: string;
  private _classId: string;
  private _name: string;

  constructor(info: ConfigurableCreateInfo, options: any) {
    this._uniqueId = info.uniqueId;
    this._classId = info.classId;
    this._name = (options && options.hasOwnProperty("name")) ? options.name : info.uniqueId;
  }

  /** @hidden */
  public get uniqueId(): string { return this._uniqueId; }

  /** Gets the class Id of configurable element */
  public get classId(): string { return this._classId; }

  /** Get internal name of configurable element. If no name is defined in configuration
   * then the name will match the UniqueId.
   */
  public get name(): string { return this._name; }
}

/** The base class for all ConfigurableUi elements that belong to a stage.
 */
export class StageConfigurable extends ConfigurableBase {
  // private _stage?: FrontstageDef;

  constructor(info: ConfigurableCreateInfo, options: any) {
    super(info, options);
  }
}

/** The type of the ConfigurableUiControl.
 */
export enum ConfigurableUiControlType {
  Content,          /** Represents [[ContentControl]] */
  NavigationAid,    /** Represents [[NavigationAidControl]] */
  StatusBarWidget,  /** Represents [[StatusBarWidgetControl]]  */
  ToolUiProvider,   /** Represents [[ToolUiProvider]]  */
  Viewport,         /** Represents [[ViewportContentControl]] */
  Widget,           /** Represents [[WidgetControl]]  */
}

/** Prototype for ConfigurableUiControl constructor
 */
export type ConfigurableUiControlConstructor = new (info: ConfigurableCreateInfo, options: any) => ConfigurableUiElement;

/** The absract base class for all Frontstage controls.
 *
 * @note This is an abstract class which should not be derived from by the applications.
 * Instead, applications should derive from one of
 * [[ContentControl]],
 * [[ViewportContentControl]],
 * [[WidgetControl]],
 * [[StatusBarWidgetControl]] or
 * [[NavigationAidControl]].
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

  /** @hidden
   */
  public initialize(): void { this._initialize(); }

  /** Called to initialize the ConfigurableUiControl.
   */
  protected _initialize(): void {
  }

  /** Returns the ID of this ConfigurableUiControl.
   */
  public getConfigurableUiControlId(): string { return this._cid; }

  /** Get the type of this control.
   */
  public abstract getType(): ConfigurableUiControlType;

  /** Returns a promise that resolves when the control is ready for usage.
   */
  public get isReady(): Promise<void> { return Promise.resolve(); }
}

export default ConfigurableUiControl;
