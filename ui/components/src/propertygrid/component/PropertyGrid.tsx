/*---------------------------------------------------------------------------------------------
* Copyright (c) 2018 Bentley Systems, Incorporated. All rights reserved.
* Licensed under the MIT License. See LICENSE.md in the project root for license terms.
*--------------------------------------------------------------------------------------------*/
/** @module PropertyGrid */

import * as React from "react";
import { DisposeFunc } from "@bentley/bentleyjs-core";
import { Orientation } from "@bentley/ui-core";
import { PropertyRecord } from "../../properties";
import { PropertyDataProvider, PropertyCategory, PropertyData } from "../PropertyDataProvider";

import "./PropertyGrid.scss";
import { SelectablePropertyBlock } from "./SelectablePropertyBlock";

/** Props for PropertyGrid React component */
export interface PropertyGridProps {
  /** Property data provider */
  dataProvider: PropertyDataProvider;
  /** Grid orientation */
  orientation: Orientation;
  /** Enables/disables property selection */
  isPropertySelectionEnabled?: boolean;
  /** Callback to property selection */
  onPropertySelectionChanged?: (property: PropertyRecord) => void;
}

export interface PropertyGridCategory {
  propertyCategory: PropertyCategory;
  propertyCount: number;
  properties: PropertyRecord[];
}

/** State of [[PropertyGrid]] React component */
export interface PropertyGridState {
  /** List of PropertyGrid categories */
  categories: PropertyGridCategory[];
  /** Unique key of currently selected property */
  selectedPropertyKey?: string;
}

/** PropertyGrid React component.
 */
export class PropertyGrid extends React.Component<PropertyGridProps, PropertyGridState> {

  private _dataChangesListenerDisposeFunc?: DisposeFunc;
  private _isMounted = false;

  public readonly state: Readonly<PropertyGridState> = {
    categories: [],
    selectedPropertyKey: undefined,
  };

  constructor(props: PropertyGridProps) {
    super(props);
    this._dataChangesListenerDisposeFunc = this.props.dataProvider.onDataChanged.addListener(this._onPropertyDataChanged);
  }

  public componentDidMount() {
    this._isMounted = true;
    this.gatherData(this.props.dataProvider);
  }

  public componentWillUnmount() {
    if (this._dataChangesListenerDisposeFunc) {
      this._dataChangesListenerDisposeFunc();
      this._dataChangesListenerDisposeFunc = undefined;
    }
    this._isMounted = false;
  }

  public componentDidUpdate() {
    if (this._dataChangesListenerDisposeFunc)
      this._dataChangesListenerDisposeFunc();
    this._dataChangesListenerDisposeFunc = this.props.dataProvider.onDataChanged.addListener(this._onPropertyDataChanged);
  }

  private _onPropertyDataChanged = () => {
    this.gatherData(this.props.dataProvider);
  }

  private _shouldExpandCategory = (category: PropertyCategory): boolean => {
    if (category.expand)
      return true;
    return this.state.categories.some((stateCategory: PropertyGridCategory) => {
      return stateCategory.propertyCategory.name === category.name && stateCategory.propertyCategory.expand;
    });
  }

  private async gatherData(dataProvider: PropertyDataProvider) {
    const propertyData: PropertyData = await dataProvider.getData();
    if (!this._isMounted)
      return;

    const categories = new Array<PropertyGridCategory>();
    propertyData.categories.map((category: PropertyCategory, _index: number) => {
      const gridCategory: PropertyGridCategory = {
        propertyCategory: { ...category, expand: this._shouldExpandCategory(category) },
        propertyCount: propertyData.records[category.name].length,
        properties: propertyData.records[category.name],
      };
      categories.push(gridCategory);
    });
    this.setState({ categories });
  }

  private _onExpansionToggled = (categoryName: string) => {
    const index = this.state.categories.findIndex((c) => c.propertyCategory.name === categoryName);
    if (-1 === index)
      return;

    const categories = [...this.state.categories];

    const newCategory = {
      ...categories[index],
      propertyCategory: {
        ...categories[index].propertyCategory,
        expand: !categories[index].propertyCategory.expand,
      },
    };

    categories[index] = newCategory;
    this.setState({ categories });
  }

  private _onPropertyClicked = (property: PropertyRecord, key?: string) => {
    if (!this.props.isPropertySelectionEnabled)
      return;

    if (this.state.selectedPropertyKey === key) {
      // Deselect
      this.setState({ selectedPropertyKey: undefined });
    } else {
      // Select another one
      this.setState({ selectedPropertyKey: key });
    }

    if (this.props.onPropertySelectionChanged)
      this.props.onPropertySelectionChanged(property);
  }

  public render() {
    return (
      <div className="components-property-grid-wrapper">
        <div className="components-property-grid">
          {
            this.state.categories.map((gridCategory: PropertyGridCategory) => (
              <SelectablePropertyBlock key={gridCategory.propertyCategory.name}
                category={gridCategory.propertyCategory}
                properties={gridCategory.properties}
                orientation={this.props.orientation}
                selectedPropertyKey={this.state.selectedPropertyKey}
                onExpansionToggled={this._onExpansionToggled}
                onPropertyClicked={this._onPropertyClicked}
              />
            ))
          }
        </div>
      </div>
    );
  }
}
