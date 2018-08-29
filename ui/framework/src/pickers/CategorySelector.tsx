/*---------------------------------------------------------------------------------------------
| $Copyright: (c) 2018 Bentley Systems, Incorporated. All rights reserved. $
 *--------------------------------------------------------------------------------------------*/
import * as React from "react";
import ListPickerWidget, { ListItem, ListItemType } from "./ListPickerWidget";
import { IModelApp, Viewport, ViewState, SelectedViewportChangedArgs } from "@bentley/imodeljs-frontend";
import { UiFramework } from "../UiFramework";
import { ConfigurableUiManager } from "../configurableui/ConfigurableUiManager";
import { ConfigurableCreateInfo } from "../configurableui/ConfigurableUiControl";
import { WidgetControl } from "../configurableui/WidgetControl";

export class CategorySelectorDemoWidget extends WidgetControl {
  constructor(info: ConfigurableCreateInfo, options: any) {
    super(info, options);

    const thing = options.iModel;
    this.reactElement = <CategorySelectorWidget widgetControl={this} imodel={thing} />;
  }
}

// Select categories in a viewport or all viewports of the current selected type (e.g. 3D/2D)
// Pass 'allViewports' property to ripple category changes to all viewports
export class CategorySelectorWidget extends React.Component<any, any> {
  private _removeSelectedViewportChanged?: () => void;

  constructor(props: any) {
    super(props);

    this.state = {
      items: [],
      title: UiFramework.i18n.translate("UiFramework:categoriesModels.categories"),
      initialized: false,
    };

    this.updateState();
  }

  public componentDidMount() {
    this._removeSelectedViewportChanged = IModelApp.viewManager.onSelectedViewportChanged.addListener(this._handleSelectedViewportChanged);
  }

  public componentWillUnmount() {
    if (this._removeSelectedViewportChanged)
      this._removeSelectedViewportChanged();
  }

  private _handleSelectedViewportChanged = (args: SelectedViewportChangedArgs) => {
    if (args.current)
      this.updateStateWithViewport(args.current);
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
    const vp = IModelApp.viewManager.selectedView;
    if (vp)
      this.updateStateWithViewport(vp);
  }

  public render() {
    if (!this.state.initialized)
      this.updateState();

    // Change the category
    const setEnabled = (item: ListItem, enabled: boolean) => {
      if (!IModelApp.viewManager.selectedView)
        return;
      const updateViewport = (vp: Viewport) => {
        // Only act on viewports that are both 3D or both 2D. Important if we have multiple viewports opened and we
        // are using 'allViewports' property
        if (IModelApp.viewManager.selectedView && IModelApp.viewManager.selectedView.view.is3d() === vp.view.is3d()) {
          const view: ViewState = vp.view.clone();
          view.categorySelector.changeCategoryDisplay(item.key, enabled);
          vp.changeView(view);
        }
      };
      // This property let us act on all viewports or just on the selected one, configurable by the app
      if (this.props.allViewports) {
        IModelApp.viewManager.forEachViewport(updateViewport);
      } else if (IModelApp.viewManager.selectedView) {
        updateViewport(IModelApp.viewManager.selectedView);
      }
      this.updateStateWithViewport(IModelApp.viewManager.selectedView);
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
      <ListPickerWidget
        {...this.props}
        title={this.state.title}
        setEnabled={setEnabled}
        items={this.state.items}
        iconClass={"icon-layers"}
        enableAllFunc={enableAll}
        disableAllFunc={disableAll}
        invertFunc={invert}
      />
    );
  }
}

ConfigurableUiManager.registerControl("CategorySelectorWidget", CategorySelectorDemoWidget);
