/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
/**
 * @packageDocumentation
 * @module Properties
 */

import * as React from "react";
import { PropertyDescription, PropertyRecord, PropertyValueFormat, StandardTypeNames } from "@itwin/appui-abstract";
import { PropertyEditorBase, PropertyEditorManager, PropertyEditorProps, TypeEditor } from "@itwin/components-react";
import { IModelConnection } from "@itwin/core-frontend";
import { NavigationPropertyInfo } from "@itwin/presentation-common";
import { IContentDataProvider } from "../common/ContentDataProvider";
import {
  NavigationPropertyTargetSelector, NavigationPropertyTargetSelectorAttributes, ReadonlyNavigationPropertyTarget,
} from "./NavigationPropertyTargetSelector";

/**
 * Editor for navigation properties.
 *
 * **Note:** Should be used inside [[navigationPropertyEditorContext]].
 * @beta
 */
export class NavigationPropertyEditor extends PropertyEditorBase {
  // istanbul ignore next
  public override get containerHandlesEnter(): boolean {
    return false;
  }
  // istanbul ignore next
  public override get containerStopsKeydownPropagation(): boolean {
    return false;
  }
  public get reactNode(): React.ReactNode {
    return <NavigationPropertyTargetEditor />;
  }
}

PropertyEditorManager.registerEditor(StandardTypeNames.Navigation, NavigationPropertyEditor);

/**
 * Data structure that describes [[navigationPropertyEditorContext]] value.
 * @beta
 */
export interface NavigationPropertyEditorContext {
  /** iModel connection to pull data from. */
  imodel: IModelConnection;
  /** Getter to get [NavigationPropertyInfo]($presentation-common) for specific property. */
  getNavigationPropertyInfo: (property: PropertyDescription) => Promise<NavigationPropertyInfo | undefined>;
}

/**
 * Context used to store data for [[NavigationPropertyEditor]].
 * @beta
 */
export const navigationPropertyEditorContext = React.createContext<NavigationPropertyEditorContext | undefined>(undefined);

/**
 * Custom hook that creates value for [[navigationPropertyEditorContext]].
 * @beta
 */
export function useNavigationPropertyEditingContext(imodel: IModelConnection, dataProvider: IContentDataProvider): NavigationPropertyEditorContext {
  return React.useMemo<NavigationPropertyEditorContext>(() => ({
    imodel,
    getNavigationPropertyInfo: async (property) => {
      const field = await dataProvider.getFieldByPropertyRecord(new PropertyRecord({ valueFormat: PropertyValueFormat.Primitive }, property));
      if (!field || !field.isPropertiesField())
        return undefined;
      return field.properties[0].property.navigationPropertyInfo;
    },
  }), [imodel, dataProvider]);
}

/**
 * Component that renders navigation property target selector for navigation property value editing.
 *
 * **Note:** Should be used inside [[navigationPropertyEditorContext]].
 * @beta
 */
export class NavigationPropertyTargetEditor extends React.PureComponent<PropertyEditorProps> implements TypeEditor {
  private _ref = React.createRef<NavigationPropertyTargetSelectorAttributes>();

  // istanbul ignore next
  public async getPropertyValue() {
    return this._ref.current?.getValue();
  }

  // istanbul ignore next
  public get htmlElement() {
    return this._ref.current?.divElement ?? null;
  }

  // istanbul ignore next
  public get hasFocus() {
    if (!this._ref.current?.divElement || !document.activeElement)
      return false;
    return this._ref.current.divElement.contains(document.activeElement);
  }

  /** @internal */
  public override render() {
    return <NavigationPropertyTargetEditorInner ref={this._ref} {...this.props} />;
  }
}

const NavigationPropertyTargetEditorInner = React.forwardRef<NavigationPropertyTargetSelectorAttributes, PropertyEditorProps>((props, ref) => {
  const context = React.useContext(navigationPropertyEditorContext);
  if (!props.propertyRecord)
    return null;

  if (!context)
    return <ReadonlyNavigationPropertyTarget record={props.propertyRecord} />;

  return <NavigationPropertyTargetSelector
    {...props}
    ref={ref}
    imodel={context.imodel}
    getNavigationPropertyInfo={context.getNavigationPropertyInfo}
    propertyRecord={props.propertyRecord}
  />;
});
NavigationPropertyTargetEditorInner.displayName = "NavigationPropertyTargetEditorInner";
