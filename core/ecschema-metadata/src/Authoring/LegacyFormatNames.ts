/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*---------------------------------------------------------------------------------------------*/
/** @packageDocumentation
 * @module Schema
 */

import { ecUnitNameFromFusName, fusNameFromECUnitName } from "./LegacyUnitNames";

/**
 * FUS (format-unit-system) descriptors: how a kind of quantity carried its units before ECXML 3.2
 * had `Unit` and `Format` schema items.
 *
 * A descriptor is a legacy unit name with an optional legacy format name in parentheses -
 * `CM(real4u)`, `M`, `FT(real4);IN(DefaultReal)` - and this module converts between that and the
 * EC 3.2 unit and format references the document holds. Frozen legacy data, transcribed from
 * native's `FormatMappings.cpp`; the unit half lives in {@link ./LegacyUnitNames}.
 */

/** Legacy format alias, as it appears inside a FUS, to the canonical legacy format name. Lookup is
 * case-insensitive, so the keys are lowercase. */
const aliasToLegacyName: ReadonlyMap<string, string> = new Map([
  ["cdm8", "CAngleDM8"], ["cdms", "CAngleDMS"], ["cdms8", "CAngleDMS8"],
  ["decimaldeg4", "DecimalDeg4"], ["dm8", "AngleDM8"], ["dms", "AngleDMS"], ["dms8", "AngleDMS8"],
  ["feet4u", "Feet4u"], ["fi8", "AmerFI8"], ["fi16", "AmerFI16"], ["fi32", "AmerFI32"],
  ["fract", "DefaultFractional"], ["fractu", "DefaultFractionalU"],
  ["fract4", "Fractional4"], ["fract4u", "Fractional4U"], ["fract8", "Fractional8"], ["fract8u", "Fractional8U"],
  ["fract16", "Fractional16"], ["fract16u", "Fractional16U"], ["fract32", "Fractional32"], ["fract32u", "Fractional32U"],
  ["fract64", "Fractional64"], ["fract64u", "Fractional64U"], ["fract128", "Fractional128"], ["fract128u", "Fractional128U"],
  ["fractsign", "SignedFractional"],
  ["yfi8", "AmerYFI8"], ["meters4u", "Meters4u"], ["inches4u", "Inches4u"], ["inches18u", "Inches18u"],
  ["int", "DefaultInt"], ["myfi4", "AmerMYFI4"], ["hms", "HMS"],
  ["real", "DefaultReal"], ["realu", "DefaultRealU"],
  ["real2", "Real2"], ["real2u", "Real2U"], ["real2uns", "Real2UNS"],
  ["real3", "Real3"], ["real3u", "Real3U"], ["real3uns", "Real3UNS"],
  ["real4", "Real4"], ["real4u", "Real4U"], ["real4uns", "Real4UNS"],
  ["real6u", "Real6U"], ["real6uns", "Real6UNS"],
  ["realpth", "ParenthsReal"], ["realsign", "SignedReal"],
  ["sci", "DefaultExp"], ["scin", "NormalizedExp"], ["scisign", "SignedExp"],
  ["stationft2", "StationFt2"], ["stationm4", "StationM4"],
  ["stop100-2-2z", "Stop100-2-2z"], ["stop100-2-4", "Stop100-2-4"], ["stop100-2-4u", "Stop100-2-4u"],
  ["stop100-2", "Stop100-2"], ["stop100-2u", "Stop100-2u"], ["stop100-2uz", "Stop100-2uz"],
  ["stop1000-2-3z", "Stop1000-2-3z"], ["stop1000-2-4", "Stop1000-2-4"], ["stop1000-2-4u", "Stop1000-2-4u"],
  ["stop1000-2", "Stop1000-2"], ["stop1000-2u", "Stop1000-2u"],
]);

/** Canonical legacy format name to the EC 3.2 format string it became. Order matters: several
 * legacy names map to one format, and the reverse lookup keeps the first, which is the spelling
 * native writes back. Legacy names with no EC 3.2 counterpart are absent - the generation that
 * replaced them dropped those formats. */
