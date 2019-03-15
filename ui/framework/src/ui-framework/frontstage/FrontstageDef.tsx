/*---------------------------------------------------------------------------------------------
* Copyright (c) 2019 Bentley Systems, Incorporated. All rights reserved.
* Licensed under the MIT License. See LICENSE.md in the project root for license terms.
*--------------------------------------------------------------------------------------------*/
/** @module Frontstage */

import * as React from "react";
import { FrontstageManager } from "./FrontstageManager";
import { ZoneDef } from "../zones/ZoneDef";
import { ContentLayoutManager, ContentLayoutDef } from "../content/ContentLayout";
import { ContentControl } from "../content/ContentControl";
import { ContentGroup, ContentGroupManager } from "../content/ContentGroup";
import { WidgetDef } from "../widgets/WidgetDef";
import { WidgetControl } from "../widgets/WidgetControl";
import { Frontstage } from "./Frontstage";
import { FrontstageProvider } from "./FrontstageProvider";

import { NineZoneProps } from "@bentley/ui-ninezone";
import { IModelApp } from "@bentley/imodeljs-frontend";
import { ToolItemDef } from "../shared/Item";
import { StagePanelDef } from "../stagepanels/StagePanelDef";
import { StagePanelLocation } from "../stagepanels/StagePanel";

/** FrontstageDef class provides an API for a Frontstage.
 */
export class FrontstageDef {
  public id: string = "";
  public defaultTool?: ToolItemDef;
  public defaultLayoutId: string = "";
  public defaultContentId: string = "";
  public contentGroupId: string = "";

  public isInFooterMode: boolean = true;
  public applicationData?: any;

  // TODO
  public inheritZoneStates: boolean = true;
  public hubEnabled: boolean = false;
  public contextToolbarEnabled: boolean = false;

  public topLeft?: ZoneDef;
  public topCenter?: ZoneDef;
  public topRight?: ZoneDef;
  public centerLeft?: ZoneDef;
  public centerRight?: ZoneDef;
  public bottomLeft?: ZoneDef;
  public bottomCenter?: ZoneDef;
  public bottomRight?: ZoneDef;

  public topPanel?: StagePanelDef;
  public topMostPanel?: StagePanelDef;
  public leftPanel?: StagePanelDef;
  public rightPanel?: StagePanelDef;
  public bottomPanel?: StagePanelDef;
  public bottomMostPanel?: StagePanelDef;

  public defaultLayout?: ContentLayoutDef;
  public contentGroup?: ContentGroup;
  public frontstageProvider?: FrontstageProvider;
  public nineZoneProps?: NineZoneProps;

  /** Constructs the [[FrontstageDef]]  */
  constructor() { }

  /** Handles when the Frontstage becomes activated */
  public onActivated(): void {
    if (!this.defaultLayout) {
      this.defaultLayout = ContentLayoutManager.findLayout(this.defaultLayoutId);
      if (!this.defaultLayout)
        throw Error("Content Layout '" + this.defaultLayoutId + "' not registered");
    }
    if (!this.contentGroup) {
      this.contentGroup = ContentGroupManager.findGroup(this.contentGroupId);
      if (!this.contentGroup)
        throw Error("Content Group '" + this.contentGroupId + "' not registered");
    }

    const activeLayout = this.defaultLayout!;
    ContentLayoutManager.setActiveLayout(activeLayout, this.contentGroup);
  }

  /** Handles when the Frontstage becomes inactive */
  public onDeactivated(): void {
    for (const control of this._widgetControls) {
      control.onFrontstageDeactivated();
    }

    for (const control of this.contentControls) {
      control.onFrontstageDeactivated();
    }

    if (this.contentGroup)
      this.contentGroup.onFrontstageDeactivated();
  }

  /** Returns once the contained widgets and content controls are ready to use */
  public async waitUntilReady(): Promise<void> {
    // create an array of control-ready promises
    const controlReadyPromises = new Array<Promise<void>>();
    this._widgetControls.forEach((control: WidgetControl) => {
      controlReadyPromises.push(control.isReady);
    });

    if (ContentLayoutManager.activeLayout) {
      const usedContentIndexes = ContentLayoutManager.activeLayout.getUsedContentIndexes();
      this.contentControls.forEach((control: ContentControl, index: number) => {
        if (usedContentIndexes.includes(index))
          controlReadyPromises.push(control.isReady);
      });
    }

    return Promise.all(controlReadyPromises)
      .then(() => {
        // Frontstage ready
      });
  }

  /** Handles when the Frontstage becomes active */
  public onFrontstageReady(): void {
    for (const control of this._widgetControls) {
      control.onFrontstageReady();
    }

    for (const control of this.contentControls) {
      control.onFrontstageReady();
    }

    // istanbul ignore else
    if (this.contentGroup)
      this.contentGroup.onFrontstageReady();
  }

  /** Starts the default tool for the Frontstage */
  public startDefaultTool(): void {
    // Start the default tool
    if (this.defaultTool && IModelApp.toolAdmin && IModelApp.viewManager) {
      IModelApp.toolAdmin.defaultToolId = this.defaultTool.toolId;
      this.defaultTool.execute();
    }
  }

