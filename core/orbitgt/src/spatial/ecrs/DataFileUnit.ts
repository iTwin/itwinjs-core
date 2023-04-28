/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
/** @packageDocumentation
 * @module OrbitGT
 */

//generated data file, do not edit
//package orbitgt.spatial.ecrs;

type int8 = number;
type int16 = number;
type int32 = number;
type float32 = number;
type float64 = number;
import { AList } from "../../system/collection/AList";

/** @internal */
export class DataFileUnit {
  private static DATA_LINES: AList<string> = null;
  private static addPart0(l: AList<string>): void {
    l.add(
      "UOM_CODE	UNIT_OF_MEAS_NAME	UNIT_OF_MEAS_TYPE	TARGET_UOM_CODE	FACTOR_B	FACTOR_C	ABBREVIATION"
    );
    l.add("1024	bin	scale	9201	1	1	bin");
    l.add("1025	millimetre	length	9001	1	1000	millimetre");
    l.add("1026	metre per second	length	1026	1	1	metre per second");
    l.add("1027	millimetres per year	length	1026	1	31556925445	mm/a");
    l.add("1028	parts per billion	scale	9201	1	1000000000	ppb");
    l.add("1029	year	time	1040	31556925.445	1	year");
    l.add("1030	parts per billion per year	scale	1036	1	3.1556925445E+16	ppb/a");
    l.add("1031	milliarc-second	angle	9101	3.14159265358979	648000000	msec");
    l.add(
      "1032	milliarc-seconds per year	angle	1035	3.14159265358979	2.044888768836E+16	msec/a"
    );
    l.add("1033	centimetre	length	9001	1	100	centimetre");
    l.add("1034	centimetres per year	length	1026	1	3155692544.5	cm/a");
    l.add("1035	radian per second	angle	1035	1	1	radian per second");
    l.add("1036	unity per second	scale	1036	1	1	unity per second");
    l.add("1040	second	time	1040	1	1	second");
    l.add("1041	parts per million per year	scale	1036	1	31556925445000	ppm/a");
    l.add("1042	metres per year	length	1026	1	31556925.445	m/a");
    l.add(
      "1043	arc-seconds per year	angle	1035	3.14159265358979	20448887688360	sec/a"
    );
    l.add("9001	metre	length	9001	1	1	metre");
    l.add("9002	foot	length	9001	0.3048	1	foot");
    l.add("9003	US survey foot	length	9001	12	39.37	ftUS");
    l.add("9005	Clarke's foot	length	9001	0.3047972654	1	ftCla");
    l.add("9014	fathom	length	9001	1.8288	1	f");
    l.add("9030	nautical mile	length	9001	1852	1	NM");
    l.add("9031	German legal metre	length	9001	1.0000135965	1	GLM");
    l.add("9033	US survey chain	length	9001	792	39.37	chUS");
    l.add("9034	US survey link	length	9001	7.92	39.37	lkUS");
    l.add("9035	US survey mile	length	9001	63360	39.37	miUS");
    l.add("9036	kilometre	length	9001	1000	1	kilometre");
    l.add("9037	Clarke's yard	length	9001	0.9143917962	1	ydCla");
    l.add("9038	Clarke's chain	length	9001	20.1166195164	1	chCla");
    l.add("9039	Clarke's link	length	9001	0.201166195164	1	lkCla");
    l.add("9040	British yard (Sears 1922)	length	9001	36	39.370147	ydSe");
    l.add("9041	British foot (Sears 1922)	length	9001	12	39.370147	ftSe");
    l.add("9042	British chain (Sears 1922)	length	9001	792	39.370147	chSe");
    l.add("9043	British link (Sears 1922)	length	9001	7.92	39.370147	lkSe");
    l.add("9050	British yard (Benoit 1895 A)	length	9001	0.9143992	1	ydBnA");
    l.add("9051	British foot (Benoit 1895 A)	length	9001	0.9143992	3	ftBnA");
    l.add("9052	British chain (Benoit 1895 A)	length	9001	20.1167824	1	chBnA");
    l.add("9053	British link (Benoit 1895 A)	length	9001	0.201167824	1	lkBnA");
    l.add("9060	British yard (Benoit 1895 B)	length	9001	36	39.370113	ydBnB");
    l.add("9061	British foot (Benoit 1895 B)	length	9001	12	39.370113	ftBnB");
    l.add("9062	British chain (Benoit 1895 B)	length	9001	792	39.370113	chBnB");
    l.add("9063	British link (Benoit 1895 B)	length	9001	7.92	39.370113	lkBnB");
    l.add("9070	British foot (1865)	length	9001	0.9144025	3	ftBr(65)");
    l.add("9080	Indian foot	length	9001	12	39.370142	ftInd");
    l.add("9081	Indian foot (1937)	length	9001	0.30479841	1	ftInd(37)");
    l.add("9082	Indian foot (1962)	length	9001	0.3047996	1	ftInd(62)");
    l.add("9083	Indian foot (1975)	length	9001	0.3047995	1	ftInd(75)");
    l.add("9084	Indian yard	length	9001	36	39.370142	ydInd");
    l.add("9085	Indian yard (1937)	length	9001	0.91439523	1	ydInd(37)");
    l.add("9086	Indian yard (1962)	length	9001	0.9143988	1	ydInd(62)");
    l.add("9087	Indian yard (1975)	length	9001	0.9143985	1	ydInd(75)");
    l.add("9093	Statute mile	length	9001	1609.344	1	Statute mile");
    l.add("9094	Gold Coast foot	length	9001	6378300	20926201	ftGC");
    l.add("9095	British foot (1936)	length	9001	0.3048007491	1	ftBr(36)");
    l.add("9096	yard	length	9001	0.9144	1	yard");
    l.add("9097	chain	length	9001	20.1168	1	ch");
    l.add("9098	link	length	9001	20.1168	100	lk");
    l.add("9099	British yard (Sears 1922 truncated)	length	9001	0.914398	1	ydSe(T)");
    l.add("9101	radian	angle	9101	1	1	radian");
    l.add("9102	degree	angle	9101	3.14159265358979	180	deg");
    l.add("9103	arc-minute	angle	9101	3.14159265358979	10800	min");
    l.add("9104	arc-second	angle	9101	3.14159265358979	648000	sec");
    l.add("9105	grad	angle	9101	3.14159265358979	200	gr");
    l.add("9109	microradian	angle	9101	1	1000000	\u00b5rad");
    l.add("9110	sexagesimal DMS	angle	9102			DDD.MMSSsss");
    l.add("9111	sexagesimal DM	angle	9102			DDD.MMm");
    l.add("9112	centesimal minute	angle	9101	3.14159265358979	20000	c");
    l.add("9113	centesimal second	angle	9101	3.14159265358979	2000000	cc");
    l.add("9114	mil_6400	angle	9101	3.14159265358979	3200	mil_6400");
    l.add(
      "9122	degree (supplier to define representation)	angle	9101	3.14159265358979	180	deg"
    );
    l.add("9201	unity	scale	9201	1	1	unity");
    l.add("9202	parts per million	scale	9201	1	1000000	parts per million");
    l.add("9203	coefficient	scale	9201	1	1	coefficient");
    l.add("9300	British foot (Sears 1922 truncated)	length	9001	0.914398	3	ftSe(T)");
    l.add(
      "9301	British chain (Sears 1922 truncated)	length	9001	20.116756	1	chSe(T)"
    );
    l.add(
      "9302	British link (Sears 1922 truncated)	length	9001	20.116756	100	lkSe(T)"
    );
  }
  public static getDataLines(): AList<string> {
    if (DataFileUnit.DATA_LINES == null) {
      let lines: AList<string> = new AList<string>(78);
      DataFileUnit.addPart0(lines);
      DataFileUnit.DATA_LINES = lines;
    }
    return DataFileUnit.DATA_LINES;
  }
}
