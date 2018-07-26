/*---------------------------------------------------------------------------------------------
| $Copyright: (c) 2018 Bentley Systems, Incorporated. All rights reserved. $
 *--------------------------------------------------------------------------------------------*/
/** @module ContentGroup */

import { ContentControl } from "./ContentControl";
import { ConfigurableUiManager } from "./ConfigurableUiManager";
import { StandardViewId } from "@bentley/imodeljs-frontend";

// -----------------------------------------------------------------------------
// ContentGroupDef and associated enums & interfaces
// -----------------------------------------------------------------------------

/** Enumeration for the iModel view class */
export enum ViewClass {
  Drawing,
  Sheet,
  Orthographic,
  Camera,
}

/** Interface for the definition of a color */
export interface ColorDef {
  r: number;
  g: number;
  b: number;
  a: number;
}

/** Interface for the definition of a view specification */
export interface ViewSpecDef {
  viewDefinitionClass: ViewClass;
  viewRotation: StandardViewId;
}

/** Properties for content displayed in a content view */
export interface ContentProps {
  id?: string;
  classId: string;

  featureId?: string;
  sourceFile?: string;

  backgroundColor?: ColorDef;
  defaultViewSpec?: ViewSpecDef;

  applicationData?: any;
}

/** Properties for a [[ContentGroup]] */
export interface ContentGroupProps {
  id?: string;
  contents: ContentProps[];
}

// -----------------------------------------------------------------------------
// ContentGroup class
// -----------------------------------------------------------------------------

/** ContentGroup class. ContentGroups define content displayed in content views that are laid out using a [ContentLayout].
 */
export class ContentGroup {
  private static sId: number;

  public groupId: string;
  public contentPropsList: ContentProps[];
  private _contentControls = new Map<string, ContentControl>();

  constructor(groupProps: ContentGroupProps) {
    if (groupProps.id !== undefined)
      this.groupId = groupProps.id;
    else {
      ContentGroup.sId++;
      this.groupId = "ContentGroup-" + ContentGroup.sId;
    }

    this.contentPropsList = groupProps.contents;
  }

  public getContentControl(contentProps: ContentProps, index: number): ContentControl | undefined {
    let id: string;
    if (contentProps.id !== undefined)
      id = contentProps.id;
    else
      id = this.groupId + "-" + index;

    // TODO - should this call getContentControl if widget is sharable
    if (!this._contentControls.get(id)) {
      this._contentControls.set(id, ConfigurableUiManager.createConfigurable(contentProps.classId, id, contentProps.applicationData) as ContentControl);
    }

    return this._contentControls.get(id);
  }

  public getContentSet(): React.ReactNode[] {
    const contentControls: React.ReactNode[] = new Array<React.ReactNode>();

    this.contentPropsList.map((contentProps: ContentProps, index: number) => {
      const control = this.getContentControl(contentProps, index);
      if (control)
        contentControls.push(control.reactElement);
    });

    return contentControls;
  }

}

// -----------------------------------------------------------------------------
// ContentGroupManager class
// -----------------------------------------------------------------------------

/** ContentGroup Manager class.
 */
export class ContentGroupManager {
  private static _groups: { [groupId: string]: ContentGroup } = {};

  public static loadContentGroups(groupPropsList: ContentGroupProps[]) {
    groupPropsList.map((groupProps, _index) => {
      this.loadGroupProps(groupProps);
    });
  }

  public static loadGroupProps(groupProps: ContentGroupProps) {
    const group = new ContentGroup(groupProps);
    if (groupProps.id)
      this.addGroup(groupProps.id, group);
    else
      throw Error();
  }

  public static findGroup(groupId: string): ContentGroup {
    return this._groups[groupId];
  }

  public static addGroup(groupId: string, group: ContentGroup) {
    this._groups[groupId] = group;
  }
}
