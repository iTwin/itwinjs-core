/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
import { ClassRegistry, Schema, Schemas } from "../../imodeljs-backend";
import {
  ElectricalEquipmentDefinition, ElectricalFunctionalEquipment, ElectricalPhysicalRecipe, ElectricalPhysicalType, FunctionalContainer,
  PhysicalContainer,
} from "../../substation desing/Element";

export class SubstationSchema extends Schema {
  public static get schemaName(): string { return "Substation"; }

  /**
   * Registers the Schema and Domain classes in-memory.
   */
  public static registerSchema(): void {
    if (this !== Schemas.getRegisteredSchema(this.schemaName)) {
      Schemas.unregisterSchema(this.schemaName);
      Schemas.registerSchema(this);

      // We should rather use ClassRegistry.registerModule(module, this) - but it didn't quite work.
      ClassRegistry.register(ElectricalEquipmentDefinition, SubstationSchema);
      ClassRegistry.register(ElectricalPhysicalRecipe, SubstationSchema);
      ClassRegistry.register(ElectricalPhysicalType, SubstationSchema);
      ClassRegistry.register(ElectricalFunctionalEquipment, SubstationSchema);
      ClassRegistry.register(PhysicalContainer, SubstationSchema);
      ClassRegistry.register(FunctionalContainer, SubstationSchema);
    }
  }
}
