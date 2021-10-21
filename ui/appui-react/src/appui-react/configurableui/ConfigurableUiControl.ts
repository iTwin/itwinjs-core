/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
/** @packageDocumentation
 * @module ConfigurableUi
 */

/** Interface for a ConfigurableUi element
 * @public
 */
export interface ConfigurableUiElement {
  uniqueId: string;
  classId: string;
  name: string;
}

/** Information for creating a ConfigurableUi element
 * @public
 */
export class ConfigurableCreateInfo {
  constructor(public readonly classId: string,
    public readonly uniqueId: string,
    public readonly id: string) {
  }
}

/** The base class for all ConfigurableUi elements
 * @public
 */
export class ConfigurableBase implements ConfigurableUiElement {
  private _uniqueId: string;
  private _classId: string;
  private _name: string;
  protected _appDataOptions: any;

  constructor(info: ConfigurableCreateInfo, options: any) {
    this._uniqueId = info.uniqueId;
    this._classId = info.classId;
    this._name = (options && options.hasOwnProperty("name")) ? options.name : info.uniqueId;
    this._appDataOptions = options;
  }

  /** @internal */
  public get uniqueId(): string { return this._uniqueId; }

  /** allow options set via appData to be seen by API calls */
  public get applicationData(): any { return this._appDataOptions; }

  /** Gets the class Id of configurable element */
  public get classId(): string { return this._classId; }

  /** Get internal name of configurable element. If no name is defined in configuration
   * then the name will match the UniqueId.
   */
  public get name(): string { return this._name; }
}

/** The type of the ConfigurableUiControl.
 * @public
 */
export enum ConfigurableUiControlType {
  Content = "ContentControl",
  NavigationAid = "NavigationAidControl",
  StatusBarWidget = "StatusBarWidgetControl",
  ToolUiProvider = "ToolUiProvider",
  Viewport = "ViewportContentControl",
  Widget = "WidgetControl",
}

/** Prototype for ConfigurableUiControl constructor
 * @public
 */
export type ConfigurableUiControlConstructor = new (info: ConfigurableCreateInfo, options: any) => ConfigurableUiElement;

/** The abstract base class for all Frontstage controls.
 * @public
 *
 * @note This is an abstract class which should not be derived from by the applications.
 * Instead, applications should derive from one of
 * [[ContentControl]],
 * [[ViewportContentControl]],
 * [[WidgetControl]],
 * [[StatusBarWidgetControl]] or
 * [[NavigationAidControl]].
 */
export abstract class ConfigurableUiControl extends ConfigurableBase {
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

  /** @internal
   */
  public initialize(): void { this.onInitialize(); }

  /** Called to initialize the ConfigurableUiControl. */
  public onInitialize(): void { }

  /** Called when Frontstage is deactivated. */
  public onFrontstageDeactivated(): void { }

  /** Called when Frontstage is ready. */
  public onFrontstageReady(): void { }

  /** Returns the ID of this ConfigurableUiControl.
   */
  public get controlId(): string { return this._cid; }

  /** Get the type of this control.
   */
  public abstract getType(): ConfigurableUiControlType;

  /** Returns a promise that resolves when the control is ready for usage.
   */
  public get isReady(): Promise<void> { return Promise.resolve(); }
}
