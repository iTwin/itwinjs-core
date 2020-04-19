/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
/** @packageDocumentation
 * @module PropertyGrid
 */
import * as React from "react";
import classnames from "classnames";
import ReactResizeDetector from "react-resize-detector";

import { DisposeFunc } from "@bentley/bentleyjs-core";
import { Orientation, Spinner, SpinnerSize, CommonProps } from "@bentley/ui-core";
import { PropertyRecord, PropertyValueFormat, ArrayValue, StructValue } from "@bentley/ui-abstract";
import { IPropertyDataProvider, PropertyCategory, PropertyData } from "../PropertyDataProvider";
import { SelectablePropertyBlock } from "./SelectablePropertyBlock";
import { PropertyValueRendererManager } from "../../properties/ValueRendererManager";
import { PropertyUpdatedArgs } from "../../editors/EditorContainer";
import { matchLinks } from "../../common/Links";
import { ActionButtonRenderer } from "../../properties/renderers/ActionButtonRenderer";
import "./PropertyGrid.scss";

/** Properties for [[PropertyGrid]] React component
 * @public
 */
export interface PropertyGridProps extends CommonProps {
  /** Property data provider */
  dataProvider: IPropertyDataProvider;

  /** Grid orientation. When not defined, it is chosen automatically based on width of the grid. */
  orientation?: Orientation;

  /** Enables/disables property hovering effect */
  isPropertyHoverEnabled?: boolean;

  /** Called to show a context menu when properties are right-clicked */
  onPropertyContextMenu?: (args: PropertyGridContextMenuArgs) => void;

  /** Enables/disables property selection */
  isPropertySelectionEnabled?: boolean;
  /** Enables/disables property selection with right click */
  isPropertySelectionOnRightClickEnabled?: boolean;
  /** Callback to property selection */
  onPropertySelectionChanged?: (property: PropertyRecord) => void;

  /** Enables/disables property editing @beta */
  isPropertyEditingEnabled?: boolean;
  /** Callback for when properties are being edited @beta */
  onPropertyEditing?: (args: PropertyEditingArgs, category: PropertyCategory) => void;
  /** Callback for when properties are updated @beta */
  onPropertyUpdated?: (args: PropertyUpdatedArgs, category: PropertyCategory) => Promise<boolean>;

  /** Callback for when links in properties are being clicked @beta */
  onPropertyLinkClick?: (property: PropertyRecord, text: string) => void;

  /** Custom property value renderer manager */
  propertyValueRendererManager?: PropertyValueRendererManager;

  /** Indicates whether the orientation is fixed and does not auto-switch to Vertical when the width is too narrow. Defaults to false. @beta */
  isOrientationFixed?: boolean;
  /** The minimum width before the auto-switch to Vertical when the width is too narrow. Defaults to 300. @beta */
  horizontalOrientationMinWidth?: number;

  /**
   * Array of action button renderers. Each renderer is called for each property and can decide
   * to render an action button for the property or not.
   *
   * @beta
   */
  actionButtonRenderers?: ActionButtonRenderer[];
}

/** Arguments for the Property Editing event callback
 * @public
 */
export interface PropertyEditingArgs {
  /** PropertyRecord being edited  */
  propertyRecord: PropertyRecord;
  /** Unique key of currently edited property */
  propertyKey?: string;
}

/** Arguments for `PropertyGridProps.onPropertyContextMenu` callback
 * @public
 */
export interface PropertyGridContextMenuArgs {
  /** PropertyRecord being edited  */
  propertyRecord: PropertyRecord;
  /** An event which caused the context menu callback */
  event: React.MouseEvent;
}

/** Property Category in the [[PropertyGrid]] state
 * @public
 */
export interface PropertyGridCategory {
  propertyCategory: PropertyCategory;
  propertyCount: number;
  properties: PropertyRecord[];
}

/** State of [[PropertyGrid]] React component
 * @internal
 */
interface PropertyGridState {
  /** List of PropertyGrid categories */
  categories: PropertyGridCategory[];
  /** Unique key of currently selected property */
  selectedPropertyKey?: string;
  /** Unique key of currently edited property */
  editingPropertyKey?: string;
  /** Actual orientation used by the property grid */
  orientation: Orientation;
  /** If property grid currently loading data, the loading start time  */
  loadStart?: Date;
  /** Width of PropertyGrid */
  width: number;
}

/** PropertyGrid React component.
 * @public
 */
export class PropertyGrid extends React.Component<PropertyGridProps, PropertyGridState> {
  private _dataChangesListenerDisposeFunc?: DisposeFunc;
  private _isMounted = false;
  private _isInDataRequest = false;
  private _hasPendingDataRequest = false;

  /** @internal */
  constructor(props: PropertyGridProps) {
    super(props);
    this.state = {
      categories: [],
      orientation: this.getPreferredOrientation(),
      width: 0,
    };
  }

