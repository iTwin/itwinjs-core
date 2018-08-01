import * as React from "react";
import ListPicker, { ListItem, ListItemType } from "./ListPicker";
import { IModelApp, Viewport, ViewState } from "@bentley/imodeljs-frontend/lib/frontend";
import { UiFramework } from "../UiFramework";

export class CategorySelectorWidget extends React.Component<any, any> {
  constructor(props: any) {
    super(props);

    this.state = {
      items: [],
      title: UiFramework.i18n.translate("UiFramework:categoriesModels.categories"),
      initialized: false,
    };

    this.updateState();
  }

  public async updateStateWithViewport(vp: Viewport) {
    // Query categories and add them to state
    const view: ViewState = vp.view.clone();
    const ecsql = "SELECT ECInstanceId as id, CodeValue as code, UserLabel as label FROM " + (view.is3d() ? "BisCore.SpatialCategory" : "BisCore.DrawingCategory");
    const rows = await this.props.imodel.executeQuery(ecsql);

    const categories: ListItem[] = [];
    for (const row of rows) {
      const category: ListItem = {
        key: row.id as string,
        name: row.label ? row.label as string : row.code as string,
        enabled: view.categorySelector.has(row.id as string),
        type: ListItemType.Item,
      };
      categories.push(category);
    }

    this.setState({
      items: categories,
      title: UiFramework.i18n.translate("UiFramework:categoriesModels.categories"),
      initialized: true,
    });

    vp.changeView(view);
  }

  public async updateState() {
    const vp = IModelApp.viewManager.getFirstOpenView();
    if (vp)
      this.updateStateWithViewport(vp);
  }

  public render() {
    if (!this.state.initialized)
      this.updateState();

    // Change the category
    const setEnabled = (item: ListItem, enabled: boolean) => {
      IModelApp.viewManager.forEachViewport((vp: Viewport) => {
        const view: ViewState = vp.view.clone();
        view.categorySelector.changeCategoryDisplay(item.key, enabled);
        vp.changeView(view);
      });

      this.updateState();
    };

    // Hook on the category selector being expanded so that we may initialize if needed
    const onExpanded = (_expand: boolean) => {
      this.updateState();
    };

    const self = this;
    // Enable all categories
    const enableAll = () => {
      IModelApp.viewManager.forEachViewport((vp: Viewport) => {
        const view: ViewState = vp.view.clone();
        for (const item of self.state.items) {
          view.categorySelector.changeCategoryDisplay(item.key, true);
        }
        vp.changeView(view);
      });

      // Update the category items in the list picker
      self.updateState();
    };

    // Disable all categories
    const disableAll = () => {
      IModelApp.viewManager.forEachViewport((vp: Viewport) => {
        const view: ViewState = vp.view.clone();
        for (const item of self.state.items) {
          view.categorySelector.changeCategoryDisplay(item.key, false);
        }
        vp.changeView(view);
      });

      // Update the category items in the list picker
      self.updateState();
    };

    // Invert category selection
    const invert = () => {
      IModelApp.viewManager.forEachViewport((vp: Viewport) => {
        const view: ViewState = vp.view.clone();
        for (const item of self.state.items) {
          view.categorySelector.changeCategoryDisplay(item.key, !item.enabled);
        }
        vp.changeView(view);
      });

      // Update the category items in the list picker
      self.updateState();
    };

    return (
      <ListPicker
        {...this.props}
        title={this.state.title}
        setEnabled={setEnabled}
        items={this.state.items}
        iconClass={"icon-layers"}
        onExpanded={onExpanded}
        enableAllFunc={enableAll}
        disableAllFunc={disableAll}
        invertFunc={invert}
      />
    );
  }
}
