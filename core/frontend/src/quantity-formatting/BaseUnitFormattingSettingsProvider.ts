/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
/** @packageDocumentation
 * @module QuantityFormatting
 */

import { FormatProps, UnitSystemKey } from "@itwin/core-quantity";
import { IModelApp } from "../IModelApp";
import { IModelConnection } from "../IModelConnection";
import { SelectedViewportChangedArgs } from "../ViewManager";
import {
  FormattingUnitSystemChangedArgs, OverrideFormatEntry, QuantityFormatOverridesChangedArgs, QuantityFormatter,
  QuantityTypeKey, UnitFormattingSettingsProvider,
} from "./QuantityFormatter";

/** This abstract class reacts to changes in the "active" iModel and updates the [[QuantityFormatter]] overrides and active
 * presentation unit system based on stored preferences.  In addition, monitors the [[QuantityFormatter]] for changes to format overrides and the active
 * unit system and stores these changes. The "active" iModel is determined by listening to the `IModelApp.viewManager.onSelectedViewportChanged` event
 * and gets the iModel from the selected viewport.
 * @beta
 */
export abstract class BaseUnitFormattingSettingsProvider implements UnitFormattingSettingsProvider {
  protected _imodelConnection: IModelConnection | undefined;

  /**
   * @param maintainOverridesPerIModel If maintainOverridesPerIModel is true the base class will set up listeners
   * to monitor "active" iModel changes so the overrides for the QuantityFormatter properly match the overrides set
   * up by the user. If false then the overrides are maintained only per user.
   * @beta
   */
  constructor(private _quantityFormatter: QuantityFormatter, private _maintainOverridesPerIModel?: boolean) {
    if (this._maintainOverridesPerIModel) {
      IModelApp.viewManager.onSelectedViewportChanged.addListener(this.handleViewportChanged);
      IModelConnection.onOpen.addListener(this.handleIModelOpen);
      IModelConnection.onClose.addListener(this.handleIModelClose);
    }
  }

  public get maintainOverridesPerIModel(): boolean {
    return !!this._maintainOverridesPerIModel;
  }

  public storeFormatOverrides = async ({typeKey, overrideEntry, unitSystem}: QuantityFormatOverridesChangedArgs) => {
    if (undefined === overrideEntry) {
      // remove all overrides for quantity type
      if (undefined === unitSystem) {
        await this.remove (typeKey);
        return;
      }else {
        // remove only system specific overrides for quantity type
        const storedJson = await this.retrieve (typeKey);
        if (storedJson) {
          delete storedJson[unitSystem];
          if (Object.keys(storedJson).length) {
            await this.store (typeKey, storedJson);
          } else {
            await this.remove (typeKey);
          }
        }
      }
    } else {
      // setting a new override or set of overrides
      const storedJson = await this.retrieve (typeKey);
      const updatedFormat = {...storedJson, ...overrideEntry};
      await this.store (typeKey, updatedFormat);
    }
  };

  /** save UnitSystem for active iModel */
  public storeUnitSystemSetting = async ({system}: FormattingUnitSystemChangedArgs) => {
    await this.storeUnitSystemKey(system);
  };

  public async loadOverrides(imodel?: IModelConnection): Promise<void> {
    await this.applyQuantityFormattingSettingsForIModel(imodel);
  }

  protected applyQuantityFormattingSettingsForIModel = async (imodel?: IModelConnection) => {
    if (this._maintainOverridesPerIModel)
      this._imodelConnection = imodel;
    const overrideFormatProps = await this.buildQuantityFormatOverridesMap();
    const unitSystemKey = await this.retrieveUnitSystem (this._quantityFormatter.activeUnitSystem);
    await this._quantityFormatter.reinitializeFormatAndParsingsMaps(overrideFormatProps, unitSystemKey, true, true);
  };

  private handleIModelOpen = async (imodel: IModelConnection) => {
    await this.applyQuantityFormattingSettingsForIModel (imodel);
  };

  private handleViewportChanged = async (args: SelectedViewportChangedArgs) => {
    if(args.current?.iModel && (args.current?.iModel?.iModelId !== this.imodelConnection?.iModelId)) {
      await this.applyQuantityFormattingSettingsForIModel (args.current?.iModel);
    }
  };

  private handleIModelClose = async () => {
    this._imodelConnection = undefined;
  };

  protected get imodelConnection() {
    return  this._imodelConnection;
  }

  /** function to convert from serialized JSON format for Quantity Type overrides to build a map compatible with QuantityManager */
  protected async buildQuantityFormatOverridesMap() {
    const overrideFormatProps = new Map<UnitSystemKey, Map<QuantityTypeKey, FormatProps>>();

    // use map and await all returned promises - overrides are stored by QuantityType
    for await (const quantityTypeKey of [...this._quantityFormatter.quantityTypesRegistry.keys()]) {
      const quantityTypeDef = this._quantityFormatter.quantityTypesRegistry.get(quantityTypeKey);
      if (quantityTypeDef) {
        const typeKey = quantityTypeDef.key;
        const overrideEntry = await this.retrieve (typeKey);
        if (overrideEntry) {
          // extract overrides and insert into appropriate override map entry
          Object.keys(overrideEntry).forEach ((systemKey) => {
            const unitSystemKey = systemKey as UnitSystemKey;
            const props = overrideEntry[unitSystemKey];
            if (props) {
              if (overrideFormatProps.has(unitSystemKey)) {
                overrideFormatProps.get(unitSystemKey)!.set(typeKey, props);
              } else {
                const newMap = new Map<string, FormatProps>();
                newMap.set(typeKey, props);
                overrideFormatProps.set(unitSystemKey, newMap);
              }
            }
          });
        }
      }
    }
    return overrideFormatProps;
  }

  /** Serializes JSON object containing format overrides for a specific quantity type. */
  abstract store(quantityTypeKey: QuantityTypeKey, overrideProps: OverrideFormatEntry): Promise<boolean>;

  /** Retrieves serialized JSON object containing format overrides for a specific quantity type. */
  abstract retrieve(quantityTypeKey: QuantityTypeKey): Promise<OverrideFormatEntry|undefined>;

  /** Removes the override formats for a specific quantity type. */
  abstract remove(quantityTypeKey: QuantityTypeKey): Promise<boolean>;

  /** Retrieves the active unit system typically based on the "active" iModelConnection. */
  abstract  retrieveUnitSystem(defaultKey: UnitSystemKey): Promise<UnitSystemKey>;

  /** Store the active unit system typically for the "active" iModelConnection. */
  abstract  storeUnitSystemKey(unitSystemKey: UnitSystemKey): Promise<boolean>;
}

