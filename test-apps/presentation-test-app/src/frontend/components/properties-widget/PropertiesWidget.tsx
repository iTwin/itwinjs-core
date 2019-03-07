/*---------------------------------------------------------------------------------------------
* Copyright (c) 2019 Bentley Systems, Incorporated. All rights reserved.
* Licensed under the MIT License. See LICENSE.md in the project root for license terms.
*--------------------------------------------------------------------------------------------*/

import * as React from "react";
import { IModelApp, IModelConnection, PropertyRecord } from "@bentley/imodeljs-frontend";
import {
  PresentationPropertyDataProvider, propertyGridWithUnifiedSelection,
  IPresentationPropertyDataProvider,
} from "@bentley/presentation-components";
import { GlobalContextMenu, ContextMenuItem } from "@bentley/ui-core";
import { PropertyGrid, PropertyData, PropertyCategory, PropertyGridContextMenuArgs } from "@bentley/ui-components";
import "./PropertiesWidget.css";

// tslint:disable-next-line:variable-name naming-convention
const SamplePropertyGrid = propertyGridWithUnifiedSelection(PropertyGrid);

export interface Props {
  imodel: IModelConnection;
  rulesetId: string;
  onFindSimilar?: (propertiesProvider: IPresentationPropertyDataProvider, record: PropertyRecord) => void;
}
export interface State {
  dataProvider: PresentationPropertyDataProvider;
  contextMenu?: PropertyGridContextMenuArgs;
}
export default class PropertiesWidget extends React.Component<Props, State> {
  constructor(props: Props, context?: any) {
    super(props, context);
    this.state = {
      dataProvider: createDataProvider(this.props.imodel, this.props.rulesetId),
    };
  }
  public static getDerivedStateFromProps(props: Props, state: State) {
    if (props.imodel !== state.dataProvider.imodel || props.rulesetId !== state.dataProvider.rulesetId)
      return { ...state, dataProvider: createDataProvider(props.imodel, props.rulesetId) };
    return null;
  }
  private _onFindSimilar = (property: PropertyRecord) => {
    if (this.props.onFindSimilar)
      this.props.onFindSimilar(this.state.dataProvider, property);
    this.setState({ contextMenu: undefined });
  }
  private _onPropertyContextMenu = (args: PropertyGridContextMenuArgs) => {
    args.event.persist();
    this.setState({ contextMenu: args });
  }
  private _onContextMenuOutsideClick = () => {
    this.setState({ contextMenu: undefined });
  }
  private _onContextMenuEsc = () => {
    this.setState({ contextMenu: undefined });
  }
  private buildContextMenu(args: PropertyGridContextMenuArgs) {
    const items = new Array<React.ReactNode>();
    if (this.props.onFindSimilar) {
      items.push(
        <ContextMenuItem
          key="find-similar"
          onSelect={() => this._onFindSimilar(args.propertyRecord)}
          title={IModelApp.i18n.translate("Sample:controls.properties.context-menu.find-similar.description")}
        >
          {IModelApp.i18n.translate("Sample:controls.properties.context-menu.find-similar.label")}
        </ContextMenuItem>,
      );
    }
    if (items.length === 0)
      return undefined;

    return (
      <GlobalContextMenu
        opened={true}
        onOutsideClick={this._onContextMenuOutsideClick}
        onEsc={this._onContextMenuEsc}
        identifier="PropertiesWidget"
        x={args.event.clientX}
        y={args.event.clientY}
      >
        {items}
      </GlobalContextMenu>
    );
  }
  public render() {
    let contextMenu: React.ReactNode;
    if (this.state.contextMenu)
      contextMenu = this.buildContextMenu(this.state.contextMenu);

    return (
      <div className="PropertiesWidget">
        <h3>{IModelApp.i18n.translate("Sample:controls.properties.widget-label")}</h3>
        <div className="ContentContainer">
          <SamplePropertyGrid
            dataProvider={this.state.dataProvider}
            isPropertyHoverEnabled={true}
            onPropertyContextMenu={this._onPropertyContextMenu}
          />
        </div>
        {contextMenu}
      </div>
    );
  }
}

class AutoExpandingPropertyDataProvider extends PresentationPropertyDataProvider {
  public async getData(): Promise<PropertyData> {
    const result = await super.getData();
    result.categories.forEach((category: PropertyCategory) => {
      category.expand = true;
    });
    return result;
  }
}

function createDataProvider(imodel: IModelConnection, rulesetId: string): PresentationPropertyDataProvider {
  return new AutoExpandingPropertyDataProvider(imodel, rulesetId);
}