  /** Sets the active view content control */
  public setActiveView(newContent: ContentControl, oldContent?: ContentControl): void {
    if (oldContent)
      oldContent.onDeactivated();
    newContent.onActivated();
    FrontstageManager.onContentControlActivatedEvent.emit({ activeContentControl: newContent, oldContentControl: oldContent });
  }

  /** Gets a [[ZoneDef]] based on a given zone id */
  public getZoneDef(zoneId: number): ZoneDef | undefined {
    let zoneDef;

    switch (zoneId) {
      case 1:
        zoneDef = this.topLeft;
        break;
      case 2:
        zoneDef = this.topCenter;
        break;
      case 3:
        zoneDef = this.topRight;
        break;
      case 4:
        zoneDef = this.centerLeft;
        break;
      case 6:
        zoneDef = this.centerRight;
        break;
      case 7:
        zoneDef = this.bottomLeft;
        break;
      case 8:
        zoneDef = this.bottomCenter;
        break;
      case 9:
        zoneDef = this.bottomRight;
        break;
      // istanbul ignore default
      default:
        throw new RangeError();
    }

    // Zones can be undefined in a Frontstage

    return zoneDef;
  }

  /** Gets a list of [[ZoneDef]]s */
  public get zoneDefs(): ZoneDef[] {
    const zones = [1, 2, 3, 4, 6, 7, 8, 9];
    const zoneDefs: ZoneDef[] = [];

    zones.forEach((zoneId) => {
      const zoneDef = this.getZoneDef(zoneId);
      if (zoneDef)
        zoneDefs.push(zoneDef);
    });

    return zoneDefs;
  }

  /** Gets a [[StagePanelDef]] based on a given panel location */
  public getStagePanelDef(location: StagePanelLocation): StagePanelDef | undefined {
    let panelDef: StagePanelDef | undefined;

    switch (location) {
      case StagePanelLocation.Top:
        panelDef = this.topPanel;
        break;
      case StagePanelLocation.TopMost:
        panelDef = this.topMostPanel;
        break;
      case StagePanelLocation.Left:
        panelDef = this.leftPanel;
        break;
      case StagePanelLocation.Right:
        panelDef = this.rightPanel;
        break;
      case StagePanelLocation.Bottom:
        panelDef = this.bottomPanel;
        break;
      case StagePanelLocation.BottomMost:
        panelDef = this.bottomMostPanel;
        break;
      // istanbul ignore default
      default:
        throw new RangeError();
    }

    // Panels can be undefined in a Frontstage

    return panelDef;
  }

  /** Gets a list of [[StagePanelDef]]s */
  public get panelDefs(): StagePanelDef[] {
    const panels = [StagePanelLocation.Left];
    const panelDefs: StagePanelDef[] = [];

    panels.forEach((location: StagePanelLocation) => {
      const panelDef = this.getStagePanelDef(location);
      if (panelDef)
        panelDefs.push(panelDef);
    });

    return panelDefs;
  }

  /** Finds a [[WidgetDef]] based on a given id */
  public findWidgetDef(id: string): WidgetDef | undefined {
    for (const zoneDef of this.zoneDefs) {
      const widgetDef = zoneDef.findWidgetDef(id);
      if (widgetDef)
        return widgetDef;
    }

    for (const panelDef of this.panelDefs) {
      const widgetDef = panelDef.findWidgetDef(id);
      if (widgetDef)
        return widgetDef;
    }

    return undefined;
  }

  /** Gets the list of [[WidgetControl]]s */
  private get _widgetControls(): WidgetControl[] {
    const widgetControls = new Array<WidgetControl>();

    this.zoneDefs.forEach((zoneDef: ZoneDef) => {
      zoneDef.widgetDefs.forEach((widgetDef: WidgetDef) => {
        const widgetControl = widgetDef.widgetControl;
        if (widgetControl)
          widgetControls.push(widgetControl);
      });
    });

    this.panelDefs.forEach((panelDef: StagePanelDef) => {
      panelDef.widgetDefs.forEach((widgetDef: WidgetDef) => {
        const widgetControl = widgetDef.widgetControl;
        if (widgetControl)
          widgetControls.push(widgetControl);
      });
    });

    return widgetControls;
  }

  /** Gets the list of [[ContentControl]]s */
  public get contentControls(): ContentControl[] {
    if (this.contentGroup) {
      return this.contentGroup.getContentControls();
    }
    return [];
  }

  /**
   * Initializes this [[FrontstageDef]] from a [[FrontstageProvider]]
   * @param frontstageProvider The FrontstageProvider to initialize from
   */
  public initializeFromProvider(frontstageProvider: FrontstageProvider) {
    // istanbul ignore else
    if (frontstageProvider.frontstage && React.isValidElement(frontstageProvider.frontstage)) {
      Frontstage.initializeFrontstageDef(this, frontstageProvider.frontstage.props);
      this.frontstageProvider = frontstageProvider;
    }
  }

}
