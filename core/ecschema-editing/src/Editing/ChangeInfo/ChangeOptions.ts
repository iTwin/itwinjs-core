import { BeginSchemaEditCallback } from "./ChangeInfo";

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

export interface CustomAttributeOptionProps {
  readonly updateCustomAttributeReferences: boolean;
  readonly removeCustomAttributesIfClassRemoved: boolean;
  readonly removeCustomAttributePropertyValues: boolean;
  readonly removeCustomAttributesIfPropertyRemoved: boolean;
}

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

export class ChangeOptions {
  public changeBase = false;
  public changeDerived = false;
  public allowPropertyOverrides = false;
  public breakInheritanceChain = false;
  public leavePropertyOverrides = false;
  public leaveRelationshipClassEndpoints = false;
  public stopRelabelOnFirstPropertyOverrideWithDifferentLabel = false;
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

  public static get default(): ChangeOptions {
    return new ChangeOptions ();
  }

  public static includeBase(): ChangeOptions {
    const options = this.default;
    options.changeBase = true;
    return options;
  }

  public static includeDerived(): ChangeOptions {
    const options = this.default;
    options.changeDerived = true;
    return options;
  }

  public static includeBaseAndDerived(): ChangeOptions {
    const options = this.default;
    options.changeBase = true;
    options.changeDerived = true;
    return options;
  }

  public static allowPropertyOverrides(): ChangeOptions {
    const options = this.default;
    options.allowPropertyOverrides = true;
    return options;
  }

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

export class CustomAttributeOptions {
  public updateCustomAttributeReferences = true;
  public removeCustomAttributesIfClassRemoved = true;
  public removeCustomAttributePropertyValues = true;
  public removeCustomAttributesIfPropertyRemoved = false;

  public static default(): CustomAttributeOptions {
    return new CustomAttributeOptions ();
  }
}
