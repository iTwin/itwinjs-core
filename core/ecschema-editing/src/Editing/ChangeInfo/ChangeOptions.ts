import { BeginSchemaEditCallback } from "./ChangeInfo";

/**
 * Defines potential options for all the edit operations available in the editing API.
 * @alpha
 */
export enum ChangeOption {
  LocalChange = "LocalChange",
  StopRelabelOnFirstPropertyOverrideWithADifferentLabel = "StopRelabelOnFirstPropertyOverrideWithADifferentLabel",
  ChangeBase = "ChangeBase",
  ChangeDerived = "ChangeDerived",
  LeavePropertyOverrides = "LeavePropertyOverrides",
  AllowPropertyOverrides = "AllowPropertyOverrides",
  BreakInheritanceChain = "BreakInheritanceChain",
  LeaveRelationshipClassEndpoints = "LeaveRelationshipClassEndpoints",
  UpdateCustomAttributeReferences = "UpdateCustomAttributeReferences",
  RemoveCustomAttributePropertyValues = "RemoveCustomAttributePropertyValues",
  RemoveCustomAttributesIfClassRemoved = "RemoveCustomAttributesIfClassRemoved",
  RemoveCustomAttributesIfPropertyRemoved = "RemoveCustomAttributesIfPropertyRemoved"
}

/**
 * Used for JSON serialization/deserialization. Defines the possible options that control CustomAttribute related edits.
 * TODO: probably not needed...
 * @alpha
 */
export interface CustomAttributeOptionProps {
  readonly updateCustomAttributeReferences: boolean;
  readonly removeCustomAttributesIfClassRemoved: boolean;
  readonly removeCustomAttributePropertyValues: boolean;
  readonly removeCustomAttributesIfPropertyRemoved: boolean;
}

/**
 * Used for JSON serialization/deserialization. Defines the possible options that control how a particular edit should be performed.
 * TODO: probably not needed...
 * @alpha
 */
export interface ChangeOptionProps {
  readonly changeBase: boolean;
  readonly changeDerived: boolean;
  readonly allowPropertyOverrides: boolean;
  readonly breakInheritanceChain: boolean;
  readonly leavePropertyOverrides: boolean;
  readonly leaveRelationshipClassEndpoints: boolean;
  readonly stopRelabelOnFirstPropertyOverrideWithDifferentLabel: boolean;
  readonly localChange: boolean;
  readonly attributeOptions: CustomAttributeOptionProps;
}

/**
 * Class that defines the options that are applied to a given edit operation.
 * @alpha
 */
export class ChangeOptions {
  /** Indicates if the edit should be propagated to base classes/properties, if applicable. Default to false. */
  public changeBase = false;

  /** Indicates if the edit should be propagated to derived classes/properties, if applicable. Default to false. */
  public changeDerived = false;

  /** Only valid for property rename operations. Allows rename if a base property exists with the same name. Defaults to false.*/
  public allowPropertyOverrides = false;

  /** Only valid when removing classes.  Connects base and derived classes of the removed class.  Defaults to false. */
  public breakInheritanceChain = false;

  /**
   * If false removing a property removes all overrides of the property. A property can be removed directly ore by removing
   * the class defining the property.  Defaults to false.
  */
  public leavePropertyOverrides = false;

  /** If false removing a class removes it from the relationship constraints where it is referenced.  Defaults to false. */
  public leaveRelationshipClassEndpoints = false;

  /** If true property overrides will be relabeled until one is found with a different label.  Defaults to false. */
  public stopRelabelOnFirstPropertyOverrideWithDifferentLabel = false;

  /** If true the change will not be propagated beyond the element modified. Defaults to false. */
  public localChange = false;


  public attributeOptions = CustomAttributeOptions.default();

  private _extendedOptions: Map<string, any>;
  public beginChangeCallback?: BeginSchemaEditCallback;


  constructor() {
    this._extendedOptions = new Map<string, object>();
  }

  public set beginEditCallback(callback: BeginSchemaEditCallback) {
    this.beginChangeCallback = callback;
  }

  public get customOptions(): Map<string, any> {
    return this._extendedOptions;
  }

  public setExtendedOption(key: string, value: any) {
    this._extendedOptions.set(key, value);
  }

  public getExtendedOption(key: string): any {
    return this._extendedOptions.get(key);
  }

  public with(changeOptions: ChangeOption[]): ChangeOptions {
    for (const option of changeOptions) {
      ChangeOptions.setOption(this, option);
    }
    return this;
  }

  /** All options are set to false except for [[attributeOptions]] which is set to [[CustomAttributeOptions.Default]] */
  public static get default(): ChangeOptions {
    return new ChangeOptions ();
  }

  /** All options are set to false except for changeBase. */
  public static get includeBase(): ChangeOptions {
    const options = this.default;
    options.changeBase = true;
    return options;
  }

