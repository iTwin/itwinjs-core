import { BeginSchemaEditCallback } from "./SchemaEditInfo";

/**
 * Defines potential options for all the edit operations available in the editing API.
 * @alpha
 */
export enum EditOption {
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
 * Class that defines the options that are applied to a given edit operation.
 * @alpha
 */
export class EditOptions {
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


  /** The CustomAttributeOptions options which is set to [[CustomAttributeOptions.Default]] */
  public attributeOptions = CustomAttributeOptions.default();

  private _extendedOptions: Map<string, any>;
  private _beginEditCallback?: BeginSchemaEditCallback;


  constructor() {
    this._extendedOptions = new Map<string, object>();
  }

  /** Gets the BeginSchemaEditCallback function. Maybe undefined. */
  public get beginEditCallback(): BeginSchemaEditCallback | undefined {
    return this._beginEditCallback;
  }

  /** Sets the BeginSchemaEditCallback function. Called before the edit operation starts. */
  public set beginEditCallback(callback: BeginSchemaEditCallback) {
    this._beginEditCallback = callback;
  }

  /** Gets the custom edit options. */
  public get customOptions(): Map<string, any> {
    return this._extendedOptions;
  }

  /**
   * Sets an extended/custom edit option.
   * @param key The key identifying the option.
   * @param value The edit option value.
   */
  public setExtendedOption(key: string, value: any) {
    this._extendedOptions.set(key, value);
  }

  /**
   * Gets a custom edit option by it's key.
   * @param key The key of the edit option.
   * @returns The value of the edit option of type 'any'.
   */
  public getExtendedOption(key: string): any {
    return this._extendedOptions.get(key);
  }

  /**
   * Updates the current EditOptions instance with the given options.
   * @param editOptions An array of EditOption values to set.
   * @returns The updated EditOptions.
   */
  public with(editOptions: EditOption[]): EditOptions {
    for (const option of editOptions) {
      EditOptions.setOption(this, option);
    }
    return this;
  }

  /** All options are set to false except for [[attributeOptions]] which is set to [[CustomAttributeOptions.Default]] */
  public static get default(): EditOptions {
    return new EditOptions();
  }

  /** All options are set to false except for changeBase. */
  public static get includeBase(): EditOptions {
    const options = this.default;
    options.changeBase = true;
    return options;
  }

  /** All options are set to false except for changeDerived. */
  public static get includeDerived(): EditOptions {
    const options = this.default;
    options.changeDerived = true;
    return options;
  }

  /** All options are set to false except for changeBase and changeDerived. */
  public static get includeBaseAndDerived(): EditOptions {
    const options = this.default;
    options.changeBase = true;
    options.changeDerived = true;
    return options;
  }

  /** All options are set to false except for allowPropertyOverrides. */
  public static get allowPropertyOverrides(): EditOptions {
    const options = this.default;
    options.allowPropertyOverrides = true;
    return options;
  }

  /**
   * Creates a new EditOptions using the instance as a base and then updates
   * the options with the given ChangeOption array.
   * @param editOptions
   * @returns The new EditOptions instance.
   */
  public newWith(editOptions: EditOption[]) {
    const newOptions = new EditOptions();
    newOptions.changeBase = this.changeBase;
    newOptions.changeDerived = this.changeDerived;
    newOptions.breakInheritanceChain = this.breakInheritanceChain;
    newOptions.leavePropertyOverrides = this.leavePropertyOverrides;
    newOptions.allowPropertyOverrides = this.allowPropertyOverrides;
    newOptions.leaveRelationshipClassEndpoints = this.leaveRelationshipClassEndpoints;
    newOptions.stopRelabelOnFirstPropertyOverrideWithDifferentLabel = this.stopRelabelOnFirstPropertyOverrideWithDifferentLabel;
    newOptions.localChange = this.localChange;
    newOptions.attributeOptions = this.attributeOptions;

    for (const option of editOptions) {
      EditOptions.setOption(newOptions, option);
    }

    return newOptions;
  }

  /**
   * Type guard method to identify an object as a EditOptions object.
   * @param obj The  object to check.
   * @returns True if a EditOptions object, false otherwise.
   */
  public static isChangeOptions(obj: any): obj is EditOptions {
    return (<EditOptions>obj).changeBase !== undefined && (<EditOptions>obj).changeDerived !== undefined &&
      (<EditOptions>obj).breakInheritanceChain !== undefined && (<EditOptions>obj).leavePropertyOverrides !== undefined;
  }

  private static setOption(options: EditOptions, option: EditOption) {
    switch (option) {
      case EditOption.LocalChange:
        options.localChange = true;
        break;
      case EditOption.BreakInheritanceChain:
        options.breakInheritanceChain = true;
        break;
      case EditOption.ChangeBase:
        options.changeBase = true;
        break;
      case EditOption.ChangeDerived:
        options.changeDerived = true;
        break;
      case EditOption.LeavePropertyOverrides:
        options.leavePropertyOverrides = true;
        break;
      case EditOption.AllowPropertyOverrides:
        options.allowPropertyOverrides = true;
        break;
      case EditOption.LeaveRelationshipClassEndpoints:
        options.leaveRelationshipClassEndpoints = true;
        break;
      case EditOption.StopRelabelOnFirstPropertyOverrideWithADifferentLabel:
        options.stopRelabelOnFirstPropertyOverrideWithDifferentLabel = true;
        break;
      case EditOption.RemoveCustomAttributePropertyValues:
        options.attributeOptions.removeCustomAttributePropertyValues = true;
        break;
      case EditOption.RemoveCustomAttributesIfClassRemoved:
        options.attributeOptions.removeCustomAttributesIfClassRemoved = true;
        break;
      case EditOption.RemoveCustomAttributesIfPropertyRemoved:
        options.attributeOptions.removeCustomAttributesIfPropertyRemoved = true;
        break;
      case EditOption.UpdateCustomAttributeReferences:
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
    return new CustomAttributeOptions();
  }
}
