import * as React from "react";
import ListPicker, { ListItem, ListItemType } from "./ListPicker";
import { IModelApp, Viewport, SpatialViewState, SpatialModelState } from "@bentley/imodeljs-frontend/lib/frontend";
import { ModelQueryParams } from "@bentley/imodeljs-common/lib/ModelProps";
import { UiFramework } from "../UiFramework";

export default class ModelSelectorWidget extends React.Component<any, any> {
  constructor(props: any) {
    super(props);

    this.state = {
      items: [],
      title: UiFramework.i18n.translate("UiFramework:categoriesModels.models"),
      initialized: false,
    };

    this.updateState();
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

    // Hook on the category selector being expanded so that we may initialize if needed
    const onExpanded = (_expand: boolean) => {
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
      <ListPicker
        {...this.props}
        title={this.state.title}
        setEnabled={setEnabled}
        items={this.state.items}
        iconClass={"icon-3d-cube"}
        onExpanded={onExpanded}
        enableAllFunc={enableAll}
        disableAllFunc={disableAll}
        invertFunc={invert}
      />
    );
  }
}
