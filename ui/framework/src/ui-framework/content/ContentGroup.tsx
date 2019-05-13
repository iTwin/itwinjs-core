/*---------------------------------------------------------------------------------------------
* Copyright (c) 2019 Bentley Systems, Incorporated. All rights reserved.
* Licensed under the MIT License. See LICENSE.md in the project root for license terms.
*--------------------------------------------------------------------------------------------*/
/** @module ContentView */

import * as React from "react";

import { ContentControl } from "./ContentControl";
import { ConfigurableUiManager } from "../configurableui/ConfigurableUiManager";
import { ConfigurableUiControlType, ConfigurableUiControlConstructor, ConfigurableCreateInfo } from "../configurableui/ConfigurableUiControl";

/** Properties for content displayed in a content view
 * @public
 */
export interface ContentProps {
  /** An optional id for the Content View */
  id?: string;
  /** The class name or [[ConfigurableUiControlConstructor]] of the content control */
  classId: string | ConfigurableUiControlConstructor;
  /** Optional application data passed down the the Content View */
  applicationData?: any;
}

/** Properties for a [[ContentGroup]]
 * @public
 */
export interface ContentGroupProps {
  /** An optional id for the [[ContentGroup]] */
  id?: string;
  /** A collection of [[ContentProps]], one for each content view */
  contents: ContentProps[];
}

// -----------------------------------------------------------------------------
// ContentGroup class
// -----------------------------------------------------------------------------

/** ContentGroup class. ContentGroups define content displayed in content views that are laid out using a [[ContentLayout]].
 * @public
 */
export class ContentGroup {
  private static _sId = 0;

  public groupId: string;
  public contentPropsList: ContentProps[];
  private _contentControls = new Map<string, ContentControl>();
  private _contentSetMap = new Map<React.ReactNode, ContentControl>();

  constructor(groupProps: ContentGroupProps) {
    if (groupProps.id !== undefined)
      this.groupId = groupProps.id;
    else {
      ContentGroup._sId++;
      this.groupId = "ContentGroup-" + ContentGroup._sId;
    }

    this.contentPropsList = groupProps.contents;
  }

  public getContentControl(contentProps: ContentProps, index: number): ContentControl | undefined {
    let id: string;
    if (contentProps.id !== undefined)
      id = contentProps.id;
    else
      id = this.groupId + "-" + index;

    let contentControl: ContentControl | undefined;

    if (!this._contentControls.get(id)) {
      let usedClassId: string = "";

      if (typeof contentProps.classId === "string") {
        if (!this._contentControls.get(id) && ConfigurableUiManager.isControlRegistered(contentProps.classId)) {
          contentControl = ConfigurableUiManager.createControl(contentProps.classId, id, contentProps.applicationData) as ContentControl;
          usedClassId = contentProps.classId;
        }
      } else {
        const info = new ConfigurableCreateInfo(contentProps.classId.name, id, id);
        contentControl = new contentProps.classId(info, contentProps.applicationData) as ContentControl;
        usedClassId = contentProps.classId.name;
      }

      if (contentControl) {
        if (contentControl.getType() !== ConfigurableUiControlType.Content && contentControl.getType() !== ConfigurableUiControlType.Viewport) {
          throw Error("ContentGroup.getContentControl error: '" + usedClassId + "' is NOT a ContentControl or ViewportContentControl");
        }
        contentControl.initialize();
        this._contentControls.set(id, contentControl);
      }
    }

    return this._contentControls.get(id);
  }

  public getContentNodes(): React.ReactNode[] {
    const contentNodes: React.ReactNode[] = new Array<React.ReactNode>();

    this._contentSetMap.clear();

    this.contentPropsList.forEach((contentProps: ContentProps, index: number) => {
      const control = this.getContentControl(contentProps, index);
      if (control) {
        contentNodes.push(control.reactElement);
        this._contentSetMap.set(control.reactElement, control);
      }
    });

    return contentNodes;
  }

  public getControlFromElement(node: React.ReactNode): ContentControl | undefined {
    if (this._contentSetMap.size === 0)
      this.getContentNodes();

    return this._contentSetMap.get(node);
  }

  public getContentControls(): ContentControl[] {
    const contentControls: ContentControl[] = new Array<ContentControl>();

    this.contentPropsList.forEach((contentProps: ContentProps, index: number) => {
      const control = this.getContentControl(contentProps, index);
      if (control) {
        contentControls.push(control);
      }
    });

    return contentControls;
  }

  /** Called when Frontstage is deactivated. */
  public onFrontstageDeactivated(): void {
    this.clearContentControls();
  }

  /** Called when Frontstage is ready. */
  public onFrontstageReady(): void { }

  /** Clears the map of content controls. */
  public clearContentControls(): void {
    this._contentControls.clear();
  }

}

// -----------------------------------------------------------------------------
// ContentGroupManager class
// -----------------------------------------------------------------------------

/** ContentGroup Manager class.
 * @public
 */
export class ContentGroupManager {
  private static _groups: Map<string, ContentGroup> = new Map<string, ContentGroup>();

  public static loadGroups(groupPropsList: ContentGroupProps[]) {
    groupPropsList.map((groupProps, _index) => {
      this.loadGroup(groupProps);
    });
  }

  public static loadGroup(groupProps: ContentGroupProps) {
    const group = new ContentGroup(groupProps);
    if (groupProps.id)
      this.addGroup(groupProps.id, group);
    else
      throw Error();
  }

  public static findGroup(groupId: string): ContentGroup | undefined {
    return this._groups.get(groupId);
  }

  public static addGroup(groupId: string, group: ContentGroup) {
    this._groups.set(groupId, group);
  }
}
