/*---------------------------------------------------------------------------------------------
* Copyright (c) 2019 Bentley Systems, Incorporated. All rights reserved.
* Licensed under the MIT License. See LICENSE.md in the project root for license terms.
*--------------------------------------------------------------------------------------------*/
import { observable, action, computed } from "mobx";

export class MobxDemoModel {
  @observable private _birds: string[] = [];

  @action public addBird = (bird: string) => {
    this._birds.push(bird);
  }

  @computed public get birdCount() {
    return this._birds.length;
  }

  public get birds(): string[] {
    return this._birds;
  }
}