  /** @internal */
  public componentDidMount() {
    this._isMounted = true;
    this._dataChangesListenerDisposeFunc = this.props.dataProvider.onDataChanged.addListener(this._onPropertyDataChanged);

    // tslint:disable-next-line:no-floating-promises
    this.gatherData();
  }

  /** @internal */
  public componentWillUnmount() {
    // istanbul ignore else
    if (this._dataChangesListenerDisposeFunc) {
      this._dataChangesListenerDisposeFunc();
      this._dataChangesListenerDisposeFunc = undefined;
    }
    this._isMounted = false;
  }

  public componentDidUpdate(prevProps: PropertyGridProps) {
    if (this.props.dataProvider !== prevProps.dataProvider) {
      // istanbul ignore else
      if (this._dataChangesListenerDisposeFunc)
        this._dataChangesListenerDisposeFunc();
      this._dataChangesListenerDisposeFunc = this.props.dataProvider.onDataChanged.addListener(this._onPropertyDataChanged);
    }

    if (this.props.orientation !== prevProps.orientation
      || this.props.isOrientationFixed !== prevProps.isOrientationFixed
      || this.props.horizontalOrientationMinWidth !== prevProps.horizontalOrientationMinWidth)
      this.updateOrientation(this.state.width);
  }

  private handleLinkClick(_record: PropertyRecord, text: string) {
    const linksArray = matchLinks(text);
    if (linksArray.length <= 0)
      return;
    const foundLink = linksArray[0];
    // istanbul ignore else
    if (foundLink && foundLink.url) {
      if (foundLink.schema === "mailto:" || foundLink.schema === "pw:")
        location.href = foundLink.url;
      else
        window.open(foundLink.url, "_blank")!.focus();
    }
  }

  private _onPropertyDataChanged = () => {
    // tslint:disable-next-line:no-floating-promises
    this.gatherData();
  }

  private _shouldExpandCategory = (category: PropertyCategory): boolean => {
    const stateCategory = this.state.categories.find((x) => x.propertyCategory.name === category.name);
    if (stateCategory)
      return stateCategory.propertyCategory.expand;
    return category.expand;
  }

  private async gatherData(): Promise<void> {
    if (this._isInDataRequest) {
      this._hasPendingDataRequest = true;
      return;
    }

    this.setState((prev) => prev.loadStart ? null : { loadStart: new Date() });

    this._isInDataRequest = true;
    let propertyData: PropertyData;
    try {
      propertyData = await this.props.dataProvider.getData();
    } finally {
      this._isInDataRequest = false;
    }

    if (!this._isMounted)
      return;

    if (this._hasPendingDataRequest) {
      this._hasPendingDataRequest = false;
      return this.gatherData();
    }

    const categories = new Array<PropertyGridCategory>();
    propertyData.categories.forEach((category: PropertyCategory) => {
      categories.push({
        propertyCategory: { ...category, expand: this._shouldExpandCategory(category) },
        propertyCount: propertyData.records[category.name].length,
        properties: propertyData.records[category.name],
      });

      this.assignRecordClickHandlers(propertyData.records[category.name]);
    });
    this.setState({ categories, loadStart: undefined });
  }