  /** All options are set to false except for changeDerived. */
  public static get includeDerived(): ChangeOptions {
    const options = this.default;
    options.changeDerived = true;
    return options;
  }

  /** All options are set to false except for changeBase and changeDerived. */
  public static get includeBaseAndDerived(): ChangeOptions {
    const options = this.default;
    options.changeBase = true;
    options.changeDerived = true;
    return options;
  }

  /** All options are set to false except for allowPropertyOverrides. */
  public static get allowPropertyOverrides(): ChangeOptions {
    const options = this.default;
    options.allowPropertyOverrides = true;
    return options;
  }

  /**
   * Creates a new ChangeOptions using the instance as a base and then updates
   * the options with the given ChangeOption array.
   * @param changeOptions
   * @returns The new ChangeOptions instance.
   */
  public newWith(changeOptions: ChangeOption[]) {
    const newOptions = new ChangeOptions();
    newOptions.changeBase = this.changeBase;
    newOptions.changeDerived = this.changeDerived;
    newOptions.breakInheritanceChain = this.breakInheritanceChain;
    newOptions.leavePropertyOverrides = this.leavePropertyOverrides;
    newOptions.allowPropertyOverrides = this.allowPropertyOverrides;
    newOptions.leaveRelationshipClassEndpoints = this.leaveRelationshipClassEndpoints;
    newOptions.stopRelabelOnFirstPropertyOverrideWithDifferentLabel = this.stopRelabelOnFirstPropertyOverrideWithDifferentLabel;
    newOptions.localChange = this.localChange;
    newOptions.attributeOptions = this.attributeOptions;

    for (const option of changeOptions) {
      ChangeOptions.setOption(newOptions, option);
    }

    return newOptions;
  }

  /**
   * Type guard method to identify an object as a ChangeOptions object.
   * @param obj The  object to check.
   * @returns True if a ChangeOptions object, false otherwise.
   */
  public static isChangeOptions(obj: any): obj is ChangeOptions {
    return (<ChangeOptions>obj).changeBase !== undefined && (<ChangeOptions>obj).changeDerived !== undefined &&
            (<ChangeOptions>obj).breakInheritanceChain !== undefined && (<ChangeOptions>obj).leavePropertyOverrides !== undefined;
  }

  private static setOption(options: ChangeOptions, option: ChangeOption) {
    switch(option) {
      case ChangeOption.LocalChange:
        options.localChange = true;
        break;
      case ChangeOption.BreakInheritanceChain:
        options.breakInheritanceChain = true;
        break;
      case ChangeOption.ChangeBase:
        options.changeBase = true;
        break;
      case ChangeOption.ChangeDerived:
        options.changeDerived = true;
        break;
      case ChangeOption.LeavePropertyOverrides:
        options.leavePropertyOverrides = true;
        break;
      case ChangeOption.AllowPropertyOverrides:
        options.allowPropertyOverrides = true;
        break;
      case ChangeOption.LeaveRelationshipClassEndpoints:
        options.leaveRelationshipClassEndpoints = true;
        break;
      case ChangeOption.StopRelabelOnFirstPropertyOverrideWithADifferentLabel:
        options.stopRelabelOnFirstPropertyOverrideWithDifferentLabel = true;
        break;
      case ChangeOption.RemoveCustomAttributePropertyValues:
        options.attributeOptions.removeCustomAttributePropertyValues = true;
        break;
      case ChangeOption.RemoveCustomAttributesIfClassRemoved:
        options.attributeOptions.removeCustomAttributesIfClassRemoved = true;
        break;
      case ChangeOption.RemoveCustomAttributesIfPropertyRemoved:
        options.attributeOptions.removeCustomAttributesIfPropertyRemoved = true;
        break;
      case ChangeOption.UpdateCustomAttributeReferences:
        options.attributeOptions.updateCustomAttributeReferences = true;
        break;
    }
  }
}

/** Options that apply to CustomAttribute related edits. */
export class CustomAttributeOptions {
  /** References to classes and properties in custom attribute values are updated.  Defaults to true. */
  public updateCustomAttributeReferences = true;

  /** Removing a custom attribute class removes all instances of that custom attribute.  Defaults to true. */
  public removeCustomAttributesIfClassRemoved = true;

  /** Removing a property from a custom attribute class removes values of that property from all custom attributes.  Defaults to true. */
  public removeCustomAttributePropertyValues = true;

  /** Removing a property from a custom attribute class removes all instances of that custom attribute.  Defaults to false. */
  public removeCustomAttributesIfPropertyRemoved = false;

  /** Returns default options. All options are set to true, except removeCustomAttributesIfPropertyRemoved is false. */
  public static default(): CustomAttributeOptions {
    return new CustomAttributeOptions ();
  }
}
