/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
import * as React from "react";
import { Id64String } from "@itwin/core-bentley";
import { ConfigurableCreateInfo, UiFramework, WidgetControl } from "@itwin/appui-react";
import { ActiveSettingsManager, iModelInfoAvailableEvent } from "../../../api/ActiveSettingsManager";

interface ActiveSettingsComponentState {
  modelId: Id64String | undefined;
  categoryId: Id64String | undefined;
}

export class ActiveSettingsComponent extends React.Component<{}, ActiveSettingsComponentState> {

  constructor(props?: any, context?: any) {
    super(props, context);
    this.state = { modelId: "", categoryId: "" };
    iModelInfoAvailableEvent.addListener(this.updateState, this);
  }

  private updateState() {
    this.setState((prev) => ({
      ...prev,
      modelId: ActiveSettingsManager.briefcase?.editorToolSettings.model,
      categoryId: ActiveSettingsManager.briefcase?.editorToolSettings.category,
    }));
  }

  private get activeModelName(): string {
    const model = ActiveSettingsManager.briefcase?.editorToolSettings.model;
    return model ? ActiveSettingsManager.models.getNameFromId(model) ?? "" : "";
  }

  private get activeCategoryName(): string {
    const category = ActiveSettingsManager.briefcase?.editorToolSettings.category;
    return category ? ActiveSettingsManager.categories.getNameFromId(category) ?? "" : "";
  }

  private getAllModels(): React.ReactElement[] {
    return ActiveSettingsManager.models.cache.map((nid) =>
      <option id={nid.id} key={nid.id}>{nid.name}</option>,
    );
  }

  private onSelectModel(event: React.FormEvent<HTMLSelectElement>) {
    if (ActiveSettingsManager.briefcase)
      ActiveSettingsManager.briefcase.editorToolSettings.model = event.currentTarget.options[event.currentTarget.selectedIndex].id;

    this.updateState();
  }

  private getAllCategories(): React.ReactElement[] {
    return ActiveSettingsManager.categories.cache.map((nid) =>
      <option id={nid.id} key={nid.id}>{nid.name}</option>,
    );
  }

  private onSelectCategory(event: React.FormEvent<HTMLSelectElement>) {
    if (ActiveSettingsManager.briefcase)
      ActiveSettingsManager.briefcase.editorToolSettings.category = event.currentTarget.options[event.currentTarget.selectedIndex].id;

    this.updateState();
  }

  public override render() {
    if (ActiveSettingsManager.models === undefined || ActiveSettingsManager.categories === undefined)
      return <div>...</div>;
    return (
      <div>
        <h2>Active Settings</h2>
        <table>
          <tbody>
            <tr>
              <td>Model</td>
              <td><select title="Active Model" value={this.activeModelName} onBlur={(e) => this.onSelectModel(e)} >
                {this.getAllModels()}
              </select>
              </td>
            </tr>
            <tr>
              <td>Category</td>
              <td><select title="Active Category" value={this.activeCategoryName} onBlur={(e) => this.onSelectCategory(e)} >
                {this.getAllCategories()}
              </select>
              </td>
            </tr>
          </tbody>
        </table>
      </div >
    );
  }

}

export class ActiveSettingsWidget extends WidgetControl {
  constructor(info: ConfigurableCreateInfo, options: any) {
    super(info, options);

    this.reactNode = <ActiveSettingsComponent />;
  }
}
UiFramework.controls.register("ActiveSettings", ActiveSettingsWidget);
