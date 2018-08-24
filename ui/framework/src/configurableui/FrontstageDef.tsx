/*---------------------------------------------------------------------------------------------
| $Copyright: (c) 2018 Bentley Systems, Incorporated. All rights reserved. $
 *--------------------------------------------------------------------------------------------*/
/** @module Frontstage */

import { FrontstageManager } from "./FrontstageManager";
import { ZoneProps, ZoneDef, ZoneDefFactory } from "./ZoneDef";
import { ToolItemDef } from "./Item";
import { ItemDefBase } from "./ItemDefBase";
import { ItemPropsList } from "./ItemProps";
import { ContentLayoutManager, ContentLayoutDef } from "./ContentLayout";
import { ContentControl } from "./ContentControl";
import { ItemMap } from "./ItemFactory";
import { ContentGroup } from "./ContentGroup";
import { ContentGroupManager } from "./ContentGroup";
import { WidgetDef } from "./WidgetDef";

// -----------------------------------------------------------------------------
// FrontstageProps and associated enums
// -----------------------------------------------------------------------------

/** Stage Type enum.
 */
export enum StageType {
  Primary,
  Temporary,
  Modal,
}

/** Selection Scope enum.
 */
export enum SelectionScope {
  Element,
  Assembly,
  TopAssembly,
  Category,
  Model,
}

/** Props for a Frontstage.
 */
export interface FrontstageProps extends ItemPropsList {
  id: string;
  defaultToolId: string;

  defaultLayout: string | ContentLayoutDef;
  contentGroup: string | ContentGroup;

  defaultContentId?: string;

  type?: StageType;                             // Default - StageType.Primary
  inheritZoneStates?: boolean;                  // Default - true
  hubEnabled?: boolean;                         // Default - false
  contextToolbarEnabled?: boolean;              // Default - false
  isInFooterMode?: boolean;                     // Default - true
  defaultSelectionScope?: SelectionScope;       // Default - SelectionScope.Element
  availableSelectionScopes?: SelectionScope[];  // Defaults - SelectionScope.Element, Assembly, TopAssembly, Category, Model

  topLeft?: ZoneProps;
  topCenter?: ZoneProps;
  topRight?: ZoneProps;
  centerLeft?: ZoneProps;
  centerRight?: ZoneProps;
  bottomLeft?: ZoneProps;
  bottomCenter?: ZoneProps;
  bottomRight?: ZoneProps;

  applicationData?: any;
}

// -----------------------------------------------------------------------------
// FrontstageDef class
// -----------------------------------------------------------------------------

/** FrontstageDef class.
 */
export class FrontstageDef {
  public id: string = "";
  public defaultToolId: string = "";
  public defaultLayoutId: string = "";
  public defaultContentId: string = "";
  public contentGroupId: string = "";

  public type?: StageType = StageType.Primary;
  public inheritZoneStates: boolean = true;
  public hubEnabled: boolean = false;
  public contextToolbarEnabled: boolean = false;
  public isInFooterMode: boolean = true;
  public defaultSelectionScope: SelectionScope = SelectionScope.Element;
  public availableSelectionScopes: SelectionScope[] = [
    SelectionScope.Element,
    SelectionScope.Assembly,
    SelectionScope.TopAssembly,
    SelectionScope.Category,
    SelectionScope.Model,
  ];
  public applicationData?: any;

  public items: ItemMap = new ItemMap();

  public topLeft?: ZoneDef;
  public topCenter?: ZoneDef;
  public topRight?: ZoneDef;
  public centerLeft?: ZoneDef;
  public centerRight?: ZoneDef;
  public bottomLeft?: ZoneDef;
  public bottomCenter?: ZoneDef;
  public bottomRight?: ZoneDef;

  private _activeToolItem: ToolItemDef | undefined;
  public defaultLayout: ContentLayoutDef | undefined;
  public contentGroup: ContentGroup | undefined;

