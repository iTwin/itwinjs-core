/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
export const UNIT_SCHEMA_STRING = `{
  "$schema": "https://dev.bentley.com/json_schemas/ec/32/ecschema",
  "name": "Units",
  "version": "01.00.06",
  "alias": "u",
  "label": "Units",
  "description": "Standard Set of Unit definitions for the system",
  "items": {
    "SI": {
      "schemaItemType": "UnitSystem"
    },
    "CGS": {
      "schemaItemType": "UnitSystem"
    },
    "METRIC": {
      "schemaItemType": "UnitSystem"
    },
    "IMPERIAL": {
      "schemaItemType": "UnitSystem"
    },
    "MARITIME": {
      "schemaItemType": "UnitSystem"
    },
    "USSURVEY": {
      "schemaItemType": "UnitSystem"
    },
    "INDUSTRIAL": {
      "schemaItemType": "UnitSystem"
    },
    "INTERNATIONAL": {
      "schemaItemType": "UnitSystem"
    },
    "USCUSTOM": {
      "schemaItemType": "UnitSystem"
    },
    "STATISTICS": {
      "schemaItemType": "UnitSystem"
    },
    "FINANCE": {
      "schemaItemType": "UnitSystem"
    },
    "CONSTANT": {
      "schemaItemType": "UnitSystem"
    },
    "APPARENT_POWER": {
      "schemaItemType": "Phenomenon",
      "label": "Apparent Power",
      "definition": "ELECTRIC_POTENTIAL*CURRENT"
    },
    "AREA": {
      "schemaItemType": "Phenomenon",
      "label": "Area",
      "definition": "LENGTH(2)"
    },
    "VOLUME": {
      "schemaItemType": "Phenomenon",
      "label": "Volume",
      "definition": "LENGTH(3)"
    },
    "VELOCITY": {
      "schemaItemType": "Phenomenon",
      "label": "Velocity",
      "definition": "LENGTH*TIME(-1)"
    },
    "ANGULAR_VELOCITY": {
      "schemaItemType": "Phenomenon",
      "label": "Angular Velocity",
      "definition": "ANGLE*TIME(-1)"
    },
    "ACCELERATION": {
      "schemaItemType": "Phenomenon",
      "label": "Acceleration",
      "definition": "LENGTH*TIME(-2)"
    },
    "FORCE": {
      "schemaItemType": "Phenomenon",
      "label": "Force",
      "definition": "MASS*ACCELERATION"
    },
    "PRESSURE": {
      "schemaItemType": "Phenomenon",
      "label": "Pressure",
      "definition": "FORCE*AREA(-1)"
    },
    "FORCE_DENSITY": {
      "schemaItemType": "Phenomenon",
      "label": "Force Density",
      "definition": "FORCE*VOLUME(-1)"
    },
    "PRESSURE_GRADIENT": {
      "schemaItemType": "Phenomenon",
      "label": "Pressure Gradient",
      "definition": "PRESSURE*LENGTH(-1)"
    },
    "TORQUE": {
      "schemaItemType": "Phenomenon",
      "label": "Torque",
      "definition": "FORCE*LENGTH*ANGLE(-1)"
    },
    "LINEAR_TORQUE": {
      "schemaItemType": "Phenomenon",
      "label": "Linear Torque",
      "definition": "TORQUE*LENGTH(-1)"
    },
    "AREA_TORQUE": {
      "schemaItemType": "Phenomenon",
      "label": "Area Torque",
      "definition": "TORQUE*AREA(-1)"
    },
    "AREA_MOMENT_INERTIA": {
      "schemaItemType": "Phenomenon",
      "label": "Area Moment Inertia",
      "definition": "LENGTH(4)"
    },
    "MASS_RATIO": {
      "schemaItemType": "Phenomenon",
      "label": "Mass Ratio",
      "definition": "MASS*MASS(-1)"
    },
    "DENSITY": {
      "schemaItemType": "Phenomenon",
      "label": "Density",
      "definition": "MASS*VOLUME(-1)"
    },
    "SPECIFIC_VOLUME": {
      "schemaItemType": "Phenomenon",
      "label": "Specific Volume",
      "definition": "VOLUME*MASS(-1)"
    },
    "LINEAR_DENSITY": {
      "schemaItemType": "Phenomenon",
      "label": "Linear Density",
      "definition": "MASS*LENGTH(-1)"
    },
    "SURFACE_DENSITY": {
      "schemaItemType": "Phenomenon",
      "label": "Surface Density",
      "definition": "MASS*AREA(-1)"
    },
    "WORK": {
      "schemaItemType": "Phenomenon",
      "label": "Work",
      "definition": "FORCE*LENGTH"
    },
    "POWER": {
      "schemaItemType": "Phenomenon",
      "label": "Power",
      "definition": "WORK*TIME(-1)"
    },
    "VOLUMETRIC_FLOW": {
      "schemaItemType": "Phenomenon",
      "label": "Volumetric Flow",
      "definition": "VOLUME*TIME(-1)"
    },
    "FLOW_DENSITY_PER_AREA": {
      "schemaItemType": "Phenomenon",
      "label": "Flow Density per Area",
      "description": "Flow demanded by or discharged to a Water/Sewer network per area.",
      "definition": "VOLUMETRIC_FLOW*AREA(-1)"
    },
    "MASS_FLOW": {
      "schemaItemType": "Phenomenon",
      "label": "Mass Flow",
      "definition": "MASS*TIME(-1)"
    },
    "MOLAR_FLOW": {
      "schemaItemType": "Phenomenon",
      "label": "Molar Flow",
      "definition": "MOLE*TIME(-1)"
    },
    "DYNAMIC_VISCOSITY": {
      "schemaItemType": "Phenomenon",
      "label": "Dynamic Viscosity",
      "definition": "PRESSURE*TIME"
    },
    "KINEMATIC_VISCOSITY": {
      "schemaItemType": "Phenomenon",
      "label": "Kinematic Viscosity",
      "definition": "DYNAMIC_VISCOSITY*DENSITY(-1)"
    },
    "ELECTRIC_CHARGE": {
      "schemaItemType": "Phenomenon",
      "label": "Electric Charge",
      "definition": "CURRENT*TIME"
    },
    "ELECTRIC_POTENTIAL": {
      "schemaItemType": "Phenomenon",
      "label": "Electric Potential",
      "definition": "POWER*CURRENT(-1)"
    },
    "LUMINOUS_FLUX": {
      "schemaItemType": "Phenomenon",
      "label": "Luminous Flux",
      "definition": "LUMINOSITY*SOLIDANGLE"
    },
    "ILLUMINANCE": {
      "schemaItemType": "Phenomenon",
      "label": "Illuminance",
      "definition": "LUMINOUS_FLUX*LENGTH(-2)"
    },
    "ROTATIONAL_SPRING_CONSTANT": {
      "schemaItemType": "Phenomenon",
      "label": "Rotational Spring Constant",
      "definition": "TORQUE*ANGLE(-1)"
    },
    "LINEAR_ROTATIONAL_SPRING_CONSTANT": {
      "schemaItemType": "Phenomenon",
      "label": "Linear Rotational Spring Constant",
      "definition": "FORCE*ANGLE(-1)"
    },
    "SPRING_CONSTANT": {
      "schemaItemType": "Phenomenon",
      "label": "Spring Constant",
      "definition": "FORCE*LENGTH(-1)"
    },
    "LINEAR_SPRING_CONSTANT": {
      "schemaItemType": "Phenomenon",
      "label": "Linear Spring Constant",
      "definition": "SPRING_CONSTANT*LENGTH(-1)"
    },
    "AREA_SPRING_CONSTANT": {
      "schemaItemType": "Phenomenon",
      "label": "Area Spring Constant",
      "definition": "SPRING_CONSTANT*AREA(-1)"
    },
    "PIPE_DIAMETER_LENGTH": {
      "schemaItemType": "Phenomenon",
      "label": "Pipe Diameter-Length",
      "description": "The diameter of a pipe multiplied by its length, used as a coefficient for pipe-infiltration calculations.",
      "definition": "LENGTH*LENGTH"
    },
    "THERMAL_CONDUCTIVITY": {
      "schemaItemType": "Phenomenon",
      "label": "Thermal Conductivity",
      "definition": "POWER*LENGTH(-1)*TEMPERATURE_CHANGE(-1)"
    },
    "THERMAL_INSULANCE": {
      "schemaItemType": "Phenomenon",
      "label": "Thermal Resistance",
      "definition": "AREA*TEMPERATURE_CHANGE*POWER(-1)"
    },
    "TEMPERATURE_GRADIENT": {
      "schemaItemType": "Phenomenon",
      "label": "Temperature Gradient",
      "definition": "TEMPERATURE_CHANGE*LENGTH(-1)"
    },
    "MOLAR_VOLUME": {
      "schemaItemType": "Phenomenon",
      "label": "Molar Volume",
      "definition": "VOLUME*MOLE(-1)"
    },
    "MOLAR_CONCENTRATION": {
      "schemaItemType": "Phenomenon",
      "label": "Molar Concentration",
      "definition": "MOLE*VOLUME(-1)"
    },
    "SLOPE": {
      "schemaItemType": "Phenomenon",
      "label": "Slope",
      "definition": "LENGTH*LENGTH(-1)"
    },
    "HEAT_TRANSFER": {
      "schemaItemType": "Phenomenon",
      "label": "Heat Transfer",
      "description": "https://en.wikipedia.org/wiki/Heat_transfer_coefficient",
      "definition": "POWER*AREA(-1)*TEMPERATURE_CHANGE(-1)"
    },
    "HEAT_FLUX_DENSITY": {
      "schemaItemType": "Phenomenon",
      "label": "Heat Flux Density",
      "description": "https://en.wikipedia.org/wiki/Heat_flux see description of heat flux density",
      "definition": "POWER*AREA(-1)"
    },
    "TORSIONAL_WARPING_CONSTANT": {
      "schemaItemType": "Phenomenon",
      "label": "Torsional Warping Constant",
      "definition": "LENGTH(6)"
    },
    "POPULATION_DENSITY": {
      "schemaItemType": "Phenomenon",
      "label": "Population Density",
      "definition": "CAPITA*AREA(-1)"
    },
    "FREQUENCY": {
      "schemaItemType": "Phenomenon",
      "label": "Frequency",
      "definition": "TIME(-1)"
    },
    "LINEAR_LOAD": {
      "schemaItemType": "Phenomenon",
      "label": "Linear Load",
      "definition": "FORCE*LENGTH(-1)"
    },
    "ENERGY_DENSITY": {
      "schemaItemType": "Phenomenon",
      "label": "Energy Density",
      "definition": "WORK*VOLUME(-1)"
    },
    "ELECTRICAL_RESISTANCE": {
      "schemaItemType": "Phenomenon",
      "label": "Electrical Resistance",
      "definition": "ELECTRIC_POTENTIAL*CURRENT(-1)"
    },
    "ELECTRICAL_RESISTIVITY": {
      "schemaItemType": "Phenomenon",
      "label": "Electrical Resistivity",
      "definition": "ELECTRICAL_RESISTANCE*LENGTH"
    },
    "SPECIFIC_ENERGY": {
      "schemaItemType": "Phenomenon",
      "label": "Specific Energy",
      "definition": "WORK*MASS(-1)"
    },
    "SPECIFIC_HEAT_CAPACITY": {
      "schemaItemType": "Phenomenon",
      "label": "Specific_heat Capacity",
      "definition": "WORK*MASS(-1)*TEMPERATURE_CHANGE(-1)"
    },
    "SPECIFIC_HEAT_CAPACITY_MOLAR": {
      "schemaItemType": "Phenomenon",
      "label": "Specific_heat Capacity Molar",
      "definition": "WORK*MOLE(-1)*TEMPERATURE_CHANGE(-1)"
    },
    "PERCENTAGE": {
      "schemaItemType": "Phenomenon",
      "label": "Percentage",
      "definition": "NUMBER"
    },
    "PROBABILITY": {
      "schemaItemType": "Phenomenon",
      "label": "Probability",
      "definition": "NUMBER"
    },
    "LINEAR_RATE": {
      "schemaItemType": "Phenomenon",
      "label": "Linear Rate",
      "definition": "NUMBER*LENGTH(-1)"
    },
    "LINEAR_COEFFICIENT_OF_THERMAL_EXPANSION": {
      "schemaItemType": "Phenomenon",
      "label": "Linear Coefficient Of Thermal Expansion",
      "definition": "LENGTH*LENGTH(-1)*TEMPERATURE_CHANGE(-1)"
    },
    "VOLUME_RATIO": {
      "schemaItemType": "Phenomenon",
      "label": "Volume Ratio",
      "definition": "VOLUME*VOLUME(-1)"
    },
    "LENGTH_RATIO": {
      "schemaItemType": "Phenomenon",
      "definition": "LENGTH*LENGTH(-1)"
    },
    "LENGTH": {
      "schemaItemType": "Phenomenon",
      "label": "Length",
      "definition": "LENGTH"
    },
    "MASS": {
      "schemaItemType": "Phenomenon",
      "label": "Mass",
      "definition": "MASS"
    },
    "TIME": {
      "schemaItemType": "Phenomenon",
      "label": "Time",
      "definition": "TIME"
    },
    "TEMPERATURE": {
      "schemaItemType": "Phenomenon",
      "label": "Temperature",
      "definition": "TEMPERATURE"
    },
    "TEMPERATURE_CHANGE": {
      "schemaItemType": "Phenomenon",
      "label": "Temperature Change",
      "definition": "TEMPERATURE_CHANGE"
    },
    "CURRENT": {
      "schemaItemType": "Phenomenon",
      "label": "Current",
      "definition": "CURRENT"
    },
    "MOLE": {
      "schemaItemType": "Phenomenon",
      "label": "Mole",
      "definition": "MOLE"
    },
    "LUMINOSITY": {
      "schemaItemType": "Phenomenon",
      "label": "Luminosity",
      "definition": "LUMINOSITY"
    },
    "ANGLE": {
      "schemaItemType": "Phenomenon",
      "label": "Angle",
      "definition": "ANGLE"
    },
    "SOLIDANGLE": {
      "schemaItemType": "Phenomenon",
      "label": "Solid Angle",
      "definition": "SOLIDANGLE"
    },
    "CURRENCY": {
      "schemaItemType": "Phenomenon",
      "definition": "CURRENCY"
    },
    "CAPITA": {
      "schemaItemType": "Phenomenon",
      "label": "Capita",
      "definition": "CAPITA"
    },
    "NUMBER": {
      "schemaItemType": "Phenomenon",
      "label": "Number",
      "definition": "NUMBER"
    },
    "THREAD_PITCH": {
      "schemaItemType": "Phenomenon",
      "label": "Thread Pitch",
      "definition": "LENGTH*ANGLE(-1)"
    },
    "ENTROPY": {
      "schemaItemType": "Phenomenon",
      "label": "Entropy",
      "definition": "WORK*TEMPERATURE_CHANGE(-1)"
    },
    "LUMINOUS_EFFICACY": {
      "schemaItemType": "Phenomenon",
      "label": "Luminous Efficacy",
      "definition": "LUMINOUS_FLUX*POWER(-1)"
    },
    "MOMENT_DISPLAY_SCALE": {
      "schemaItemType": "Phenomenon",
      "label": "Moment Scale",
      "description": "Display size of the linear moment",
      "definition": "FORCE(-1)"
    },
    "FORCE_DISPLAY_SCALE": {
      "schemaItemType": "Phenomenon",
      "label": "Force Scale",
      "description": "Display size of the force",
      "definition": "LINEAR_LOAD(-1)"
    },
    "PI": {
      "schemaItemType": "Constant",
      "label": "Pi",
      "phenomenon": "Units.LENGTH_RATIO",
      "definition": "ONE",
      "numerator": 3.141592653589793,
      "denominator": 1
    },
    "QUARTER_PI": {
      "schemaItemType": "Constant",
      "label": "Pi/4",
      "phenomenon": "Units.LENGTH_RATIO",
      "definition": "PI",
      "numerator": 1,
      "denominator": 4
    },
    "HALF_PI": {
      "schemaItemType": "Constant",
      "label": "Pi/2",
      "phenomenon": "Units.LENGTH_RATIO",
      "definition": "PI",
      "numerator": 1,
      "denominator": 2
    },
    "TWO_PI": {
      "schemaItemType": "Constant",
      "label": "2Pi",
      "phenomenon": "Units.LENGTH_RATIO",
      "definition": "PI",
      "numerator": 2,
      "denominator": 1
    },
    "DEG360": {
      "schemaItemType": "Constant",
      "label": "360°",
      "phenomenon": "Units.ANGLE",
      "definition": "ARC_DEG",
      "numerator": 360,
      "denominator": 1
    },
    "STD_G": {
      "schemaItemType": "Constant",
      "label": "ɡ0",
      "phenomenon": "Units.ACCELERATION",
      "definition": "M*S(-2)",
      "numerator": 9.80665,
      "denominator": 1
    },
    "DECI": {
      "schemaItemType": "Constant",
      "label": "deci",
      "phenomenon": "Units.NUMBER",
      "definition": "ONE",
      "numerator": 0.1,
      "denominator": 1
    },
    "CENTI": {
      "schemaItemType": "Constant",
      "label": "centi",
      "phenomenon": "Units.NUMBER",
      "definition": "ONE",
      "numerator": 0.01,
      "denominator": 1
    },
    "MILLI": {
      "schemaItemType": "Constant",
      "label": "milli",
      "phenomenon": "Units.NUMBER",
      "definition": "ONE",
      "numerator": 0.001,
      "denominator": 1
    },
    "MICRO": {
      "schemaItemType": "Constant",
      "label": "micro",
      "phenomenon": "Units.NUMBER",
      "definition": "ONE",
      "numerator": 0.000001,
      "denominator": 1
    },
    "NANO": {
      "schemaItemType": "Constant",
      "label": "nano",
      "phenomenon": "Units.NUMBER",
      "definition": "ONE",
      "numerator": 1e-9,
      "denominator": 1
    },
    "PICO": {
      "schemaItemType": "Constant",
      "label": "pico",
      "phenomenon": "Units.NUMBER",
      "definition": "ONE",
      "numerator": 1e-12,
      "denominator": 1
    },
    "FEMTO": {
      "schemaItemType": "Constant",
      "label": "femto",
      "phenomenon": "Units.NUMBER",
      "definition": "ONE",
      "numerator": 1e-15,
      "denominator": 1
    },
    "ATTO": {
      "schemaItemType": "Constant",
      "label": "atto",
      "phenomenon": "Units.NUMBER",
      "definition": "ONE",
      "numerator": 1e-18,
      "denominator": 1
    },
    "ZEPTO": {
      "schemaItemType": "Constant",
      "label": "zepto",
      "phenomenon": "Units.NUMBER",
      "definition": "ONE",
      "numerator": 1e-21,
      "denominator": 1
    },
    "YOCTO": {
      "schemaItemType": "Constant",
      "label": "yocto",
      "phenomenon": "Units.NUMBER",
      "definition": "ONE",
      "numerator": 1e-24,
      "denominator": 1
    },
    "DECA": {
      "schemaItemType": "Constant",
      "phenomenon": "Units.NUMBER",
      "definition": "ONE",
      "numerator": 10,
      "denominator": 1
    },
    "HECTO": {
      "schemaItemType": "Constant",
      "label": "hecto",
      "phenomenon": "Units.NUMBER",
      "definition": "ONE",
      "numerator": 100,
      "denominator": 1
    },
    "KILO": {
      "schemaItemType": "Constant",
      "label": "kilo",
      "phenomenon": "Units.NUMBER",
      "definition": "ONE",
      "numerator": 1000,
      "denominator": 1
    },
    "MEGA": {
      "schemaItemType": "Constant",
      "label": "mega",
      "phenomenon": "Units.NUMBER",
      "definition": "ONE",
      "numerator": 1000000,
      "denominator": 1
    },
    "GIGA": {
      "schemaItemType": "Constant",
      "label": "giga",
      "phenomenon": "Units.NUMBER",
      "definition": "ONE",
      "numerator": 1000000000,
      "denominator": 1
    },
    "TERA": {
      "schemaItemType": "Constant",
      "label": "tera",
      "phenomenon": "Units.NUMBER",
      "definition": "ONE",
      "numerator": 1000000000000,
      "denominator": 1
    },
    "PETA": {
      "schemaItemType": "Constant",
      "label": "peta",
      "phenomenon": "Units.NUMBER",
      "definition": "ONE",
      "numerator": 1000000000000000,
      "denominator": 1
    },
    "EXA": {
      "schemaItemType": "Constant",
      "label": "exa",
      "phenomenon": "Units.NUMBER",
      "definition": "ONE",
      "numerator": 1000000000000000000,
      "denominator": 1
    },
    "ZETTA": {
      "schemaItemType": "Constant",
      "label": "zetta",
      "phenomenon": "Units.NUMBER",
      "definition": "ONE",
      "numerator": 1e+21,
      "denominator": 1
    },
    "YOTTA": {
      "schemaItemType": "Constant",
      "label": "yotta",
      "phenomenon": "Units.NUMBER",
      "definition": "ONE",
      "numerator": 1e+24,
      "denominator": 1
    },
    "MM": {
      "schemaItemType": "Unit",
      "label": "mm",
      "phenomenon": "Units.LENGTH",
      "unitSystem": "Units.METRIC",
      "definition": "[MILLI]*M",
      "numerator": 1,
      "denominator": 1,
      "offset": 0
    },
    "CM": {
      "schemaItemType": "Unit",
      "label": "cm",
      "phenomenon": "Units.LENGTH",
      "unitSystem": "Units.METRIC",
      "definition": "[CENTI]*M",
      "numerator": 1,
      "denominator": 1,
      "offset": 0
    },
    "DM": {
      "schemaItemType": "Unit",
      "label": "dm",
      "phenomenon": "Units.LENGTH",
      "unitSystem": "Units.METRIC",
      "definition": "[DECI]*M",
      "numerator": 1,
      "denominator": 1,
      "offset": 0
    },
    "KM": {
      "schemaItemType": "Unit",
      "label": "km",
      "phenomenon": "Units.LENGTH",
      "unitSystem": "Units.METRIC",
      "definition": "[KILO]*M",
      "numerator": 1,
      "denominator": 1,
      "offset": 0
    },
    "UM": {
      "schemaItemType": "Unit",
      "label": "µm",
      "phenomenon": "Units.LENGTH",
      "unitSystem": "Units.METRIC",
      "definition": "[MICRO]*M",
      "numerator": 1,
      "denominator": 1,
      "offset": 0
    },
    "MILLIINCH": {
      "schemaItemType": "Unit",
      "label": "mil",
      "phenomenon": "Units.LENGTH",
      "unitSystem": "Units.USCUSTOM",
      "definition": "[MILLI]*IN",
      "numerator": 1,
      "denominator": 1,
      "offset": 0
    },
    "MICROINCH": {
      "schemaItemType": "Unit",
      "label": "µin",
      "phenomenon": "Units.LENGTH",
      "unitSystem": "Units.USCUSTOM",
      "definition": "[MICRO]*IN",
      "numerator": 1,
      "denominator": 1,
      "offset": 0
    },
    "MILLIFOOT": {
      "schemaItemType": "Unit",
      "label": "mft",
      "phenomenon": "Units.LENGTH",
      "unitSystem": "Units.USCUSTOM",
      "definition": "[MILLI]*FT",
      "numerator": 1,
      "denominator": 1,
      "offset": 0
    },
    "IN": {
      "schemaItemType": "Unit",
      "label": "in",
      "description": "Exact, http://www.nist.gov/pml/wmd/pubs/upload/hb44-15-web-final.pdf, Appendix B. Section 3.1, Page B-10",
      "phenomenon": "Units.LENGTH",
      "unitSystem": "Units.USCUSTOM",
      "definition": "MM",
      "numerator": 25.4,
      "denominator": 1,
      "offset": 0
    },
    "FT": {
      "schemaItemType": "Unit",
      "label": "ft",
      "description": "Exact, http://www.nist.gov/pml/wmd/pubs/upload/hb44-15-web-final.pdf, Appendix C. Section 2, Page C-4",
      "phenomenon": "Units.LENGTH",
      "unitSystem": "Units.USCUSTOM",
      "definition": "IN",
      "numerator": 12,
      "denominator": 1,
      "offset": 0
    },
    "YRD": {
      "schemaItemType": "Unit",
      "label": "yd",
      "description": "Exact, http://www.nist.gov/pml/wmd/pubs/upload/hb44-15-web-final.pdf, Appendix C. Section 2, Page C-4",
      "phenomenon": "Units.LENGTH",
      "unitSystem": "Units.USCUSTOM",
      "definition": "FT",
      "numerator": 3,
      "denominator": 1,
      "offset": 0
    },
    "CHAIN": {
      "schemaItemType": "Unit",
      "label": "chain",
      "description": "Exact, http://www.nist.gov/pml/wmd/pubs/upload/hb44-15-web-final.pdf, Appendix C. Section 4, Page C-8",
      "phenomenon": "Units.LENGTH",
      "unitSystem": "Units.USCUSTOM",
      "definition": "FT",
      "numerator": 66,
      "denominator": 1,
      "offset": 0
    },
    "MILE": {
      "schemaItemType": "Unit",
      "label": "mi",
      "description": "Exact, http://www.nist.gov/pml/wmd/pubs/upload/hb44-15-web-final.pdf, Appendix C. Section 4, Page C-8",
      "phenomenon": "Units.LENGTH",
      "unitSystem": "Units.USCUSTOM",
      "definition": "YRD",
      "numerator": 1760,
      "denominator": 1,
      "offset": 0
    },
    "US_SURVEY_IN": {
      "schemaItemType": "Unit",
      "label": "in (US Survey)",
      "description": "100/3937 Derived from the definition of us survey foot in terms of meters.  Exact, http://www.nist.gov/pml/wmd/pubs/upload/hb44-15-web-final.pdf, Appendix C. Section 4, Page C-9",
      "phenomenon": "Units.LENGTH",
      "unitSystem": "Units.USSURVEY",
      "definition": "M",
      "numerator": 100,
      "denominator": 3937,
      "offset": 0
    },
    "US_SURVEY_FT": {
      "schemaItemType": "Unit",
      "label": "ft (US Survey)",
      "description": "Exact, http://www.nist.gov/pml/wmd/pubs/upload/hb44-15-web-final.pdf, Appendix C. Section 2, Page C-4",
      "phenomenon": "Units.LENGTH",
      "unitSystem": "Units.USSURVEY",
      "definition": "US_SURVEY_IN",
      "numerator": 12,
      "denominator": 1,
      "offset": 0
    },
    "US_SURVEY_YRD": {
      "schemaItemType": "Unit",
      "label": "yrd (US Survey)",
      "description": "Exact, http://www.nist.gov/pml/wmd/pubs/upload/hb44-15-web-final.pdf, Appendix C. Section 2, Page C-4",
      "phenomenon": "Units.LENGTH",
      "unitSystem": "Units.USSURVEY",
      "definition": "US_SURVEY_FT",
      "numerator": 3,
      "denominator": 1,
      "offset": 0
    },
    "US_SURVEY_CHAIN": {
      "schemaItemType": "Unit",
      "label": "chain (US Survey)",
      "description": "Exact, http://www.nist.gov/pml/wmd/pubs/upload/hb44-15-web-final.pdf, Appendix C. Section 4, Page C-8",
      "phenomenon": "Units.LENGTH",
      "unitSystem": "Units.USSURVEY",
      "definition": "US_SURVEY_FT",
      "numerator": 66,
      "denominator": 1,
      "offset": 0
    },
    "US_SURVEY_MILE": {
      "schemaItemType": "Unit",
      "label": "mi (US Survey)",
      "description": "Exact, http://www.nist.gov/pml/wmd/pubs/upload/hb44-15-web-final.pdf, Appendix C. Section 4, Page C-8",
      "phenomenon": "Units.LENGTH",
      "unitSystem": "Units.USSURVEY",
      "definition": "US_SURVEY_YRD",
      "numerator": 1760,
      "denominator": 1,
      "offset": 0
    },
    "NAUT_MILE": {
      "schemaItemType": "Unit",
      "label": "nmi",
      "description": "International Nautical Mile.  Exact, http://www.nist.gov/pml/wmd/pubs/upload/hb44-15-web-final.pdf, Appendix C. Section 2, Page C-4",
      "phenomenon": "Units.LENGTH",
      "unitSystem": "Units.MARITIME",
      "definition": "M",
      "numerator": 1852,
      "denominator": 1,
      "offset": 0
    },
    "G": {
      "schemaItemType": "Unit",
      "label": "g",
      "phenomenon": "Units.MASS",
      "unitSystem": "Units.METRIC",
      "definition": "[MILLI]*KG",
      "numerator": 1,
      "denominator": 1,
      "offset": 0
    },
    "MG": {
      "schemaItemType": "Unit",
      "label": "mg",
      "phenomenon": "Units.MASS",
      "unitSystem": "Units.METRIC",
      "definition": "[MILLI]*G",
      "numerator": 1,
      "denominator": 1,
      "offset": 0
    },
    "MKG": {
      "schemaItemType": "Unit",
      "label": "µg",
      "phenomenon": "Units.MASS",
      "unitSystem": "Units.METRIC",
      "definition": "[MICRO]*G",
      "numerator": 1,
      "denominator": 1,
      "offset": 0
    },
    "NG": {
      "schemaItemType": "Unit",
      "label": "ng",
      "phenomenon": "Units.MASS",
      "unitSystem": "Units.METRIC",
      "definition": "[NANO]*G",
      "numerator": 1,
      "denominator": 1,
      "offset": 0
    },
    "MEGAGRAM": {
      "schemaItemType": "Unit",
      "label": "Mg",
      "phenomenon": "Units.MASS",
      "unitSystem": "Units.METRIC",
      "definition": "[MEGA]*G",
      "numerator": 1,
      "denominator": 1,
      "offset": 0
    },
    "TONNE": {
      "schemaItemType": "Unit",
      "label": "tonne",
      "description": "Also known as a metric ton http://phyMETRICcs.nist.gov/cuu/pdf/sp811.pdf, Appendix B.",
      "phenomenon": "Units.MASS",
      "unitSystem": "Units.METRIC",
      "definition": "[KILO]*KG",
      "numerator": 1,
      "denominator": 1,
      "offset": 0
    },
    "LBM": {
      "schemaItemType": "Unit",
      "label": "lb",
      "description": "Is Avoirdupois Pound.  Exact, http://physics.nist.gov/cuu/pdf/sp811.pdf, Appendix B. Footnote 22",
      "phenomenon": "Units.MASS",
      "unitSystem": "Units.USCUSTOM",
      "definition": "KG",
      "numerator": 0.45359237,
      "denominator": 1,
      "offset": 0
    },
    "SLUG": {
      "schemaItemType": "Unit",
      "label": "slug",
      "phenomenon": "Units.MASS",
      "unitSystem": "Units.USCUSTOM",
      "definition": "LBF*S(2)*FT(-1)",
      "numerator": 1,
      "denominator": 1,
      "offset": 0
    },
    "GRM": {
      "schemaItemType": "Unit",
      "label": "gr",
      "description": "Exact, http://www.nist.gov/pml/wmd/pubs/upload/hb44-15-web-final.pdf, Appendix B. Section 3.2, Page B-10",
      "phenomenon": "Units.MASS",
      "unitSystem": "Units.USCUSTOM",
      "definition": "LBM",
      "numerator": 1,
      "denominator": 7000,
      "offset": 0
    },
    "SHORT_TON_MASS": {
      "schemaItemType": "Unit",
      "label": "tn (short)",
      "description": "Exact, http://physics.nist.gov/cuu/pdf/sp811.pdf, Appendix B.",
      "phenomenon": "Units.MASS",
      "unitSystem": "Units.USCUSTOM",
      "definition": "LBM",
      "numerator": 2000,
      "denominator": 1,
      "offset": 0
    },
    "LONG_TON_MASS": {
      "schemaItemType": "Unit",
      "label": "tn (long)",
      "description": "Exact, http://physics.nist.gov/cuu/pdf/sp811.pdf, Appendix B.",
      "phenomenon": "Units.MASS",
      "unitSystem": "Units.USCUSTOM",
      "definition": "LBM",
      "numerator": 2240,
      "denominator": 1,
      "offset": 0
    },
    "KIPM": {
      "schemaItemType": "Unit",
      "label": "kipm",
      "description": "Exact, http://physics.nist.gov/cuu/pdf/sp811.pdf, Appendix B.",
      "phenomenon": "Units.MASS",
      "unitSystem": "Units.USCUSTOM",
      "definition": "[KILO]*LBM",
      "numerator": 1,
      "denominator": 1,
      "offset": 0
    },
    "OZM": {
      "schemaItemType": "Unit",
      "label": "oz",
      "description": "1/16 Exact, https://en.wikipedia.org/wiki/Ounce",
      "phenomenon": "Units.MASS",
      "unitSystem": "Units.USCUSTOM",
      "definition": "LBM",
      "numerator": 1,
      "denominator": 16,
      "offset": 0
    },
    "MIN": {
      "schemaItemType": "Unit",
      "label": "min",
      "phenomenon": "Units.TIME",
      "unitSystem": "Units.INTERNATIONAL",
      "definition": "S",
      "numerator": 60,
      "denominator": 1,
      "offset": 0
    },
    "HR": {
      "schemaItemType": "Unit",
      "label": "h",
      "phenomenon": "Units.TIME",
      "unitSystem": "Units.INTERNATIONAL",
      "definition": "MIN",
      "numerator": 60,
      "denominator": 1,
      "offset": 0
    },
    "DAY": {
      "schemaItemType": "Unit",
      "label": "days",
      "phenomenon": "Units.TIME",
      "unitSystem": "Units.INTERNATIONAL",
      "definition": "HR",
      "numerator": 24,
      "denominator": 1,
      "offset": 0
    },
    "WEEK": {
      "schemaItemType": "Unit",
      "label": "week",
      "phenomenon": "Units.TIME",
      "unitSystem": "Units.INTERNATIONAL",
      "definition": "DAY",
      "numerator": 7,
      "denominator": 1,
      "offset": 0
    },
    "YR": {
      "schemaItemType": "Unit",
      "label": "years",
      "description": "http://physics.nist.gov/cuu/pdf/sp811.pdf, Appendix B. Year is 3.1536 E+07 seconds which is equal to 365 * 24 * 60 * 60",
      "phenomenon": "Units.TIME",
      "unitSystem": "Units.INTERNATIONAL",
      "definition": "DAY",
      "numerator": 365,
      "denominator": 1,
      "offset": 0
    },
    "YEAR_SIDEREAL": {
      "schemaItemType": "Unit",
      "label": "Year (Sidereal)",
      "description": "http://physics.nist.gov/cuu/pdf/sp811.pdf, Appendix B.",
      "phenomenon": "Units.TIME",
      "unitSystem": "Units.INTERNATIONAL",
      "definition": "S",
      "numerator": 31558150,
      "denominator": 1,
      "offset": 0
    },
    "YEAR_TROPICAL": {
      "schemaItemType": "Unit",
      "label": "Year (Tropical)",
      "description": "http://physics.nist.gov/cuu/pdf/sp811.pdf, Appendix B.",
      "phenomenon": "Units.TIME",
      "unitSystem": "Units.INTERNATIONAL",
      "definition": "S",
      "numerator": 31556930,
      "denominator": 1,
      "offset": 0
    },
    "MS": {
      "schemaItemType": "Unit",
      "label": "ms",
      "phenomenon": "Units.TIME",
      "unitSystem": "Units.INTERNATIONAL",
      "definition": "[MILLI]*S",
      "numerator": 1,
      "denominator": 1,
      "offset": 0
    },
    "MKS": {
      "schemaItemType": "Unit",
      "label": "µs",
      "phenomenon": "Units.TIME",
      "unitSystem": "Units.INTERNATIONAL",
      "definition": "[MICRO]*S",
      "numerator": 1,
      "denominator": 1,
      "offset": 0
    },
    "CELSIUS": {
      "schemaItemType": "Unit",
      "label": "°C",
      "phenomenon": "Units.TEMPERATURE",
      "unitSystem": "Units.METRIC",
      "definition": "K",
      "numerator": 1,
      "denominator": 1,
      "offset": 273.15
    },
    "FAHRENHEIT": {
      "schemaItemType": "Unit",
      "label": "°F",
      "description": "Factor is 5/9",
      "phenomenon": "Units.TEMPERATURE",
      "unitSystem": "Units.USCUSTOM",
      "definition": "CELSIUS",
      "numerator": 5,
      "denominator": 9,
      "offset": -32
    },
    "RANKINE": {
      "schemaItemType": "Unit",
      "label": "°R",
      "description": "Factor is 5/9",
      "phenomenon": "Units.TEMPERATURE",
      "unitSystem": "Units.USCUSTOM",
      "definition": "K",
      "numerator": 5,
      "denominator": 9,
      "offset": 0
    },
    "DELTA_CELSIUS": {
      "schemaItemType": "Unit",
      "label": "Δ°C",
      "phenomenon": "Units.TEMPERATURE_CHANGE",
      "unitSystem": "Units.METRIC",
      "definition": "DELTA_KELVIN",
      "numerator": 1,
      "denominator": 1,
      "offset": 0
    },
    "DELTA_FAHRENHEIT": {
      "schemaItemType": "Unit",
      "label": "Δ°F",
      "description": "Factor is 5/9",
      "phenomenon": "Units.TEMPERATURE_CHANGE",
      "unitSystem": "Units.USCUSTOM",
      "definition": "DELTA_CELSIUS",
      "numerator": 5,
      "denominator": 9,
      "offset": 0
    },
    "DELTA_RANKINE": {
      "schemaItemType": "Unit",
      "label": "Δ°R",
      "description": "Factor is 5/9",
      "phenomenon": "Units.TEMPERATURE_CHANGE",
      "unitSystem": "Units.USCUSTOM",
      "definition": "DELTA_KELVIN",
      "numerator": 5,
      "denominator": 9,
      "offset": 0
    },
    "KELVIN_PER_M": {
      "schemaItemType": "Unit",
      "label": "ΔK/m",
      "phenomenon": "Units.TEMPERATURE_GRADIENT",
      "unitSystem": "Units.SI",
      "definition": "DELTA_KELVIN*M(-1)",
      "numerator": 1,
      "denominator": 1,
      "offset": 0
    },
    "STRAIN_PER_KELVIN": {
      "schemaItemType": "Unit",
      "label": "1/ΔK",
      "phenomenon": "Units.LINEAR_COEFFICIENT_OF_THERMAL_EXPANSION",
      "unitSystem": "Units.SI",
      "definition": "DELTA_KELVIN(-1)",
      "numerator": 1,
      "denominator": 1,
      "offset": 0
    },
    "STRAIN_PER_CELSIUS": {
      "schemaItemType": "Unit",
      "label": "1/Δ°C",
      "phenomenon": "Units.LINEAR_COEFFICIENT_OF_THERMAL_EXPANSION",
      "unitSystem": "Units.METRIC",
      "definition": "DELTA_CELSIUS(-1)",
      "numerator": 1,
      "denominator": 1,
      "offset": 0
    },
    "STRAIN_PER_FAHRENHEIT": {
      "schemaItemType": "Unit",
      "label": "1/Δ°F",
      "phenomenon": "Units.LINEAR_COEFFICIENT_OF_THERMAL_EXPANSION",
      "unitSystem": "Units.USCUSTOM",
      "definition": "DELTA_FAHRENHEIT(-1)",
      "numerator": 1,
      "denominator": 1,
      "offset": 0
    },
    "STRAIN_PER_RANKINE": {
      "schemaItemType": "Unit",
      "label": "1/Δ°R",
      "phenomenon": "Units.LINEAR_COEFFICIENT_OF_THERMAL_EXPANSION",
      "unitSystem": "Units.USCUSTOM",
      "definition": "DELTA_RANKINE(-1)",
      "numerator": 1,
      "denominator": 1,
      "offset": 0
    },
    "LUMEN": {
      "schemaItemType": "Unit",
      "label": "lm",
      "phenomenon": "Units.LUMINOUS_FLUX",
      "unitSystem": "Units.SI",
      "definition": "CD*STERAD",
      "numerator": 1,
      "denominator": 1,
      "offset": 0
    },
    "LUX": {
      "schemaItemType": "Unit",
      "label": "lx",
      "phenomenon": "Units.ILLUMINANCE",
      "unitSystem": "Units.SI",
      "definition": "LUMEN*M(-2)",
      "numerator": 1,
      "denominator": 1,
      "offset": 0
    },
    "LUMEN_PER_SQ_FT": {
      "schemaItemType": "Unit",
      "label": "lm/ft²",
      "phenomenon": "Units.ILLUMINANCE",
      "unitSystem": "Units.USCUSTOM",
      "definition": "LUMEN*FT(-2)",
      "numerator": 1,
      "denominator": 1,
      "offset": 0
    },
    "KMOL": {
      "schemaItemType": "Unit",
      "label": "kmol",
      "phenomenon": "Units.MOLE",
      "unitSystem": "Units.METRIC",
      "definition": "[KILO]*MOL",
      "numerator": 1,
      "denominator": 1,
      "offset": 0
    },
    "LB_MOL": {
      "schemaItemType": "Unit",
      "label": "lb-mol",
      "description": "ASTM SI 10 standard SI1-.phhc8328.pdf page 29, 35 and http://en.wikipedia.org/wiki/Mole_%28unit%29",
      "phenomenon": "Units.MOLE",
      "unitSystem": "Units.USCUSTOM",
      "definition": "MOL",
      "numerator": 453.59237,
      "denominator": 1,
      "offset": 0
    },
    "HUNDRED_PERSON": {
      "schemaItemType": "Unit",
      "phenomenon": "Units.CAPITA",
      "unitSystem": "Units.STATISTICS",
      "definition": "[HECTO]*PERSON",
      "numerator": 1,
      "denominator": 1,
      "offset": 0
    },
    "THOUSAND_PERSON": {
      "schemaItemType": "Unit",
      "phenomenon": "Units.CAPITA",
      "unitSystem": "Units.STATISTICS",
      "definition": "[KILO]*PERSON",
      "numerator": 1,
      "denominator": 1,
      "offset": 0
    },
    "N_M_PER_RAD": {
      "schemaItemType": "Unit",
      "label": "N·m/rad",
      "phenomenon": "Units.ROTATIONAL_SPRING_CONSTANT",
      "unitSystem": "Units.SI",
      "definition": "N_M*RAD(-1)",
      "numerator": 1,
      "denominator": 1,
      "offset": 0
    },
    "KN_M_PER_RAD": {
      "schemaItemType": "Unit",
      "label": "kN·m/rad",
      "phenomenon": "Units.ROTATIONAL_SPRING_CONSTANT",
      "unitSystem": "Units.METRIC",
      "definition": "KN_M*RAD(-1)",
      "numerator": 1,
      "denominator": 1,
      "offset": 0
    },
    "N_M_PER_DEG": {
      "schemaItemType": "Unit",
      "label": "N·m/deg",
      "phenomenon": "Units.ROTATIONAL_SPRING_CONSTANT",
      "unitSystem": "Units.METRIC",
      "definition": "N_M*ARC_DEG(-1)",
      "numerator": 1,
      "denominator": 1,
      "offset": 0
    },
    "KPF_FT_PER_RAD": {
      "schemaItemType": "Unit",
      "label": "kpf·ft/rad",
      "phenomenon": "Units.ROTATIONAL_SPRING_CONSTANT",
      "unitSystem": "Units.USCUSTOM",
      "definition": "KPF_FT*RAD(-1)",
      "numerator": 1,
      "denominator": 1,
      "offset": 0
    },
    "N_PER_RAD": {
      "schemaItemType": "Unit",
      "label": "N/rad",
      "phenomenon": "Units.LINEAR_ROTATIONAL_SPRING_CONSTANT",
      "unitSystem": "Units.SI",
      "definition": "N*RAD(-1)",
      "numerator": 1,
      "denominator": 1,
      "offset": 0
    },
    "KN_PER_RAD": {
      "schemaItemType": "Unit",
      "label": "kN/rad",
      "phenomenon": "Units.LINEAR_ROTATIONAL_SPRING_CONSTANT",
      "unitSystem": "Units.METRIC",
      "definition": "KN*RAD(-1)",
      "numerator": 1,
      "denominator": 1,
      "offset": 0
    },
    "KPF_PER_RAD": {
      "schemaItemType": "Unit",
      "label": "kpf/rad",
      "phenomenon": "Units.LINEAR_ROTATIONAL_SPRING_CONSTANT",
      "unitSystem": "Units.USCUSTOM",
      "definition": "KPF*RAD(-1)",
      "numerator": 1,
      "denominator": 1,
      "offset": 0
    },
    "SPRING_CONSTANT_N_PER_M": {
      "schemaItemType": "Unit",
      "label": "N/m",
      "phenomenon": "Units.SPRING_CONSTANT",
      "unitSystem": "Units.SI",
      "definition": "N*M(-1)",
      "numerator": 1,
      "denominator": 1,
      "offset": 0
    },
    "SPRING_CONSTANT_KN_PER_M": {
      "schemaItemType": "Unit",
      "label": "kN/m",
      "phenomenon": "Units.SPRING_CONSTANT",
      "unitSystem": "Units.METRIC",
      "definition": "KN*M(-1)",
      "numerator": 1,
      "denominator": 1,
      "offset": 0
    },
    "SPRING_CONSTANT_KPF_PER_FT": {
      "schemaItemType": "Unit",
      "label": "kpf/ft",
      "phenomenon": "Units.SPRING_CONSTANT",
      "unitSystem": "Units.USCUSTOM",
      "definition": "KPF*FT(-1)",
      "numerator": 1,
      "denominator": 1,
      "offset": 0
    },
    "LINEAR_SPRING_CONSTANT_N_PER_SQ_M": {
      "schemaItemType": "Unit",
      "label": "N/m²",
      "phenomenon": "Units.LINEAR_SPRING_CONSTANT",
      "unitSystem": "Units.SI",
      "definition": "SPRING_CONSTANT_N_PER_M*M(-1)",
      "numerator": 1,
      "denominator": 1,
      "offset": 0
    },
    "LINEAR_SPRING_CONSTANT_KN_PER_SQ_M": {
      "schemaItemType": "Unit",
      "label": "kN/m²",
      "phenomenon": "Units.LINEAR_SPRING_CONSTANT",
      "unitSystem": "Units.METRIC",
      "definition": "SPRING_CONSTANT_KN_PER_M*M(-1)",
      "numerator": 1,
      "denominator": 1,
      "offset": 0
    },
    "LINEAR_SPRING_CONSTANT_KPF_PER_SQ_FT": {
      "schemaItemType": "Unit",
      "label": "kpf/ft²",
      "phenomenon": "Units.LINEAR_SPRING_CONSTANT",
      "unitSystem": "Units.USCUSTOM",
      "definition": "SPRING_CONSTANT_KPF_PER_FT*FT(-1)",
      "numerator": 1,
      "denominator": 1,
      "offset": 0
    },
    "AREA_SPRING_CONSTANT_N_PER_CUB_M": {
      "schemaItemType": "Unit",
      "label": "N/m³",
      "phenomenon": "Units.AREA_SPRING_CONSTANT",
      "unitSystem": "Units.SI",
      "definition": "SPRING_CONSTANT_N_PER_M*SQ_M(-1)",
      "numerator": 1,
      "denominator": 1,
      "offset": 0
    },
    "AREA_SPRING_CONSTANT_KN_PER_CUB_M": {
      "schemaItemType": "Unit",
      "label": "kN/m³",
      "phenomenon": "Units.AREA_SPRING_CONSTANT",
      "unitSystem": "Units.METRIC",
      "definition": "SPRING_CONSTANT_KN_PER_M*SQ_M(-1)",
      "numerator": 1,
      "denominator": 1,
      "offset": 0
    },
    "AREA_SPRING_CONSTANT_KPF_PER_CUB_FT": {
      "schemaItemType": "Unit",
      "label": "kpf/ft³",
      "phenomenon": "Units.AREA_SPRING_CONSTANT",
      "unitSystem": "Units.USCUSTOM",
      "definition": "SPRING_CONSTANT_KPF_PER_FT*SQ_FT(-1)",
      "numerator": 1,
      "denominator": 1,
      "offset": 0
    },
    "M_PER_SEC_SQ": {
      "schemaItemType": "Unit",
      "label": "m/sec²",
      "phenomenon": "Units.ACCELERATION",
      "unitSystem": "Units.SI",
      "definition": "M*S(-2)",
      "numerator": 1,
      "denominator": 1,
      "offset": 0
    },
    "CM_PER_SEC_SQ": {
      "schemaItemType": "Unit",
      "label": "cm/sec²",
      "phenomenon": "Units.ACCELERATION",
      "unitSystem": "Units.METRIC",
      "definition": "CM*S(-2)",
      "numerator": 1,
      "denominator": 1,
      "offset": 0
    },
    "FT_PER_SEC_SQ": {
      "schemaItemType": "Unit",
      "label": "ft/sec²",
      "phenomenon": "Units.ACCELERATION",
      "unitSystem": "Units.USCUSTOM",
      "definition": "FT*S(-2)",
      "numerator": 1,
      "denominator": 1,
      "offset": 0
    },
    "ARC_DEG": {
      "schemaItemType": "Unit",
      "label": "°",
      "description": "1/180",
      "phenomenon": "Units.ANGLE",
      "unitSystem": "Units.METRIC",
      "definition": "[PI]*RAD",
      "numerator": 1,
      "denominator": 180,
      "offset": 0
    },
    "ARC_MINUTE": {
      "schemaItemType": "Unit",
      "label": "'",
      "description": "1/60",
      "phenomenon": "Units.ANGLE",
      "unitSystem": "Units.METRIC",
      "definition": "ARC_DEG",
      "numerator": 1,
      "denominator": 60,
      "offset": 0
    },
    "ARC_SECOND": {
      "schemaItemType": "Unit",
      "label": "''",
      "description": "1/3600",
      "phenomenon": "Units.ANGLE",
      "unitSystem": "Units.METRIC",
      "definition": "ARC_DEG",
      "numerator": 1,
      "denominator": 3600,
      "offset": 0
    },
    "ARC_QUADRANT": {
      "schemaItemType": "Unit",
      "label": "quadrants",
      "phenomenon": "Units.ANGLE",
      "unitSystem": "Units.METRIC",
      "definition": "[HALF_PI]*RAD",
      "numerator": 1,
      "denominator": 1,
      "offset": 0
    },
    "GRAD": {
      "schemaItemType": "Unit",
      "label": "grad",
      "description": "1/200",
      "phenomenon": "Units.ANGLE",
      "unitSystem": "Units.METRIC",
      "definition": "[PI]*RAD",
      "numerator": 1,
      "denominator": 200,
      "offset": 0
    },
    "REVOLUTION": {
      "schemaItemType": "Unit",
      "label": "r",
      "phenomenon": "Units.ANGLE",
      "unitSystem": "Units.METRIC",
      "definition": "[TWO_PI]*RAD",
      "numerator": 1,
      "denominator": 1,
      "offset": 0
    },
    "SQ_M": {
      "schemaItemType": "Unit",
      "label": "m²",
      "phenomenon": "Units.AREA",
      "unitSystem": "Units.SI",
      "definition": "M(2)",
      "numerator": 1,
      "denominator": 1,
      "offset": 0
    },
    "SQ_UM": {
      "schemaItemType": "Unit",
      "label": "um²",
      "phenomenon": "Units.AREA",
      "unitSystem": "Units.METRIC",
      "definition": "UM(2)",
      "numerator": 1,
      "denominator": 1,
      "offset": 0
    },
    "SQ_MM": {
      "schemaItemType": "Unit",
      "label": "mm²",
      "phenomenon": "Units.AREA",
      "unitSystem": "Units.METRIC",
      "definition": "MM(2)",
      "numerator": 1,
      "denominator": 1,
      "offset": 0
    },
    "SQ_CM": {
      "schemaItemType": "Unit",
      "label": "cm²",
      "phenomenon": "Units.AREA",
      "unitSystem": "Units.METRIC",
      "definition": "CM(2)",
      "numerator": 1,
      "denominator": 1,
      "offset": 0
    },
    "SQ_DM": {
      "schemaItemType": "Unit",
      "label": "dm²",
      "phenomenon": "Units.AREA",
      "unitSystem": "Units.METRIC",
      "definition": "DM(2)",
      "numerator": 1,
      "denominator": 1,
      "offset": 0
    },
    "SQ_KM": {
      "schemaItemType": "Unit",
      "label": "km²",
      "phenomenon": "Units.AREA",
      "unitSystem": "Units.METRIC",
      "definition": "KM(2)",
      "numerator": 1,
      "denominator": 1,
      "offset": 0
    },
    "ARE": {
      "schemaItemType": "Unit",
      "label": "are",
      "phenomenon": "Units.AREA",
      "unitSystem": "Units.METRIC",
      "definition": "[HECTO]*M(2)",
      "numerator": 1,
      "denominator": 1,
      "offset": 0
    },
    "HECTARE": {
      "schemaItemType": "Unit",
      "label": "ha",
      "phenomenon": "Units.AREA",
      "unitSystem": "Units.METRIC",
      "definition": "[HECTO]*ARE",
      "numerator": 1,
      "denominator": 1,
      "offset": 0
    },
    "SQ_IN": {
      "schemaItemType": "Unit",
      "label": "in²",
      "phenomenon": "Units.AREA",
      "unitSystem": "Units.USCUSTOM",
      "definition": "IN(2)",
      "numerator": 1,
      "denominator": 1,
      "offset": 0
    },
    "SQ_FT": {
      "schemaItemType": "Unit",
      "label": "ft²",
      "phenomenon": "Units.AREA",
      "unitSystem": "Units.USCUSTOM",
      "definition": "FT(2)",
      "numerator": 1,
      "denominator": 1,
      "offset": 0
    },
    "THOUSAND_SQ_FT": {
      "schemaItemType": "Unit",
      "label": "thousand ft²",
      "phenomenon": "Units.AREA",
      "unitSystem": "Units.USCUSTOM",
      "definition": "[KILO]*FT(2)",
      "numerator": 1,
      "denominator": 1,
      "offset": 0
    },
    "SQ_YRD": {
      "schemaItemType": "Unit",
      "label": "yd²",
      "phenomenon": "Units.AREA",
      "unitSystem": "Units.USCUSTOM",
      "definition": "YRD(2)",
      "numerator": 1,
      "denominator": 1,
      "offset": 0
    },
    "SQ_MILE": {
      "schemaItemType": "Unit",
      "label": "mi²",
      "phenomenon": "Units.AREA",
      "unitSystem": "Units.USCUSTOM",
      "definition": "MILE(2)",
      "numerator": 1,
      "denominator": 1,
      "offset": 0
    },
    "SQ_CHAIN": {
      "schemaItemType": "Unit",
      "label": "chain²",
      "phenomenon": "Units.AREA",
      "unitSystem": "Units.USCUSTOM",
      "definition": "CHAIN(2)",
      "numerator": 1,
      "denominator": 1,
      "offset": 0
    },
    "ACRE": {
      "schemaItemType": "Unit",
      "label": "acres",
      "description": "Exact, http://www.nist.gov/pml/wmd/pubs/upload/hb44-15-web-final.pdf, Appendix C. Section 4, Page C-9",
      "phenomenon": "Units.AREA",
      "unitSystem": "Units.USCUSTOM",
      "definition": "CHAIN(2)",
      "numerator": 10,
      "denominator": 1,
      "offset": 0
    },
    "SQ_US_SURVEY_IN": {
      "schemaItemType": "Unit",
      "label": "in² (US Survey)",
      "phenomenon": "Units.AREA",
      "unitSystem": "Units.USSURVEY",
      "definition": "US_SURVEY_IN(2)",
      "numerator": 1,
      "denominator": 1,
      "offset": 0
    },
    "SQ_US_SURVEY_FT": {
      "schemaItemType": "Unit",
      "label": "ft² (US Survey)",
      "phenomenon": "Units.AREA",
      "unitSystem": "Units.USSURVEY",
      "definition": "US_SURVEY_FT(2)",
      "numerator": 1,
      "denominator": 1,
      "offset": 0
    },
    "SQ_US_SURVEY_YRD": {
      "schemaItemType": "Unit",
      "label": "yrd² (US Survey)",
      "phenomenon": "Units.AREA",
      "unitSystem": "Units.USSURVEY",
      "definition": "US_SURVEY_YRD(2)",
      "numerator": 1,
      "denominator": 1,
      "offset": 0
    },
    "SQ_US_SURVEY_MILE": {
      "schemaItemType": "Unit",
      "label": "mile² (US Survey)",
      "phenomenon": "Units.AREA",
      "unitSystem": "Units.USSURVEY",
      "definition": "US_SURVEY_MILE(2)",
      "numerator": 1,
      "denominator": 1,
      "offset": 0
    },
    "SQ_US_SURVEY_CHAIN": {
      "schemaItemType": "Unit",
      "label": "chain² (US Survey)",
      "phenomenon": "Units.AREA",
      "unitSystem": "Units.USSURVEY",
      "definition": "US_SURVEY_CHAIN(2)",
      "numerator": 1,
      "denominator": 1,
      "offset": 0
    },
    "US_SURVEY_ACRE": {
      "schemaItemType": "Unit",
      "label": "acre (US Survey)",
      "description": "Exact, http://www.nist.gov/pml/wmd/pubs/upload/hb44-15-web-final.pdf, Appendix C. Section 4, Page C-9",
      "phenomenon": "Units.AREA",
      "unitSystem": "Units.USSURVEY",
      "definition": "US_SURVEY_CHAIN(2)",
      "numerator": 10,
      "denominator": 1,
      "offset": 0
    },
    "IN_MILE": {
      "schemaItemType": "Unit",
      "label": "in·mi",
      "phenomenon": "Units.PIPE_DIAMETER_LENGTH",
      "unitSystem": "Units.INDUSTRIAL",
      "definition": "IN*MILE",
      "numerator": 1,
      "denominator": 1,
      "offset": 0
    },
    "FT_MILE": {
      "schemaItemType": "Unit",
      "label": "ft·mi",
      "phenomenon": "Units.PIPE_DIAMETER_LENGTH",
      "unitSystem": "Units.INDUSTRIAL",
      "definition": "FT*MILE",
      "numerator": 1,
      "denominator": 1,
      "offset": 0
    },
    "FT_FT": {
      "schemaItemType": "Unit",
      "label": "ft·ft",
      "phenomenon": "Units.PIPE_DIAMETER_LENGTH",
      "unitSystem": "Units.INDUSTRIAL",
      "definition": "FT*FT",
      "numerator": 1,
      "denominator": 1,
      "offset": 0
    },
    "IN_FT": {
      "schemaItemType": "Unit",
      "label": "in·ft",
      "phenomenon": "Units.PIPE_DIAMETER_LENGTH",
      "unitSystem": "Units.INDUSTRIAL",
      "definition": "IN*FT",
      "numerator": 1,
      "denominator": 1,
      "offset": 0
    },
    "IN_M": {
      "schemaItemType": "Unit",
      "label": "in·m",
      "phenomenon": "Units.PIPE_DIAMETER_LENGTH",
      "unitSystem": "Units.INDUSTRIAL",
      "definition": "IN*M",
      "numerator": 1,
      "denominator": 1,
      "offset": 0
    },
    "MM_KM": {
      "schemaItemType": "Unit",
      "label": "mm·km",
      "phenomenon": "Units.PIPE_DIAMETER_LENGTH",
      "unitSystem": "Units.INDUSTRIAL",
      "definition": "MM*KM",
      "numerator": 1,
      "denominator": 1,
      "offset": 0
    },
    "MM_M": {
      "schemaItemType": "Unit",
      "label": "mm·m",
      "phenomenon": "Units.PIPE_DIAMETER_LENGTH",
      "unitSystem": "Units.INDUSTRIAL",
      "definition": "MM*M",
      "numerator": 1,
      "denominator": 1,
      "offset": 0
    },
    "MM_MILE": {
      "schemaItemType": "Unit",
      "label": "mm·mi",
      "phenomenon": "Units.PIPE_DIAMETER_LENGTH",
      "unitSystem": "Units.INDUSTRIAL",
      "definition": "MM*MILE",
      "numerator": 1,
      "denominator": 1,
      "offset": 0
    },
    "M_KM": {
      "schemaItemType": "Unit",
      "label": "m·km",
      "phenomenon": "Units.PIPE_DIAMETER_LENGTH",
      "unitSystem": "Units.INDUSTRIAL",
      "definition": "M*KM",
      "numerator": 1,
      "denominator": 1,
      "offset": 0
    },
    "M_M": {
      "schemaItemType": "Unit",
      "label": "m·m",
      "phenomenon": "Units.PIPE_DIAMETER_LENGTH",
      "unitSystem": "Units.SI",
      "definition": "M*M",
      "numerator": 1,
      "denominator": 1,
      "offset": 0
    },
    "KG_PER_CUB_M": {
      "schemaItemType": "Unit",
      "label": "kg/m³",
      "phenomenon": "Units.DENSITY",
      "unitSystem": "Units.SI",
      "definition": "KG*M(-3)",
      "numerator": 1,
      "denominator": 1,
      "offset": 0
    },
    "KG_PER_CUB_CM": {
      "schemaItemType": "Unit",
      "label": "kg/cm³",
      "phenomenon": "Units.DENSITY",
      "unitSystem": "Units.METRIC",
      "definition": "KG*CM(-3)",
      "numerator": 1,
      "denominator": 1,
      "offset": 0
    },
    "KG_PER_LITRE": {
      "schemaItemType": "Unit",
      "label": "kg/dm³",
      "phenomenon": "Units.DENSITY",
      "unitSystem": "Units.METRIC",
      "definition": "KG*DM(-3)",
      "numerator": 1,
      "denominator": 1,
      "offset": 0
    },
    "G_PER_CUB_CM": {
      "schemaItemType": "Unit",
      "label": "g/cm³",
      "phenomenon": "Units.DENSITY",
      "unitSystem": "Units.METRIC",
      "definition": "G*CM(-3)",
      "numerator": 1,
      "denominator": 1,
      "offset": 0
    },
    "MKG_PER_LITRE": {
      "schemaItemType": "Unit",
      "label": "µg/L",
      "phenomenon": "Units.DENSITY",
      "unitSystem": "Units.METRIC",
      "definition": "MKG*DM(-3)",
      "numerator": 1,
      "denominator": 1,
      "offset": 0
    },
    "MG_PER_LITRE": {
      "schemaItemType": "Unit",
      "label": "mg/L",
      "phenomenon": "Units.DENSITY",
      "unitSystem": "Units.METRIC",
      "definition": "MG*DM(-3)",
      "numerator": 1,
      "denominator": 1,
      "offset": 0
    },
    "LBM_PER_CUB_FT": {
      "schemaItemType": "Unit",
      "label": "lb/ft³",
      "phenomenon": "Units.DENSITY",
      "unitSystem": "Units.USCUSTOM",
      "definition": "LBM*FT(-3)",
      "numerator": 1,
      "denominator": 1,
      "offset": 0
    },
    "LBM_PER_GALLON": {
      "schemaItemType": "Unit",
      "label": "lb/gal",
      "phenomenon": "Units.DENSITY",
      "unitSystem": "Units.USCUSTOM",
      "definition": "LBM*GALLON(-1)",
      "numerator": 1,
      "denominator": 1,
      "offset": 0
    },
    "LBM_PER_GALLON_IMPERIAL": {
      "schemaItemType": "Unit",
      "label": "lb/gal (imp)",
      "phenomenon": "Units.DENSITY",
      "unitSystem": "Units.IMPERIAL",
      "definition": "LBM*GALLON_IMPERIAL(-1)",
      "numerator": 1,
      "denominator": 1,
      "offset": 0
    },
    "LBM_PER_CUB_IN": {
      "schemaItemType": "Unit",
      "label": "lb/in³",
      "phenomenon": "Units.DENSITY",
      "unitSystem": "Units.USCUSTOM",
      "definition": "LBM*IN(-3)",
      "numerator": 1,
      "denominator": 1,
      "offset": 0
    },
    "LBM_PER_MILLION_GALLON": {
      "schemaItemType": "Unit",
      "label": "lb/million gal",
      "phenomenon": "Units.DENSITY",
      "unitSystem": "Units.USCUSTOM",
      "definition": "LBM*[MEGA](-1)*GALLON(-1)",
      "numerator": 1,
      "denominator": 1,
      "offset": 0
    },
    "SLUG_PER_CUB_FT": {
      "schemaItemType": "Unit",
      "label": "slug/ft³",
      "phenomenon": "Units.DENSITY",
      "unitSystem": "Units.USCUSTOM",
      "definition": "SLUG*FT(-3)",
      "numerator": 1,
      "denominator": 1,
      "offset": 0
    },
    "KIP_PER_CUB_FT": {
      "schemaItemType": "Unit",
      "label": "kip/ft³",
      "phenomenon": "Units.DENSITY",
      "unitSystem": "Units.USCUSTOM",
      "definition": "KIPM*FT(-3)",
      "numerator": 1,
      "denominator": 1,
      "offset": 0
    },
    "SHORT_TON_PER_CUB_FT": {
      "schemaItemType": "Unit",
      "label": "tn (short)/ft³",
      "phenomenon": "Units.DENSITY",
      "unitSystem": "Units.USCUSTOM",
      "definition": "SHORT_TON_MASS*FT(-3)",
      "numerator": 1,
      "denominator": 1,
      "offset": 0
    },
    "N_PER_CUB_M": {
      "schemaItemType": "Unit",
      "label": "N/m³",
      "phenomenon": "Units.FORCE_DENSITY",
      "unitSystem": "Units.SI",
      "definition": "N*M(-3)",
      "numerator": 1,
      "denominator": 1,
      "offset": 0
    },
    "KN_PER_CUB_M": {
      "schemaItemType": "Unit",
      "label": "kN/m³",
      "phenomenon": "Units.FORCE_DENSITY",
      "unitSystem": "Units.METRIC",
      "definition": "[KILO]*N*M(-3)",
      "numerator": 1,
      "denominator": 1,
      "offset": 0
    },
    "KPF_PER_CUB_FT": {
      "schemaItemType": "Unit",
      "label": "kpf/ft³",
      "phenomenon": "Units.FORCE_DENSITY",
      "unitSystem": "Units.USCUSTOM",
      "definition": "KPF*FT(-3)",
      "numerator": 1,
      "denominator": 1,
      "offset": 0
    },
    "N_PER_CUB_FT": {
      "schemaItemType": "Unit",
      "label": "N/ft³",
      "phenomenon": "Units.FORCE_DENSITY",
      "unitSystem": "Units.USCUSTOM",
      "definition": "N*FT(-3)",
      "numerator": 1,
      "denominator": 1,
      "offset": 0
    },
    "KN_PER_CUB_FT": {
      "schemaItemType": "Unit",
      "label": "kN/ft³",
      "phenomenon": "Units.FORCE_DENSITY",
      "unitSystem": "Units.USCUSTOM",
      "definition": "[KILO]*N*FT(-3)",
      "numerator": 1,
      "denominator": 1,
      "offset": 0
    },
    "PERSON_PER_SQ_M": {
      "schemaItemType": "Unit",
      "label": "p/m²",
      "phenomenon": "Units.POPULATION_DENSITY",
      "unitSystem": "Units.SI",
      "definition": "PERSON*M(-2)",
      "numerator": 1,
      "denominator": 1,
      "offset": 0
    },
    "PERSON_PER_HECTARE": {
      "schemaItemType": "Unit",
      "label": "p/ha",
      "phenomenon": "Units.POPULATION_DENSITY",
      "unitSystem": "Units.METRIC",
      "definition": "PERSON*HECTARE(-1)",
      "numerator": 1,
      "denominator": 1,
      "offset": 0
    },
    "PERSON_PER_SQ_KM": {
      "schemaItemType": "Unit",
      "label": "p/km²",
      "phenomenon": "Units.POPULATION_DENSITY",
      "unitSystem": "Units.METRIC",
      "definition": "PERSON*KM(-2)",
      "numerator": 1,
      "denominator": 1,
      "offset": 0
    },
    "PERSON_PER_ACRE": {
      "schemaItemType": "Unit",
      "label": "p/acre",
      "phenomenon": "Units.POPULATION_DENSITY",
      "unitSystem": "Units.USCUSTOM",
      "definition": "PERSON*ACRE(-1)",
      "numerator": 1,
      "denominator": 1,
      "offset": 0
    },
    "PERSON_PER_SQ_FT": {
      "schemaItemType": "Unit",
      "label": "p/ft²",
      "phenomenon": "Units.POPULATION_DENSITY",
      "unitSystem": "Units.USCUSTOM",
      "definition": "PERSON*FT(-2)",
      "numerator": 1,
      "denominator": 1,
      "offset": 0
    },
    "PERSON_PER_SQ_MILE": {
      "schemaItemType": "Unit",
      "label": "p/mi²",
      "phenomenon": "Units.POPULATION_DENSITY",
      "unitSystem": "Units.USCUSTOM",
      "definition": "PERSON*MILE(-2)",
      "numerator": 1,
      "denominator": 1,
      "offset": 0
    },
    "KILOAMPERE": {
      "schemaItemType": "Unit",
      "label": "KA",
      "phenomenon": "Units.CURRENT",
      "unitSystem": "Units.METRIC",
      "definition": "[KILO]*A",
      "numerator": 1,
      "denominator": 1,
      "offset": 0
    },
    "MILLIAMPERE": {
      "schemaItemType": "Unit",
      "label": "mA",
      "phenomenon": "Units.CURRENT",
      "unitSystem": "Units.METRIC",
      "definition": "[MILLI]*A",
      "numerator": 1,
      "denominator": 1,
      "offset": 0
    },
    "MICROAMPERE": {
      "schemaItemType": "Unit",
      "label": "µA",
      "phenomenon": "Units.CURRENT",
      "unitSystem": "Units.METRIC",
      "definition": "[MICRO]*A",
      "numerator": 1,
      "denominator": 1,
      "offset": 0
    },
    "COULOMB": {
      "schemaItemType": "Unit",
      "label": "C",
      "phenomenon": "Units.ELECTRIC_CHARGE",
      "unitSystem": "Units.SI",
      "definition": "A*S",
      "numerator": 1,
      "denominator": 1,
      "offset": 0
    },
    "VOLT": {
      "schemaItemType": "Unit",
      "label": "V",
      "phenomenon": "Units.ELECTRIC_POTENTIAL",
      "unitSystem": "Units.SI",
      "definition": "N*M*COULOMB(-1)",
      "numerator": 1,
      "denominator": 1,
      "offset": 0
    },
    "KILOVOLT": {
      "schemaItemType": "Unit",
      "label": "KV",
      "phenomenon": "Units.ELECTRIC_POTENTIAL",
      "unitSystem": "Units.METRIC",
      "definition": "[KILO]*VOLT",
      "numerator": 1,
      "denominator": 1,
      "offset": 0
    },
    "MEGAVOLT": {
      "schemaItemType": "Unit",
      "label": "MV",
      "phenomenon": "Units.ELECTRIC_POTENTIAL",
      "unitSystem": "Units.METRIC",
      "definition": "[MEGA]*VOLT",
      "numerator": 1,
      "denominator": 1,
      "offset": 0
    },
    "J": {
      "schemaItemType": "Unit",
      "phenomenon": "Units.WORK",
      "unitSystem": "Units.SI",
      "definition": "N*M",
      "numerator": 1,
      "denominator": 1,
      "offset": 0
    },
    "KJ": {
      "schemaItemType": "Unit",
      "label": "kJ",
      "phenomenon": "Units.WORK",
      "unitSystem": "Units.METRIC",
      "definition": "[KILO]*J",
      "numerator": 1,
      "denominator": 1,
      "offset": 0
    },
    "MEGAJ": {
      "schemaItemType": "Unit",
      "label": "MJ",
      "phenomenon": "Units.WORK",
      "unitSystem": "Units.METRIC",
      "definition": "[MEGA]*J",
      "numerator": 1,
      "denominator": 1,
      "offset": 0
    },
    "GJ": {
      "schemaItemType": "Unit",
      "phenomenon": "Units.WORK",
      "unitSystem": "Units.METRIC",
      "definition": "[GIGA]*J",
      "numerator": 1,
      "denominator": 1,
      "offset": 0
    },
    "FT_PDL": {
      "schemaItemType": "Unit",
      "label": "ft*pdl",
      "phenomenon": "Units.WORK",
      "unitSystem": "Units.USCUSTOM",
      "definition": "PDL*FT",
      "numerator": 1,
      "denominator": 1,
      "offset": 0
    },
    "BTU": {
      "schemaItemType": "Unit",
      "label": "Btu",
      "description": "Is IT BTU.  http://physics.nist.gov/cuu/pdf/sp811.pdf, Appendix B.  See foot note #9: ",
      "phenomenon": "Units.WORK",
      "unitSystem": "Units.INTERNATIONAL",
      "definition": "J",
      "numerator": 1055.05585262,
      "denominator": 1,
      "offset": 0
    },
    "KILOBTU": {
      "schemaItemType": "Unit",
      "label": "kBtu",
      "phenomenon": "Units.WORK",
      "unitSystem": "Units.USCUSTOM",
      "definition": "[KILO]*BTU",
      "numerator": 1,
      "denominator": 1,
      "offset": 0
    },
    "WATT_SECOND": {
      "schemaItemType": "Unit",
      "label": "Ws",
      "phenomenon": "Units.WORK",
      "unitSystem": "Units.INTERNATIONAL",
      "definition": "W*S",
      "numerator": 1,
      "denominator": 1,
      "offset": 0
    },
    "KWH": {
      "schemaItemType": "Unit",
      "label": "kW·h",
      "phenomenon": "Units.WORK",
      "unitSystem": "Units.INTERNATIONAL",
      "definition": "KW*HR",
      "numerator": 1,
      "denominator": 1,
      "offset": 0
    },
    "MEGAWH": {
      "schemaItemType": "Unit",
      "label": "MWh",
      "phenomenon": "Units.WORK",
      "unitSystem": "Units.INTERNATIONAL",
      "definition": "MEGAW*HR",
      "numerator": 1,
      "denominator": 1,
      "offset": 0
    },
    "GWH": {
      "schemaItemType": "Unit",
      "label": "GWh",
      "phenomenon": "Units.WORK",
      "unitSystem": "Units.INTERNATIONAL",
      "definition": "GW*HR",
      "numerator": 1,
      "denominator": 1,
      "offset": 0
    },
    "J_PER_CUB_M": {
      "schemaItemType": "Unit",
      "label": "J/m³",
      "phenomenon": "Units.ENERGY_DENSITY",
      "unitSystem": "Units.SI",
      "definition": "J*M(-3)",
      "numerator": 1,
      "denominator": 1,
      "offset": 0
    },
    "KJ_PER_CUB_M": {
      "schemaItemType": "Unit",
      "label": "kJ/m³",
      "phenomenon": "Units.ENERGY_DENSITY",
      "unitSystem": "Units.METRIC",
      "definition": "KJ*M(-3)",
      "numerator": 1,
      "denominator": 1,
      "offset": 0
    },
    "KWH_PER_CUB_M": {
      "schemaItemType": "Unit",
      "label": "kW·h/m³",
      "phenomenon": "Units.ENERGY_DENSITY",
      "unitSystem": "Units.METRIC",
      "definition": "KWH*M(-3)",
      "numerator": 1,
      "denominator": 1,
      "offset": 0
    },
    "KWH_PER_CUB_FT": {
      "schemaItemType": "Unit",
      "label": "kWh/ft³",
      "phenomenon": "Units.ENERGY_DENSITY",
      "unitSystem": "Units.USCUSTOM",
      "definition": "KWH*FT(-3)",
      "numerator": 1,
      "denominator": 1,
      "offset": 0
    },
    "KWH_PER_MILLION_GALLON": {
      "schemaItemType": "Unit",
      "label": "kW·h/million gal",
      "phenomenon": "Units.ENERGY_DENSITY",
      "unitSystem": "Units.USCUSTOM",
      "definition": "KWH*[MEGA](-1)*GALLON(-1)",
      "numerator": 1,
      "denominator": 1,
      "offset": 0
    },
    "J_PER_KG": {
      "schemaItemType": "Unit",
      "label": "J/kg",
      "phenomenon": "Units.SPECIFIC_ENERGY",
      "unitSystem": "Units.SI",
      "definition": "J*KG(-1)",
      "numerator": 1,
      "denominator": 1,
      "offset": 0
    },
    "KJ_PER_KG": {
      "schemaItemType": "Unit",
      "label": "kJ/kg",
      "phenomenon": "Units.SPECIFIC_ENERGY",
      "unitSystem": "Units.METRIC",
      "definition": "KJ*KG(-1)",
      "numerator": 1,
      "denominator": 1,
      "offset": 0
    },
    "MEGAJ_PER_KG": {
      "schemaItemType": "Unit",
      "label": "MJ/kg",
      "phenomenon": "Units.SPECIFIC_ENERGY",
      "unitSystem": "Units.METRIC",
      "definition": "MEGAJ*KG(-1)",
      "numerator": 1,
      "denominator": 1,
      "offset": 0
    },
    "BTU_PER_LBM": {
      "schemaItemType": "Unit",
      "label": "Btu/lb",
      "phenomenon": "Units.SPECIFIC_ENERGY",
      "unitSystem": "Units.USCUSTOM",
      "definition": "BTU*LBM(-1)",
      "numerator": 1,
      "denominator": 1,
      "offset": 0
    },
    "J_PER_KG_K": {
      "schemaItemType": "Unit",
      "label": "J/(kg·ΔK)",
      "phenomenon": "Units.SPECIFIC_HEAT_CAPACITY",
      "unitSystem": "Units.SI",
      "definition": "J*KG(-1)*DELTA_KELVIN(-1)",
      "numerator": 1,
      "denominator": 1,
      "offset": 0
    },
    "BTU_PER_LBM_RANKINE": {
      "schemaItemType": "Unit",
      "label": "Btu/(lbm·Δ°R)",
      "phenomenon": "Units.SPECIFIC_HEAT_CAPACITY",
      "unitSystem": "Units.USCUSTOM",
      "definition": "BTU*LBM(-1)*DELTA_RANKINE(-1)",
      "numerator": 1,
      "denominator": 1,
      "offset": 0
    },
    "J_PER_G_CELSIUS": {
      "schemaItemType": "Unit",
      "label": "J/(g·Δ°C)",
      "phenomenon": "Units.SPECIFIC_HEAT_CAPACITY",
      "unitSystem": "Units.METRIC",
      "definition": "J*G(-1)*DELTA_CELSIUS(-1)",
      "numerator": 1,
      "denominator": 1,
      "offset": 0
    },
    "J_PER_MOL_K": {
      "schemaItemType": "Unit",
      "label": "J/(mol*K)",
      "phenomenon": "Units.SPECIFIC_HEAT_CAPACITY_MOLAR",
      "unitSystem": "Units.SI",
      "definition": "J*MOL(-1)*DELTA_KELVIN(-1)",
      "numerator": 1,
      "denominator": 1,
      "offset": 0
    },
    "J_PER_KMOL_K": {
      "schemaItemType": "Unit",
      "label": "J/(kmol·ΔK)",
      "phenomenon": "Units.SPECIFIC_HEAT_CAPACITY_MOLAR",
      "unitSystem": "Units.METRIC",
      "definition": "J*KMOL(-1)*DELTA_KELVIN(-1)",
      "numerator": 1,
      "denominator": 1,
      "offset": 0
    },
    "KJ_PER_KMOL_K": {
      "schemaItemType": "Unit",
      "label": "kJ/(kmol·ΔK)",
      "phenomenon": "Units.SPECIFIC_HEAT_CAPACITY_MOLAR",
      "unitSystem": "Units.METRIC",
      "definition": "KJ*KMOL(-1)*DELTA_KELVIN(-1)",
      "numerator": 1,
      "denominator": 1,
      "offset": 0
    },
    "BTU_PER_LB_MOL_RANKINE": {
      "schemaItemType": "Unit",
      "label": "Btu/(lb-mol·Δ°R)",
      "phenomenon": "Units.SPECIFIC_HEAT_CAPACITY_MOLAR",
      "unitSystem": "Units.USCUSTOM",
      "definition": "BTU*LB_MOL(-1)*DELTA_RANKINE(-1)",
      "numerator": 1,
      "denominator": 1,
      "offset": 0
    },
    "CUB_M_PER_SEC": {
      "schemaItemType": "Unit",
      "label": "m³/s",
      "phenomenon": "Units.VOLUMETRIC_FLOW",
      "unitSystem": "Units.SI",
      "definition": "M(3)*S(-1)",
      "numerator": 1,
      "denominator": 1,
      "offset": 0
    },
    "CUB_M_PER_MIN": {
      "schemaItemType": "Unit",
      "label": "m³/min",
      "phenomenon": "Units.VOLUMETRIC_FLOW",
      "unitSystem": "Units.METRIC",
      "definition": "M(3)*MIN(-1)",
      "numerator": 1,
      "denominator": 1,
      "offset": 0
    },
    "CUB_M_PER_HR": {
      "schemaItemType": "Unit",
      "label": "m³/h",
      "phenomenon": "Units.VOLUMETRIC_FLOW",
      "unitSystem": "Units.METRIC",
      "definition": "M(3)*HR(-1)",
      "numerator": 1,
      "denominator": 1,
      "offset": 0
    },
    "CUB_M_PER_DAY": {
      "schemaItemType": "Unit",
      "label": "m³/day",
      "phenomenon": "Units.VOLUMETRIC_FLOW",
      "unitSystem": "Units.METRIC",
      "definition": "M(3)*DAY(-1)",
      "numerator": 1,
      "denominator": 1,
      "offset": 0
    },
    "LITRE_PER_SEC": {
      "schemaItemType": "Unit",
      "label": "L/s",
      "phenomenon": "Units.VOLUMETRIC_FLOW",
      "unitSystem": "Units.METRIC",
      "definition": "LITRE*S(-1)",
      "numerator": 1,
      "denominator": 1,
      "offset": 0
    },
    "LITRE_PER_MIN": {
      "schemaItemType": "Unit",
      "label": "L/min",
      "phenomenon": "Units.VOLUMETRIC_FLOW",
      "unitSystem": "Units.METRIC",
      "definition": "LITRE*MIN(-1)",
      "numerator": 1,
      "denominator": 1,
      "offset": 0
    },
    "LITRE_PER_HR": {
      "schemaItemType": "Unit",
      "label": "L/h",
      "phenomenon": "Units.VOLUMETRIC_FLOW",
      "unitSystem": "Units.METRIC",
      "definition": "LITRE*HR(-1)",
      "numerator": 1,
      "denominator": 1,
      "offset": 0
    },
    "LITRE_PER_DAY": {
      "schemaItemType": "Unit",
      "label": "L/day",
      "phenomenon": "Units.VOLUMETRIC_FLOW",
      "unitSystem": "Units.METRIC",
      "definition": "LITRE*DAY(-1)",
      "numerator": 1,
      "denominator": 1,
      "offset": 0
    },
    "CUB_IN_PER_SEC": {
      "schemaItemType": "Unit",
      "label": "in³/sec",
      "phenomenon": "Units.VOLUMETRIC_FLOW",
      "unitSystem": "Units.USCUSTOM",
      "definition": "CUB_IN*S(-1)",
      "numerator": 1,
      "denominator": 1,
      "offset": 0
    },
    "CUB_IN_PER_MIN": {
      "schemaItemType": "Unit",
      "label": "in³/min",
      "phenomenon": "Units.VOLUMETRIC_FLOW",
      "unitSystem": "Units.USCUSTOM",
      "definition": "CUB_IN*MIN(-1)",
      "numerator": 1,
      "denominator": 1,
      "offset": 0
    },
    "CUB_FT_PER_SEC": {
      "schemaItemType": "Unit",
      "label": "ft³/s",
      "phenomenon": "Units.VOLUMETRIC_FLOW",
      "unitSystem": "Units.USCUSTOM",
      "definition": "CUB_FT*S(-1)",
      "numerator": 1,
      "denominator": 1,
      "offset": 0
    },
    "CUB_FT_PER_MIN": {
      "schemaItemType": "Unit",
      "label": "ft³/min",
      "phenomenon": "Units.VOLUMETRIC_FLOW",
      "unitSystem": "Units.USCUSTOM",
      "definition": "CUB_FT*MIN(-1)",
      "numerator": 1,
      "denominator": 1,
      "offset": 0
    },
    "CUB_FT_PER_DAY": {
      "schemaItemType": "Unit",
      "label": "ft³/day",
      "phenomenon": "Units.VOLUMETRIC_FLOW",
      "unitSystem": "Units.USCUSTOM",
      "definition": "CUB_FT*DAY(-1)",
      "numerator": 1,
      "denominator": 1,
      "offset": 0
    },
    "ACRE_FT_PER_DAY": {
      "schemaItemType": "Unit",
      "label": "acre·ft/day",
      "phenomenon": "Units.VOLUMETRIC_FLOW",
      "unitSystem": "Units.USCUSTOM",
      "definition": "ACRE_FT*DAY(-1)",
      "numerator": 1,
      "denominator": 1,
      "offset": 0
    },
    "ACRE_FT_PER_HR": {
      "schemaItemType": "Unit",
      "label": "acre·ft/h",
      "phenomenon": "Units.VOLUMETRIC_FLOW",
      "unitSystem": "Units.USCUSTOM",
      "definition": "ACRE_FT*HR(-1)",
      "numerator": 1,
      "denominator": 1,
      "offset": 0
    },
    "ACRE_FT_PER_MIN": {
      "schemaItemType": "Unit",
      "label": "acre·ft/min",
      "phenomenon": "Units.VOLUMETRIC_FLOW",
      "unitSystem": "Units.USCUSTOM",
      "definition": "ACRE_FT*MIN(-1)",
      "numerator": 1,
      "denominator": 1,
      "offset": 0
    },
    "ACRE_IN_PER_DAY": {
      "schemaItemType": "Unit",
      "label": "acre_in/day",
      "phenomenon": "Units.VOLUMETRIC_FLOW",
      "unitSystem": "Units.USCUSTOM",
      "definition": "ACRE_IN*DAY(-1)",
      "numerator": 1,
      "denominator": 1,
      "offset": 0
    },
    "ACRE_IN_PER_HR": {
      "schemaItemType": "Unit",
      "label": "acre·in/h",
      "phenomenon": "Units.VOLUMETRIC_FLOW",
      "unitSystem": "Units.USCUSTOM",
      "definition": "ACRE_IN*HR(-1)",
      "numerator": 1,
      "denominator": 1,
      "offset": 0
    },
    "ACRE_IN_PER_MIN": {
      "schemaItemType": "Unit",
      "label": "acre·in/min",
      "phenomenon": "Units.VOLUMETRIC_FLOW",
      "unitSystem": "Units.USCUSTOM",
      "definition": "ACRE_IN*MIN(-1)",
      "numerator": 1,
      "denominator": 1,
      "offset": 0
    },
    "GALLON_IMPERIAL_PER_SEC": {
      "schemaItemType": "Unit",
      "label": "gal (imp)/s",
      "phenomenon": "Units.VOLUMETRIC_FLOW",
      "unitSystem": "Units.IMPERIAL",
      "definition": "GALLON_IMPERIAL*S(-1)",
      "numerator": 1,
      "denominator": 1,
      "offset": 0
    },
    "GALLON_IMPERIAL_PER_MIN": {
      "schemaItemType": "Unit",
      "label": "gal (imp)/min",
      "phenomenon": "Units.VOLUMETRIC_FLOW",
      "unitSystem": "Units.IMPERIAL",
      "definition": "GALLON_IMPERIAL*MIN(-1)",
      "numerator": 1,
      "denominator": 1,
      "offset": 0
    },
    "GALLON_IMPERIAL_PER_HR": {
      "schemaItemType": "Unit",
      "label": "gal (imp)/h",
      "phenomenon": "Units.VOLUMETRIC_FLOW",
      "unitSystem": "Units.IMPERIAL",
      "definition": "GALLON_IMPERIAL*HR(-1)",
      "numerator": 1,
      "denominator": 1,
      "offset": 0
    },
    "GALLON_IMPERIAL_PER_DAY": {
      "schemaItemType": "Unit",
      "label": "gal (imp)/day",
      "phenomenon": "Units.VOLUMETRIC_FLOW",
      "unitSystem": "Units.IMPERIAL",
      "definition": "GALLON_IMPERIAL*DAY(-1)",
      "numerator": 1,
      "denominator": 1,
      "offset": 0
    },
    "GALLON_PER_SEC": {
      "schemaItemType": "Unit",
      "label": "gal/s",
      "phenomenon": "Units.VOLUMETRIC_FLOW",
      "unitSystem": "Units.USCUSTOM",
      "definition": "GALLON*S(-1)",
      "numerator": 1,
      "denominator": 1,
      "offset": 0
    },
    "GALLON_PER_MIN": {
      "schemaItemType": "Unit",
      "label": "gal/min",
      "phenomenon": "Units.VOLUMETRIC_FLOW",
      "unitSystem": "Units.USCUSTOM",
      "definition": "GALLON*MIN(-1)",
      "numerator": 1,
      "denominator": 1,
      "offset": 0
    },
    "GALLON_PER_HR": {
      "schemaItemType": "Unit",
      "label": "gal/h",
      "phenomenon": "Units.VOLUMETRIC_FLOW",
      "unitSystem": "Units.USCUSTOM",
      "definition": "GALLON*HR(-1)",
      "numerator": 1,
      "denominator": 1,
      "offset": 0
    },
    "GALLON_PER_DAY": {
      "schemaItemType": "Unit",
      "label": "gal/day",
      "phenomenon": "Units.VOLUMETRIC_FLOW",
      "unitSystem": "Units.USCUSTOM",
      "definition": "GALLON*DAY(-1)",
      "numerator": 1,
      "denominator": 1,
      "offset": 0
    },
    "HZ": {
      "schemaItemType": "Unit",
      "label": "Hz",
      "phenomenon": "Units.FREQUENCY",
      "unitSystem": "Units.SI",
      "definition": "S(-1)",
      "numerator": 1,
      "denominator": 1,
      "offset": 0
    },
    "KHZ": {
      "schemaItemType": "Unit",
      "label": "KHz",
      "phenomenon": "Units.FREQUENCY",
      "unitSystem": "Units.METRIC",
      "definition": "[KILO]*S(-1)",
      "numerator": 1,
      "denominator": 1,
      "offset": 0
    },
    "MHZ": {
      "schemaItemType": "Unit",
      "label": "MHz",
      "phenomenon": "Units.FREQUENCY",
      "unitSystem": "Units.METRIC",
      "definition": "[MEGA]*S(-1)",
      "numerator": 1,
      "denominator": 1,
      "offset": 0
    },
    "CUB_M_PER_SQ_M_SEC": {
      "schemaItemType": "Unit",
      "label": "m³/(m²*sec)",
      "phenomenon": "Units.FLOW_DENSITY_PER_AREA",
      "unitSystem": "Units.SI",
      "definition": "M*S(-1)",
      "numerator": 1,
      "denominator": 1,
      "offset": 0
    },
    "CUB_M_PER_SQ_M_DAY": {
      "schemaItemType": "Unit",
      "label": "m³/(m²·day)",
      "phenomenon": "Units.FLOW_DENSITY_PER_AREA",
      "unitSystem": "Units.METRIC",
      "definition": "M*DAY(-1)",
      "numerator": 1,
      "denominator": 1,
      "offset": 0
    },
    "CUB_M_PER_HECTARE_DAY": {
      "schemaItemType": "Unit",
      "label": "m³/(ha·day)",
      "phenomenon": "Units.FLOW_DENSITY_PER_AREA",
      "unitSystem": "Units.METRIC",
      "definition": "CUB_M*HECTARE(-1)*DAY(-1)",
      "numerator": 1,
      "denominator": 1,
      "offset": 0
    },
    "CUB_M_PER_SQ_KM_DAY": {
      "schemaItemType": "Unit",
      "label": "m³/(km²·day)",
      "phenomenon": "Units.FLOW_DENSITY_PER_AREA",
      "unitSystem": "Units.METRIC",
      "definition": "CUB_M*KM(-2)*DAY(-1)",
      "numerator": 1,
      "denominator": 1,
      "offset": 0
    },
    "LITRE_PER_SQ_M_SEC": {
      "schemaItemType": "Unit",
      "label": "L/(m²·s)",
      "phenomenon": "Units.FLOW_DENSITY_PER_AREA",
      "unitSystem": "Units.METRIC",
      "definition": "LITRE*M(-2)*S(-1)",
      "numerator": 1,
      "denominator": 1,
      "offset": 0
    },
    "CUB_FT_PER_SQ_FT_MIN": {
      "schemaItemType": "Unit",
      "label": "ft³/(ft²·min)",
      "phenomenon": "Units.FLOW_DENSITY_PER_AREA",
      "unitSystem": "Units.USCUSTOM",
      "definition": "FT*MIN(-1)",
      "numerator": 1,
      "denominator": 1,
      "offset": 0
    },
    "CUB_FT_PER_SQ_FT_SEC": {
      "schemaItemType": "Unit",
      "label": "ft³/(ft²·s)",
      "phenomenon": "Units.FLOW_DENSITY_PER_AREA",
      "unitSystem": "Units.USCUSTOM",
      "definition": "FT*S(-1)",
      "numerator": 1,
      "denominator": 1,
      "offset": 0
    },
    "CUB_FT_PER_SQ_MILE_SEC": {
      "schemaItemType": "Unit",
      "label": "ft³/(mi²·s)",
      "phenomenon": "Units.FLOW_DENSITY_PER_AREA",
      "unitSystem": "Units.USCUSTOM",
      "definition": "FT(3)*MILE(-2)*S(-1)",
      "numerator": 1,
      "denominator": 1,
      "offset": 0
    },
    "CUB_FT_PER_ACRE_SEC": {
      "schemaItemType": "Unit",
      "label": "ft³/(acres·s)",
      "phenomenon": "Units.FLOW_DENSITY_PER_AREA",
      "unitSystem": "Units.USCUSTOM",
      "definition": "FT(3)*ACRE(-1)*S(-1)",
      "numerator": 1,
      "denominator": 1,
      "offset": 0
    },
    "GALLON_PER_ACRE_DAY": {
      "schemaItemType": "Unit",
      "label": "gal/(acre·day)",
      "phenomenon": "Units.FLOW_DENSITY_PER_AREA",
      "unitSystem": "Units.USCUSTOM",
      "definition": "GALLON*DAY(-1)*ACRE(-1)",
      "numerator": 1,
      "denominator": 1,
      "offset": 0
    },
    "GALLON_PER_ACRE_MIN": {
      "schemaItemType": "Unit",
      "label": "gal/(acre·min)",
      "phenomenon": "Units.FLOW_DENSITY_PER_AREA",
      "unitSystem": "Units.USCUSTOM",
      "definition": "GALLON*MIN(-1)*ACRE(-1)",
      "numerator": 1,
      "denominator": 1,
      "offset": 0
    },
    "GALLON_PER_SQ_FT_MIN": {
      "schemaItemType": "Unit",
      "label": "gal/(ft²·min)",
      "phenomenon": "Units.FLOW_DENSITY_PER_AREA",
      "unitSystem": "Units.USCUSTOM",
      "definition": "GALLON*MIN(-1)*FT(-2)",
      "numerator": 1,
      "denominator": 1,
      "offset": 0
    },
    "GALLON_PER_SQ_FT_DAY": {
      "schemaItemType": "Unit",
      "label": "gal/(ft²·day)",
      "phenomenon": "Units.FLOW_DENSITY_PER_AREA",
      "unitSystem": "Units.USCUSTOM",
      "definition": "GALLON*DAY(-1)*FT(-2)",
      "numerator": 1,
      "denominator": 1,
      "offset": 0
    },
    "GALLON_PER_SQ_MILE_MIN": {
      "schemaItemType": "Unit",
      "label": "gal/(mi²·min)",
      "phenomenon": "Units.FLOW_DENSITY_PER_AREA",
      "unitSystem": "Units.USCUSTOM",
      "definition": "GALLON*MIN(-1)*MILE(-2)",
      "numerator": 1,
      "denominator": 1,
      "offset": 0
    },
    "GALLON_PER_SQ_MILE_DAY": {
      "schemaItemType": "Unit",
      "label": "gal/(mi²·day)",
      "phenomenon": "Units.FLOW_DENSITY_PER_AREA",
      "unitSystem": "Units.USCUSTOM",
      "definition": "GALLON*DAY(-1)*MILE(-2)",
      "numerator": 1,
      "denominator": 1,
      "offset": 0
    },
    "KG_PER_KG": {
      "schemaItemType": "Unit",
      "label": "kg/kg",
      "phenomenon": "Units.MASS_RATIO",
      "unitSystem": "Units.SI",
      "definition": "KG*KG(-1)",
      "numerator": 1,
      "denominator": 1,
      "offset": 0
    },
    "GRM_PER_LBM": {
      "schemaItemType": "Unit",
      "label": "gr/lb",
      "phenomenon": "Units.MASS_RATIO",
      "unitSystem": "Units.USCUSTOM",
      "definition": "GRM*LBM(-1)",
      "numerator": 1,
      "denominator": 1,
      "offset": 0
    },
    "KG_PER_SEC": {
      "schemaItemType": "Unit",
      "label": "kg/s",
      "phenomenon": "Units.MASS_FLOW",
      "unitSystem": "Units.SI",
      "definition": "KG*S(-1)",
      "numerator": 1,
      "denominator": 1,
      "offset": 0
    },
    "KG_PER_MIN": {
      "schemaItemType": "Unit",
      "label": "kg/min",
      "phenomenon": "Units.MASS_FLOW",
      "unitSystem": "Units.METRIC",
      "definition": "KG*MIN(-1)",
      "numerator": 1,
      "denominator": 1,
      "offset": 0
    },
    "KG_PER_HR": {
      "schemaItemType": "Unit",
      "label": "kg/h",
      "phenomenon": "Units.MASS_FLOW",
      "unitSystem": "Units.METRIC",
      "definition": "KG*HR(-1)",
      "numerator": 1,
      "denominator": 1,
      "offset": 0
    },
    "KG_PER_DAY": {
      "schemaItemType": "Unit",
      "label": "kg/day",
      "phenomenon": "Units.MASS_FLOW",
      "unitSystem": "Units.METRIC",
      "definition": "KG*DAY(-1)",
      "numerator": 1,
      "denominator": 1,
      "offset": 0
    },
    "G_PER_SEC": {
      "schemaItemType": "Unit",
      "label": "g/s",
      "phenomenon": "Units.MASS_FLOW",
      "unitSystem": "Units.METRIC",
      "definition": "G*S(-1)",
      "numerator": 1,
      "denominator": 1,
      "offset": 0
    },
    "G_PER_MIN": {
      "schemaItemType": "Unit",
      "label": "g/min",
      "phenomenon": "Units.MASS_FLOW",
      "unitSystem": "Units.METRIC",
      "definition": "G*MIN(-1)",
      "numerator": 1,
      "denominator": 1,
      "offset": 0
    },
    "G_PER_HR": {
      "schemaItemType": "Unit",
      "label": "g/h",
      "phenomenon": "Units.MASS_FLOW",
      "unitSystem": "Units.METRIC",
      "definition": "G*HR(-1)",
      "numerator": 1,
      "denominator": 1,
      "offset": 0
    },
    "MG_PER_SEC": {
      "schemaItemType": "Unit",
      "label": "mg/s",
      "phenomenon": "Units.MASS_FLOW",
      "unitSystem": "Units.METRIC",
      "definition": "MG*S(-1)",
      "numerator": 1,
      "denominator": 1,
      "offset": 0
    },
    "MG_PER_MIN": {
      "schemaItemType": "Unit",
      "label": "mg/min",
      "phenomenon": "Units.MASS_FLOW",
      "unitSystem": "Units.METRIC",
      "definition": "MG*MIN(-1)",
      "numerator": 1,
      "denominator": 1,
      "offset": 0
    },
    "MG_PER_HR": {
      "schemaItemType": "Unit",
      "label": "mg/h",
      "phenomenon": "Units.MASS_FLOW",
      "unitSystem": "Units.METRIC",
      "definition": "MG*HR(-1)",
      "numerator": 1,
      "denominator": 1,
      "offset": 0
    },
    "MG_PER_DAY": {
      "schemaItemType": "Unit",
      "label": "mg/day",
      "phenomenon": "Units.MASS_FLOW",
      "unitSystem": "Units.METRIC",
      "definition": "MG*DAY(-1)",
      "numerator": 1,
      "denominator": 1,
      "offset": 0
    },
    "MKG_PER_SEC": {
      "schemaItemType": "Unit",
      "label": "µg/s",
      "phenomenon": "Units.MASS_FLOW",
      "unitSystem": "Units.METRIC",
      "definition": "MKG*S(-1)",
      "numerator": 1,
      "denominator": 1,
      "offset": 0
    },
    "MKG_PER_MIN": {
      "schemaItemType": "Unit",
      "label": "µg/min",
      "phenomenon": "Units.MASS_FLOW",
      "unitSystem": "Units.METRIC",
      "definition": "MKG*MIN(-1)",
      "numerator": 1,
      "denominator": 1,
      "offset": 0
    },
    "MKG_PER_HR": {
      "schemaItemType": "Unit",
      "label": "µg/h",
      "phenomenon": "Units.MASS_FLOW",
      "unitSystem": "Units.METRIC",
      "definition": "MKG*HR(-1)",
      "numerator": 1,
      "denominator": 1,
      "offset": 0
    },
    "MKG_PER_DAY": {
      "schemaItemType": "Unit",
      "label": "µg/day",
      "phenomenon": "Units.MASS_FLOW",
      "unitSystem": "Units.METRIC",
      "definition": "MKG*DAY(-1)",
      "numerator": 1,
      "denominator": 1,
      "offset": 0
    },
    "TONNE_PER_HR": {
      "schemaItemType": "Unit",
      "label": "tph",
      "phenomenon": "Units.MASS_FLOW",
      "unitSystem": "Units.METRIC",
      "definition": "TONNE*HR(-1)",
      "numerator": 1,
      "denominator": 1,
      "offset": 0
    },
    "LBM_PER_SEC": {
      "schemaItemType": "Unit",
      "label": "lb/s",
      "phenomenon": "Units.MASS_FLOW",
      "unitSystem": "Units.USCUSTOM",
      "definition": "LBM*S(-1)",
      "numerator": 1,
      "denominator": 1,
      "offset": 0
    },
    "LBM_PER_MIN": {
      "schemaItemType": "Unit",
      "label": "lb/min",
      "phenomenon": "Units.MASS_FLOW",
      "unitSystem": "Units.USCUSTOM",
      "definition": "LBM*MIN(-1)",
      "numerator": 1,
      "denominator": 1,
      "offset": 0
    },
    "LBM_PER_HR": {
      "schemaItemType": "Unit",
      "label": "lb/h",
      "phenomenon": "Units.MASS_FLOW",
      "unitSystem": "Units.USCUSTOM",
      "definition": "LBM*HR(-1)",
      "numerator": 1,
      "denominator": 1,
      "offset": 0
    },
    "LBM_PER_DAY": {
      "schemaItemType": "Unit",
      "label": "lb/day",
      "phenomenon": "Units.MASS_FLOW",
      "unitSystem": "Units.USCUSTOM",
      "definition": "LBM*DAY(-1)",
      "numerator": 1,
      "denominator": 1,
      "offset": 0
    },
    "SHORT_TON_PER_HR": {
      "schemaItemType": "Unit",
      "label": "tph",
      "phenomenon": "Units.MASS_FLOW",
      "unitSystem": "Units.USCUSTOM",
      "definition": "SHORT_TON_MASS*HR(-1)",
      "numerator": 1,
      "denominator": 1,
      "offset": 0
    },
    "MOL_PER_SEC": {
      "schemaItemType": "Unit",
      "label": "mol/s",
      "phenomenon": "Units.MOLAR_FLOW",
      "unitSystem": "Units.SI",
      "definition": "MOL*S(-1)",
      "numerator": 1,
      "denominator": 1,
      "offset": 0
    },
    "KMOL_PER_SEC": {
      "schemaItemType": "Unit",
      "label": "kmol/s",
      "phenomenon": "Units.MOLAR_FLOW",
      "unitSystem": "Units.METRIC",
      "definition": "[KILO]*MOL*S(-1)",
      "numerator": 1,
      "denominator": 1,
      "offset": 0
    },
    "N": {
      "schemaItemType": "Unit",
      "phenomenon": "Units.FORCE",
      "unitSystem": "Units.SI",
      "definition": "KG*M*S(-2)",
      "numerator": 1,
      "denominator": 1,
      "offset": 0
    },
    "KN": {
      "schemaItemType": "Unit",
      "label": "kN",
      "phenomenon": "Units.FORCE",
      "unitSystem": "Units.METRIC",
      "definition": "[KILO]*N",
      "numerator": 1,
      "denominator": 1,
      "offset": 0
    },
    "MN": {
      "schemaItemType": "Unit",
      "label": "mN",
      "phenomenon": "Units.FORCE",
      "unitSystem": "Units.METRIC",
      "definition": "[MILLI]*N",
      "numerator": 1,
      "denominator": 1,
      "offset": 0
    },
    "MEGAN": {
      "schemaItemType": "Unit",
      "label": "MN",
      "phenomenon": "Units.FORCE",
      "unitSystem": "Units.METRIC",
      "definition": "[MEGA]*N",
      "numerator": 1,
      "denominator": 1,
      "offset": 0
    },
    "KGF": {
      "schemaItemType": "Unit",
      "label": "kgf",
      "phenomenon": "Units.FORCE",
      "unitSystem": "Units.METRIC",
      "definition": "[STD_G]*KG",
      "numerator": 1,
      "denominator": 1,
      "offset": 0
    },
    "DYNE": {
      "schemaItemType": "Unit",
      "label": "dyn",
      "phenomenon": "Units.FORCE",
      "unitSystem": "Units.METRIC",
      "definition": "G*CM*S(-2)",
      "numerator": 1,
      "denominator": 1,
      "offset": 0
    },
    "PDL": {
      "schemaItemType": "Unit",
      "label": "pdl",
      "phenomenon": "Units.FORCE",
      "unitSystem": "Units.USCUSTOM",
      "definition": "LBM*FT*S(-2)",
      "numerator": 1,
      "denominator": 1,
      "offset": 0
    },
    "SHORT_TON_FORCE": {
      "schemaItemType": "Unit",
      "label": "tnf (short)",
      "phenomenon": "Units.FORCE",
      "unitSystem": "Units.USCUSTOM",
      "definition": "[STD_G]*SHORT_TON_MASS",
      "numerator": 1,
      "denominator": 1,
      "offset": 0
    },
    "LONG_TON_FORCE": {
      "schemaItemType": "Unit",
      "label": "tnf (long)",
      "phenomenon": "Units.FORCE",
      "unitSystem": "Units.USCUSTOM",
      "definition": "[STD_G]*LONG_TON_MASS",
      "numerator": 1,
      "denominator": 1,
      "offset": 0
    },
    "LBF": {
      "schemaItemType": "Unit",
      "label": "lbf",
      "phenomenon": "Units.FORCE",
      "unitSystem": "Units.USCUSTOM",
      "definition": "[STD_G]*LBM",
      "numerator": 1,
      "denominator": 1,
      "offset": 0
    },
    "OZF": {
      "schemaItemType": "Unit",
      "label": "ozf",
      "phenomenon": "Units.FORCE",
      "unitSystem": "Units.USCUSTOM",
      "definition": "[STD_G]*OZM",
      "numerator": 1,
      "denominator": 1,
      "offset": 0
    },
    "KPF": {
      "schemaItemType": "Unit",
      "label": "kpf",
      "phenomenon": "Units.FORCE",
      "unitSystem": "Units.USCUSTOM",
      "definition": "[KILO]*LBF",
      "numerator": 1,
      "denominator": 1,
      "offset": 0
    },
    "W_PER_SQ_M": {
      "schemaItemType": "Unit",
      "label": "W/m²",
      "phenomenon": "Units.HEAT_FLUX_DENSITY",
      "unitSystem": "Units.SI",
      "definition": "W*M(-2)",
      "numerator": 1,
      "denominator": 1,
      "offset": 0
    },
    "W_PER_SQ_M_K": {
      "schemaItemType": "Unit",
      "label": "W/(m²·ΔK)",
      "phenomenon": "Units.HEAT_TRANSFER",
      "unitSystem": "Units.SI",
      "definition": "W*M(-2)*DELTA_KELVIN(-1)",
      "numerator": 1,
      "denominator": 1,
      "offset": 0
    },
    "W_PER_SQ_M_CELSIUS": {
      "schemaItemType": "Unit",
      "label": "W/(m²·Δ°C)",
      "phenomenon": "Units.HEAT_TRANSFER",
      "unitSystem": "Units.METRIC",
      "definition": "W*M(-2)*DELTA_CELSIUS(-1)",
      "numerator": 1,
      "denominator": 1,
      "offset": 0
    },
    "BTU_PER_SQ_FT_HR_FAHRENHEIT": {
      "schemaItemType": "Unit",
      "label": "Btu/(ft²·h·Δ°F)",
      "phenomenon": "Units.HEAT_TRANSFER",
      "unitSystem": "Units.USCUSTOM",
      "definition": "BTU*FT(-2)*HR(-1)*DELTA_FAHRENHEIT(-1)",
      "numerator": 1,
      "denominator": 1,
      "offset": 0
    },
    "KG_PER_M": {
      "schemaItemType": "Unit",
      "label": "kg/m",
      "phenomenon": "Units.LINEAR_DENSITY",
      "unitSystem": "Units.SI",
      "definition": "KG*M(-1)",
      "numerator": 1,
      "denominator": 1,
      "offset": 0
    },
    "KG_PER_MM": {
      "schemaItemType": "Unit",
      "label": "kg/mm",
      "phenomenon": "Units.LINEAR_DENSITY",
      "unitSystem": "Units.METRIC",
      "definition": "KG*MM(-1)",
      "numerator": 1,
      "denominator": 1,
      "offset": 0
    },
    "LBM_PER_FT": {
      "schemaItemType": "Unit",
      "label": "lb/ft",
      "phenomenon": "Units.LINEAR_DENSITY",
      "unitSystem": "Units.USCUSTOM",
      "definition": "LBM*FT(-1)",
      "numerator": 1,
      "denominator": 1,
      "offset": 0
    },
    "N_PER_M": {
      "schemaItemType": "Unit",
      "label": "N/m",
      "phenomenon": "Units.LINEAR_LOAD",
      "unitSystem": "Units.SI",
      "definition": "N*M(-1)",
      "numerator": 1,
      "denominator": 1,
      "offset": 0
    },
    "KN_PER_M": {
      "schemaItemType": "Unit",
      "label": "kN/m",
      "phenomenon": "Units.LINEAR_LOAD",
      "unitSystem": "Units.METRIC",
      "definition": "KN*M(-1)",
      "numerator": 1,
      "denominator": 1,
      "offset": 0
    },
    "MEGAN_PER_M": {
      "schemaItemType": "Unit",
      "label": "MN/m",
      "phenomenon": "Units.LINEAR_LOAD",
      "unitSystem": "Units.METRIC",
      "definition": "MEGAN*M(-1)",
      "numerator": 1,
      "denominator": 1,
      "offset": 0
    },
    "N_PER_MM": {
      "schemaItemType": "Unit",
      "label": "N/mm",
      "phenomenon": "Units.LINEAR_LOAD",
      "unitSystem": "Units.METRIC",
      "definition": "N*MM(-1)",
      "numerator": 1,
      "denominator": 1,
      "offset": 0
    },
    "LBF_PER_IN": {
      "schemaItemType": "Unit",
      "label": "lbf/in",
      "phenomenon": "Units.LINEAR_LOAD",
      "unitSystem": "Units.USCUSTOM",
      "definition": "LBF*IN(-1)",
      "numerator": 1,
      "denominator": 1,
      "offset": 0
    },
    "LBF_PER_FT": {
      "schemaItemType": "Unit",
      "label": "lbf/ft",
      "phenomenon": "Units.LINEAR_LOAD",
      "unitSystem": "Units.USCUSTOM",
      "definition": "LBF*FT(-1)",
      "numerator": 1,
      "denominator": 1,
      "offset": 0
    },
    "KGF_PER_M": {
      "schemaItemType": "Unit",
      "label": "kgf/m",
      "phenomenon": "Units.LINEAR_LOAD",
      "unitSystem": "Units.METRIC",
      "definition": "KGF*M(-1)",
      "numerator": 1,
      "denominator": 1,
      "offset": 0
    },
    "KPF_PER_FT": {
      "schemaItemType": "Unit",
      "label": "kpf/ft",
      "phenomenon": "Units.LINEAR_LOAD",
      "unitSystem": "Units.USCUSTOM",
      "definition": "KPF*FT(-1)",
      "numerator": 1,
      "denominator": 1,
      "offset": 0
    },
    "PER_M": {
      "schemaItemType": "Unit",
      "label": "1/m",
      "phenomenon": "Units.LINEAR_RATE",
      "unitSystem": "Units.SI",
      "definition": "M(-1)",
      "numerator": 1,
      "denominator": 1,
      "offset": 0
    },
    "PER_MM": {
      "schemaItemType": "Unit",
      "label": "1/mm",
      "phenomenon": "Units.LINEAR_RATE",
      "unitSystem": "Units.METRIC",
      "definition": "MM(-1)",
      "numerator": 1,
      "denominator": 1,
      "offset": 0
    },
    "PER_KM": {
      "schemaItemType": "Unit",
      "label": "1/km",
      "phenomenon": "Units.LINEAR_RATE",
      "unitSystem": "Units.METRIC",
      "definition": "KM(-1)",
      "numerator": 1,
      "denominator": 1,
      "offset": 0
    },
    "PER_FT": {
      "schemaItemType": "Unit",
      "label": "1/ft",
      "phenomenon": "Units.LINEAR_RATE",
      "unitSystem": "Units.USCUSTOM",
      "definition": "FT(-1)",
      "numerator": 1,
      "denominator": 1,
      "offset": 0
    },
    "PER_MILE": {
      "schemaItemType": "Unit",
      "label": "1/mile",
      "phenomenon": "Units.LINEAR_RATE",
      "unitSystem": "Units.USCUSTOM",
      "definition": "MILE(-1)",
      "numerator": 1,
      "denominator": 1,
      "offset": 0
    },
    "PER_THOUSAND_FT": {
      "schemaItemType": "Unit",
      "label": "1/1000 ft",
      "phenomenon": "Units.LINEAR_RATE",
      "unitSystem": "Units.USCUSTOM",
      "definition": "FT(-1)",
      "numerator": 0.001,
      "denominator": 1,
      "offset": 0
    },
    "N_M": {
      "schemaItemType": "Unit",
      "label": "N·m",
      "phenomenon": "Units.TORQUE",
      "unitSystem": "Units.SI",
      "definition": "N*M*RAD(-1)",
      "numerator": 1,
      "denominator": 1,
      "offset": 0
    },
    "KN_M": {
      "schemaItemType": "Unit",
      "label": "kN·m",
      "phenomenon": "Units.TORQUE",
      "unitSystem": "Units.METRIC",
      "definition": "KN*M*RAD(-1)",
      "numerator": 1,
      "denominator": 1,
      "offset": 0
    },
    "MEGAN_M": {
      "schemaItemType": "Unit",
      "label": "MN·m",
      "phenomenon": "Units.TORQUE",
      "unitSystem": "Units.METRIC",
      "definition": "MEGAN*M*RAD(-1)",
      "numerator": 1,
      "denominator": 1,
      "offset": 0
    },
    "N_CM": {
      "schemaItemType": "Unit",
      "label": "N·cm",
      "phenomenon": "Units.TORQUE",
      "unitSystem": "Units.METRIC",
      "definition": "N*CM*RAD(-1)",
      "numerator": 1,
      "denominator": 1,
      "offset": 0
    },
    "LBF_FT": {
      "schemaItemType": "Unit",
      "label": "lbf·ft",
      "phenomenon": "Units.TORQUE",
      "unitSystem": "Units.USCUSTOM",
      "definition": "LBF*FT*RAD(-1)",
      "numerator": 1,
      "denominator": 1,
      "offset": 0
    },
    "LBF_IN": {
      "schemaItemType": "Unit",
      "label": "lbf·in",
      "phenomenon": "Units.TORQUE",
      "unitSystem": "Units.USCUSTOM",
      "definition": "LBF*IN*RAD(-1)",
      "numerator": 1,
      "denominator": 1,
      "offset": 0
    },
    "KGF_M": {
      "schemaItemType": "Unit",
      "label": "kgf·m",
      "phenomenon": "Units.TORQUE",
      "unitSystem": "Units.METRIC",
      "definition": "KGF*M*RAD(-1)",
      "numerator": 1,
      "denominator": 1,
      "offset": 0
    },
    "KPF_FT": {
      "schemaItemType": "Unit",
      "label": "kpf·ft",
      "phenomenon": "Units.TORQUE",
      "unitSystem": "Units.USCUSTOM",
      "definition": "KPF*FT*RAD(-1)",
      "numerator": 1,
      "denominator": 1,
      "offset": 0
    },
    "N_M_PER_M": {
      "schemaItemType": "Unit",
      "label": "N·m/m",
      "phenomenon": "Units.LINEAR_TORQUE",
      "unitSystem": "Units.SI",
      "definition": "N_M*M(-1)",
      "numerator": 1,
      "denominator": 1,
      "offset": 0
    },
    "KN_M_PER_M": {
      "schemaItemType": "Unit",
      "label": "kN·m/m",
      "phenomenon": "Units.LINEAR_TORQUE",
      "unitSystem": "Units.METRIC",
      "definition": "KN_M*M(-1)",
      "numerator": 1,
      "denominator": 1,
      "offset": 0
    },
    "MEGAN_M_PER_M": {
      "schemaItemType": "Unit",
      "label": "MN·m/m",
      "phenomenon": "Units.LINEAR_TORQUE",
      "unitSystem": "Units.METRIC",
      "definition": "MEGAN_M*M(-1)",
      "numerator": 1,
      "denominator": 1,
      "offset": 0
    },
    "N_CM_PER_CM": {
      "schemaItemType": "Unit",
      "label": "N·cm/cm",
      "phenomenon": "Units.LINEAR_TORQUE",
      "unitSystem": "Units.METRIC",
      "definition": "N_CM*CM(-1)",
      "numerator": 1,
      "denominator": 1,
      "offset": 0
    },
    "LBF_IN_PER_IN": {
      "schemaItemType": "Unit",
      "label": "lbf·in/in",
      "phenomenon": "Units.LINEAR_TORQUE",
      "unitSystem": "Units.USCUSTOM",
      "definition": "LBF_IN*IN(-1)",
      "numerator": 1,
      "denominator": 1,
      "offset": 0
    },
    "LBF_FT_PER_FT": {
      "schemaItemType": "Unit",
      "label": "lbf·ft/ft",
      "phenomenon": "Units.LINEAR_TORQUE",
      "unitSystem": "Units.USCUSTOM",
      "definition": "LBF_FT*FT(-1)",
      "numerator": 1,
      "denominator": 1,
      "offset": 0
    },
    "KPF_FT_PER_FT": {
      "schemaItemType": "Unit",
      "label": "kpf·ft/ft",
      "phenomenon": "Units.LINEAR_TORQUE",
      "unitSystem": "Units.USCUSTOM",
      "definition": "KPF_FT*FT(-1)",
      "numerator": 1,
      "denominator": 1,
      "offset": 0
    },
    "N_M_PER_SQ_M": {
      "schemaItemType": "Unit",
      "label": "N·m/m²",
      "phenomenon": "Units.AREA_TORQUE",
      "unitSystem": "Units.SI",
      "definition": "N_M*M(-2)",
      "numerator": 1,
      "denominator": 1,
      "offset": 0
    },
    "KN_M_PER_SQ_M": {
      "schemaItemType": "Unit",
      "label": "kN·m/m²",
      "phenomenon": "Units.AREA_TORQUE",
      "unitSystem": "Units.METRIC",
      "definition": "KN_M*M(-2)",
      "numerator": 1,
      "denominator": 1,
      "offset": 0
    },
    "MEGAN_M_PER_SQ_M": {
      "schemaItemType": "Unit",
      "label": "MN·m/m²",
      "phenomenon": "Units.AREA_TORQUE",
      "unitSystem": "Units.METRIC",
      "definition": "MEGAN_M*M(-2)",
      "numerator": 1,
      "denominator": 1,
      "offset": 0
    },
    "N_CM_PER_SQ_CM": {
      "schemaItemType": "Unit",
      "label": "N·cm/cm²",
      "phenomenon": "Units.AREA_TORQUE",
      "unitSystem": "Units.METRIC",
      "definition": "N_CM*CM(-2)",
      "numerator": 1,
      "denominator": 1,
      "offset": 0
    },
    "LBF_IN_PER_SQ_IN": {
      "schemaItemType": "Unit",
      "label": "lbf·in/in²",
      "phenomenon": "Units.AREA_TORQUE",
      "unitSystem": "Units.USCUSTOM",
      "definition": "LBF_IN*IN(-2)",
      "numerator": 1,
      "denominator": 1,
      "offset": 0
    },
    "LBF_FT_PER_SQ_FT": {
      "schemaItemType": "Unit",
      "label": "lbf·ft/ft²",
      "phenomenon": "Units.AREA_TORQUE",
      "unitSystem": "Units.USCUSTOM",
      "definition": "LBF_FT*FT(-2)",
      "numerator": 1,
      "denominator": 1,
      "offset": 0
    },
    "KPF_FT_PER_SQ_FT": {
      "schemaItemType": "Unit",
      "label": "kpf·ft/ft²",
      "phenomenon": "Units.AREA_TORQUE",
      "unitSystem": "Units.USCUSTOM",
      "definition": "KPF_FT*FT(-2)",
      "numerator": 1,
      "denominator": 1,
      "offset": 0
    },
    "CUB_M_PER_MOL": {
      "schemaItemType": "Unit",
      "label": "m³/mol",
      "phenomenon": "Units.MOLAR_VOLUME",
      "unitSystem": "Units.SI",
      "definition": "CUB_M*MOL(-1)",
      "numerator": 1,
      "denominator": 1,
      "offset": 0
    },
    "CUB_M_PER_KMOL": {
      "schemaItemType": "Unit",
      "label": "m³/kmol",
      "phenomenon": "Units.MOLAR_VOLUME",
      "unitSystem": "Units.METRIC",
      "definition": "CUB_M*[KILO](-1)*MOL(-1)",
      "numerator": 1,
      "denominator": 1,
      "offset": 0
    },
    "CUB_FT_PER_LB_MOL": {
      "schemaItemType": "Unit",
      "label": "ft³/lb-mol",
      "phenomenon": "Units.MOLAR_VOLUME",
      "unitSystem": "Units.USCUSTOM",
      "definition": "CUB_FT*LB_MOL(-1)",
      "numerator": 1,
      "denominator": 1,
      "offset": 0
    },
    "MOL_PER_CUB_M": {
      "schemaItemType": "Unit",
      "label": "mol/m³",
      "phenomenon": "Units.MOLAR_CONCENTRATION",
      "unitSystem": "Units.SI",
      "definition": "MOL*CUB_M(-1)",
      "numerator": 1,
      "denominator": 1,
      "offset": 0
    },
    "KMOL_PER_CUB_M": {
      "schemaItemType": "Unit",
      "label": "kmol/m³",
      "phenomenon": "Units.MOLAR_CONCENTRATION",
      "unitSystem": "Units.METRIC",
      "definition": "[KILO]*MOL*CUB_M(-1)",
      "numerator": 1,
      "denominator": 1,
      "offset": 0
    },
    "MOL_PER_CUB_DM": {
      "schemaItemType": "Unit",
      "label": "mol/dm³",
      "phenomenon": "Units.MOLAR_CONCENTRATION",
      "unitSystem": "Units.METRIC",
      "definition": "MOL*CUB_DM(-1)",
      "numerator": 1,
      "denominator": 1,
      "offset": 0
    },
    "MICROMOL_PER_CUB_DM": {
      "schemaItemType": "Unit",
      "label": "µmol/dm³",
      "phenomenon": "Units.MOLAR_CONCENTRATION",
      "unitSystem": "Units.METRIC",
      "definition": "[MICRO]*MOL*CUB_DM(-1)",
      "numerator": 1,
      "denominator": 1,
      "offset": 0
    },
    "NMOL_PER_CUB_DM": {
      "schemaItemType": "Unit",
      "label": "nmol/dm³",
      "phenomenon": "Units.MOLAR_CONCENTRATION",
      "unitSystem": "Units.METRIC",
      "definition": "[NANO]*MOL*CUB_DM(-1)",
      "numerator": 1,
      "denominator": 1,
      "offset": 0
    },
    "PICOMOL_PER_CUB_DM": {
      "schemaItemType": "Unit",
      "label": "picomol/dm³",
      "phenomenon": "Units.MOLAR_CONCENTRATION",
      "unitSystem": "Units.METRIC",
      "definition": "[PICO]*MOL*CUB_DM(-1)",
      "numerator": 1,
      "denominator": 1,
      "offset": 0
    },
    "MOL_PER_CUB_FT": {
      "schemaItemType": "Unit",
      "label": "mol/ft³",
      "phenomenon": "Units.MOLAR_CONCENTRATION",
      "unitSystem": "Units.USCUSTOM",
      "definition": "MOL*CUB_FT(-1)",
      "numerator": 1,
      "denominator": 1,
      "offset": 0
    },
    "MM_TO_THE_FOURTH": {
      "schemaItemType": "Unit",
      "label": "mm⁴",
      "phenomenon": "Units.AREA_MOMENT_INERTIA",
      "unitSystem": "Units.METRIC",
      "definition": "MM(4)",
      "numerator": 1,
      "denominator": 1,
      "offset": 0
    },
    "M_TO_THE_FOURTH": {
      "schemaItemType": "Unit",
      "label": "m⁴",
      "phenomenon": "Units.AREA_MOMENT_INERTIA",
      "unitSystem": "Units.SI",
      "definition": "M(4)",
      "numerator": 1,
      "denominator": 1,
      "offset": 0
    },
    "CM_TO_THE_FOURTH": {
      "schemaItemType": "Unit",
      "label": "cm⁴",
      "phenomenon": "Units.AREA_MOMENT_INERTIA",
      "unitSystem": "Units.METRIC",
      "definition": "CM(4)",
      "numerator": 1,
      "denominator": 1,
      "offset": 0
    },
    "IN_TO_THE_FOURTH": {
      "schemaItemType": "Unit",
      "label": "in⁴",
      "phenomenon": "Units.AREA_MOMENT_INERTIA",
      "unitSystem": "Units.USCUSTOM",
      "definition": "IN(4)",
      "numerator": 1,
      "denominator": 1,
      "offset": 0
    },
    "FT_TO_THE_FOURTH": {
      "schemaItemType": "Unit",
      "label": "ft⁴",
      "phenomenon": "Units.AREA_MOMENT_INERTIA",
      "unitSystem": "Units.USCUSTOM",
      "definition": "FT(4)",
      "numerator": 1,
      "denominator": 1,
      "offset": 0
    },
    "W": {
      "schemaItemType": "Unit",
      "phenomenon": "Units.POWER",
      "unitSystem": "Units.SI",
      "definition": "N*M*S(-1)",
      "numerator": 1,
      "denominator": 1,
      "offset": 0
    },
    "KW": {
      "schemaItemType": "Unit",
      "label": "kW",
      "phenomenon": "Units.POWER",
      "unitSystem": "Units.METRIC",
      "definition": "[KILO]*W",
      "numerator": 1,
      "denominator": 1,
      "offset": 0
    },
    "MEGAW": {
      "schemaItemType": "Unit",
      "label": "MW",
      "phenomenon": "Units.POWER",
      "unitSystem": "Units.METRIC",
      "definition": "[MEGA]*W",
      "numerator": 1,
      "denominator": 1,
      "offset": 0
    },
    "GW": {
      "schemaItemType": "Unit",
      "phenomenon": "Units.POWER",
      "unitSystem": "Units.METRIC",
      "definition": "[GIGA]*W",
      "numerator": 1,
      "denominator": 1,
      "offset": 0
    },
    "BTU_PER_HR": {
      "schemaItemType": "Unit",
      "label": "Btu/h",
      "phenomenon": "Units.POWER",
      "unitSystem": "Units.USCUSTOM",
      "definition": "BTU*HR(-1)",
      "numerator": 1,
      "denominator": 1,
      "offset": 0
    },
    "KILOBTU_PER_HR": {
      "schemaItemType": "Unit",
      "label": "kBtu/h",
      "phenomenon": "Units.POWER",
      "unitSystem": "Units.USCUSTOM",
      "definition": "[KILO]*BTU*HR(-1)",
      "numerator": 1,
      "denominator": 1,
      "offset": 0
    },
    "HP": {
      "schemaItemType": "Unit",
      "label": "hp",
      "description": "Exact, See http://physics.nist.gov/cuu/pdf/sp811.pdf Appendix B.",
      "phenomenon": "Units.POWER",
      "unitSystem": "Units.USCUSTOM",
      "definition": "LBF*FT*S(-1)",
      "numerator": 550,
      "denominator": 1,
      "offset": 0
    },
    "PA": {
      "schemaItemType": "Unit",
      "label": "N/m²",
      "phenomenon": "Units.PRESSURE",
      "unitSystem": "Units.SI",
      "definition": "N*M(-2)",
      "numerator": 1,
      "denominator": 1,
      "offset": 0
    },
    "PA_GAUGE": {
      "schemaItemType": "Unit",
      "label": "Pa (gauge)",
      "description": "Offset is one standard atmosphere in PA.  Offset is exact, See http://physics.nist.gov/cuu/pdf/sp811.pdf Appendix B.  ",
      "phenomenon": "Units.PRESSURE",
      "unitSystem": "Units.INDUSTRIAL",
      "definition": "PA",
      "numerator": 1,
      "denominator": 1,
      "offset": 101325
    },
    "HECTOPASCAL": {
      "schemaItemType": "Unit",
      "label": "hPa",
      "phenomenon": "Units.PRESSURE",
      "unitSystem": "Units.METRIC",
      "definition": "[HECTO]*PA",
      "numerator": 1,
      "denominator": 1,
      "offset": 0
    },
    "KILOPASCAL": {
      "schemaItemType": "Unit",
      "label": "kPa",
      "phenomenon": "Units.PRESSURE",
      "unitSystem": "Units.METRIC",
      "definition": "[KILO]*PA",
      "numerator": 1,
      "denominator": 1,
      "offset": 0
    },
    "MICROPASCAL": {
      "schemaItemType": "Unit",
      "label": "µPa",
      "phenomenon": "Units.PRESSURE",
      "unitSystem": "Units.METRIC",
      "definition": "[MICRO]*PA",
      "numerator": 1,
      "denominator": 1,
      "offset": 0
    },
    "KILOPASCAL_GAUGE": {
      "schemaItemType": "Unit",
      "label": "kPa (Gauge)",
      "description": "Offset is one standard atmosphere (101325 PA) converted to kilopascal.  Offset is exact, See http://physics.nist.gov/cuu/pdf/sp811.pdf Appendix B.  ",
      "phenomenon": "Units.PRESSURE",
      "unitSystem": "Units.INDUSTRIAL",
      "definition": "[KILO]*PA",
      "numerator": 1,
      "denominator": 1,
      "offset": 101.325
    },
    "MEGAPASCAL": {
      "schemaItemType": "Unit",
      "label": "MPa",
      "phenomenon": "Units.PRESSURE",
      "unitSystem": "Units.METRIC",
      "definition": "[MEGA]*PA",
      "numerator": 1,
      "denominator": 1,
      "offset": 0
    },
    "MEGAPASCAL_GAUGE": {
      "schemaItemType": "Unit",
      "label": "MPa (Gauge)",
      "description": "Offset is one standard atmosphere (101325 PA) converted to megapascal.  Offset is exact, See http://physics.nist.gov/cuu/pdf/sp811.pdf Appendix B.  ",
      "phenomenon": "Units.PRESSURE",
      "unitSystem": "Units.INDUSTRIAL",
      "definition": "[MEGA]*PA",
      "numerator": 1,
      "denominator": 1,
      "offset": 0.101325
    },
    "AT": {
      "schemaItemType": "Unit",
      "label": "kgf/cm²",
      "description": "Exact, See http://physics.nist.gov/cuu/pdf/sp811.pdf Appendix B.",
      "phenomenon": "Units.PRESSURE",
      "unitSystem": "Units.INTERNATIONAL",
      "definition": "KGF*CM(-2)",
      "numerator": 1,
      "denominator": 1,
      "offset": 0
    },
    "AT_GAUGE": {
      "schemaItemType": "Unit",
      "label": "kgf/cm² (Gauge)",
      "description": "Offset is one standard atmosphere (101325 PA) converted to atmosphere-technical (AT).  Offset is exact, See http://physics.nist.gov/cuu/pdf/sp811.pdf Appendix B.  ",
      "phenomenon": "Units.PRESSURE",
      "unitSystem": "Units.INDUSTRIAL",
      "definition": "AT",
      "numerator": 1,
      "denominator": 1,
      "offset": 1.033227452799886
    },
    "KGF_PER_SQ_M": {
      "schemaItemType": "Unit",
      "label": "kgf/m²",
      "phenomenon": "Units.PRESSURE",
      "unitSystem": "Units.INTERNATIONAL",
      "definition": "KGF*M(-2)",
      "numerator": 1,
      "denominator": 1,
      "offset": 0
    },
    "ATM": {
      "schemaItemType": "Unit",
      "label": "atm",
      "description": "Standard atmosphere, see AT for atmosphere-technical.  Exact, See http://physics.nist.gov/cuu/pdf/sp811.pdf Appendix B.  ",
      "phenomenon": "Units.PRESSURE",
      "unitSystem": "Units.METRIC",
      "definition": "PA",
      "numerator": 101325,
      "denominator": 1,
      "offset": 0
    },
    "BAR": {
      "schemaItemType": "Unit",
      "label": "bar",
      "description": "Exact, See http://physics.nist.gov/cuu/pdf/sp811.pdf Appendix B.  ",
      "phenomenon": "Units.PRESSURE",
      "unitSystem": "Units.METRIC",
      "definition": "PA",
      "numerator": 100000,
      "denominator": 1,
      "offset": 0
    },
    "BAR_GAUGE": {
      "schemaItemType": "Unit",
      "label": "bar (Gauge)",
      "description": "Offset is one standard atmosphere converted to BAR.  Offset is exact, See http://physics.nist.gov/cuu/pdf/sp811.pdf Appendix B.  ",
      "phenomenon": "Units.PRESSURE",
      "unitSystem": "Units.INDUSTRIAL",
      "definition": "PA",
      "numerator": 100000,
      "denominator": 1,
      "offset": 1.01325
    },
    "MBAR": {
      "schemaItemType": "Unit",
      "label": "mBar",
      "phenomenon": "Units.PRESSURE",
      "unitSystem": "Units.METRIC",
      "definition": "[MILLI]*BAR",
      "numerator": 1,
      "denominator": 1,
      "offset": 0
    },
    "BARYE": {
      "schemaItemType": "Unit",
      "label": "ba",
      "phenomenon": "Units.PRESSURE",
      "unitSystem": "Units.METRIC",
      "definition": "DYNE*CM(-2)",
      "numerator": 1,
      "denominator": 1,
      "offset": 0
    },
    "PSI": {
      "schemaItemType": "Unit",
      "label": "lbf/in²",
      "phenomenon": "Units.PRESSURE",
      "unitSystem": "Units.USCUSTOM",
      "definition": "LBF*IN(-2)",
      "numerator": 1,
      "denominator": 1,
      "offset": 0
    },
    "PSF": {
      "schemaItemType": "Unit",
      "label": "lbf/ft²",
      "phenomenon": "Units.PRESSURE",
      "unitSystem": "Units.USCUSTOM",
      "definition": "LBF*FT(-2)",
      "numerator": 1,
      "denominator": 1,
      "offset": 0
    },
    "PSIG": {
      "schemaItemType": "Unit",
      "label": "lbf/in² (Gauge)",
      "description": "Offset is one standard atmosphere (101325 PA) converted to PSI",
      "phenomenon": "Units.PRESSURE",
      "unitSystem": "Units.USCUSTOM",
      "definition": "LBF*IN(-2)",
      "numerator": 1,
      "denominator": 1,
      "offset": 14.695948775513449
    },
    "KSI": {
      "schemaItemType": "Unit",
      "label": "ksi",
      "phenomenon": "Units.PRESSURE",
      "unitSystem": "Units.USCUSTOM",
      "definition": "KPF*IN(-2)",
      "numerator": 1,
      "denominator": 1,
      "offset": 0
    },
    "KSF": {
      "schemaItemType": "Unit",
      "label": "ksf",
      "phenomenon": "Units.PRESSURE",
      "unitSystem": "Units.USCUSTOM",
      "definition": "KPF*FT(-2)",
      "numerator": 1,
      "denominator": 1,
      "offset": 0
    },
    "LBF_PER_SQ_FT": {
      "schemaItemType": "Unit",
      "label": "lbf/ft²",
      "phenomenon": "Units.PRESSURE",
      "unitSystem": "Units.USCUSTOM",
      "definition": "LBF*FT(-2)",
      "numerator": 1,
      "denominator": 1,
      "offset": 0
    },
    "TORR": {
      "schemaItemType": "Unit",
      "label": "torr",
      "description": "See http://physics.nist.gov/cuu/pdf/sp811.pdf Appendix B. for approx conversion and Table 11 for a reference to the exact conversion",
      "phenomenon": "Units.PRESSURE",
      "unitSystem": "Units.USCUSTOM",
      "definition": "PA",
      "numerator": 101325,
      "denominator": 760,
      "offset": 0
    },
    "M_H2O": {
      "schemaItemType": "Unit",
      "label": "mH2O (Conv)",
      "description": "Meter of H2O Conventional",
      "phenomenon": "Units.PRESSURE",
      "unitSystem": "Units.METRIC",
      "definition": "[KILO]*MM_H2O",
      "numerator": 1,
      "denominator": 1,
      "offset": 0
    },
    "MM_H2O": {
      "schemaItemType": "Unit",
      "label": "mmH2O (Conv)",
      "description": "Millimeter of H2O Conventional, See http://physics.nist.gov/cuu/pdf/sp811.pdf Appendix B.",
      "phenomenon": "Units.PRESSURE",
      "unitSystem": "Units.METRIC",
      "definition": "PA",
      "numerator": 9.80665,
      "denominator": 1,
      "offset": 0
    },
    "MM_HG_AT_32F": {
      "schemaItemType": "Unit",
      "label": "mmHg@32°F",
      "description": "See http://physics.nist.gov/cuu/pdf/sp811.pdf Appendix B.  Used centimeter of mercury (0 C) to pascal",
      "phenomenon": "Units.PRESSURE",
      "unitSystem": "Units.METRIC",
      "definition": "PA",
      "numerator": 133.322,
      "denominator": 1,
      "offset": 0
    },
    "FT_H2O": {
      "schemaItemType": "Unit",
      "label": "ft H2O (Conv)",
      "description": "foot of H2O Conventional, See http://physics.nist.gov/cuu/pdf/sp811.pdf Appendix B.",
      "phenomenon": "Units.PRESSURE",
      "unitSystem": "Units.USCUSTOM",
      "definition": "PA",
      "numerator": 2989.067,
      "denominator": 1,
      "offset": 0
    },
    "IN_H2O_AT_32F": {
      "schemaItemType": "Unit",
      "label": "inH2O@32°F",
      "description": "Inch of H2O at 32 Fahrenheit, Water is assumed to be in a liquid state. Equal to water at 0C.  No verified source",
      "phenomenon": "Units.PRESSURE",
      "unitSystem": "Units.USCUSTOM",
      "definition": "PA",
      "numerator": 249.1083,
      "denominator": 1,
      "offset": 0
    },
    "IN_H2O_AT_39_2F": {
      "schemaItemType": "Unit",
      "label": "inH2O@39.2°F",
      "description": "See http://physics.nist.gov/cuu/pdf/sp811.pdf Appendix B.",
      "phenomenon": "Units.PRESSURE",
      "unitSystem": "Units.USCUSTOM",
      "definition": "PA",
      "numerator": 249.082,
      "denominator": 1,
      "offset": 0
    },
    "IN_H2O_AT_60F": {
      "schemaItemType": "Unit",
      "label": "inH2O@60°F",
      "description": "See http://physics.nist.gov/cuu/pdf/sp811.pdf Appendix B.",
      "phenomenon": "Units.PRESSURE",
      "unitSystem": "Units.USCUSTOM",
      "definition": "PA",
      "numerator": 248.84,
      "denominator": 1,
      "offset": 0
    },
    "IN_HG": {
      "schemaItemType": "Unit",
      "label": "inHg (Conv)",
      "description": "Inch of HG conventional, See http://physics.nist.gov/cuu/pdf/sp811.pdf Appendix B.",
      "phenomenon": "Units.PRESSURE",
      "unitSystem": "Units.USCUSTOM",
      "definition": "PA",
      "numerator": 3386.389,
      "denominator": 1,
      "offset": 0
    },
    "IN_HG_AT_32F": {
      "schemaItemType": "Unit",
      "label": "inHg@32°F",
      "description": "See http://physics.nist.gov/cuu/pdf/sp811.pdf Appendix B.",
      "phenomenon": "Units.PRESSURE",
      "unitSystem": "Units.USCUSTOM",
      "definition": "PA",
      "numerator": 3386.38,
      "denominator": 1,
      "offset": 0
    },
    "IN_HG_AT_60F": {
      "schemaItemType": "Unit",
      "label": "inHg@60°F",
      "description": "See http://physics.nist.gov/cuu/pdf/sp811.pdf Appendix B.",
      "phenomenon": "Units.PRESSURE",
      "unitSystem": "Units.USCUSTOM",
      "definition": "PA",
      "numerator": 3376.85,
      "denominator": 1,
      "offset": 0
    },
    "PA_PER_M": {
      "schemaItemType": "Unit",
      "label": "Pa/m",
      "phenomenon": "Units.PRESSURE_GRADIENT",
      "unitSystem": "Units.SI",
      "definition": "PA*M(-1)",
      "numerator": 1,
      "denominator": 1,
      "offset": 0
    },
    "BAR_PER_KM": {
      "schemaItemType": "Unit",
      "label": "bar/km",
      "phenomenon": "Units.PRESSURE_GRADIENT",
      "unitSystem": "Units.METRIC",
      "definition": "BAR*KM(-1)",
      "numerator": 1,
      "denominator": 1,
      "offset": 0
    },
    "PERCENT": {
      "schemaItemType": "Unit",
      "label": "%",
      "description": "Unit used to show a ratio as a percentage in the UI.",
      "phenomenon": "Units.PERCENTAGE",
      "unitSystem": "Units.INTERNATIONAL",
      "definition": "ONE",
      "numerator": 1,
      "denominator": 1,
      "offset": 0
    },
    "DECIMAL_PERCENT": {
      "schemaItemType": "Unit",
      "label": "decimal percent",
      "description": "Unit suitable for storing a decimal number that represents an unspecified ratio.",
      "phenomenon": "Units.PERCENTAGE",
      "unitSystem": "Units.INTERNATIONAL",
      "definition": "PERCENT",
      "numerator": 100,
      "denominator": 1,
      "offset": 0
    },
    "PROBABILITY_FRACTION": {
      "schemaItemType": "Unit",
      "label": "",
      "phenomenon": "Units.PROBABILITY",
      "unitSystem": "Units.SI",
      "definition": "ONE",
      "numerator": 1,
      "denominator": 1,
      "offset": 0
    },
    "PROBABILITY_PERCENT": {
      "schemaItemType": "Unit",
      "label": "%",
      "phenomenon": "Units.PROBABILITY",
      "unitSystem": "Units.INTERNATIONAL",
      "definition": "PROBABILITY_FRACTION",
      "numerator": 1,
      "denominator": 100,
      "offset": 0
    },
    "M_PER_M": {
      "schemaItemType": "Unit",
      "label": "m/m",
      "phenomenon": "Units.SLOPE",
      "unitSystem": "Units.SI",
      "definition": "M*M(-1)",
      "numerator": 1,
      "denominator": 1,
      "offset": 0
    },
    "CM_PER_M": {
      "schemaItemType": "Unit",
      "label": "cm/m",
      "phenomenon": "Units.SLOPE",
      "unitSystem": "Units.METRIC",
      "definition": "CM*M(-1)",
      "numerator": 1,
      "denominator": 1,
      "offset": 0
    },
    "MM_PER_M": {
      "schemaItemType": "Unit",
      "label": "mm/m",
      "phenomenon": "Units.SLOPE",
      "unitSystem": "Units.METRIC",
      "definition": "MM*M(-1)",
      "numerator": 1,
      "denominator": 1,
      "offset": 0
    },
    "M_PER_KM": {
      "schemaItemType": "Unit",
      "label": "m/km",
      "phenomenon": "Units.SLOPE",
      "unitSystem": "Units.METRIC",
      "definition": "M*KM(-1)",
      "numerator": 1,
      "denominator": 1,
      "offset": 0
    },
    "FT_PER_THOUSAND_FOOT": {
      "schemaItemType": "Unit",
      "label": "ft/1000ft",
      "phenomenon": "Units.SLOPE",
      "unitSystem": "Units.USCUSTOM",
      "definition": "FT*[KILO](-1)*FT(-1)",
      "numerator": 1,
      "denominator": 1,
      "offset": 0
    },
    "FT_PER_FT": {
      "schemaItemType": "Unit",
      "label": "ft/ft",
      "phenomenon": "Units.SLOPE",
      "unitSystem": "Units.USCUSTOM",
      "definition": "FT*FT(-1)",
      "numerator": 1,
      "denominator": 1,
      "offset": 0
    },
    "IN_PER_FT": {
      "schemaItemType": "Unit",
      "label": "in/ft",
      "phenomenon": "Units.SLOPE",
      "unitSystem": "Units.USCUSTOM",
      "definition": "IN*FT(-1)",
      "numerator": 1,
      "denominator": 1,
      "offset": 0
    },
    "FT_PER_IN": {
      "schemaItemType": "Unit",
      "label": "ft/in",
      "phenomenon": "Units.SLOPE",
      "unitSystem": "Units.USCUSTOM",
      "definition": "FT*IN(-1)",
      "numerator": 1,
      "denominator": 1,
      "offset": 0
    },
    "FT_PER_MILE": {
      "schemaItemType": "Unit",
      "label": "ft/mi",
      "phenomenon": "Units.SLOPE",
      "unitSystem": "Units.USCUSTOM",
      "definition": "FT*MILE(-1)",
      "numerator": 1,
      "denominator": 1,
      "offset": 0
    },
    "VERTICAL_PER_HORIZONTAL": {
      "schemaItemType": "Unit",
      "label": "slope",
      "phenomenon": "Units.SLOPE",
      "unitSystem": "Units.INTERNATIONAL",
      "definition": "M_PER_M",
      "numerator": 1,
      "denominator": 1,
      "offset": 0
    },
    "PERCENT_SLOPE": {
      "schemaItemType": "Unit",
      "label": "%",
      "phenomenon": "Units.SLOPE",
      "unitSystem": "Units.INTERNATIONAL",
      "definition": "DECIMAL_PERCENT(-1)*M_PER_M",
      "numerator": 1,
      "denominator": 1,
      "offset": 0
    },
    "HORIZONTAL_PER_VERTICAL": {
      "schemaItemType": "InvertedUnit",
      "invertsUnit": "Units.VERTICAL_PER_HORIZONTAL",
      "unitSystem": "Units.INTERNATIONAL"
    },
    "FT_HORIZONTAL_PER_FT_VERTICAL": {
      "schemaItemType": "InvertedUnit",
      "invertsUnit": "Units.FT_PER_FT",
      "unitSystem": "Units.USCUSTOM"
    },
    "M_HORIZONTAL_PER_M_VERTICAL": {
      "schemaItemType": "InvertedUnit",
      "invertsUnit": "Units.M_PER_M",
      "unitSystem": "Units.SI"
    },
    "KG_PER_SQ_M": {
      "schemaItemType": "Unit",
      "label": "kg/m²",
      "phenomenon": "Units.SURFACE_DENSITY",
      "unitSystem": "Units.SI",
      "definition": "KG*M(-2)",
      "numerator": 1,
      "denominator": 1,
      "offset": 0
    },
    "G_PER_SQ_M": {
      "schemaItemType": "Unit",
      "label": "g/m²",
      "phenomenon": "Units.SURFACE_DENSITY",
      "unitSystem": "Units.METRIC",
      "definition": "G*M(-2)",
      "numerator": 1,
      "denominator": 1,
      "offset": 0
    },
    "KG_PER_HECTARE": {
      "schemaItemType": "Unit",
      "label": "kg/ha",
      "phenomenon": "Units.SURFACE_DENSITY",
      "unitSystem": "Units.METRIC",
      "definition": "KG*HECTARE(-1)",
      "numerator": 1,
      "denominator": 1,
      "offset": 0
    },
    "LBM_PER_ACRE": {
      "schemaItemType": "Unit",
      "label": "lb/acre",
      "phenomenon": "Units.SURFACE_DENSITY",
      "unitSystem": "Units.USCUSTOM",
      "definition": "LBM*ACRE(-1)",
      "numerator": 1,
      "denominator": 1,
      "offset": 0
    },
    "W_PER_M_K": {
      "schemaItemType": "Unit",
      "label": "W/(m·K)",
      "phenomenon": "Units.THERMAL_CONDUCTIVITY",
      "unitSystem": "Units.SI",
      "definition": "W*M(-1)*DELTA_KELVIN(-1)",
      "numerator": 1,
      "denominator": 1,
      "offset": 0
    },
    "W_PER_M_C": {
      "schemaItemType": "Unit",
      "label": "W/(m·Δ°C)",
      "phenomenon": "Units.THERMAL_CONDUCTIVITY",
      "unitSystem": "Units.METRIC",
      "definition": "W*M(-1)*DELTA_CELSIUS(-1)",
      "numerator": 1,
      "denominator": 1,
      "offset": 0
    },
    "BTU_IN_PER_SQ_FT_HR_FAHRENHEIT": {
      "schemaItemType": "Unit",
      "label": "Btu·in/(ft²·h·Δ°F)",
      "phenomenon": "Units.THERMAL_CONDUCTIVITY",
      "unitSystem": "Units.USCUSTOM",
      "definition": "BTU*IN*FT(-2)*HR(-1)*DELTA_FAHRENHEIT(-1)",
      "numerator": 1,
      "denominator": 1,
      "offset": 0
    },
    "SQ_M_KELVIN_PER_WATT": {
      "schemaItemType": "Unit",
      "label": "m²·ΔK/W",
      "phenomenon": "Units.THERMAL_INSULANCE",
      "unitSystem": "Units.SI",
      "definition": "M(2)*DELTA_KELVIN*W(-1)",
      "numerator": 1,
      "denominator": 1,
      "offset": 0
    },
    "SQ_M_CELSIUS_PER_WATT": {
      "schemaItemType": "Unit",
      "label": "m²·Δ°C/W",
      "phenomenon": "Units.THERMAL_INSULANCE",
      "unitSystem": "Units.METRIC",
      "definition": "M(2)*DELTA_CELSIUS*W(-1)",
      "numerator": 1,
      "denominator": 1,
      "offset": 0
    },
    "SQ_FT_HR_FAHRENHEIT_PER_BTU": {
      "schemaItemType": "Unit",
      "label": "ft²·h·Δ°F/Btu",
      "phenomenon": "Units.THERMAL_INSULANCE",
      "unitSystem": "Units.USCUSTOM",
      "definition": "FT(2)*HR*DELTA_FAHRENHEIT*BTU(-1)",
      "numerator": 1,
      "denominator": 1,
      "offset": 0
    },
    "M_PER_SEC": {
      "schemaItemType": "Unit",
      "label": "m/s",
      "phenomenon": "Units.VELOCITY",
      "unitSystem": "Units.SI",
      "definition": "M*S(-1)",
      "numerator": 1,
      "denominator": 1,
      "offset": 0
    },
    "M_PER_MIN": {
      "schemaItemType": "Unit",
      "label": "m/min",
      "phenomenon": "Units.VELOCITY",
      "unitSystem": "Units.METRIC",
      "definition": "M*MIN(-1)",
      "numerator": 1,
      "denominator": 1,
      "offset": 0
    },
    "M_PER_HR": {
      "schemaItemType": "Unit",
      "label": "m/h",
      "phenomenon": "Units.VELOCITY",
      "unitSystem": "Units.METRIC",
      "definition": "M*HR(-1)",
      "numerator": 1,
      "denominator": 1,
      "offset": 0
    },
    "M_PER_DAy": {
      "schemaItemType": "Unit",
      "label": "m/day",
      "phenomenon": "Units.VELOCITY",
      "unitSystem": "Units.METRIC",
      "definition": "M*DAY(-1)",
      "numerator": 1,
      "denominator": 1,
      "offset": 0
    },
    "MM_PER_SEC": {
      "schemaItemType": "Unit",
      "label": "mm/sec",
      "phenomenon": "Units.VELOCITY",
      "unitSystem": "Units.METRIC",
      "definition": "MM*S(-1)",
      "numerator": 1,
      "denominator": 1,
      "offset": 0
    },
    "MM_PER_MIN": {
      "schemaItemType": "Unit",
      "label": "mm/min",
      "phenomenon": "Units.VELOCITY",
      "unitSystem": "Units.METRIC",
      "definition": "MM*MIN(-1)",
      "numerator": 1,
      "denominator": 1,
      "offset": 0
    },
    "MM_PER_HR": {
      "schemaItemType": "Unit",
      "label": "mm/h",
      "phenomenon": "Units.VELOCITY",
      "unitSystem": "Units.METRIC",
      "definition": "MM*HR(-1)",
      "numerator": 1,
      "denominator": 1,
      "offset": 0
    },
    "MM_PER_DAY": {
      "schemaItemType": "Unit",
      "label": "mm/day",
      "phenomenon": "Units.VELOCITY",
      "unitSystem": "Units.METRIC",
      "definition": "MM*DAY(-1)",
      "numerator": 1,
      "denominator": 1,
      "offset": 0
    },
    "CM_PER_SEC": {
      "schemaItemType": "Unit",
      "label": "cm/s",
      "phenomenon": "Units.VELOCITY",
      "unitSystem": "Units.METRIC",
      "definition": "CM*S(-1)",
      "numerator": 1,
      "denominator": 1,
      "offset": 0
    },
    "CM_PER_MIN": {
      "schemaItemType": "Unit",
      "label": "cm/min",
      "phenomenon": "Units.VELOCITY",
      "unitSystem": "Units.METRIC",
      "definition": "CM*MIN(-1)",
      "numerator": 1,
      "denominator": 1,
      "offset": 0
    },
    "CM_PER_HR": {
      "schemaItemType": "Unit",
      "label": "cm/h",
      "phenomenon": "Units.VELOCITY",
      "unitSystem": "Units.METRIC",
      "definition": "CM*HR(-1)",
      "numerator": 1,
      "denominator": 1,
      "offset": 0
    },
    "CM_PER_DAY": {
      "schemaItemType": "Unit",
      "label": "cm/day",
      "phenomenon": "Units.VELOCITY",
      "unitSystem": "Units.METRIC",
      "definition": "CM*DAY(-1)",
      "numerator": 1,
      "denominator": 1,
      "offset": 0
    },
    "KM_PER_SEC": {
      "schemaItemType": "Unit",
      "label": "km/sec",
      "phenomenon": "Units.VELOCITY",
      "unitSystem": "Units.METRIC",
      "definition": "KM*S(-1)",
      "numerator": 1,
      "denominator": 1,
      "offset": 0
    },
    "KM_PER_HR": {
      "schemaItemType": "Unit",
      "label": "km/h",
      "phenomenon": "Units.VELOCITY",
      "unitSystem": "Units.METRIC",
      "definition": "KM*HR(-1)",
      "numerator": 1,
      "denominator": 1,
      "offset": 0
    },
    "IN_PER_SEC": {
      "schemaItemType": "Unit",
      "label": "in/s",
      "phenomenon": "Units.VELOCITY",
      "unitSystem": "Units.USCUSTOM",
      "definition": "IN*S(-1)",
      "numerator": 1,
      "denominator": 1,
      "offset": 0
    },
    "IN_PER_MIN": {
      "schemaItemType": "Unit",
      "label": "in/min",
      "phenomenon": "Units.VELOCITY",
      "unitSystem": "Units.USCUSTOM",
      "definition": "IN*MIN(-1)",
      "numerator": 1,
      "denominator": 1,
      "offset": 0
    },
    "IN_PER_HR": {
      "schemaItemType": "Unit",
      "label": "in/h",
      "phenomenon": "Units.VELOCITY",
      "unitSystem": "Units.USCUSTOM",
      "definition": "IN*HR(-1)",
      "numerator": 1,
      "denominator": 1,
      "offset": 0
    },
    "IN_PER_DAY": {
      "schemaItemType": "Unit",
      "label": "in/day",
      "phenomenon": "Units.VELOCITY",
      "unitSystem": "Units.USCUSTOM",
      "definition": "IN*DAY(-1)",
      "numerator": 1,
      "denominator": 1,
      "offset": 0
    },
    "FT_PER_SEC": {
      "schemaItemType": "Unit",
      "label": "ft/s",
      "phenomenon": "Units.VELOCITY",
      "unitSystem": "Units.USCUSTOM",
      "definition": "FT*S(-1)",
      "numerator": 1,
      "denominator": 1,
      "offset": 0
    },
    "FT_PER_MIN": {
      "schemaItemType": "Unit",
      "label": "ft/min",
      "phenomenon": "Units.VELOCITY",
      "unitSystem": "Units.USCUSTOM",
      "definition": "FT*MIN(-1)",
      "numerator": 1,
      "denominator": 1,
      "offset": 0
    },
    "FT_PER_HR": {
      "schemaItemType": "Unit",
      "label": "ft/h",
      "phenomenon": "Units.VELOCITY",
      "unitSystem": "Units.USCUSTOM",
      "definition": "FT*HR(-1)",
      "numerator": 1,
      "denominator": 1,
      "offset": 0
    },
    "FT_PER_DAY": {
      "schemaItemType": "Unit",
      "label": "ft/day",
      "phenomenon": "Units.VELOCITY",
      "unitSystem": "Units.USCUSTOM",
      "definition": "FT*DAY(-1)",
      "numerator": 1,
      "denominator": 1,
      "offset": 0
    },
    "YRD_PER_SEC": {
      "schemaItemType": "Unit",
      "label": "yrd/sec",
      "phenomenon": "Units.VELOCITY",
      "unitSystem": "Units.USCUSTOM",
      "definition": "YRD*S(-1)",
      "numerator": 1,
      "denominator": 1,
      "offset": 0
    },
    "MPH": {
      "schemaItemType": "Unit",
      "label": "mi/h",
      "phenomenon": "Units.VELOCITY",
      "unitSystem": "Units.USCUSTOM",
      "definition": "MILE*HR(-1)",
      "numerator": 1,
      "denominator": 1,
      "offset": 0
    },
    "KNOT_INTERNATIONAL": {
      "schemaItemType": "Unit",
      "label": "knot (Int.)",
      "phenomenon": "Units.VELOCITY",
      "unitSystem": "Units.MARITIME",
      "definition": "NAUT_MILE*HR(-1)",
      "numerator": 1,
      "denominator": 1,
      "offset": 0
    },
    "RAD_PER_SEC": {
      "schemaItemType": "Unit",
      "label": "rad/sec",
      "phenomenon": "Units.ANGULAR_VELOCITY",
      "unitSystem": "Units.SI",
      "definition": "RAD*S(-1)",
      "numerator": 1,
      "denominator": 1,
      "offset": 0
    },
    "RAD_PER_MIN": {
      "schemaItemType": "Unit",
      "label": "rad/min",
      "phenomenon": "Units.ANGULAR_VELOCITY",
      "unitSystem": "Units.METRIC",
      "definition": "RAD*MIN(-1)",
      "numerator": 1,
      "denominator": 1,
      "offset": 0
    },
    "RAD_PER_HR": {
      "schemaItemType": "Unit",
      "label": "rad/hr",
      "phenomenon": "Units.ANGULAR_VELOCITY",
      "unitSystem": "Units.METRIC",
      "definition": "RAD*HR(-1)",
      "numerator": 1,
      "denominator": 1,
      "offset": 0
    },
    "RPS": {
      "schemaItemType": "Unit",
      "label": "cycle/sec",
      "phenomenon": "Units.ANGULAR_VELOCITY",
      "unitSystem": "Units.METRIC",
      "definition": "[TWO_PI]*RAD*S(-1)",
      "numerator": 1,
      "denominator": 1,
      "offset": 0
    },
    "RPM": {
      "schemaItemType": "Unit",
      "label": "cycle/min",
      "phenomenon": "Units.ANGULAR_VELOCITY",
      "unitSystem": "Units.METRIC",
      "definition": "[TWO_PI]*RAD*MIN(-1)",
      "numerator": 1,
      "denominator": 1,
      "offset": 0
    },
    "RPH": {
      "schemaItemType": "Unit",
      "label": "cycle/hr",
      "phenomenon": "Units.ANGULAR_VELOCITY",
      "unitSystem": "Units.METRIC",
      "definition": "[TWO_PI]*RAD*HR(-1)",
      "numerator": 1,
      "denominator": 1,
      "offset": 0
    },
    "DEG_PER_SEC": {
      "schemaItemType": "Unit",
      "label": "deg/sec",
      "phenomenon": "Units.ANGULAR_VELOCITY",
      "unitSystem": "Units.METRIC",
      "definition": "ARC_DEG*S(-1)",
      "numerator": 1,
      "denominator": 1,
      "offset": 0
    },
    "DEG_PER_MIN": {
      "schemaItemType": "Unit",
      "label": "deg/min",
      "phenomenon": "Units.ANGULAR_VELOCITY",
      "unitSystem": "Units.METRIC",
      "definition": "ARC_DEG*MIN(-1)",
      "numerator": 1,
      "denominator": 1,
      "offset": 0
    },
    "DEG_PER_HR": {
      "schemaItemType": "Unit",
      "label": "deg/hr",
      "phenomenon": "Units.ANGULAR_VELOCITY",
      "unitSystem": "Units.METRIC",
      "definition": "ARC_DEG*HR(-1)",
      "numerator": 1,
      "denominator": 1,
      "offset": 0
    },
    "PA_S": {
      "schemaItemType": "Unit",
      "label": "Pa·s",
      "phenomenon": "Units.DYNAMIC_VISCOSITY",
      "unitSystem": "Units.SI",
      "definition": "PA*S",
      "numerator": 1,
      "denominator": 1,
      "offset": 0
    },
    "POISE": {
      "schemaItemType": "Unit",
      "label": "poise",
      "description": "Exact, See http://physics.nist.gov/cuu/pdf/sp811.pdf Appendix B.",
      "phenomenon": "Units.DYNAMIC_VISCOSITY",
      "unitSystem": "Units.METRIC",
      "definition": "[DECI]*PA_S",
      "numerator": 1,
      "denominator": 1,
      "offset": 0
    },
    "CENTIPOISE": {
      "schemaItemType": "Unit",
      "label": "cP",
      "phenomenon": "Units.DYNAMIC_VISCOSITY",
      "unitSystem": "Units.METRIC",
      "definition": "[CENTI]*POISE",
      "numerator": 1,
      "denominator": 1,
      "offset": 0
    },
    "LBM_PER_FT_S": {
      "schemaItemType": "Unit",
      "label": "lbm/(ft*s)",
      "phenomenon": "Units.DYNAMIC_VISCOSITY",
      "unitSystem": "Units.USCUSTOM",
      "definition": "LBM*FT(-1)*S(-1)",
      "numerator": 1,
      "denominator": 1,
      "offset": 0
    },
    "SQ_M_PER_SEC": {
      "schemaItemType": "Unit",
      "label": "m²/s",
      "phenomenon": "Units.KINEMATIC_VISCOSITY",
      "unitSystem": "Units.SI",
      "definition": "M(2)*S(-1)",
      "numerator": 1,
      "denominator": 1,
      "offset": 0
    },
    "SQ_FT_PER_SEC": {
      "schemaItemType": "Unit",
      "label": "ft²/s",
      "phenomenon": "Units.KINEMATIC_VISCOSITY",
      "unitSystem": "Units.USCUSTOM",
      "definition": "FT(2)*S(-1)",
      "numerator": 1,
      "denominator": 1,
      "offset": 0
    },
    "STOKE": {
      "schemaItemType": "Unit",
      "label": "St",
      "phenomenon": "Units.KINEMATIC_VISCOSITY",
      "unitSystem": "Units.METRIC",
      "definition": "CM(2)*S(-1)",
      "numerator": 1,
      "denominator": 1,
      "offset": 0
    },
    "CENTISTOKE": {
      "schemaItemType": "Unit",
      "label": "cSt",
      "phenomenon": "Units.KINEMATIC_VISCOSITY",
      "unitSystem": "Units.METRIC",
      "definition": "MM(2)*S(-1)",
      "numerator": 1,
      "denominator": 1,
      "offset": 0
    },
    "CUB_M": {
      "schemaItemType": "Unit",
      "label": "m³",
      "phenomenon": "Units.VOLUME",
      "unitSystem": "Units.SI",
      "definition": "M(3)",
      "numerator": 1,
      "denominator": 1,
      "offset": 0
    },
    "CUB_UM": {
      "schemaItemType": "Unit",
      "label": "um³",
      "phenomenon": "Units.VOLUME",
      "unitSystem": "Units.METRIC",
      "definition": "UM(3)",
      "numerator": 1,
      "denominator": 1,
      "offset": 0
    },
    "CUB_MM": {
      "schemaItemType": "Unit",
      "label": "mm³",
      "phenomenon": "Units.VOLUME",
      "unitSystem": "Units.METRIC",
      "definition": "MM(3)",
      "numerator": 1,
      "denominator": 1,
      "offset": 0
    },
    "CUB_CM": {
      "schemaItemType": "Unit",
      "label": "cm³",
      "phenomenon": "Units.VOLUME",
      "unitSystem": "Units.METRIC",
      "definition": "CM(3)",
      "numerator": 1,
      "denominator": 1,
      "offset": 0
    },
    "CUB_DM": {
      "schemaItemType": "Unit",
      "label": "dm³",
      "phenomenon": "Units.VOLUME",
      "unitSystem": "Units.METRIC",
      "definition": "DM(3)",
      "numerator": 1,
      "denominator": 1,
      "offset": 0
    },
    "CUB_KM": {
      "schemaItemType": "Unit",
      "label": "km³",
      "phenomenon": "Units.VOLUME",
      "unitSystem": "Units.METRIC",
      "definition": "KM(3)",
      "numerator": 1,
      "denominator": 1,
      "offset": 0
    },
    "LITRE": {
      "schemaItemType": "Unit",
      "label": "L",
      "phenomenon": "Units.VOLUME",
      "unitSystem": "Units.METRIC",
      "definition": "CUB_DM",
      "numerator": 1,
      "denominator": 1,
      "offset": 0
    },
    "THOUSAND_LITRE": {
      "schemaItemType": "Unit",
      "label": "thousand L",
      "phenomenon": "Units.VOLUME",
      "unitSystem": "Units.METRIC",
      "definition": "[KILO]*LITRE",
      "numerator": 1,
      "denominator": 1,
      "offset": 0
    },
    "MILLION_LITRE": {
      "schemaItemType": "Unit",
      "label": "million L",
      "phenomenon": "Units.VOLUME",
      "unitSystem": "Units.METRIC",
      "definition": "[MEGA]*LITRE",
      "numerator": 1,
      "denominator": 1,
      "offset": 0
    },
    "MICROLITRE": {
      "schemaItemType": "Unit",
      "label": "µliter",
      "phenomenon": "Units.VOLUME",
      "unitSystem": "Units.METRIC",
      "definition": "[MICRO]*LITRE",
      "numerator": 1,
      "denominator": 1,
      "offset": 0
    },
    "CUB_IN": {
      "schemaItemType": "Unit",
      "label": "in³",
      "phenomenon": "Units.VOLUME",
      "unitSystem": "Units.USCUSTOM",
      "definition": "IN(3)",
      "numerator": 1,
      "denominator": 1,
      "offset": 0
    },
    "CUB_FT": {
      "schemaItemType": "Unit",
      "label": "ft³",
      "phenomenon": "Units.VOLUME",
      "unitSystem": "Units.USCUSTOM",
      "definition": "FT(3)",
      "numerator": 1,
      "denominator": 1,
      "offset": 0
    },
    "CUB_YRD": {
      "schemaItemType": "Unit",
      "label": "yd³",
      "phenomenon": "Units.VOLUME",
      "unitSystem": "Units.USCUSTOM",
      "definition": "YRD(3)",
      "numerator": 1,
      "denominator": 1,
      "offset": 0
    },
    "CUB_MILE": {
      "schemaItemType": "Unit",
      "label": "mile³",
      "phenomenon": "Units.VOLUME",
      "unitSystem": "Units.USCUSTOM",
      "definition": "MILE(3)",
      "numerator": 1,
      "denominator": 1,
      "offset": 0
    },
    "ACRE_IN": {
      "schemaItemType": "Unit",
      "label": "acre·in",
      "phenomenon": "Units.VOLUME",
      "unitSystem": "Units.USCUSTOM",
      "definition": "ACRE*IN",
      "numerator": 1,
      "denominator": 1,
      "offset": 0
    },
    "ACRE_FT": {
      "schemaItemType": "Unit",
      "label": "acre·ft",
      "phenomenon": "Units.VOLUME",
      "unitSystem": "Units.USCUSTOM",
      "definition": "ACRE*FT",
      "numerator": 1,
      "denominator": 1,
      "offset": 0
    },
    "GALLON": {
      "schemaItemType": "Unit",
      "label": "gal",
      "description": "Exact, http://www.nist.gov/pml/wmd/pubs/upload/hb44-15-web-final.pdf, Appendix C. Section 4, Page C-11",
      "phenomenon": "Units.VOLUME",
      "unitSystem": "Units.USCUSTOM",
      "definition": "IN(3)",
      "numerator": 231,
      "denominator": 1,
      "offset": 0
    },
    "THOUSAND_GALLON": {
      "schemaItemType": "Unit",
      "label": "thousand gal",
      "phenomenon": "Units.VOLUME",
      "unitSystem": "Units.USCUSTOM",
      "definition": "[KILO]*GALLON",
      "numerator": 1,
      "denominator": 1,
      "offset": 0
    },
    "MILLION_GALLON": {
      "schemaItemType": "Unit",
      "label": "million gal",
      "phenomenon": "Units.VOLUME",
      "unitSystem": "Units.USCUSTOM",
      "definition": "[MEGA]*GALLON",
      "numerator": 1,
      "denominator": 1,
      "offset": 0
    },
    "GALLON_IMPERIAL": {
      "schemaItemType": "Unit",
      "label": "gal (imp)",
      "description": "Exact, See http://physics.nist.gov/cuu/pdf/sp811.pdf Appendix B.",
      "phenomenon": "Units.VOLUME",
      "unitSystem": "Units.IMPERIAL",
      "definition": "LITRE",
      "numerator": 4.54609,
      "denominator": 1,
      "offset": 0
    },
    "CUB_M_PER_CUB_M": {
      "schemaItemType": "Unit",
      "label": "m³/m³",
      "phenomenon": "Units.VOLUME_RATIO",
      "unitSystem": "Units.SI",
      "definition": "M(3)*M(-3)",
      "numerator": 1,
      "denominator": 1,
      "offset": 0
    },
    "LITRE_PER_LITRE": {
      "schemaItemType": "Unit",
      "label": "liter/liter",
      "phenomenon": "Units.VOLUME_RATIO",
      "unitSystem": "Units.METRIC",
      "definition": "LITRE*LITRE(-1)",
      "numerator": 1,
      "denominator": 1,
      "offset": 0
    },
    "CUB_M_PER_KG": {
      "schemaItemType": "Unit",
      "label": "m³/kg",
      "phenomenon": "Units.SPECIFIC_VOLUME",
      "unitSystem": "Units.SI",
      "definition": "M(3)*KG(-1)",
      "numerator": 1,
      "denominator": 1,
      "offset": 0
    },
    "CUB_FT_PER_LBM": {
      "schemaItemType": "Unit",
      "label": "ft³/lm",
      "phenomenon": "Units.SPECIFIC_VOLUME",
      "unitSystem": "Units.USCUSTOM",
      "definition": "FT(3)*LBM(-1)",
      "numerator": 1,
      "denominator": 1,
      "offset": 0
    },
    "M_TO_THE_SIXTH": {
      "schemaItemType": "Unit",
      "label": "m⁶",
      "phenomenon": "Units.TORSIONAL_WARPING_CONSTANT",
      "unitSystem": "Units.SI",
      "definition": "M(6)",
      "numerator": 1,
      "denominator": 1,
      "offset": 0
    },
    "MM_TO_THE_SIXTH": {
      "schemaItemType": "Unit",
      "label": "mm⁶",
      "phenomenon": "Units.TORSIONAL_WARPING_CONSTANT",
      "unitSystem": "Units.METRIC",
      "definition": "MM(6)",
      "numerator": 1,
      "denominator": 1,
      "offset": 0
    },
    "CM_TO_THE_SIXTH": {
      "schemaItemType": "Unit",
      "label": "cm⁶",
      "phenomenon": "Units.TORSIONAL_WARPING_CONSTANT",
      "unitSystem": "Units.METRIC",
      "definition": "CM(6)",
      "numerator": 1,
      "denominator": 1,
      "offset": 0
    },
    "IN_TO_THE_SIXTH": {
      "schemaItemType": "Unit",
      "label": "in⁶",
      "phenomenon": "Units.TORSIONAL_WARPING_CONSTANT",
      "unitSystem": "Units.USCUSTOM",
      "definition": "IN(6)",
      "numerator": 1,
      "denominator": 1,
      "offset": 0
    },
    "FT_TO_THE_SIXTH": {
      "schemaItemType": "Unit",
      "label": "ft⁶",
      "phenomenon": "Units.TORSIONAL_WARPING_CONSTANT",
      "unitSystem": "Units.USCUSTOM",
      "definition": "FT(6)",
      "numerator": 1,
      "denominator": 1,
      "offset": 0
    },
    "VA": {
      "schemaItemType": "Unit",
      "phenomenon": "Units.APPARENT_POWER",
      "unitSystem": "Units.SI",
      "definition": "VOLT*A",
      "numerator": 1,
      "denominator": 1,
      "offset": 0
    },
    "KVA": {
      "schemaItemType": "Unit",
      "phenomenon": "Units.APPARENT_POWER",
      "unitSystem": "Units.METRIC",
      "definition": "[KILO]*VA",
      "numerator": 1,
      "denominator": 1,
      "offset": 0
    },
    "MVA": {
      "schemaItemType": "Unit",
      "phenomenon": "Units.APPARENT_POWER",
      "unitSystem": "Units.METRIC",
      "definition": "[MEGA]*VA",
      "numerator": 1,
      "denominator": 1,
      "offset": 0
    },
    "M": {
      "schemaItemType": "Unit",
      "label": "m",
      "phenomenon": "Units.LENGTH",
      "unitSystem": "Units.SI",
      "definition": "M",
      "numerator": 1,
      "denominator": 1,
      "offset": 0
    },
    "KG": {
      "schemaItemType": "Unit",
      "label": "kg",
      "phenomenon": "Units.MASS",
      "unitSystem": "Units.SI",
      "definition": "KG",
      "numerator": 1,
      "denominator": 1,
      "offset": 0
    },
    "S": {
      "schemaItemType": "Unit",
      "label": "s",
      "phenomenon": "Units.TIME",
      "unitSystem": "Units.SI",
      "definition": "S",
      "numerator": 1,
      "denominator": 1,
      "offset": 0
    },
    "K": {
      "schemaItemType": "Unit",
      "phenomenon": "Units.TEMPERATURE",
      "unitSystem": "Units.SI",
      "definition": "K",
      "numerator": 1,
      "denominator": 1,
      "offset": 0
    },
    "DELTA_KELVIN": {
      "schemaItemType": "Unit",
      "label": "ΔK",
      "phenomenon": "Units.TEMPERATURE_CHANGE",
      "unitSystem": "Units.SI",
      "definition": "DELTA_KELVIN",
      "numerator": 1,
      "denominator": 1,
      "offset": 0
    },
    "A": {
      "schemaItemType": "Unit",
      "phenomenon": "Units.CURRENT",
      "unitSystem": "Units.SI",
      "definition": "A",
      "numerator": 1,
      "denominator": 1,
      "offset": 0
    },
    "MOL": {
      "schemaItemType": "Unit",
      "label": "mol",
      "description": "Where mol is the SI gram mol or gmol.",
      "phenomenon": "Units.MOLE",
      "unitSystem": "Units.SI",
      "definition": "MOL",
      "numerator": 1,
      "denominator": 1,
      "offset": 0
    },
    "CD": {
      "schemaItemType": "Unit",
      "label": "cd",
      "phenomenon": "Units.LUMINOSITY",
      "unitSystem": "Units.SI",
      "definition": "CD",
      "numerator": 1,
      "denominator": 1,
      "offset": 0
    },
    "RAD": {
      "schemaItemType": "Unit",
      "label": "rad",
      "phenomenon": "Units.ANGLE",
      "unitSystem": "Units.SI",
      "definition": "RAD",
      "numerator": 1,
      "denominator": 1,
      "offset": 0
    },
    "STERAD": {
      "schemaItemType": "Unit",
      "label": "sterad",
      "phenomenon": "Units.SOLIDANGLE",
      "unitSystem": "Units.SI",
      "definition": "STERAD",
      "numerator": 1,
      "denominator": 1,
      "offset": 0
    },
    "US_DOLLAR": {
      "schemaItemType": "Unit",
      "label": "$",
      "phenomenon": "Units.CURRENCY",
      "unitSystem": "Units.FINANCE",
      "definition": "US_DOLLAR",
      "numerator": 1,
      "denominator": 1,
      "offset": 0
    },
    "MONETARY_UNIT": {
      "schemaItemType": "Unit",
      "label": "¤",
      "description": "For money of an unspecified denomination",
      "phenomenon": "Units.CURRENCY",
      "unitSystem": "Units.FINANCE",
      "definition": "MONETARY_UNIT",
      "numerator": 1,
      "denominator": 1,
      "offset": 0
    },
    "PERSON": {
      "schemaItemType": "Unit",
      "label": "person",
      "phenomenon": "Units.CAPITA",
      "unitSystem": "Units.SI",
      "definition": "PERSON",
      "numerator": 1,
      "denominator": 1,
      "offset": 0
    },
    "ONE": {
      "schemaItemType": "Unit",
      "label": "one",
      "phenomenon": "Units.NUMBER",
      "unitSystem": "Units.INTERNATIONAL",
      "definition": "ONE",
      "numerator": 1,
      "denominator": 1,
      "offset": 0
    },
    "COEFFICIENT": {
      "schemaItemType": "Unit",
      "label": "coefficient",
      "description": "For unitless coefficients",
      "phenomenon": "Units.NUMBER",
      "unitSystem": "Units.INTERNATIONAL",
      "definition": "ONE",
      "numerator": 1,
      "denominator": 1,
      "offset": 0
    },
    "OHM": {
      "schemaItemType": "Unit",
      "label": "Ω",
      "phenomenon": "Units.ELECTRICAL_RESISTANCE",
      "unitSystem": "Units.SI",
      "definition": "VOLT*A(-1)",
      "numerator": 1,
      "denominator": 1,
      "offset": 0
    },
    "KOHM": {
      "schemaItemType": "Unit",
      "label": "kΩ",
      "phenomenon": "Units.ELECTRICAL_RESISTANCE",
      "unitSystem": "Units.METRIC",
      "definition": "[KILO]*OHM",
      "numerator": 1,
      "denominator": 1,
      "offset": 0
    },
    "OHM_M": {
      "schemaItemType": "Unit",
      "label": "Ω·m",
      "phenomenon": "Units.ELECTRICAL_RESISTIVITY",
      "unitSystem": "Units.SI",
      "definition": "OHM*M",
      "numerator": 1,
      "denominator": 1,
      "offset": 0
    },
    "M_PER_REVOLUTION": {
      "schemaItemType": "Unit",
      "label": "m/r",
      "phenomenon": "Units.THREAD_PITCH",
      "unitSystem": "Units.INTERNATIONAL",
      "definition": "M*REVOLUTION(-1)",
      "numerator": 1,
      "denominator": 1,
      "offset": 0
    },
    "M_PER_RAD": {
      "schemaItemType": "Unit",
      "label": "m/rad",
      "phenomenon": "Units.THREAD_PITCH",
      "unitSystem": "Units.SI",
      "definition": "M*RAD(-1)",
      "numerator": 1,
      "denominator": 1,
      "offset": 0
    },
    "IN_PER_DEGREE": {
      "schemaItemType": "Unit",
      "label": "in/degree",
      "phenomenon": "Units.THREAD_PITCH",
      "unitSystem": "Units.USCUSTOM",
      "definition": "IN*ARC_DEG(-1)",
      "numerator": 1,
      "denominator": 1,
      "offset": 0
    },
    "J_PER_K": {
      "schemaItemType": "Unit",
      "label": "J/K",
      "phenomenon": "Units.ENTROPY",
      "unitSystem": "Units.SI",
      "definition": "J*DELTA_KELVIN(-1)",
      "numerator": 1,
      "denominator": 1,
      "offset": 0
    },
    "KJ_PER_K": {
      "schemaItemType": "Unit",
      "label": "KJ/K",
      "phenomenon": "Units.ENTROPY",
      "unitSystem": "Units.METRIC",
      "definition": "[KILO]*J*DELTA_KELVIN(-1)",
      "numerator": 1,
      "denominator": 1,
      "offset": 0
    },
    "BTU_PER_FAHRENHEIT": {
      "schemaItemType": "Unit",
      "label": "Btu/°F",
      "description": "Exact, See http://physics.nist.gov/cuu/pdf/sp811.pdf Appendix B.8, page 46.",
      "phenomenon": "Units.ENTROPY",
      "unitSystem": "Units.USCUSTOM",
      "definition": "BTU*DELTA_FAHRENHEIT(-1)",
      "numerator": 1,
      "denominator": 1,
      "offset": 0
    },
    "LUMEN_PER_W": {
      "schemaItemType": "Unit",
      "label": "lm/W",
      "phenomenon": "Units.LUMINOUS_EFFICACY",
      "unitSystem": "Units.SI",
      "definition": "LUMEN*W(-1)",
      "numerator": 1,
      "denominator": 1,
      "offset": 0
    },
    "INVERSE_N": {
      "schemaItemType": "Unit",
      "label": "1/N",
      "phenomenon": "Units.MOMENT_DISPLAY_SCALE",
      "unitSystem": "Units.SI",
      "definition": "N(-1)",
      "numerator": 1,
      "denominator": 1,
      "offset": 0
    },
    "INVERSE_KN": {
      "schemaItemType": "Unit",
      "label": "1/kN",
      "phenomenon": "Units.MOMENT_DISPLAY_SCALE",
      "unitSystem": "Units.METRIC",
      "definition": "KN(-1)",
      "numerator": 1,
      "denominator": 1,
      "offset": 0
    },
    "INVERSE_KPF": {
      "schemaItemType": "Unit",
      "label": "1/kpf",
      "phenomenon": "Units.MOMENT_DISPLAY_SCALE",
      "unitSystem": "Units.USCUSTOM",
      "definition": "KPF(-1)",
      "numerator": 1,
      "denominator": 1,
      "offset": 0
    },
    "M_PER_N": {
      "schemaItemType": "Unit",
      "label": "m/N",
      "phenomenon": "Units.FORCE_DISPLAY_SCALE",
      "unitSystem": "Units.SI",
      "definition": "N_PER_M(-1)",
      "numerator": 1,
      "denominator": 1,
      "offset": 0
    },
    "M_PER_KN": {
      "schemaItemType": "Unit",
      "label": "m/kN",
      "phenomenon": "Units.FORCE_DISPLAY_SCALE",
      "unitSystem": "Units.METRIC",
      "definition": "KN_PER_M(-1)",
      "numerator": 1,
      "denominator": 1,
      "offset": 0
    }
  }
}`;
