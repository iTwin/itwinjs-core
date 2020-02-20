/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
import * as React from "react";
import { IModelApp, IModelConnection } from "@bentley/imodeljs-frontend";
import { Orientation } from "@bentley/ui-core";
import { PropertyGrid } from "@bentley/ui-components";
import {
  IPresentationPropertyDataProvider,
  PresentationPropertyDataProvider,
  propertyGridWithUnifiedSelection,
} from "@bentley/presentation-components";

// create a HOC property grid component that supports unified selection
// tslint:disable-next-line:variable-name
const SimplePropertyGrid = propertyGridWithUnifiedSelection(PropertyGrid);

/** React properties for the property pane component, that accepts an iModel connection with ruleset id */
export interface IModelConnectionProps {
  /** iModel whose content should be displayed in the property pane */
  imodel: IModelConnection;
  /** ID of the presentation rule set to use for creating the hierarchy in the property pane */
  rulesetId: string;
}

/** React properties for the property pane component, that accepts a data provider */
export interface DataProviderProps {
  /** Custom property pane data provider. */
  dataProvider: IPresentationPropertyDataProvider;
}

/** React properties for the property pane component */
export type Props = IModelConnectionProps | DataProviderProps;

/** Property grid component for the viewer app */
export default class SimplePropertiesComponent extends React.PureComponent<Props> {
  private getDataProvider(props: Props) {
    if ((props as any).dataProvider) {
      const providerProps = props as DataProviderProps;
      return providerProps.dataProvider;
    } else {
      const imodelProps = props as IModelConnectionProps;
      return new PresentationPropertyDataProvider({ imodel: imodelProps.imodel, ruleset: imodelProps.rulesetId });
    }
  }

  public render() {
    return (
      <>
        <h3 data-testid="property-pane-component-header">{IModelApp.i18n.translate("SimpleEditor:components.properties")}</h3>
        <div style={{ flex: "1", height: "calc(100% - 50px)" }}>
          <SimplePropertyGrid
            orientation={Orientation.Horizontal}
            dataProvider={this.getDataProvider(this.props)}
          />
        </div>
      </>
    );
  }
}
