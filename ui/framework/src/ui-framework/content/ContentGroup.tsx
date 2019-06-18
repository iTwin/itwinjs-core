/*---------------------------------------------------------------------------------------------
* Copyright (c) 2019 Bentley Systems, Incorporated. All rights reserved.
* Licensed under the MIT License. See LICENSE.md in the project root for license terms.
*--------------------------------------------------------------------------------------------*/
/** @module ContentView */

import * as React from "react";

import { UiError } from "@bentley/ui-core";
import { ScreenViewport } from "@bentley/imodeljs-frontend";
import { Logger } from "@bentley/bentleyjs-core";

import { ContentControl } from "./ContentControl";
import { ConfigurableUiManager } from "../configurableui/ConfigurableUiManager";
import { ConfigurableUiControlType, ConfigurableUiControlConstructor, ConfigurableCreateInfo } from "../configurableui/ConfigurableUiControl";
import { UiFramework } from "../UiFramework";

/** Properties for content displayed in a content view
 * @public
 */
export interface ContentProps {
  /** An optional id for the Content View */
  id?: string;
  /** The class name or [[ConfigurableUiControlConstructor]] of the content control */
  classId: string | ConfigurableUiControlConstructor;
  /** Optional application data passed down to the Content View */
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

/** Callback to process content properties during toJSON method
 * @beta
 */
export type ContentCallback = (content: ContentProps) => void;

/** ContentGroup class. Content Groups define content displayed in content views that are laid out using a [[ContentLayout]].
 * @public
 */
export class ContentGroup {
  private static _sId = 0;

  public groupId: string;
  public contentPropsList: ContentProps[];
  private _contentControls = new Map<string, ContentControl>();
  private _contentSetMap = new Map<string, ContentControl>();

  constructor(groupProps: ContentGroupProps) {
    if (groupProps.id !== undefined)
      this.groupId = groupProps.id;
    else {
      ContentGroup._sId++;
      this.groupId = "ContentGroup-" + ContentGroup._sId;
    }

    this.contentPropsList = groupProps.contents;
  }

  /** Gets a [[ContentControl]] from the Content Group based on its [[ContentProps]]. */
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
          throw new UiError(UiFramework.loggerCategory(this), `getContentControl error: '${usedClassId}' is NOT a ContentControl or ViewportContentControl`);
        }
        contentControl.initialize();
        this._contentControls.set(id, contentControl);
      }
    }

    return this._contentControls.get(id);
  }

  /** Gets a [[ContentControl]] from the Content Group with a given ID. */
  public getContentControlById(id: string): ContentControl | undefined {
    return this._contentControls.get(id);
  }

  /** Gets the React nodes representing the Content Views in this Content Group. */
  public getContentNodes(): React.ReactNode[] {
    const contentNodes: React.ReactNode[] = new Array<React.ReactNode>();

    this._contentSetMap.clear();

    this.contentPropsList.forEach((contentProps: ContentProps, index: number) => {
      const control = this.getContentControl(contentProps, index);
      if (control) {
        contentNodes.push(control.reactElement);
        this._contentSetMap.set(control.controlId, control);
      }
    });

    return contentNodes;
  }

  /** Gets the [[ContentControl]] associated with a given React node representing a Content View. */
  public getControlFromElement(node: React.ReactNode): ContentControl | undefined {
    if (this._contentSetMap.size === 0)
      this.getContentNodes();

    if (node && (node as React.ReactElement<any>).key)
      return this._contentSetMap.get((node as React.ReactElement<any>).key as string);

    Logger.logError(UiFramework.loggerCategory(this), `getControlFromElement: no control found for element`);
    return undefined;
  }

  /** Refreshes the React nodes representing the Content Views in this Content Group.. */
  public refreshContentNodes() {
    this._contentSetMap.clear();
  }

  /** Gets an array of the content controls representing the Content Views. */
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

  /** Creates [[ContentGroupProps]] for JSON purposes
   * @beta
   */
  public toJSON(contentCallback?: ContentCallback): ContentGroupProps {
    const contentGroupProps: ContentGroupProps = {
      id: this.groupId,
      contents: this.contentPropsList,
    };

    contentGroupProps.contents.forEach((content: ContentProps, index: number) => {
      if (typeof content.classId !== "string") {
        const classId = ConfigurableUiManager.getConstructorClassId(content.classId);
        if (classId !== undefined)
          content.classId = classId;
        else
          throw new UiError(UiFramework.loggerCategory(this), `toJSON: ContentControl at index ${index} is NOT registered with a string id`);

        if (contentCallback)
          contentCallback(content);
      }
    });

    return contentGroupProps;
  }

  /** Gets Viewports from Viewport Content Controls
   * @internal
   */
  public getViewports(): Array<ScreenViewport | undefined> {
    const contentControls = this.getContentControls();
    const viewports = new Array<ScreenViewport | undefined>();

    contentControls.forEach((control: ContentControl) => {
      if (control.isViewport && control.viewport) {
        viewports.push(control.viewport);
      } else {
        viewports.push(undefined);
      }
    });

    return viewports;
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
      throw new UiError(UiFramework.loggerCategory(this), `loadGroup: ContentGroupProps should contain an id`);
  }

  public static findGroup(groupId: string): ContentGroup | undefined {
    return this._groups.get(groupId);
  }

  public static addGroup(groupId: string, group: ContentGroup) {
    this._groups.set(groupId, group);
  }
}
