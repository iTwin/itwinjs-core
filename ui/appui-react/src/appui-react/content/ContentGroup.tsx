/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
/** @packageDocumentation
 * @module ContentView
 */

import * as React from "react";
import { Logger } from "@itwin/core-bentley";
import { ScreenViewport } from "@itwin/core-frontend";
import { ContentLayoutProps, UiError } from "@itwin/appui-abstract";
import { ConfigurableCreateInfo, ConfigurableUiControlConstructor, ConfigurableUiControlType } from "../configurableui/ConfigurableUiControl";
import { ConfigurableUiManager } from "../configurableui/ConfigurableUiManager";
import { UiFramework } from "../UiFramework";
import { ContentControl } from "./ContentControl";
import { FrontstageProps } from "../frontstage/Frontstage";

/** Properties for content displayed in a content view
 * @public
 */
export interface ContentProps {
  /** A unique id for the Content View within the group */
  id: string;
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
  id: string;
  /** Content Layout Id or complete set of [[ContentLayoutProps]]  */
  layout: ContentLayoutProps;
  /** A collection of [[ContentProps]], one for each content view */
  contents: ContentProps[];
}

/** Abstract class that can be implemented and specified by frontstage to dynamically construct
 * content group just prior to activating the frontstage.
 * @public
 */
export abstract class ContentGroupProvider {
  abstract provideContentGroup(props: FrontstageProps): Promise<ContentGroup>;

  /** Allow provider to update any data stored in ContentGroupProps. Typically this may
   * be to remove applicationData entries.
   */
  public prepareToSaveProps(contentGroupProps: ContentGroupProps) {
    return contentGroupProps;
  }

  /** Allow provider to update any stored ContentGroupProps be it is to be used to create ContentGroup and layouts.
   * Typically this may be to add applicationData to content entries.
   */
  public applyUpdatesToSavedProps(contentGroupProps: ContentGroupProps) {
    return contentGroupProps;
  }

  /** Allow provider to save any content group data before the stage deactivated. */
  public async onFrontstageDeactivated() { }
}

/** Callback to process content properties during toJSON method
 * @public
 */
export type ContentCallback = (content: ContentProps) => void;

/** ContentGroup class. Content Groups define content displayed in content views that are laid out using a [[ContentLayout]].
 * @public
 */
export class ContentGroup {
  private static _sId = 0;
  public groupId: string;
  public propsId: string;
  public layout: ContentLayoutProps;
  public contentPropsList: ContentProps[];
  private _contentControls = new Map<string, ContentControl>();
  private _contentSetMap = new Map<string, ContentControl>();

  public get id() {
    return this.groupId;
  }

  constructor(contentGroupProps: ContentGroupProps) {
    this.layout = { ...contentGroupProps.layout };
    this.propsId = contentGroupProps.id;
    // ensure we have a unique groupId for each instance of a content group - this will be used to generate a key in the React controls
    this.groupId = `[${contentGroupProps.id}-${ContentGroup._sId++}]`;
    this.contentPropsList = contentGroupProps.contents;
  }

  /** Gets a [[ContentControl]] from the Content Group based on its [[ContentProps]]. */
  public getContentControl(contentProps: ContentProps, _index: number): ContentControl | undefined {
    // ensure we have a unique control Id for each instance of a content control - this will be used as a key for the React control - see `ContentControl.getKeyedReactNode`
    const id = `${contentProps.id}::${this.groupId}`;
    let contentControl: ContentControl | undefined;

    if (!this._contentControls.get(contentProps.id)) {
      let usedClassId: string = "";

      if (typeof contentProps.classId === "string") {
        if (!this._contentControls.get(contentProps.id) && ConfigurableUiManager.isControlRegistered(contentProps.classId)) {
          contentControl = ConfigurableUiManager.createControl(contentProps.classId, id, contentProps.applicationData, contentProps.id) as ContentControl;
          usedClassId = contentProps.classId;
        }
      } else {
        const info = new ConfigurableCreateInfo(contentProps.classId.name, id, contentProps.id);
        contentControl = new contentProps.classId(info, contentProps.applicationData) as ContentControl;
        usedClassId = contentProps.classId.name;
      }

      if (contentControl) {
        if (contentControl.getType() !== ConfigurableUiControlType.Content && contentControl.getType() !== ConfigurableUiControlType.Viewport) {
          throw new UiError(UiFramework.loggerCategory(this), `getContentControl error: '${usedClassId}' is NOT a ContentControl or ViewportContentControl`);
        }
        contentControl.initialize();
        this._contentControls.set(contentProps.id, contentControl);
      }
    }

    return this._contentControls.get(contentProps.id);
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
        contentNodes.push(control.reactNode);
        this._contentSetMap.set(control.controlId, control);
      }
    });

    return contentNodes;
  }

  /** Gets the [[ContentControl]] associated with a given React node representing a Content View. */
  public getControlFromElement(node: React.ReactNode): ContentControl | undefined {
    if (this._contentSetMap.size === 0)
      this.getContentNodes();

    if (node && (node as React.ReactElement<any>).key) {
      const key = ((node as React.ReactElement<any>).key as string);
      // key has format `${contentProps.id}::${this.groupId}` which is stored as unique id
      const controlId = key.split("::", 1)[0];
      return this._contentSetMap.get(controlId);
    }

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
   * @public
   */
  public toJSON(contentCallback?: ContentCallback): ContentGroupProps {
    const contentGroupProps: ContentGroupProps = {
      id: this.propsId,
      layout: this.layout,
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
