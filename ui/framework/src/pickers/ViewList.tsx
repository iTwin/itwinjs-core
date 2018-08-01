import * as React from "react";
import ListPicker, { ListItem, ListItemType } from "./ListPicker";
import { IModelApp, Viewport, ViewState, IModelConnection } from "@bentley/imodeljs-frontend/lib/frontend";
import { ViewQueryParams } from "@bentley/imodeljs-common/lib/ViewProps";
import { UiFramework } from "../UiFramework";

export default class ViewListWidget extends React.Component<any, any> {
  constructor(props: any) {
    super(props);

    this.state = {
      items: [],
      selectedViewId: null,
      title: UiFramework.i18n.translate("UiFramework:savedViews.views"),
      initialized: false,
    };

    this.updateState();
  }

  public async updateState(viewId?: any) {
    // Query views and add them to state
    const views3d: ListItem[] = [];
    const views2d: ListItem[] = [];
    const viewQueryParams: ViewQueryParams = { wantPrivate: false };
    const viewSpecs: IModelConnection.ViewSpec[] = await this.props.imodel!.views.getViewList(viewQueryParams);
    for (const viewSpec of viewSpecs) {
      const viewState: ViewState = await this.props.imodel!.views.load(viewSpec.id);
      const viewItem: ListItem = {
        key: viewSpec.id,
        name: viewSpec.name,
        enabled: viewId && viewSpec.id === viewId ? true : false,
        type: ListItemType.Item,
      };
      if (viewState.is3d())
        views3d.push(viewItem);
      else
        views2d.push(viewItem);
    }

    const views3dContainer: ListItem = {
      key: "views3dContainer",
      name: UiFramework.i18n.translate("UiFramework:savedViews.spatialViews"),
      enabled: false,
      type: ListItemType.Container,
      children: views3d,
    };

    const views2dContainer: ListItem = {
      key: "views2dContainer",
      name: UiFramework.i18n.translate("UiFramework:savedViews.drawings"),
      enabled: false,
      type: ListItemType.Container,
      children: views2d,
    };

    this.setState({
      items: [views3dContainer, views2dContainer],
      selectedViewId: viewId ? viewId : null,
      title: UiFramework.i18n.translate("UiFramework:savedViews.views"),
      initialized: true,
    });
  }

  public render() {
    if (!this.state.initialized)
      this.updateState(this.state.selectedViewId);

    // enable/disable the models
    const setEnabled = async (item: ListItem, _enabled: boolean) => {
      const vp: Viewport | undefined = IModelApp.viewManager.selectedView;
      if (!vp)
        return;

      // Load the view state using the viewSpec's ID
      const viewState = await this.props.imodel!.views.load(item.key);
      vp.changeView(viewState);
      // Set state to show enabled the view that got selected
      this.updateState(item.key);
    };

    // Hook on the category selector being expanded so that we may initialize if needed
    const onExpanded = (_expand: boolean) => {
      this.updateState(this.state.selectedViewId);
    };

    return (
      <ListPicker
        {...this.props}
        title={this.state.title}
        setEnabled={setEnabled}
        items={this.state.items}
        iconClass={"icon-saved-view"}
        onExpanded={onExpanded}
      />
    );
  }
}
