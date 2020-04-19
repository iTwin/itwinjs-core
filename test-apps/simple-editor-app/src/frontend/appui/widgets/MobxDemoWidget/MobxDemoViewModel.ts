/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
import { MobxDemoModel } from "./MobxDemoModel";

export class MobxDemoViewModel {
  private _mobxDemoModel: MobxDemoModel;

  constructor(mobxDemoModel: MobxDemoModel) {
    this._mobxDemoModel = mobxDemoModel;
  }

  public get birds() {
    return this._mobxDemoModel.birds;
  }

  public get birdCount() {
    return this._mobxDemoModel.birdCount;
  }

  public addBird(bird: string) {
    this._mobxDemoModel.addBird(bird);
  }
}
