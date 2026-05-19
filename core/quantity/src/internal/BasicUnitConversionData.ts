/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
import { UnitConversionInvert, type UnitConversionProps, type UnitProps } from "../Interfaces";
import type { SerializedInvertedUnit, SerializedUnit, SerializedUnitSchema } from "../SerializedUnitSchema";
import { type ResolvedUnit, UnitDefinitionResolver } from "../UnitConversion/UnitDefinitionResolver";
import { qualifyItemName } from "../UnitConversion/nameUtils";

interface IndexedUnit {
  readonly props: UnitProps;
  readonly resolved: ResolvedUnit;
}

interface InvertedUnitSourceEntry {
  readonly props: UnitProps;
  readonly invertsUnitName: string;
}

/** Immutable lookup indexes resolved from the bundled Units schema data.
 * @internal
 */
export interface ResolvedBasicUnitsData {
  readonly nameMap: Map<string, IndexedUnit>;
  readonly labelMap: Map<string, IndexedUnit[]>;
  readonly phenomenonMap: Map<string, IndexedUnit[]>;
  readonly invertedUnitSources: Map<string, InvertedUnitSourceEntry>;
  readonly schemaName: string;
}

/** Builds lookup indexes and conversion metadata from a serialized Units schema.
 * @internal
 */
export function buildResolvedBasicUnitsData(schema: SerializedUnitSchema): ResolvedBasicUnitsData {
  const nameMap = new Map<string, IndexedUnit>();
  const labelMap = new Map<string, IndexedUnit[]>();
  const phenomenonMap = new Map<string, IndexedUnit[]>();
  const invertedUnitSources = new Map<string, InvertedUnitSourceEntry>();

  const resolver = new UnitDefinitionResolver(schema);
  const resolved = resolver.resolveAll();

  for (const [name, entry] of resolved) {
    const item = schema.items[name] as SerializedUnit;
    const phenomenon = item.phenomenon;
    const unitSystem = item.unitSystem;

    const fullName = `${schema.name}.${name}`;
    const props: UnitProps = {
      name: fullName,
      label: entry.label,
      phenomenon,
      isValid: true,
      system: unitSystem,
    };

    const indexed: IndexedUnit = { props, resolved: entry };

    nameMap.set(fullName, indexed);
    const lowerLabel = entry.label.toLowerCase();
    const byLabel = labelMap.get(lowerLabel) ?? [];
    byLabel.push(indexed);
    labelMap.set(lowerLabel, byLabel);

    const byPhen = phenomenonMap.get(phenomenon) ?? [];
    byPhen.push(indexed);
    phenomenonMap.set(phenomenon, byPhen);
  }

  for (const [name, item] of Object.entries(schema.items)) {
    if (item.schemaItemType !== "InvertedUnit") {
      continue;
    }

    const inv: SerializedInvertedUnit = item;
    const fullName = `${schema.name}.${name}`;
    const invertsName = qualifyItemName(inv.invertsUnit, schema.name);
    const unitSystem = inv.unitSystem;

    const invertedSource = nameMap.get(invertsName);
    const phenomenon = invertedSource?.props.phenomenon ?? "";

    const props: UnitProps = {
      name: fullName,
      label: inv.label ?? name,
      phenomenon,
      isValid: true,
      system: unitSystem,
    };

    invertedUnitSources.set(fullName, { props, invertsUnitName: invertsName });

    if (invertedSource) {
      const indexed: IndexedUnit = {
        props,
        resolved: { ...invertedSource.resolved, name: fullName, label: props.label, unitSystem },
      };
      nameMap.set(fullName, indexed);

      const lowerLabel = props.label.toLowerCase();
      const byLabel = labelMap.get(lowerLabel) ?? [];
      byLabel.push(indexed);
      labelMap.set(lowerLabel, byLabel);

      const byPhen = phenomenonMap.get(phenomenon) ?? [];
      byPhen.push(indexed);
      phenomenonMap.set(phenomenon, byPhen);
    }
  }

  return { nameMap, labelMap, phenomenonMap, invertedUnitSources, schemaName: schema.name };
}

/** Computes `UnitConversionProps` metadata between two units from the resolved basic-units state.
 * This resolves lookup/conversion metadata only; callers should apply the returned conversion through
 * `UnitConversions.convertValue(...)` or other higher-level helpers rather than using the raw factors directly.
 * @internal
 */
export function getBasicUnitConversion(state: ResolvedBasicUnitsData, fromUnit: UnitProps, toUnit: UnitProps): UnitConversionProps {
  const from = state.nameMap.get(fromUnit.name);
  const to = state.nameMap.get(toUnit.name);

  if (!from || !to) {
    return { factor: 1.0, offset: 0.0, error: true };
  }

  const fromInverted = state.invertedUnitSources.get(fromUnit.name);
  const toInverted = state.invertedUnitSources.get(toUnit.name);

  const fromPhenomenon = fromInverted
    ? state.nameMap.get(fromInverted.invertsUnitName)?.props.phenomenon
    : from.props.phenomenon;
  const toPhenomenon = toInverted
    ? state.nameMap.get(toInverted.invertsUnitName)?.props.phenomenon
    : to.props.phenomenon;
  if (fromPhenomenon !== toPhenomenon) {
    return { factor: 1.0, offset: 0.0, error: true };
  }

  if (fromInverted && toInverted) {
    const innerFrom = state.nameMap.get(fromInverted.invertsUnitName);
    const innerTo = state.nameMap.get(toInverted.invertsUnitName);
    if (innerFrom && innerTo) {
      const c = innerFrom.resolved.conversion.inverse().compose(innerTo.resolved.conversion);
      return { factor: c.factor, offset: c.offset };
    }
  }

  if (fromInverted) {
    const innerFrom = state.nameMap.get(fromInverted.invertsUnitName);
    if (innerFrom) {
      const c = innerFrom.resolved.conversion.inverse().compose(to.resolved.conversion);
      return { factor: c.factor, offset: c.offset, inversion: UnitConversionInvert.InvertPreConversion };
    }
  }

  if (toInverted) {
    const innerTo = state.nameMap.get(toInverted.invertsUnitName);
    if (innerTo) {
      const c = from.resolved.conversion.inverse().compose(innerTo.resolved.conversion);
      return { factor: c.factor, offset: c.offset, inversion: UnitConversionInvert.InvertPostConversion };
    }
  }

  const conv = from.resolved.conversion.inverse().compose(to.resolved.conversion);
  return { factor: conv.factor, offset: conv.offset };
}
