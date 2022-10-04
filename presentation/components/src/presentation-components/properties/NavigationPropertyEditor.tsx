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
 * @alpha
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

/** @alpha */
export interface NavigationPropertyEditorContextProps {
  imodel: IModelConnection;
  getNavigationPropertyInfo: (property: PropertyDescription) => Promise<NavigationPropertyInfo | undefined>;
}

/** @alpha */
export const NavigationPropertyEditorContext = React.createContext<NavigationPropertyEditorContextProps | undefined>(undefined);

/** @alpha */
export function useNavigationPropertyEditingContextProps(imodel: IModelConnection, dataProvider: IContentDataProvider): NavigationPropertyEditorContextProps {
  return React.useMemo<NavigationPropertyEditorContextProps>(() => ({
    imodel,
    getNavigationPropertyInfo: async (property) => {
      const field = await dataProvider.getFieldByPropertyRecord(new PropertyRecord({ valueFormat: PropertyValueFormat.Primitive }, property));
      if (!field || !field.isPropertiesField())
        return undefined;
      return field.properties[0].property.navigationPropertyInfo;
    },
  }), [imodel, dataProvider]);
}

/** @alpha */
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
    if (!this._ref.current || !document.activeElement)
      return false;
    return document.activeElement.contains(this._ref.current.divElement);
  }

  /** @internal */
  public override render() {
    return <NavigationPropertyTargetEditorInner ref={this._ref} {...this.props} />;
  }
}

const NavigationPropertyTargetEditorInner = React.forwardRef<NavigationPropertyTargetSelectorAttributes, PropertyEditorProps>((props, ref) => {
  const navigationPropertyEditorContext = React.useContext(NavigationPropertyEditorContext);
  if (!props.propertyRecord)
    return null;

  if (!navigationPropertyEditorContext)
    return <ReadonlyNavigationPropertyTarget record={props.propertyRecord} />;

  return <NavigationPropertyTargetSelector
    {...props}
    ref={ref}
    imodel={navigationPropertyEditorContext.imodel}
    getNavigationPropertyInfo={navigationPropertyEditorContext.getNavigationPropertyInfo}
    propertyRecord={props.propertyRecord}
  />;
});
NavigationPropertyTargetEditorInner.displayName = "NavigationPropertyTargetEditorInner";
