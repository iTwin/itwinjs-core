# BIS Schemas Names

<!-- TODO: Do we want to include this in the docs? -->

All EcSchema/BIS Domain Names must be registered with BIS workgroup to avoid conflicts.

Schemas are manages in the [bis-schemas](https://tfs.bentley.com/tfs/ProductLine/Platform%20Technology/_git/bis-spec) repository. The list below is the summary of those schemas.

| Domain | Name | Grade | Description | Alias | Depends On |
|---|---|---|---|---|---|
| AecUnits | AecUnits | A | This contains the unit definitions that are use across AE Schemas | AECU | |
| BridgePhysical | BridgePhysical | A | Base schema for Physical Bridges. | bphys | ECDbMap, BisCore, LinearReferencing, RoadRailPhysical |
| Building | ArchitecturalPhysical | A | Architectural Physical Schema | ArchPhys | AECU, BisCore, AecUnits |
| Building | BuildingCommon | A | This schema contains Classes the span the building schemas | bldcom | bis |
| Building | BuildingPhysical | A | Building Physical Schema | BldgPhys | bis |
| Building | MechanicalFunctional | A | This schema contains Classes the span the building schemas | mfunc | bis, func |
| BuildingSpacePlanning | BuildingSpacePlanning | A | | bsp | BisCore, Functional, Grids, AecUnits |
| ConstraintModel | ConstraintModel | A | | cml | bis |
| Core | BisCore | A | The BIS core classes that all other domain schemas extend. | bis | CoreCA, ecdbmap, ecdbpol |
| Core | Functional | A | | func | bis, ecdbmap |
| Core | Generic | A | | generic | bis, ecdbmap |
| Core | Markup | A | | markup | bis |
| Core | PhysicalMaterial | A | | physMat | bis |
| Costing | Costing | A | Schema for Cost-Estimation. | cost | bis |
| Electrical | ElectricalPhysical | A | Bentley Electrical Schema | elec | bis |
| Forms | Forms | A | Forms Schema | frm | bis, prf |
| Grids | Grids | A | | grids | bis,AECU |
| LinearReferencing | LinearReferencing | A | Base schema for Linear Referencing. | lr | bis |
| Planning | Planning | A | | bp | bis, ecdbmap, CoreCA|
| Plant (OP Converted) | PlantCustomAttributes | B | Custom attributes for Plant | PlantCA | |
| Plant (OP Converted) | ProcessFunctional | B | | pfunc | PlantCA ,func, bis, CoreCA ,V2ToV3|
| Plant (OP Converted) | ProcessPhysical | B | | pphys | bis,CoreCA,PlantCA |
| Plant (OP Converted) | ProcessPidGraphical | B | Process PID graphical schema | ppidg |bis, CoreCA, PlantCA|
| Plant | ProcessPidGraphical | A | Process PID graphical schema | ppidg | CoreCA, bis, ecdbmap |
| Plant | PlantBreakdownFunctional | A | Plant Breakdown Functional | pbf | bis, CoreCA, ecdbmap, func |
| Plant | ProcessEquipmentFunctional | A | Process Equipment Functional Schema" | pequipf | ecdbmap, bis, func, CoreCA, AECU |
| Plant | ProcessEquipmentPhysical | A |  | pequip | bis, CoreCA, ecdbmap |
| Plant | ProcessInstrumentationFunctional | A |  | pinstf | func, bis, CoreCA, ecdbmap |
| Plant | ProcessInstrumentationPhysical | A |  | pinst |  |
| Plant | ProcessPipingFunctional | A |  | ppipef | pequipf, ecdbmap, bis, func, CoreCA, ppipe |
| Plant | ProcessPipingPhysical | A |  |  | ecdbmap, bis, CoreCA |
| Profiles | Profiles | A | Profiles Schema | prf | bis |
| RealityModeling | DataCapture | A | Base schema for Data Capture Physical domains. | datacapture | dgn |
| RealityModeling | PointCloud | A |  | pointcloud | bis |
| RealityModeling | Raster | A |  | raster | bis |
| RealityModeling | ScalableMesh | A |  | ScalableMesh | bis |
| RealityModeling | ThreeMx | A |  | ThreeMx | bis |
| RoadRailAlignment | RoadRailAlignment | A | Base schema for the Alignment domain in light of Road and Rail applications. |  rralign | bis |
| RoadRailPhysical | RoadRailPhysical | A | Base schema for the Road and Rail domains. | rrphys | bis, lr, rralign |
| Site | Site | A |  | SITE | bis, rrp, bsp, AECU |
| Structural | StructuralPhysical | A |  | sp | bis |





# BIS Dependencies

<span style="color:red">WHERE IS THE SOURCE FOR THESE SCHEMAS?</span>

| Name                               | Alias   |
|------------------------------------|---------|
| ECDbMap                            | ecdbmap |
| CoreCustomAttributes               | CoreCA  |
