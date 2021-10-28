/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/

/** Enum containing some sample data codes for testing
 */
export enum TestDefinitionDataCodes {
  CircuitBreaker_2D_1 = "CB_38KV_SF6-DT",
  CircuitBreaker_2D_2 = "CB_BKR01",
  CircuitBreaker_2D_3 = "CB_CBP_V",
  CircuitBreaker_3D_1 = "3DCB_38KV_SF6-DT",
  CircuitBreaker_3D_2 = "3DCB_BKR01",
  CircuitBreaker_3D_3 = "3DCB_CBP_V",
  CircuitBreaker_ACME_1 = "ACME_SLD_CBR_V",
  CircuitBreaker_ACME_2 = "ACME_SLD_CBR_H",
  CircuitBreaker_ACME_3 = "ACME_SLD_CBP_V",

  SurgeArrestor_2D_1 = "SA_SURGE_ARRESTOR1",
  SurgeArrestor_2D_2 = "SA_126KV_LSA5-Q_ABB",
  SurgeArrestor_2D_3 = "SA_96KV_LSA4-Q_ABB",
  SurgeArrestor_3D_1 = "3DSA_SURGE_ARRESTOR1",
  SurgeArrestor_3D_2 = "3DSA_126KV_LSA5-Q_ABB",
  SurgeArrestor_3D_3 = "3DSA_96KV_LSA4-Q_ABB",
  SurgeArrestor_ACME_1 = "ACME_SURGE_ARRESTOR1",
  SurgeArrestor_ACME_2 = "ACME_SPE82269584",
  SurgeArrestor_ACME_3 = "ACME_SPE82269585",

  Transformer_2D_1 = "CT",
  Transformer_2D_2 = "CT_145KV_SPEB817172",
  Transformer_2D_3 = "CB_SEI_SF6",
  Transformer_3D_1 = "3DCT",
  Transformer_3D_2 = "3DCT_145KV_SPEB817172",
  Transformer_3D_3 = "3DCB_SEI_SF6",
  Transformer_ACME_1 = "ACME_SLD_VT1",
  Transformer_ACME_2 = "ACME_SLD_TRF_V",
  Transformer_ACME_3 = "ACME_SLD_CBP_H",

  ACMETransformer = "ACME Transformer",
  ACMEBreaker = "ACME Breaker",
  ACMESurgeArrestor = "ACME SurgeArrestor"
}

/** Enum contains name of catalog */
export enum DefinitionContainerName {
  Substation2DCatalog = "Substation 2D Catalog",
  Substation3DCatalog = "Substation 3D Catalog",
  SubstationACMECatalog = "Substation ACME Catalog",
  SampleEquipmentCatalog = "Sample Electrical Equipment Catalog",
}
