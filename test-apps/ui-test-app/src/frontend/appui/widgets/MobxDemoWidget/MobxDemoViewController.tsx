/*---------------------------------------------------------------------------------------------
* Copyright (c) 2019 Bentley Systems, Incorporated. All rights reserved.
* Licensed under the MIT License. See LICENSE.md in the project root for license terms.
*--------------------------------------------------------------------------------------------*/
import * as React from "react";

// Mobx demo
import { action, computed, observable } from "mobx";
import { MobxDemoModel } from "./MobxDemoModel";
import { MobxDemoViewModel } from "./MobxDemoViewModel";
import { inject, observer } from "mobx-react";
import { MobxDemoView } from "./MobxDemoView";

interface MobxDemoViewControllerProps {
  model?: MobxDemoModel;
}

@inject("model")
@observer
export class MobxDemoViewController extends React.Component<MobxDemoViewControllerProps> {
  @observable private _bird: string = "";
  @computed public get bird(): string { return this._bird; }
  @action public setBird(v: string) { this._bird = v; }

  private _viewModel: MobxDemoViewModel;

  constructor(props: MobxDemoViewControllerProps) {
    super(props);

    const mobxDemoModel = props.model!;
    this._viewModel = new MobxDemoViewModel(mobxDemoModel);
  }

  public setBirdName = (e: React.ChangeEvent<HTMLInputElement>) => {
    this.setBird(e.target.value);
  }

  public addBird = (e: React.FormEvent) => {
    e.preventDefault();

    if (this.bird) {
      this._viewModel.addBird(this.bird);
      this.setBird("");
    }
  }

  public render() {
    return (
      <MobxDemoView
        birds={this._viewModel.birds}
        birdCount={this._viewModel.birdCount}
        setBirdName={this.setBirdName}
        addBird={this.addBird}
        birdName={this.bird}
        shouldDisableSubmit={!this.bird}
      />
    );
  }
}