const legacyNameToFormat: ReadonlyArray<readonly [string, string]> = [
  ["DefaultReal", "Formats:DefaultReal"],
  ["Real", "Formats:DefaultReal"],
  ["DefaultInt", "Formats:DefaultReal"],
  ["DefaultRealU", "Formats:DefaultRealU"],
  ["RealU", "Formats:DefaultRealU"],
  ["Real6U", "Formats:DefaultRealU"],
  ["Real2", "Formats:DefaultReal(2)"],
  ["Real3", "Formats:DefaultReal(3)"],
  ["Real4", "Formats:DefaultReal(4)"],
  ["Real2U", "Formats:DefaultRealU(2)"],
  ["Real3U", "Formats:DefaultRealU(3)"],
  ["Real4U", "Formats:DefaultRealU(4)"],
  ["Stop100-2-2z", "Formats:StationZ_100_2"],
  ["Stop1000-2-3z", "Formats:StationZ_1000_3"],
  ["AngleDMS", "Formats:AngleDMS"],
  ["CAngleDMS", "Formats:AngleDMS"],
  ["AngleDMS8", "Formats:AngleDMS(8)"],
  ["CAngleDMS8", "Formats:AngleDMS(8)"],
  ["HMS", "Formats:HMS"],
  ["AmerFI8", "Formats:AmerFI"],
  ["AmerFI16", "Formats:AmerFI(16)"],
  ["AmerFI32", "Formats:AmerFI(32)"],
  ["DefaultFractional", "Formats:Fractional"],
  ["Fractional64", "Formats:Fractional"],
  ["Fractional4", "Formats:Fractional(4)"],
  ["Fractional8", "Formats:Fractional(8)"],
  ["Fractional16", "Formats:Fractional(16)"],
  ["Fractional32", "Formats:Fractional(32)"],
  ["Fractional128", "Formats:Fractional(128)"],
  ["Real2UNS", "Formats:DefaultRealUNS(2)"],
  ["Real3UNS", "Formats:DefaultRealUNS(3)"],
  ["Real4UNS", "Formats:DefaultRealUNS(4)"],
  ["Real6UNS", "Formats:DefaultRealUNS"],
  ["Meters4u", `Formats:DefaultRealUNS(4)[Units:M|m]`],
  ["Feet4u", `Formats:DefaultRealUNS(4)[Units:FT|']`],
  ["Inches4u", `Formats:DefaultRealUNS(4)[Units:IN|"]`],
  ["DecimalDeg4", `Formats:DefaultRealUNS(4)[Units:ARC_DEG|\u00b0]`],
  // The legacy name says 18; the precision it actually carries is 8.
  ["Inches18u", `Formats:DefaultRealUNS(8)[Units:IN|"]`],
];

/** The standard formats that define their own composite units, and the major unit each one leads
 * with. A FUS naming one of these carries a unit the format already supplies, so on the way in the
 * descriptor's unit is dropped, and on the way out the major unit is what gets written. */
const compositeFormatMajorUnits: ReadonlyMap<string, string> = new Map([
  ["AngleDMS", "Units:ARC_DEG"],
  ["AmerFI", "Units:FT"],
  ["AmerI", "Units:IN"],
  ["HMS", "Units:HR"],
]);

let formatByLegacyName: Map<string, string> | undefined;
let legacyNameByFormat: Map<string, string> | undefined;
let aliasByLegacyName: Map<string, string> | undefined;

function forward(): Map<string, string> {
  if (formatByLegacyName === undefined)
    formatByLegacyName = new Map(legacyNameToFormat.map(([legacy, format]) => [legacy.toLowerCase(), format]));
  return formatByLegacyName;
}

function reverse(): Map<string, string> {
  if (legacyNameByFormat === undefined) {
    legacyNameByFormat = new Map();
    for (const [legacy, format] of legacyNameToFormat) {
      const key = format.toLowerCase();
      if (!legacyNameByFormat.has(key))
        legacyNameByFormat.set(key, legacy);
    }
  }
  return legacyNameByFormat;
}

/** Canonical legacy name to the alias a FUS is written with - native writes `real4u`, not `Real4U`. */
function reverseAliases(): Map<string, string> {
  if (aliasByLegacyName === undefined) {
    aliasByLegacyName = new Map();
    for (const [alias, legacy] of aliasToLegacyName) {
      const key = legacy.toLowerCase();
      if (!aliasByLegacyName.has(key))
        aliasByLegacyName.set(key, alias);
    }
  }
  return aliasByLegacyName;
}

