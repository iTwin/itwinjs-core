/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
import { compareStrings, SortedArray } from "@itwin/core-bentley";

// cspell:ignore vsps nvsp

/* eslint-disable @typescript-eslint/naming-convention */

export interface NamedVSPSProps {
  _name: string;
  _viewStatePropsString: string;
  _selectedElements?: string;
  _overrideElements?: string;
  _displayTransforms?: string;
}

/* eslint-enable @typescript-eslint/naming-convention */

export class NamedViewStatePropsString {
  private _name: string;
  private _viewStatePropsString: string;
  private _selectedElements: string | undefined;
  private _overrideElements: string | undefined;
  private _displayTransforms: string | undefined;

  public constructor(props: NamedVSPSProps) {
    this._name = props._name;
    this._viewStatePropsString = props._viewStatePropsString;
    this._selectedElements = props._selectedElements;
    this._overrideElements = props._overrideElements;
    this._displayTransforms = props._displayTransforms;
  }

  public get name(): string { return this._name; }
  public get viewStatePropsString(): string { return this._viewStatePropsString; }
  public get selectedElements(): string | undefined { return this._selectedElements; }
  public get overrideElements(): string | undefined { return this._overrideElements; }
  public get displayTransforms(): string | undefined { return this._displayTransforms; }
}

export class NamedVSPSList extends SortedArray<NamedViewStatePropsString> {

  private constructor() {
    super((lhs, rhs) => compareStrings(lhs.name, rhs.name));
  }

  public static create(viewNames?: NamedViewStatePropsString[]): NamedVSPSList {
    const viewList = new NamedVSPSList();
    viewList.populate(viewNames);
    return viewList;
  }

  public override clear(): void {
    super.clear();
  }

  public populate(viewStateStrings?: NamedViewStatePropsString[]): void {
    this.clear();

    if (undefined === viewStateStrings)
      return;
    if (0 === viewStateStrings.length)
      return;

    for (const vss of viewStateStrings)
      this.insert(vss);
  }

  public findName(name: string): number {
    for (let i = 0; i < this.length; ++i) {
      const nvsp = this.get(i);
      if (nvsp!.name === name) {
        return i;
      }
    }
    return -1;
  }

  public removeName(name: string): void {
    const ndx = this.findName(name);
    if (ndx >= 0) {
      const nvsp = this.get(ndx);
      if (undefined !== nvsp) {
        this.remove(nvsp);
        return;
      }
    }
  }

  public getPrintString(): string {
    // We don't really want all of the other stuff from the SortedArray class in here, just the actual name/propertyString pairs.
    return JSON.stringify(this._array, null, "  ");
  }

  public loadFromString(esvString: string): void {
    this.clear();
    if (undefined !== esvString && "" !== esvString) {
      const namedVSPs = JSON.parse(esvString) as NamedVSPSProps[];
      for (const obj of namedVSPs) {
        this.insert(new NamedViewStatePropsString(obj));
      }
    }
  }
}