  constructor(frontstageProps: FrontstageProps) {
    if (frontstageProps) {
      this.id = frontstageProps.id;
      this.defaultToolId = frontstageProps.defaultToolId;

      if (frontstageProps.defaultContentId !== undefined)
        this.defaultContentId = frontstageProps.defaultContentId;

      if (typeof frontstageProps.defaultLayout === "string")
        this.defaultLayoutId = frontstageProps.defaultLayout;
      else
        this.defaultLayout = frontstageProps.defaultLayout;

      if (typeof frontstageProps.contentGroup === "string")
        this.contentGroupId = frontstageProps.contentGroup;
      else
        this.contentGroup = frontstageProps.contentGroup;

      if (frontstageProps.type !== undefined)
        this.type = frontstageProps.type;
      if (frontstageProps.inheritZoneStates !== undefined)
        this.inheritZoneStates = frontstageProps.inheritZoneStates;
      if (frontstageProps.hubEnabled !== undefined)
        this.hubEnabled = frontstageProps.hubEnabled;
      if (frontstageProps.contextToolbarEnabled !== undefined)
        this.contextToolbarEnabled = frontstageProps.contextToolbarEnabled;
      if (frontstageProps.isInFooterMode !== undefined)
        this.isInFooterMode = frontstageProps.isInFooterMode;
      if (frontstageProps.defaultSelectionScope !== undefined)
        this.defaultSelectionScope = frontstageProps.defaultSelectionScope;
      if (frontstageProps.availableSelectionScopes !== undefined)
        this.availableSelectionScopes = frontstageProps.availableSelectionScopes;
      if (frontstageProps.applicationData !== undefined)
        this.applicationData = frontstageProps.applicationData;

      this.items.loadItems(frontstageProps);

      this.topLeft = ZoneDefFactory.Create(frontstageProps.topLeft);
      this.topCenter = ZoneDefFactory.Create(frontstageProps.topCenter);
      this.topRight = ZoneDefFactory.Create(frontstageProps.topRight);
      this.centerLeft = ZoneDefFactory.Create(frontstageProps.centerLeft);
      this.centerRight = ZoneDefFactory.Create(frontstageProps.centerRight);
      this.bottomLeft = ZoneDefFactory.Create(frontstageProps.bottomLeft);
      this.bottomCenter = ZoneDefFactory.Create(frontstageProps.bottomCenter);
      this.bottomRight = ZoneDefFactory.Create(frontstageProps.bottomRight);
    }
  }

  public findItem(id: string): ItemDefBase | undefined {
    return this.items.get(id);
  }

  public get activeToolId(): string {
    return (this._activeToolItem) ? this._activeToolItem.id : "";
  }

  public get activeToolItem(): ToolItemDef | undefined {
    return this._activeToolItem;
  }

  // TODO - connect to Redux
  public setActiveToolItem(toolItem: ToolItemDef): void {
    this._activeToolItem = toolItem;
    toolItem.onActivated();
    FrontstageManager.ToolActivatedEvent.emit({ toolId: toolItem.id, toolItem });
  }

  public onActivated(): void {
    if (!this.defaultLayout) {
      this.defaultLayout = ContentLayoutManager.findLayout(this.defaultLayoutId);
    }
    if (!this.contentGroup) {
      this.contentGroup = ContentGroupManager.findGroup(this.contentGroupId);
    }

    FrontstageManager.ContentLayoutActivatedEvent.emit({ contentLayout: this.defaultLayout!, contentGroup: this.contentGroup });

    this.zoneDefs.map((zoneDef: ZoneDef) => {
      zoneDef.clearDefaultOpenUsed();
    });
  }

  public setActiveView(newContent: ContentControl): void {
    FrontstageManager.ContentControlActivatedEvent.emit({ contentControl: newContent });
  }

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
      default:
        throw new RangeError();
    }

    // Zones can be undefined in a Frontstage

    return zoneDef;
  }

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

  public findWidgetDef(id: string): WidgetDef | undefined {
    for (const zoneDef of this.zoneDefs) {
      const widgetDef = zoneDef.findWidgetDef(id);
      if (widgetDef)
        return widgetDef;
    }
    return undefined;
  }

}
