
/**
 * To be replaced with ecschema-metadata KindOfQuantityProps once packages are combined.
 */
interface KindOfQuantityProps {
  name: string;
  label: string;
  persistenceUnit: string;
  presentationUnit: string;
}

/**
 * @internal
 * Merge with PFS concept to handle multiple unit systems.
 */
export const AEC_UNITS_KOQ: { [key: string]: KindOfQuantityProps } = {
  "AecUnits.ACCELERATION": {
    name: "AecUnits.ACCELERATION",
    label: "Acceleration",
    persistenceUnit: "Units.M_PER_SEC_SQ",
    presentationUnit: "Formats.DefaultRealU(4)[Units.M_PER_SEC_SQ]"
  },
  "AecUnits.ANGLE": {
    name: "AecUnits.ANGLE",
    label: "Angle",
    persistenceUnit: "Units.RAD",
    presentationUnit: "Formats.DefaultRealU(2)[Units.ARC_DEG]"
  },
  "AecUnits.ANGULAR_VELOCITY": {
    name: "AecUnits.ANGULAR_VELOCITY",
    label: "Angular Velocity",
    persistenceUnit: "Units.RAD_PER_SEC",
    presentationUnit: "Formats.DefaultRealU(4)[Units.RAD_PER_SEC]"
  },
  "AecUnits.AREA": {
    name: "AecUnits.AREA",
    label: "Area",
    persistenceUnit: "Units.SQ_M",
    presentationUnit: "Formats.DefaultRealU(4)[Units.SQ_M]"
  },
  "AecUnits.AREA_FORCE": {
    name: "AecUnits.AREA_FORCE",
    label: "Area Force",
    persistenceUnit: "Units.PA",
    presentationUnit: "Formats.DefaultRealU(4)[Units.KILOPASCAL]"
  },
  "AecUnits.AREA_FORCE_LARGE": {
    name: "AecUnits.AREA_FORCE_LARGE",
    label: "Area Force Large",
    persistenceUnit: "Units.PA",
    presentationUnit: "Formats.DefaultRealU(4)[Units.MEGAPASCAL]"
  },
  "AecUnits.AREA_FORCE_SMALL": {
    name: "AecUnits.AREA_FORCE_SMALL",
    label: "Area Force Small",
    persistenceUnit: "Units.PA",
    presentationUnit: "Formats.DefaultRealU(2)[Units.PA]"
  },
  "AecUnits.AREA_LARGE": {
    name: "AecUnits.AREA_LARGE",
    label: "Large Area",
    persistenceUnit: "Units.SQ_M",
    presentationUnit: "Formats.DefaultRealU(4)[Units.SQ_KM]"
  },
  "AecUnits.AREA_MOMENT": {
    name: "AecUnits.AREA_MOMENT",
    label: "Area Moment",
    persistenceUnit: "Units.N_M_PER_SQ_M",
    presentationUnit: "Formats.DefaultRealU(4)[Units.KN_M_PER_SQ_M]"
  },
  "AecUnits.AREA_MOMENT_LARGE": {
    name: "AecUnits.AREA_MOMENT_LARGE",
    label: "Area Moment Large",
    persistenceUnit: "Units.N_M_PER_SQ_M",
    presentationUnit: "Formats.DefaultRealU(4)[Units.MEGAN_M_PER_SQ_M]"
  },
  "AecUnits.AREA_MOMENT_SMALL": {
    name: "AecUnits.AREA_MOMENT_SMALL",
    label: "Area Moment Small",
    persistenceUnit: "Units.N_M_PER_SQ_M",
    presentationUnit: "Formats.DefaultRealU(4)[Units.N_M_PER_SQ_M]"
  },
  "AecUnits.AREA_SMALL": {
    name: "AecUnits.AREA_SMALL",
    label: "Small Area",
    persistenceUnit: "Units.SQ_M",
    presentationUnit: "Formats.DefaultRealU(2)[Units.SQ_MM]"
  },
  "AecUnits.AREA_SPRING_CONSTANT": {
    name: "AecUnits.AREA_SPRING_CONSTANT",
    label: "Area Spring Constant",
    persistenceUnit: "Units.AREA_SPRING_CONSTANT_N_PER_CUB_M",
    presentationUnit: "Formats.DefaultRealU(4)[Units.AREA_SPRING_CONSTANT_N_PER_CUB_M]"
  },
  "AecUnits.CURRENT": {
    name: "AecUnits.CURRENT",
    label: "Current",
    persistenceUnit: "Units.A",
    presentationUnit: "Formats.DefaultRealU(4)[Units.A]"
  },
  "AecUnits.DENSITY": {
    name: "AecUnits.DENSITY",
    label: "Density",
    persistenceUnit: "Units.KG_PER_CUB_M",
    presentationUnit: "Formats.DefaultRealU(4)[Units.KG_PER_CUB_M]"
  },
  "AecUnits.DYNAMIC_VISCOSITY": {
    name: "AecUnits.DYNAMIC_VISCOSITY",
    label: "Dynamic Viscosity",
    persistenceUnit: "Units.PA_S",
    presentationUnit: "Formats.DefaultRealU(4)[Units.PA_S]"
  },
  "AecUnits.ELECTRIC_POTENTIAL": {
    name: "AecUnits.ELECTRIC_POTENTIAL",
    label: "Electric Potential",
    persistenceUnit: "Units.VOLT",
    presentationUnit: "Formats.DefaultRealU(4)[Units.VOLT]"
  },
  "AecUnits.ENERGY": {
    name: "AecUnits.ENERGY",
    label: "Energy",
    persistenceUnit: "Units.J",
    presentationUnit: "Formats.DefaultRealU(4)[Units.J]"
  },
  "AecUnits.FLOW": {
    name: "AecUnits.FLOW",
    label: "Flow Rate",
    persistenceUnit: "Units.CUB_M_PER_SEC",
    presentationUnit: "Formats.DefaultRealU(4)[Units.LITRE_PER_MIN]"
  },
  "AecUnits.FORCE": {
    name: "AecUnits.FORCE",
    label: "Force",
    persistenceUnit: "Units.N",
    presentationUnit: "Formats.DefaultRealU(4)[Units.KN]"
  },
  "AecUnits.FORCE_DENSITY": {
    name: "AecUnits.FORCE_DENSITY",
    label: "Force Density",
    persistenceUnit: "Units.N_PER_CUB_M",
    presentationUnit: "Formats.DefaultRealU(4)[Units.N_PER_CUB_M]"
  },
  "AecUnits.FORCE_LARGE": {
    name: "AecUnits.FORCE_LARGE",
    label: "Force Large",
    persistenceUnit: "Units.N",
    presentationUnit: "Formats.DefaultRealU(4)[Units.MEGAN]"
  },
  "AecUnits.FORCE_SMALL": {
    name: "AecUnits.FORCE_SMALL",
    label: "Force Small",
    persistenceUnit: "Units.N",
    presentationUnit: "Formats.DefaultRealU(2)[Units.N]"
  },
  "AecUnits.FREQUENCY": {
    name: "AecUnits.FREQUENCY",
    label: "Frequency",
    persistenceUnit: "Units.HZ",
    presentationUnit: "Formats.DefaultRealU(4)[Units.HZ]"
  },
  "AecUnits.HEAT_TRANSFER": {
    name: "AecUnits.HEAT_TRANSFER",
    label: "Heat Transfer",
    persistenceUnit: "Units.W_PER_SQ_M_K",
    presentationUnit: "Formats.DefaultRealU(4)[Units.W_PER_SQ_M_K]"
  },
  "AecUnits.ILLUMINANCE": {
    name: "AecUnits.ILLUMINANCE",
    label: "Illuminance",
    persistenceUnit: "Units.LUX",
    presentationUnit: "Formats.DefaultRealU(4)[Units.LUX]"
  },
  "AecUnits.LENGTH": {
    name: "AecUnits.LENGTH",
    label: "Length",
    persistenceUnit: "Units.M",
    presentationUnit: "Formats.DefaultRealU(4)[Units.M]"
  },
  "AecUnits.LENGTH_LONG": {
    name: "AecUnits.LENGTH_LONG",
    label: "Long Length",
    persistenceUnit: "Units.M",
    presentationUnit: "Formats.DefaultRealU(4)[Units.KM]"
  },
  "AecUnits.LENGTH_SHORT": {
    name: "AecUnits.LENGTH_SHORT",
    label: "Short Length",
    persistenceUnit: "Units.M",
    presentationUnit: "Formats.DefaultRealU(2)[Units.MM]"
  },
  "AecUnits.LINEAR_DENSITY": {
    name: "AecUnits.LINEAR_DENSITY",
    label: "Linear Density",
    persistenceUnit: "Units.KG_PER_M",
    presentationUnit: "Formats.DefaultRealU(4)[Units.KG_PER_M]"
  },
  "AecUnits.LINEAR_FORCE": {
    name: "AecUnits.LINEAR_FORCE",
    label: "Linear Force",
    persistenceUnit: "Units.N_PER_M",
    presentationUnit: "Formats.DefaultRealU(4)[Units.KN_PER_M]"
  },
  "AecUnits.LINEAR_FORCE_LARGE": {
    name: "AecUnits.LINEAR_FORCE_LARGE",
    label: "Linear Force Large",
    persistenceUnit: "Units.N_PER_M",
    presentationUnit: "Formats.DefaultRealU(4)[Units.MEGAN_PER_M]"
  },
  "AecUnits.LINEAR_FORCE_SMALL": {
    name: "AecUnits.LINEAR_FORCE_SMALL",
    label: "Linear Force Small",
    persistenceUnit: "Units.N_PER_M",
    presentationUnit: "Formats.DefaultRealU(2)[Units.N_PER_M]"
  },
  "AecUnits.LINEAR_MOMENT": {
    name: "AecUnits.LINEAR_MOMENT",
    label: "Linear Moment",
    persistenceUnit: "Units.N_M_PER_M",
    presentationUnit: "Formats.DefaultRealU(4)[Units.KN_M_PER_M]"
  },
  "AecUnits.LINEAR_MOMENT_LARGE": {
    name: "AecUnits.LINEAR_MOMENT_LARGE",
    label: "Linear Moment Large",
    persistenceUnit: "Units.N_M_PER_M",
    presentationUnit: "Formats.DefaultRealU(4)[Units.MEGAN_M_PER_M]"
  },
  "AecUnits.LINEAR_MOMENT_SMALL": {
    name: "AecUnits.LINEAR_MOMENT_SMALL",
    label: "Linear Moment Small",
    persistenceUnit: "Units.N_M_PER_M",
    presentationUnit: "Formats.DefaultRealU(4)[Units.N_M_PER_M]"
  },
  "AecUnits.LINEAR_ROTATIONAL_SPRING_CONSTANT": {
    name: "AecUnits.LINEAR_ROTATIONAL_SPRING_CONSTANT",
    label: "Linear Rotational Spring Constant",
    persistenceUnit: "Units.N_PER_RAD",
    presentationUnit: "Formats.DefaultRealU(4)[Units.N_PER_RAD]"
  },
  "AecUnits.LINEAR_SPRING_CONSTANT": {
    name: "AecUnits.LINEAR_SPRING_CONSTANT",
    label: "Linear Spring Constant",
    persistenceUnit: "Units.LINEAR_SPRING_CONSTANT_N_PER_SQ_M",
    presentationUnit: "Formats.DefaultRealU(4)[Units.LINEAR_SPRING_CONSTANT_N_PER_SQ_M]"
  },
  "AecUnits.LIQUID_VOLUME": {
    name: "AecUnits.LIQUID_VOLUME",
    label: "Liquid Volume",
    persistenceUnit: "Units.CUB_M",
    presentationUnit: "Formats.DefaultRealU(4)[Units.LITRE]"
  },
  "AecUnits.LIQUID_VOLUME_LARGE": {
    name: "AecUnits.LIQUID_VOLUME_LARGE",
    label: "Liquid Large Volume",
    persistenceUnit: "Units.CUB_M",
    presentationUnit: "Formats.DefaultRealU(4)[Units.THOUSAND_LITRE]"
  },
  "AecUnits.LIQUID_VOLUME_SMALL": {
    name: "AecUnits.LIQUID_VOLUME_SMALL",
    label: "Liquid Small Volume",
    persistenceUnit: "Units.CUB_M",
    presentationUnit: "Formats.DefaultRealU(4)[Units.LITRE]"
  },
  "AecUnits.LUMINOUS_FLUX": {
    name: "AecUnits.LUMINOUS_FLUX",
    label: "Luminous Flux",
    persistenceUnit: "Units.LUMEN",
    presentationUnit: "Formats.DefaultRealU(4)[Units.LUMEN]"
  },
  "AecUnits.LUMINOUS_INTENSITY": {
    name: "AecUnits.LUMINOUS_INTENSITY",
    label: "Luminous Intensity",
    persistenceUnit: "Units.CD",
    presentationUnit: "Formats.DefaultRealU(4)[Units.CD]"
  },
  "AecUnits.MOMENT": {
    name: "AecUnits.MOMENT",
    label: "Moment",
    persistenceUnit: "Units.N_M",
    presentationUnit: "Formats.DefaultRealU(4)[Units.KN_M]"
  },
  "AecUnits.MOMENT_LARGE": {
    name: "AecUnits.MOMENT_LARGE",
    label: "Moment Large",
    persistenceUnit: "Units.N_M",
    presentationUnit: "Formats.DefaultRealU(4)[Units.MEGAN_M]"
  },
  "AecUnits.MOMENT_OF_INERTIA": {
    name: "AecUnits.MOMENT_OF_INERTIA",
    label: "Moment Of Inertia",
    persistenceUnit: "Units.M_TO_THE_FOURTH",
    presentationUnit: "Formats.DefaultRealU(4)[Units.M_TO_THE_FOURTH]"
  },
  "AecUnits.MOMENT_SMALL": {
    name: "AecUnits.MOMENT_SMALL",
    label: "Moment Small",
    persistenceUnit: "Units.N_M",
    presentationUnit: "Formats.DefaultRealU(2)[Units.N_M]"
  },
  "AecUnits.POWER": {
    name: "AecUnits.POWER",
    label: "Power",
    persistenceUnit: "Units.W",
    presentationUnit: "Formats.DefaultRealU(4)[Units.W]"
  },
  "AecUnits.PRESSURE": {
    name: "AecUnits.PRESSURE",
    label: "Pressure",
    persistenceUnit: "Units.PA",
    presentationUnit: "Formats.DefaultRealU(4)[Units.PA]"
  },
  "AecUnits.PRESSURE_GRADIENT": {
    name: "AecUnits.PRESSURE_GRADIENT",
    label: "Pressure Gradient",
    persistenceUnit: "Units.PA_PER_M",
    presentationUnit: "Formats.DefaultRealU(4)[Units.PA_PER_M]"
  },
  "AecUnits.PROBABILITY": {
    name: "AecUnits.PROBABILITY",
    label: "Probability",
    persistenceUnit: "Units.PROBABILITY_FRACTION",
    presentationUnit: "Formats.DefaultRealU(2)[Units.PROBABILITY_PERCENT]"
  },
  "AecUnits.PROCESS_PIPING_FLOW": {
    name: "AecUnits.PROCESS_PIPING_FLOW",
    label: "Process Piping Flow Rate",
    persistenceUnit: "Units.CUB_M_PER_SEC",
    presentationUnit: "Formats.DefaultRealU(4)[Units.LITRE_PER_MIN]"
  },
  "AecUnits.PROCESS_PIPING_PRESSURE": {
    name: "AecUnits.PROCESS_PIPING_PRESSURE",
    label: "Process Piping Pressure",
    persistenceUnit: "Units.PA",
    presentationUnit: "Formats.DefaultRealU(4)[Units.PA]"
  },
  "AecUnits.PROCESS_PIPING_TEMPERATURE": {
    name: "AecUnits.PROCESS_PIPING_TEMPERATURE",
    label: "Process Piping Temperature",
    persistenceUnit: "Units.K",
    presentationUnit: "Formats.DefaultRealU(2)[Units.CELSIUS]"
  },
  "AecUnits.ROTATIONAL_SPRING_CONSTANT": {
    name: "AecUnits.ROTATIONAL_SPRING_CONSTANT",
    label: "Rotational Spring Constant",
    persistenceUnit: "Units.N_M_PER_RAD",
    presentationUnit: "Formats.DefaultRealU(4)[Units.N_M_PER_RAD]"
  },
  "AecUnits.SPECIFIC_HEAT_CAPACITY": {
    name: "AecUnits.SPECIFIC_HEAT_CAPACITY",
    label: "Specific Heat Capacity",
    persistenceUnit: "Units.J_PER_KG_K",
    presentationUnit: "Formats.DefaultRealU(4)[Units.J_PER_KG_K]"
  },
  "AecUnits.SPECIFIC_HEAT_OF_VAPORIZATION": {
    name: "AecUnits.SPECIFIC_HEAT_OF_VAPORIZATION",
    label: "Specific Heat Of Vaporization",
    persistenceUnit: "Units.J_PER_KG",
    presentationUnit: "Formats.DefaultRealU(4)[Units.J_PER_KG]"
  },
  "AecUnits.SPRING_CONSTANT": {
    name: "AecUnits.SPRING_CONSTANT",
    label: "Spring Constant",
    persistenceUnit: "Units.SPRING_CONSTANT_N_PER_M",
    presentationUnit: "Formats.DefaultRealU(4)[Units.SPRING_CONSTANT_N_PER_M]"
  },
  "AecUnits.TEMPERATURE": {
    name: "AecUnits.TEMPERATURE",
    label: "Temperature",
    persistenceUnit: "Units.K",
    presentationUnit: "Formats.DefaultRealU(4)[Units.CELSIUS]"
  },
  "AecUnits.THERMAL_CONDUCTIVITY": {
    name: "AecUnits.THERMAL_CONDUCTIVITY",
    label: "Thermal Conductivity",
    persistenceUnit: "Units.W_PER_M_K",
    presentationUnit: "Formats.DefaultRealU(4)[Units.W_PER_M_K]"
  },
  "AecUnits.THERMAL_EXPANSION_COEFFICIENT": {
    name: "AecUnits.THERMAL_EXPANSION_COEFFICIENT",
    label: "Thermal Expansion Coefficient",
    persistenceUnit: "Units.STRAIN_PER_KELVIN",
    presentationUnit: "Formats.DefaultRealU(4)[Units.STRAIN_PER_KELVIN]"
  },
  "AecUnits.THERMAL_RESISTANCE": {
    name: "AecUnits.THERMAL_RESISTANCE",
    label: "Thermal Resistance",
    persistenceUnit: "Units.SQ_M_KELVIN_PER_WATT",
    presentationUnit: "Formats.DefaultRealU(4)[Units.SQ_M_KELVIN_PER_WATT]"
  },
  "AecUnits.TIME": {
    name: "AecUnits.TIME",
    label: "Time",
    persistenceUnit: "Units.S",
    presentationUnit: "Formats.DefaultRealU(4)[Units.S]"
  },
  "AecUnits.VELOCITY": {
    name: "AecUnits.VELOCITY",
    label: "Velocity",
    persistenceUnit: "Units.M_PER_SEC",
    presentationUnit: "Formats.DefaultRealU(4)[Units.M_PER_SEC]"
  },
  "AecUnits.VOLUME": {
    name: "AecUnits.VOLUME",
    label: "Volume",
    persistenceUnit: "Units.CUB_M",
    presentationUnit: "Formats.DefaultRealU(4)[Units.CUB_M]"
  },
  "AecUnits.VOLUME_LARGE": {
    name: "AecUnits.VOLUME_LARGE",
    label: "Large Volume",
    persistenceUnit: "Units.CUB_M",
    presentationUnit: "Formats.DefaultRealU(4)[Units.CUB_KM]"
  },
  "AecUnits.VOLUME_SMALL": {
    name: "AecUnits.VOLUME_SMALL",
    label: "Small Volume",
    persistenceUnit: "Units.CUB_M",
    presentationUnit: "Formats.DefaultRealU(4)[Units.CUB_MM]"
  },
  "AecUnits.WARPING_CONSTANT": {
    name: "AecUnits.WARPING_CONSTANT",
    label: "Warping Constant",
    persistenceUnit: "Units.M_TO_THE_SIXTH",
    presentationUnit: "Formats.DefaultRealU(4)[Units.M_TO_THE_SIXTH]"
  },
  "AecUnits.WEIGHT": {
    name: "AecUnits.WEIGHT",
    label: "Weight",
    persistenceUnit: "Units.KG",
    presentationUnit: "Formats.DefaultRealU(2)[Units.KG]"
  },
};

