/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
import { action, computed, observable } from "mobx";

export class MobxDemoModel {
  @observable private _birds: string[] = [];

  @action public addBird = (bird: string) => {
    this._birds.push(bird);
  };

  @computed public get birdCount() {
    return this._birds.length;
  }

  public get birds(): string[] {
    return this._birds;
  }
}