  private assignRecordClickHandlers(records: PropertyRecord[]) {
    records.forEach((record: PropertyRecord) => {
      if (record.links)
        record.links.onClick = this.props.onPropertyLinkClick ? this.props.onPropertyLinkClick : this.handleLinkClick;
      if (record.value.valueFormat === PropertyValueFormat.Array)
        this.assignRecordClickHandlers((record.value as ArrayValue).items);
      if (record.value.valueFormat === PropertyValueFormat.Struct)
        this.assignRecordClickHandlers(Object.values((record.value as StructValue).members));
    });
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

  private _isClickSupported() {
    return this.props.isPropertySelectionEnabled || this.props.isPropertyEditingEnabled;
  }

  private _isRightClickSupported() {
    return this.props.isPropertySelectionOnRightClickEnabled;
  }

  private _onPropertyRightClicked = (property: PropertyRecord, key?: string) => {
    // istanbul ignore else
    if (this._isRightClickSupported())
      this._onEnabledPropertyClicked(property, key, true);
  }

  private _onPropertyClicked = (property: PropertyRecord, key?: string) => {
    // istanbul ignore else
    if (this._isClickSupported())
      this._onEnabledPropertyClicked(property, key);
  }

  private _onPropertyContextMenu = (property: PropertyRecord, e: React.MouseEvent) => {
    if (this.props.onPropertyContextMenu) {
      this.props.onPropertyContextMenu({ propertyRecord: property, event: e });
    }
  }

  private _onEditCommit = async (args: PropertyUpdatedArgs, category: PropertyCategory) => {
    // istanbul ignore else
    if (this.props.onPropertyUpdated) {
      await this.props.onPropertyUpdated(args, category);
      this.setState({ editingPropertyKey: undefined });
    }
  }

  private _onEditCancel = () => {
    this.setState({ editingPropertyKey: undefined });
  }

  private _onEnabledPropertyClicked(property: PropertyRecord, key: string | undefined, rightClick: boolean = false) {
    let selectedPropertyKey = this.state.selectedPropertyKey;
    let editingPropertyKey = this.state.editingPropertyKey;

    if (this.props.isPropertyEditingEnabled && property.value.valueFormat === PropertyValueFormat.Primitive && !rightClick) {
      if (this.props.isPropertySelectionEnabled) {
        if (selectedPropertyKey === key)
          editingPropertyKey = key;
        else
          editingPropertyKey = undefined;
      } else {
        editingPropertyKey = key;
      }
    }
    if (editingPropertyKey !== key || rightClick) {
      if (rightClick) {
        editingPropertyKey = undefined;
        if (selectedPropertyKey !== key)
          selectedPropertyKey = key;
      } else
        if (selectedPropertyKey === key) {
          // Deselect
          selectedPropertyKey = undefined;
        } else {
          // Select another one
          selectedPropertyKey = key;
        }
      if (this.props.onPropertySelectionChanged)
        this.props.onPropertySelectionChanged(property);
    }
    this.setState({ selectedPropertyKey, editingPropertyKey });
  }

  private getPreferredOrientation(): Orientation {
    return (this.props.orientation !== undefined) ? this.props.orientation : Orientation.Horizontal;
  }

  private _onResize = (width: number, _height: number) => {
    this.updateOrientation(width);
  }

  private updateOrientation(width: number): void {
    const isOrientationFixed = !!this.props.isOrientationFixed;
    const horizontalOrientationMinWidth = (this.props.horizontalOrientationMinWidth !== undefined) ? this.props.horizontalOrientationMinWidth : 300;

    let orientation = this.getPreferredOrientation();
    if (!isOrientationFixed) {
      // Switch to Vertical if width too small
      if (width < horizontalOrientationMinWidth)
        orientation = Orientation.Vertical;
    }

    if (orientation !== this.state.orientation || width !== this.state.width)
      this.setState({ orientation, width });
  }

  /** @internal */
  public render() {
    if (this.state.loadStart) {
      return (
        <div className="components-property-grid-loader">
          <DelayedSpinner loadStart={this.state.loadStart} />
        </div>
      );
    }

    return (
      <div className={classnames("components-property-grid-wrapper", this.props.className)} style={this.props.style}>
        <div className="components-property-grid">
          {
            this.state.categories.map((gridCategory: PropertyGridCategory) => (
              <SelectablePropertyBlock
                key={gridCategory.propertyCategory.name}
                category={gridCategory.propertyCategory}
                properties={gridCategory.properties}
                orientation={this.state.orientation}
                selectedPropertyKey={this.state.selectedPropertyKey}
                onExpansionToggled={this._onExpansionToggled}
                onPropertyClicked={this._isClickSupported() ? this._onPropertyClicked : undefined}
                onPropertyRightClicked={this._isRightClickSupported() ? this._onPropertyRightClicked : undefined}
                onPropertyContextMenu={this._onPropertyContextMenu}
                propertyValueRendererManager={this.props.propertyValueRendererManager}
                editingPropertyKey={this.state.editingPropertyKey}
                onEditCommit={this._onEditCommit}
                onEditCancel={this._onEditCancel}
                isPropertyHoverEnabled={this.props.isPropertyHoverEnabled}
                isPropertySelectionEnabled={this.props.isPropertySelectionEnabled}
                isPropertyRightClickSelectionEnabled={this.props.isPropertySelectionOnRightClickEnabled}
                actionButtonRenderers={this.props.actionButtonRenderers}
              />
            ))
          }
        </div>
        <ReactResizeDetector handleWidth handleHeight onResize={this._onResize} />
      </div>
    );
  }
}

interface DelayedSpinnerProps {
  loadStart?: Date;
  delay?: number;
}
// tslint:disable-next-line: variable-name
const DelayedSpinner = (props: DelayedSpinnerProps) => {
  const delay = props.delay || 500;
  const [loadStart] = React.useState(props.loadStart || new Date());

  const currTime = new Date();
  const diff = (currTime.getTime() - loadStart.getTime());

  const update = useForceUpdate();
  React.useEffect(() => {
    if (diff >= delay)
      return;
    const timer = setTimeout(update, diff);
    return () => clearTimeout(timer);
  });

  if (diff < delay)
    return null;

  return (<Spinner size={SpinnerSize.Large} />);
};
const useForceUpdate = () => {
  const [value, set] = React.useState(true);
  return () => set(!value);
};