/** The item name a format string leads with, stripped of precision and overrides. */
function formatItemName(formatString: string): string {
  const separator = formatString.search(/[.:]/);
  return (separator < 0 ? formatString : formatString.substring(separator + 1)).split(/[([]/)[0];
}

/** Splits a FUS descriptor into its unit expression and optional format name.
 *
 * The unit expression may itself be parenthesized and may contain operators (`W/(M*K)(real4u)`,
 * `(SQ.M*KELVIN)/WATT(real4u)`), so a trailing parenthesized group counts as the format only when
 * its contents hold neither `*` nor `/` - native's rule, and the reason compound units survive.
 */
export function splitFusDescriptor(descriptor: string): { unit: string, format?: string } {
  const text = descriptor.trim();
  if (!text.endsWith(")"))
    return { unit: text };
  const open = text.lastIndexOf("(");
  if (open <= 0)
    return { unit: text };
  const candidate = text.substring(open + 1, text.length - 1);
  if (candidate.length === 0 || candidate.includes("*") || candidate.includes("/"))
    return { unit: text };
  return { unit: text.substring(0, open).trim(), format: candidate.trim() };
}

/** The EC 3.2 format string a legacy format name became, or `undefined` when the format has no
 * counterpart. Accepts both the FUS aliases (`real4u`) and the canonical names (`Real4U`). */
export function formatStringFromLegacyName(legacyName: string): string | undefined {
  const canonical = aliasToLegacyName.get(legacyName.toLowerCase()) ?? legacyName;
  return forward().get(canonical.toLowerCase());
}

/** Converts one FUS descriptor to the EC 3.2 format string a kind of quantity holds, or `undefined`
 * when either half has no counterpart.
 *
 * `defaultFormat` is what a descriptor with no format part gets - `DefaultReal` for a presentation
 * descriptor, and nothing for a persistence one, which carries only a unit.
 */
export function formatStringFromFus(descriptor: string, defaultFormat?: string): string | undefined {
  const { unit, format } = splitFusDescriptor(descriptor);
  const unitName = ecUnitNameFromFusName(unit);
  if (unitName === undefined)
    return undefined;
  const formatString = format === undefined ? defaultFormat : formatStringFromLegacyName(format);
  if (formatString === undefined)
    return undefined;
  // A composite format names its own units, and a mapping that already carries an override is not
  // widened either; everything else takes the descriptor's unit as its input override.
  if (compositeFormatMajorUnits.has(formatItemName(formatString)) || formatString.includes("["))
    return formatString;
  return `${formatString}[${unitName}]`;
}

/** The FUS descriptor an EC 3.2 presentation format string is written back as, or `undefined` when
 * it has no legacy counterpart.
 *
 * The unit is the format's major unit: its own override where there is one, so
 * `Formats:DefaultRealU(4)[Units:CM|centimeters]` writes as `CM(real4u)` and the label is lost; or
 * the unit a composite standard format leads with. A format with neither cannot be expressed as a
 * FUS at all and is rejected, which is what native does too. A format string with no counterpart is
 * tried again without its overrides, which recovers a precision the legacy generation did express.
 */
export function fusFromFormatString(formatString: string): string | undefined {
  const overrideStart = formatString.indexOf("[");
  const base = overrideStart < 0 ? formatString : formatString.substring(0, overrideStart);
  const legacyName = reverse().get(formatString.toLowerCase()) ?? reverse().get(base.toLowerCase());
  if (legacyName === undefined)
    return undefined;

  const unitName = overrideStart < 0
    ? compositeFormatMajorUnits.get(formatItemName(formatString))
    : formatString.substring(overrideStart + 1).split(/[|\]]/)[0];
  if (unitName === undefined)
    return undefined;
  const fusUnit = fusNameFromECUnitName(unitName);
  if (fusUnit === undefined)
    return undefined;
  return `${fusUnit}(${reverseAliases().get(legacyName.toLowerCase()) ?? legacyName})`;
}
