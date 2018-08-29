/*---------------------------------------------------------------------------------------------
| $Copyright: (c) 2018 Bentley Systems, Incorporated. All rights reserved. $
 *--------------------------------------------------------------------------------------------*/
import * as React from "react";
import ListPickerWidget, { ListItem, ListItemType } from "./ListPickerWidget";
import { IModelApp, Viewport, SpatialViewState, SpatialModelState, SelectedViewportChangedArgs } from "@bentley/imodeljs-frontend";
import { ModelQueryParams } from "@bentley/imodeljs-common/lib/ModelProps";
import { UiFramework } from "../UiFramework";
import { ConfigurableUiManager } from "../configurableui/ConfigurableUiManager";
import { ConfigurableCreateInfo } from "../configurableui/ConfigurableUiControl";
import { WidgetControl } from "../configurableui/WidgetControl";

export class ModelSelectorDemoWidget extends WidgetControl {
  constructor(info: ConfigurableCreateInfo, options: any) {
    super(info, options);

    const thing = options.iModel;
    this.reactElement = <ModelSelectorWidget widgetControl={this} imodel={thing} />;
  }
}

export default class ModelSelectorWidget extends React.Component<any, any> {
  private _removeSelectedViewportChanged?: () => void;

  constructor(props: any) {
    super(props);

    this.state = {
      items: [],
      title: UiFramework.i18n.translate("UiFramework:categoriesModels.models"),
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

  // Update viewed models on selected viewport changed
  private _handleSelectedViewportChanged = (args: SelectedViewportChangedArgs) => {
    if (args.current)
      this.updateStateWithViewport(args.current);
  }

  public async updateStateWithViewport(vp: Viewport) {
    // Query models and add them to state
    if (!(vp.view instanceof SpatialViewState))
      return;

    const spatialView = vp.view as SpatialViewState;
    const modelQueryParams: ModelQueryParams = { from: SpatialModelState.getClassFullName(), wantPrivate: false };
    const curModelProps = await this.props.imodel.models.queryProps(modelQueryParams);

    const models: ListItem[] = [];
    for (const modelProps of curModelProps) {
      const model: ListItem = {
        key: modelProps.id.toString(),
        name: modelProps.name,
        enabled: spatialView.modelSelector.has(modelProps.id),
        type: ListItemType.Item,
      };
      models.push(model);
    }

    this.setState({
      items: models,
      title: UiFramework.i18n.translate("UiFramework:categoriesModels.models"),
      initialized: true,
    });

    vp.changeView(spatialView);
  }

  public async updateState() {
    const vp = IModelApp.viewManager.getFirstOpenView();
    if (vp)
      this.updateStateWithViewport(vp);
  }

  public render() {
    if (!this.state.initialized)
      this.updateState();

    // enable/disable the models
    const setEnabledNoState = (item: ListItem, enabled: boolean) => {
      IModelApp.viewManager.forEachViewport((vp: Viewport) => {
        if (!(vp.view instanceof SpatialViewState))
          return;

        const view: SpatialViewState = vp.view.clone();
        if (enabled)
          view.modelSelector.addModels(item.key);
        else
          view.modelSelector.dropModels(item.key);

        vp.changeView(view);
      });
    };

    // Enable/disable the models and update the state
    const setEnabled = (item: ListItem, enabled: boolean) => {
      setEnabledNoState(item, enabled);
      this.updateState();
    };

    const self = this;
    // Enable all categories
    const enableAll = () => {
      for (const item of self.state.items) {
        setEnabledNoState(item, true);
      }

      self.updateState();
    };

    // Disable all models (TODO: perhaps we don't want to let the user do this, a model should always remain)
    const disableAll = () => {
      for (const item of self.state.items) {
        setEnabledNoState(item, false);
      }

      // Update the category items in the list picker
      self.updateState();
    };

    // Invert model selection
    const invert = () => {
      IModelApp.viewManager.forEachViewport((vp: Viewport) => {
        if (!(vp.view instanceof SpatialViewState))
          return;

        const view: SpatialViewState = vp.view.clone();
        for (const item of self.state.items) {
          const enabled = !view.modelSelector.has(item.key);
          if (enabled)
            view.modelSelector.addModels(item.key);
          else
            view.modelSelector.dropModels(item.key);

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
        iconClass={"icon-3d-cube"}
        enableAllFunc={enableAll}
        disableAllFunc={disableAll}
        invertFunc={invert}
      />
    );
  }
}

ConfigurableUiManager.registerControl("ModelSelectorWidget", ModelSelectorDemoWidget);
