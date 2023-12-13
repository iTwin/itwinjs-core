/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/

/* eslint-disable @typescript-eslint/naming-convention */
export class PhillyLandmarksDataset {

  // This is the output of a 'Query' request for a point over the philly airport, result is in PDF (64-based encoded arrayBuffer)
  public static phillyAirportGetFeatureInfoQueryPbf = "encoding=base64;Er4GCrsGCgNGSUQSBwoDRklEEAEaCEdsb2JhbElEMggI7dQlEM/PKjgDQgcI1J0GEJEeYigSEgkAqHBF+BsjQBEAqHBF+BsjQBoSCRSuKRKK91/BEY3CM4VRflJBagwKA0ZJRBAGGgNGSURqFAoIT0JKRUNUSUQaCE9CSkVDVElEag4KBE5BTUUQBBoETkFNRWoUCgdBRERSRVNTEAQaB0FERFJFU1NqGAoJRkVBVF9UWVBFEAQaCUZFQVRfVFlQRWoWCghTVUJfVFlQRRAEGghTVUJfVFlQRWoaCgpWQU5JVFlfTkFNEAQaClZBTklUWV9OQU1qGgoKU0VDT05EQVJZXxAEGgpTRUNPTkRBUllfag4KBEJMREcQBBoEQkxER2oaCgpQQVJFTlRfTkFNEAQaClBBUkVOVF9OQU1qGgoKUEFSRU5UX1RZUBAEGgpQQVJFTlRfVFlQahQKB0FDUkVBR0UQAxoHQUNSRUFHRWoaCgpQQVJFTlRfQUNSEAMaClBBUkVOVF9BQ1JqGgoKU2hhcGVfX0FyZRADGgpTaGFwZV9fQXJlahoKClNoYXBlX19MZW4QAxoKU2hhcGVfX0xlbmocCgtTaGFwZV9fQXJlYRADGgtTaGFwZV9fQXJlYWogCg1TaGFwZV9fTGVuZ3RoEAMaDVNoYXBlX19MZW5ndGhqKwoIR2xvYmFsSUQQCxoIR2xvYmFsSUQyE05FV0lEKCkgV0lUSCBWQUxVRVN6jgIKAyjfOAoDILxxCiQKIlBoaWxhZGVscGhpYSBJbnRlcm5hdGlvbmFsIEFpcnBvcnQKFAoSODUwMCBFU1NJTkdUT04gQVZFChAKDkFpcnBvcnQgR3JvdW5kCgMKASAKAwoBIAoDCgEgCgMKAU4KJAoiUGhpbGFkZWxwaGlhIEludGVybmF0aW9uYWwgQWlycG9ydAoQCg5BaXJwb3J0IEdyb3VuZAoJGeDvet1otKBACgkZD3T+N0wMokAKCRn9T3m5zTSWQQoJGdwnoJEWcABBCgkZAAAACZsNbEEKCRks5ZMvzB/qQAomCiQ5ZmZjODk1Yi02NGQxLTRiNDItOTU3Ny1jMTZjNjU0ZDk0Yzc=";
  public static phillyAirportGetFeatureInfoQueryJson = `{"objectIdFieldName":"FID","uniqueIdField":{"name":"FID","isSystemMaintained":true},"globalIdFieldName":"GlobalID","geometryProperties":{"shapeAreaFieldName":"Shape__Area","shapeLengthFieldName":"Shape__Length","units":"esriMeters"},"serverGens":{"minServerGen":617069,"serverGen":698323},"geometryType":"esriGeometryPolygon","spatialReference":{"wkid":102100,"latestWkid":3857},"transform":{"originPosition":"upperLeft","scale":[4.7773142671503592,4.7773142671503592],"translate":[-8377498.2988891602,4847942.0812841775]},"fields":[{"name":"FID","type":"esriFieldTypeOID","alias":"FID","sqlType":"sqlTypeInteger","domain":null,"defaultValue":null},{"name":"OBJECTID","type":"esriFieldTypeSmallInteger","alias":"OBJECTID","sqlType":"sqlTypeSmallInt","domain":null,"defaultValue":null},{"name":"NAME","type":"esriFieldTypeString","alias":"NAME","sqlType":"sqlTypeNVarchar","length":110,"domain":null,"defaultValue":null},{"name":"ADDRESS","type":"esriFieldTypeString","alias":"ADDRESS","sqlType":"sqlTypeNVarchar","length":25,"domain":null,"defaultValue":null},{"name":"FEAT_TYPE","type":"esriFieldTypeString","alias":"FEAT_TYPE","sqlType":"sqlTypeNVarchar","length":25,"domain":null,"defaultValue":null},{"name":"SUB_TYPE","type":"esriFieldTypeString","alias":"SUB_TYPE","sqlType":"sqlTypeNVarchar","length":31,"domain":null,"defaultValue":null},{"name":"VANITY_NAM","type":"esriFieldTypeString","alias":"VANITY_NAM","sqlType":"sqlTypeNVarchar","length":47,"domain":null,"defaultValue":null},{"name":"SECONDARY_","type":"esriFieldTypeString","alias":"SECONDARY_","sqlType":"sqlTypeNVarchar","length":67,"domain":null,"defaultValue":null},{"name":"BLDG","type":"esriFieldTypeString","alias":"BLDG","sqlType":"sqlTypeNVarchar","length":1,"domain":null,"defaultValue":null},{"name":"PARENT_NAM","type":"esriFieldTypeString","alias":"PARENT_NAM","sqlType":"sqlTypeNVarchar","length":63,"domain":null,"defaultValue":null},{"name":"PARENT_TYP","type":"esriFieldTypeString","alias":"PARENT_TYP","sqlType":"sqlTypeNVarchar","length":25,"domain":null,"defaultValue":null},{"name":"ACREAGE","type":"esriFieldTypeDouble","alias":"ACREAGE","sqlType":"sqlTypeFloat","domain":null,"defaultValue":null},{"name":"PARENT_ACR","type":"esriFieldTypeDouble","alias":"PARENT_ACR","sqlType":"sqlTypeFloat","domain":null,"defaultValue":null},{"name":"Shape__Are","type":"esriFieldTypeDouble","alias":"Shape__Are","sqlType":"sqlTypeFloat","domain":null,"defaultValue":null},{"name":"Shape__Len","type":"esriFieldTypeDouble","alias":"Shape__Len","sqlType":"sqlTypeFloat","domain":null,"defaultValue":null},{"name":"Shape__Area","type":"esriFieldTypeDouble","alias":"Shape__Area","sqlType":"sqlTypeFloat","domain":null,"defaultValue":null},{"name":"Shape__Length","type":"esriFieldTypeDouble","alias":"Shape__Length","sqlType":"sqlTypeFloat","domain":null,"defaultValue":null},{"name":"GlobalID","type":"esriFieldTypeGlobalID","alias":"GlobalID","sqlType":"sqlTypeOther","length":38,"domain":null}],"features":[{"attributes":{"FID":7263,"OBJECTID":7262,"NAME":"Philadelphia International Airport","ADDRESS":"8500 ESSINGTON AVE","FEAT_TYPE":"Airport Ground","SUB_TYPE":" ","VANITY_NAM":" ","SECONDARY_":" ","BLDG":"N","PARENT_NAM":"Philadelphia International Airport","PARENT_TYP":"Airport Ground","ACREAGE":2138.20481476,"PARENT_ACR":2310.1488647,"Shape__Are":93139822.3684692,"Shape__Len":134658.821106254,"Shape__Area":14707928.28125,"Shape__Length":53502.3808078266,"GlobalID":"9ffc895b-64d1-4b42-9577-c16c654d94c7"}}]}`;

  public static phillyTransportationGetFeatureInfoQueryEncodedPbf = "encoding=base64;EqQ1CqE1CghPQkpFQ1RJRBIMCghPQkpFQ1RJRBABGghHbG9iYWxJRDIICODUJRCFhCtCBwjUnQYQkR5iKBISCQCAcEX4GwNAEQCAcEX4GwNAGhIJmpn1FzXpX8ER9ihfAEOKUkFqFgoIT0JKRUNUSUQQBhoIT0JKRUNUSURqSQofR0lTREFUQVBST0pFQ1RfTE9DQVRJT05fREVUQUlMXxABGiRHSVNEQVRBUFJPSkVDVF9MT0NBVElPTl9ERVRBSUxfUFRGSURqGgoKUFJPSkVDVF9JRBABGgpQUk9KRUNUX0lEaiAKDVBST0pFQ1RfVElUTEUQBBoNUFJPSkVDVF9USVRMRWoiCg5QUk9KRUNUX1NUQVRVUxAEGg5QUk9KRUNUX1NUQVRVU2ogCg1QUk9KRUNUX0NMQVNTEAQaDVBST0pFQ1RfQ0xBU1NqKgoSUFJPSkVDVF9DTEFTU19OQU1FEAQaElBST0pFQ1RfQ0xBU1NfTkFNRWo2ChhQUk9KRUNUX0lNUFJPVkVNRU5UX0RFU0MQBBoYUFJPSkVDVF9JTVBST1ZFTUVOVF9ERVNDajQKF1BST0pFQ1RfU0hPUlRfTkFSUkFUSVZFEAQaF1BST0pFQ1RfU0hPUlRfTkFSUkFUSVZFaiYKEElNUFJPVkVNRU5UX1RZUEUQBBoQSU1QUk9WRU1FTlRfVFlQRWokChBJTVBST1ZFTUVOVF9DT0RFGhBJTVBST1ZFTUVOVF9DT0RFajIKFklNUFJPVkVNRU5UX1NIT1JUX0RFU0MQBBoWSU1QUk9WRU1FTlRfU0hPUlRfREVTQ2okCg9UWVBfRlJTVF9BUFJfRFQQBRoPVFlQX0ZSU1RfQVBSX0RUaioKEk1BSk9SX1BST0pFQ1RfRkxBRxAEGhJNQUpPUl9QUk9KRUNUX0ZMQUdqIgoOVFJBTlNQT1JUX01PREUQBBoOVFJBTlNQT1JUX01PREVqPAobUExBTk5JTkdfUEFSVE5FUl9TSE9SVF9OQU1FEAQaG1BMQU5OSU5HX1BBUlRORVJfU0hPUlRfTkFNRWoyChdSRVNQT05TSUJMRV9ESVNUUklDVF9OTxoXUkVTUE9OU0lCTEVfRElTVFJJQ1RfTk9qJAoQUFJJTUFSWV9TVF9SVF9OTxoQUFJJTUFSWV9TVF9SVF9OT2osChNESVNUUklDVF9TRUNUSU9OX0lEEAQaE0RJU1RSSUNUX1NFQ1RJT05fSURqNgoZUFJJTUFSWV9MT0NBTF9ST0FEX05VTUJFUhoZUFJJTUFSWV9MT0NBTF9ST0FEX05VTUJFUmouChRQUk9KRUNUX1RPVEFMX0xFTkdUSBACGhRQUk9KRUNUX1RPVEFMX0xFTkdUSGoqChJMT0NBTF9QUk9KRUNUX0ZMQUcQBBoSTE9DQUxfUFJPSkVDVF9GTEFHajIKFkxFVF9SRVNQT05TSUJMRV9BR0VOQ1kQBBoWTEVUX1JFU1BPTlNJQkxFX0FHRU5DWWoyChZHRU9HUkFQSElDX0RFU0NSSVBUSU9OEAQaFkdFT0dSQVBISUNfREVTQ1JJUFRJT05qKgoSUFJPSkVDVF9TVEFURV9DT0RFEAQaElBST0pFQ1RfU1RBVEVfQ09ERWo2ChhQUk9KRUNUX1NUQVRVU19DT0RFX0RFU0MQBBoYUFJPSkVDVF9TVEFUVVNfQ09ERV9ERVNDahIKB0NPREVfSUQaB0NPREVfSURqQAodUE9URU5USUFMX0NPTU1JVFRFRF9EQVRFX0ZMQUcQBBodUE9URU5USUFMX0NPTU1JVFRFRF9EQVRFX0ZMQUdqNgoYUE9URU5USUFMX0NPTU1JVFRFRF9ZRUFSEAQaGFBPVEVOVElBTF9DT01NSVRURURfWUVBUmo2ChhQT1RFTlRJQUxfQ09NTUlUVEVEX0RBVEUQBBoYUE9URU5USUFMX0NPTU1JVFRFRF9EQVRFaj4KHEVTVF9DT05TVFJfUEhBU0VfQ09TVF9BTU9VTlQQAhocRVNUX0NPTlNUUl9QSEFTRV9DT1NUX0FNT1VOVGoWCghUWVBfRkxBRxAEGghUWVBfRkxBR2oWCghUSVBfRkxBRxAEGghUSVBfRkxBR2oYCglTVElQX0ZMQUcQBBoJU1RJUF9GTEFHajgKGURFQ0FERV9PRl9JTlZFU1RNRU5UX0ZMQUcQBBoZREVDQURFX09GX0lOVkVTVE1FTlRfRkxBR2ooChFUSVBfUFJPUE9TRURfRkxBRxAEGhFUSVBfUFJPUE9TRURfRkxBR2ooChFUWVBfUFJPUE9TRURfRkxBRxAEGhFUWVBfUFJPUE9TRURfRkxBR2ouChRPQkxJR0FUSU9OX1BMQU5fRkxBRxAEGhRPQkxJR0FUSU9OX1BMQU5fRkxBR2oWCghMRVRfRkxBRxAEGghMRVRfRkxBR2oWCghMRVRfREFURRAEGghMRVRfREFURWomChBMRVRfREFURV9ESVNQTEFZEAQaEExFVF9EQVRFX0RJU1BMQVlqGAoJT1BFTl9GTEFHEAQaCU9QRU5fRkxBR2oYCglPUEVOX0RBVEUQBBoJT1BFTl9EQVRFahYKCE5UUF9GTEFHEAQaCE5UUF9GTEFHahYKCE5UUF9EQVRFEAEaCE5UUF9EQVRFaiQKD0NPTVBMRVRJT05fRkxBRxAEGg9DT01QTEVUSU9OX0ZMQUdqJAoPQ09NUExFVElPTl9EQVRFEAQaD0NPTVBMRVRJT05fREFURWoiCg5GSVNDQUxMWV9SRUFEWRAEGg5GSVNDQUxMWV9SRUFEWWocCgtGSVNDQUxfREFURRAEGgtGSVNDQUxfREFURWomChBQSFlTSUNBTExZX1JFQURZEAQaEFBIWVNJQ0FMTFlfUkVBRFlqIAoNUEhZU0lDQUxfREFURRAEGg1QSFlTSUNBTF9EQVRFaj4KHFBST0pFQ1RfTUFOQUdFUl9DT05UQUNUX05BTUUQBBocUFJPSkVDVF9NQU5BR0VSX0NPTlRBQ1RfTkFNRWowChVQUk9KRUNUX01BTkFHRVJfUEhPTkUQBBoVUFJPSkVDVF9NQU5BR0VSX1BIT05FajAKFVBST0pFQ1RfTUFOQUdFUl9FTUFJTBAEGhVQUk9KRUNUX01BTkFHRVJfRU1BSUxqKgoSVU5ERVJfQ09OU1RSVUNUSU9OEAQaElVOREVSX0NPTlNUUlVDVElPTmoYCglDT01QTEVURUQQBBoJQ09NUExFVEVEaioKEkZVVFVSRV9ERVZFTE9QTUVOVBAEGhJGVVRVUkVfREVWRUxPUE1FTlRqIgoOSU5fREVWRUxPUE1FTlQQBBoOSU5fREVWRUxPUE1FTlRqIAoNUFJPSkVDVF9TVEFHRRAEGg1QUk9KRUNUX1NUQUdFajAKFVBST0pFQ1RfQ1JFQVRJT05fREFURRAFGhVQUk9KRUNUX0NSRUFUSU9OX0RBVEVqLAoTQ0FQSVRBTF9CVURHRVRfWUVBUhAEGhNDQVBJVEFMX0JVREdFVF9ZRUFSaj4KHENBUFRJQUxfQlVER0VUX1JFUVVJUkVEX0ZMQUcQBBocQ0FQVElBTF9CVURHRVRfUkVRVUlSRURfRkxBR2o+ChxDQVBJVEFMX0JVREdFVF9BUFBST1ZFRF9GTEFHEAQaHENBUElUQUxfQlVER0VUX0FQUFJPVkVEX0ZMQUdqMAoVUExBTk5JTkdfUEFSVE5FUl9OQU1FEAQaFVBMQU5OSU5HX1BBUlRORVJfTkFNRWo4ChlSRVNQT05TSUJMRV9ESVNUUklDVF9OQU1FEAQaGVJFU1BPTlNJQkxFX0RJU1RSSUNUX05BTUVqMgoXUkVTUE9OU0lCTEVfQ09VTlRZX0NPREUaF1JFU1BPTlNJQkxFX0NPVU5UWV9DT0RFajQKF1JFU1BPTlNJQkxFX0NPVU5UWV9OQU1FEAQaF1JFU1BPTlNJQkxFX0NPVU5UWV9OQU1Fai4KFFBST0pFQ1RfU1BPTlNPUl9OQU1FEAQaFFBST0pFQ1RfU1BPTlNPUl9OQU1FaiwKE1NEX0JSSURHRV9XT1JLX0ZMQUcQBBoTU0RfQlJJREdFX1dPUktfRkxBR2ouChRPUEVOX1RPX1RSQUZGSUNfREFURRAEGhRPUEVOX1RPX1RSQUZGSUNfREFURWo2ChhPUklHSU5BTF9DT05UUkFDVF9BTU9VTlQQBBoYT1JJR0lOQUxfQ09OVFJBQ1RfQU1PVU5UajQKF0NVUlJFTlRfQ09OVFJBQ1RfQU1PVU5UEAQaF0NVUlJFTlRfQ09OVFJBQ1RfQU1PVU5UaioKEkVTVElNQVRFRF9MRVRfREFURRAEGhJFU1RJTUFURURfTEVUX0RBVEVqFgoIRE9JX0RBVEUQBBoIRE9JX0RBVEVqEgoGRE9JX0lEEAQaBkRPSV9JRGoqChJQUklNQVJZX1BST0pFQ1RfSUQQARoSUFJJTUFSWV9QUk9KRUNUX0lEajQKF1BSSU1BUllfQ09OVFJBQ1RfQU1PVU5UEAQaF1BSSU1BUllfQ09OVFJBQ1RfQU1PVU5Uai4KFFBSSU1BUllfUFJPSkVDVF9GTEFHEAQaFFBSSU1BUllfUFJPSkVDVF9GTEFHajIKFkhBU19DT05TVFJVQ1RJT05fUEhBU0UQBBoWSEFTX0NPTlNUUlVDVElPTl9QSEFTRWoyChZIQVNfRklOQUxfREVTSUdOX1BIQVNFEAQaFkhBU19GSU5BTF9ERVNJR05fUEhBU0VqQgoeSEFTX1BSRUxJTUlOQVJZX0VOR0lORUVSX1BIQVNFEAQaHkhBU19QUkVMSU1JTkFSWV9FTkdJTkVFUl9QSEFTRWpACh1IQVNfUExBTl9SRVNFQVJDSF9BRE1JTl9QSEFTRRAEGh1IQVNfUExBTl9SRVNFQVJDSF9BRE1JTl9QSEFTRWoyChZIQVNfUklHSFRfT0ZfV0FZX1BIQVNFEAQaFkhBU19SSUdIVF9PRl9XQVlfUEhBU0VqJAoPSEFTX1NUVURZX1BIQVNFEAQaD0hBU19TVFVEWV9QSEFTRWooChFIQVNfVVRJTElUWV9QSEFTRRAEGhFIQVNfVVRJTElUWV9QSEFTRWoUCghDVFlfQ09ERRoIQ1RZX0NPREVqFAoIU1RfUlRfTk8aCFNUX1JUX05Pag4KBUpVUklTGgVKVVJJU2oaCgtESVNUUklDVF9OTxoLRElTVFJJQ1RfTk9qEgoHU0VHX0JHThoHU0VHX0JHTmoYCgpPRkZTRVRfQkdOGgpPRkZTRVRfQkdOahIKB1NFR19FTkQaB1NFR19FTkRqGAoKT0ZGU0VUX0VORBoKT0ZGU0VUX0VORGoaCgpTRUdfUFRfQkdOEAEaClNFR19QVF9CR05qGgoKU0VHX1BUX0VORBABGgpTRUdfUFRfRU5EaiIKDlNFR19MTkdUSF9GRUVUEAEaDlNFR19MTkdUSF9GRUVUahIKBk5MRl9JRBABGgZOTEZfSURqFAoIU0lERV9JTkQaCFNJREVfSU5Eah4KDE5MRl9DTlRMX0JHThABGgxOTEZfQ05UTF9CR05qHgoMTkxGX0NOVExfRU5EEAEaDE5MRl9DTlRMX0VORGoiCg5DVU1fT0ZGU0VUX0JHThABGg5DVU1fT0ZGU0VUX0JHTmoiCg5DVU1fT0ZGU0VUX0VORBABGg5DVU1fT0ZGU0VUX0VORGo4ChlDT1VOVFlfTVVOSUNJUEFMSVRZX0NPREVTEAQaGUNPVU5UWV9NVU5JQ0lQQUxJVFlfQ09ERVNqKgoSTVVOSUNJUEFMSVRZX0NPREVTEAQaEk1VTklDSVBBTElUWV9DT0RFU2oqChJNVU5JQ0lQQUxJVFlfTkFNRVMQBBoSTVVOSUNJUEFMSVRZX05BTUVTaiQKD0hPVVNFX0RJU1RSSUNUUxAEGg9IT1VTRV9ESVNUUklDVFNqJgoQU0VOQVRFX0RJU1RSSUNUUxAEGhBTRU5BVEVfRElTVFJJQ1RTaioKEkNPTkdSRVNTX0RJU1RSSUNUUxAEGhJDT05HUkVTU19ESVNUUklDVFNqMgoWSE9VU0VfTEVHSVNMQVRPUl9OQU1FUxAEGhZIT1VTRV9MRUdJU0xBVE9SX05BTUVTajQKF1NFTkFURV9MRUdJU0xBVE9SX05BTUVTEAQaF1NFTkFURV9MRUdJU0xBVE9SX05BTUVTajgKGUNPTkdSRVNTX0xFR0lTTEFUT1JfTkFNRVMQBBoZQ09OR1JFU1NfTEVHSVNMQVRPUl9OQU1FU2ocCgtDT1VOVFlfTkFNRRAEGgtDT1VOVFlfTkFNRWocCgtTVFJFRVRfTkFNRRAEGgtTVFJFRVRfTkFNRWomChBCUklER0VfV09SS19GTEFHEAQaEEJSSURHRV9XT1JLX0ZMQUdqIAoNUkVDT1JEX1VQREFURRABGg1SRUNPUkRfVVBEQVRFah4KDENSRUFURURfREFURRAFGgxDUkVBVEVEX0RBVEVqJgoQTEFTVF9FRElURURfREFURRAFGhBMQVNUX0VESVRFRF9EQVRFaiIKDkdFT01fTEVOR1RIX0ZUEAEaDkdFT01fTEVOR1RIX0ZUaiAKDUdFT01FVFJZX1RZUEUQBBoNR0VPTUVUUllfVFlQRWo4ChlCUklER0VfV09SS19MT0NBVElPTl9GTEFHEAQaGUJSSURHRV9XT1JLX0xPQ0FUSU9OX0ZMQUdqJgoQUFVCTElDX05BUlJBVElWRRAEGhBQVUJMSUNfTkFSUkFUSVZFaiQKD0dJU19VUERBVEVfREFURRAFGg9HSVNfVVBEQVRFX0RBVEVqNgoYR0lTX0dFT01FVFJZX1VQREFURV9EQVRFEAUaGEdJU19HRU9NRVRSWV9VUERBVEVfREFURWomChBTRV9BTk5PX0NBRF9EQVRBEAQaEFNFX0FOTk9fQ0FEX0RBVEFqDgoER1BJRBABGgRHUElEaisKCEdsb2JhbElEEAsaCEdsb2JhbElEMhNORVdJRCgpIFdJVEggVkFMVUVTeukLCgMoqAoKBiDsi8mhBwoEINjCDAobChlIaWdoIEZyaWN0aW9uIFN1cmZhY2VzKEYpCgYKBENBTkQKBgoEU0FGRQoUChJTYWZldHkgSW1wcm92ZW1lbnQKgAEKfkluc3RhbGxpbmcgaGlnaCBmcmljdGlvbiBzdXJmYWNlcyBvbiB0b3Agb2YgZXhpc3Rpbmcgcm9hZHdheSB0byBkZWNyZWFzZSB0aGUgbnVtYmVyIG9mIGNyYXNoZXMgYWxvbmcgaGlnaCBjcmFzaCByb2Fkd2F5IGN1cnZlcwpuCmxIaWdoIEZyaWN0aW9uIFN1cmZhY2VzICBWYXJpb3VzIGhpZ2gtY3Jhc2ggcm9hZHdheSBjdXJ2ZXMgaW4gRDYtMCAgVHJlYXRtbnQgdG8gcmVkdWNlIGNyYXNoZXMgb24gcmR3eSBjdXJ2ZXMKEwoRU3VyZmFjZSBUcmVhdG1lbnQKAiBKChMKEVN1cmZhY2UgVHJlYXRtZW50CgdAgNCHrr5RCgMKAU4KAwoBSAoHCgVEVlJQQwoCIAwKAyCyLwoFCgNIRlMKAiAACgUV16PYQAoDCgFOCgAKMwoxVmFyaW91cyBoaWdoLWNyYXNoIHJvYWR3YXkgY3VydmVzIGluIERpc3RyaWN0IDYtMAoGCgRDQU5ECgsKCUNhbmRpZGF0ZQoCIFYKAAoAChcKFTYvMTIvMjAxNCAxMjowMDowMCBBTQoFFSA7FUoKAwoBTgoDCgFOCgMKAU4KAwoBTgoDCgFOCgMKAU4KAwoBWQoDCgFBCgoKCDIwMTQwNzAzChYKFDcvMy8yMDE0IDEyOjAwOjAwIEFNCgAKAAoDCgFBCgUgpMyaEwoDCgFBCgoKCDIwMTUxMDA3CgAKAAoACgAKHQobR2VvcmdlIER1bmhlaW1lciBBREUgQ09OU1RSCgwKCjYxMDIwNTY2ODAKEwoRZ2R1bmhlaW1lckBwYS5nb3YKAwoBTgoDCgFZCgMKAU4KAwoBTgoLCglDT01QTEVURUQKB0CA4I+irlEKAAoDCgFZCgMKAU4KTQpLRGVsYXdhcmUgVmFsbGV5IFJlZ2lvbmFsIFBsYW5uaW5nIENvbW1pc3Npb24gTVBPICAgICAgICAgICAgICAgICAgICAgICAgICAgCiAKHkRpc3RyaWN0IDYtMCAgICAgICAgICAgICAgICAgIAoCIB4KEAoOQ2hlc3RlciAgICAgICAKCQoHUGVubkRPVAoDCgFOCgAKAAoAChYKFDcvMy8yMDE0IDEyOjAwOjAwIEFNCgAKAAoEINjCDAoACgMKAVkKAwoBVAoDCgFGCgMKAUYKAwoBRgoDCgFGCgMKAUYKAwoBRgoDIIYBCgMgkn0KAiACCgIgDAoDIPQDCgIgAAoDIPQDCgMglC0KBSDAlrECCgUg1MOxAgoDIJQtCgQg9uIECgIgAgoCIAAKAyCULQoDIPxmCgQgkJQBCgcKBTY3MzAxCgUKAzMwMQoPCg1QSElMQURFTFBISUEgCgUKAzE3NQoDCgExChYKFDIvMy8yMDIyIDEyOjAwOjAwIEFNChoKGE1hcnlsb3Vpc2UgSXNhYWNzb24sIChEKQoSChBOaWtpbCBTYXZhbCwgKEQpCigKJkJyZW5kYW4gRi4gQm95bGUgKEQpLCBEd2lnaHQgRXZhbnMgKEQpCg4KDFBISUxBREVMUEhJQQoACgMKAU4KBSDCjaMTCgdA8Nb9/dVaCgdAkPzT8LZeCgMgwE0KBwoFUE9JTlQKAwoBTgpuCmxIaWdoIEZyaWN0aW9uIFN1cmZhY2VzDQpWYXJpb3VzIGhpZ2gtY3Jhc2ggcm9hZHdheSBjdXJ2ZXMgaW4gRDYtMA0KVHJlYXRtbnQgdG8gcmVkdWNlIGNyYXNoZXMgb24gcmR3eSBjdXJ2ZXMKB0CQiOrHqF0KB0CQvKWDnl8KAAoGIOyLyaEHCiYKJDg4YzlhMDA2LTRhZjQtNDdlYi1iZWE2LTU1M2E2MTMwNmNlZQ==";

  public static phillyTansportationGetFeatureInfoResultRef = [
    {
      layerName: "dummyFeatureLayer",
      subLayerInfos: [
        {
          subLayerName: "SampleLayer",
          displayFieldName: "SampleLayer",
          features: [
            {
              attributes: [
                {
                  value: {
                    valueFormat: 0,
                    value: 1320,
                    displayValue: "1320",
                  },
                  property: {
                    name: "OBJECTID",
                    displayLabel: "OBJECTID",
                    typename: "integer",
                  },
                },
                {
                  value: {
                    valueFormat: 0,
                    value: 974725878,
                    displayValue: "974725878",
                  },
                  property: {
                    name: "GISDATAPROJECT_LOCATION_DETAIL_",
                    displayLabel: "GISDATAPROJECT_LOCATION_DETAIL_",
                    typename: "integer",
                  },
                },
                {
                  value: {
                    valueFormat: 0,
                    value: 102572,
                    displayValue: "102572",
                  },
                  property: {
                    name: "PROJECT_ID",
                    displayLabel: "PROJECT_ID",
                    typename: "integer",
                  },
                },
                {
                  value: {
                    valueFormat: 0,
                    value: "High Friction Surfaces(F)",
                    displayValue: "High Friction Surfaces(F)",
                  },
                  property: {
                    name: "PROJECT_TITLE",
                    displayLabel: "PROJECT_TITLE",
                    typename: "string",
                  },
                },
                {
                  value: {
                    valueFormat: 0,
                    value: "CAND",
                    displayValue: "CAND",
                  },
                  property: {
                    name: "PROJECT_STATUS",
                    displayLabel: "PROJECT_STATUS",
                    typename: "string",
                  },
                },
                {
                  value: {
                    valueFormat: 0,
                    value: "SAFE",
                    displayValue: "SAFE",
                  },
                  property: {
                    name: "PROJECT_CLASS",
                    displayLabel: "PROJECT_CLASS",
                    typename: "string",
                  },
                },
                {
                  value: {
                    valueFormat: 0,
                    value: "Safety Improvement",
                    displayValue: "Safety Improvement",
                  },
                  property: {
                    name: "PROJECT_CLASS_NAME",
                    displayLabel: "PROJECT_CLASS_NAME",
                    typename: "string",
                  },
                },
                {
                  value: {
                    valueFormat: 0,
                    value: "Installing high friction surfaces on top of existing roadway to decrease the number of crashes along high crash roadway curves",
                    displayValue: "Installing high friction surfaces on top of existing roadway to decrease the number of crashes along high crash roadway curves",
                  },
                  property: {
                    name: "PROJECT_IMPROVEMENT_DESC",
                    displayLabel: "PROJECT_IMPROVEMENT_DESC",
                    typename: "string",
                  },
                },
                {
                  value: {
                    valueFormat: 0,
                    value: "High Friction Surfaces  Various high-crash roadway curves in D6-0  Treatmnt to reduce crashes on rdwy curves",
                    displayValue: "High Friction Surfaces  Various high-crash roadway curves in D6-0  Treatmnt to reduce crashes on rdwy curves",
                  },
                  property: {
                    name: "PROJECT_SHORT_NARRATIVE",
                    displayLabel: "PROJECT_SHORT_NARRATIVE",
                    typename: "string",
                  },
                },
                {
                  value: {
                    valueFormat: 0,
                    value: "Surface Treatment",
                    displayValue: "Surface Treatment",
                  },
                  property: {
                    name: "IMPROVEMENT_TYPE",
                    displayLabel: "IMPROVEMENT_TYPE",
                    typename: "string",
                  },
                },
                {
                  value: {
                    valueFormat: 0,
                    value: 37,
                    displayValue: "37",
                  },
                  property: {
                    name: "IMPROVEMENT_CODE",
                    displayLabel: "IMPROVEMENT_CODE",
                    typename: "integer",
                  },
                },
                {
                  value: {
                    valueFormat: 0,
                    value: "Surface Treatment",
                    displayValue: "Surface Treatment",
                  },
                  property: {
                    name: "IMPROVEMENT_SHORT_DESC",
                    displayLabel: "IMPROVEMENT_SHORT_DESC",
                    typename: "string",
                  },
                },
                {
                  value: {
                    valueFormat: 0,
                    value: new Date("2014-05-13T00:00:00.000Z"),
                    displayValue: "2014-05-13T00:00:00.000Z",
                  },
                  property: {
                    name: "TYP_FRST_APR_DT",
                    displayLabel: "TYP_FRST_APR_DT",
                    typename: "dateTime",
                  },
                },
                {
                  value: {
                    valueFormat: 0,
                    value: "N",
                    displayValue: "N",
                  },
                  property: {
                    name: "MAJOR_PROJECT_FLAG",
                    displayLabel: "MAJOR_PROJECT_FLAG",
                    typename: "string",
                  },
                },
                {
                  value: {
                    valueFormat: 0,
                    value: "H",
                    displayValue: "H",
                  },
                  property: {
                    name: "TRANSPORT_MODE",
                    displayLabel: "TRANSPORT_MODE",
                    typename: "string",
                  },
                },
                {
                  value: {
                    valueFormat: 0,
                    value: "DVRPC",
                    displayValue: "DVRPC",
                  },
                  property: {
                    name: "PLANNING_PARTNER_SHORT_NAME",
                    displayLabel: "PLANNING_PARTNER_SHORT_NAME",
                    typename: "string",
                  },
                },
                {
                  value: {
                    valueFormat: 0,
                    value: 6,
                    displayValue: "6",
                  },
                  property: {
                    name: "RESPONSIBLE_DISTRICT_NO",
                    displayLabel: "RESPONSIBLE_DISTRICT_NO",
                    typename: "integer",
                  },
                },
                {
                  value: {
                    valueFormat: 0,
                    value: 3033,
                    displayValue: "3033",
                  },
                  property: {
                    name: "PRIMARY_ST_RT_NO",
                    displayLabel: "PRIMARY_ST_RT_NO",
                    typename: "integer",
                  },
                },
                {
                  value: {
                    valueFormat: 0,
                    value: "HFS",
                    displayValue: "HFS",
                  },
                  property: {
                    name: "DISTRICT_SECTION_ID",
                    displayLabel: "DISTRICT_SECTION_ID",
                    typename: "string",
                  },
                },
                {
                  value: {
                    valueFormat: 0,
                    value: 0,
                    displayValue: "0",
                  },
                  property: {
                    name: "PRIMARY_LOCAL_ROAD_NUMBER",
                    displayLabel: "PRIMARY_LOCAL_ROAD_NUMBER",
                    typename: "integer",
                  },
                },
                {
                  value: {
                    valueFormat: 0,
                    value: 6.77,
                    displayValue: "6.77",
                  },
                  property: {
                    name: "PROJECT_TOTAL_LENGTH",
                    displayLabel: "PROJECT_TOTAL_LENGTH",
                    typename: "float",
                  },
                },
                {
                  value: {
                    valueFormat: 0,
                    value: "N",
                    displayValue: "N",
                  },
                  property: {
                    name: "LOCAL_PROJECT_FLAG",
                    displayLabel: "LOCAL_PROJECT_FLAG",
                    typename: "string",
                  },
                },
                {
                  value: {
                    valueFormat: 0,
                    displayValue: "",
                  },
                  property: {
                    name: "LET_RESPONSIBLE_AGENCY",
                    displayLabel: "LET_RESPONSIBLE_AGENCY",
                    typename: "string",
                  },
                },
                {
                  value: {
                    valueFormat: 0,
                    value: "Various high-crash roadway curves in District 6-0",
                    displayValue: "Various high-crash roadway curves in District 6-0",
                  },
                  property: {
                    name: "GEOGRAPHIC_DESCRIPTION",
                    displayLabel: "GEOGRAPHIC_DESCRIPTION",
                    typename: "string",
                  },
                },
                {
                  value: {
                    valueFormat: 0,
                    value: "CAND",
                    displayValue: "CAND",
                  },
                  property: {
                    name: "PROJECT_STATE_CODE",
                    displayLabel: "PROJECT_STATE_CODE",
                    typename: "string",
                  },
                },
                {
                  value: {
                    valueFormat: 0,
                    value: "Candidate",
                    displayValue: "Candidate",
                  },
                  property: {
                    name: "PROJECT_STATUS_CODE_DESC",
                    displayLabel: "PROJECT_STATUS_CODE_DESC",
                    typename: "string",
                  },
                },
                {
                  value: {
                    valueFormat: 0,
                    value: 43,
                    displayValue: "43",
                  },
                  property: {
                    name: "CODE_ID",
                    displayLabel: "CODE_ID",
                    typename: "integer",
                  },
                },
                {
                  value: {
                    valueFormat: 0,
                    displayValue: "",
                  },
                  property: {
                    name: "POTENTIAL_COMMITTED_DATE_FLAG",
                    displayLabel: "POTENTIAL_COMMITTED_DATE_FLAG",
                    typename: "string",
                  },
                },
                {
                  value: {
                    valueFormat: 0,
                    displayValue: "",
                  },
                  property: {
                    name: "POTENTIAL_COMMITTED_YEAR",
                    displayLabel: "POTENTIAL_COMMITTED_YEAR",
                    typename: "string",
                  },
                },
                {
                  value: {
                    valueFormat: 0,
                    value: "6/12/2014 12:00:00 AM",
                    displayValue: "6/12/2014 12:00:00 AM",
                  },
                  property: {
                    name: "POTENTIAL_COMMITTED_DATE",
                    displayLabel: "POTENTIAL_COMMITTED_DATE",
                    typename: "string",
                  },
                },
                {
                  value: {
                    valueFormat: 0,
                    value: 2445000,
                    displayValue: "2445000",
                  },
                  property: {
                    name: "EST_CONSTR_PHASE_COST_AMOUNT",
                    displayLabel: "EST_CONSTR_PHASE_COST_AMOUNT",
                    typename: "float",
                  },
                },
                {
                  value: {
                    valueFormat: 0,
                    value: "N",
                    displayValue: "N",
                  },
                  property: {
                    name: "TYP_FLAG",
                    displayLabel: "TYP_FLAG",
                    typename: "string",
                  },
                },
                {
                  value: {
                    valueFormat: 0,
                    value: "N",
                    displayValue: "N",
                  },
                  property: {
                    name: "TIP_FLAG",
                    displayLabel: "TIP_FLAG",
                    typename: "string",
                  },
                },
                {
                  value: {
                    valueFormat: 0,
                    value: "N",
                    displayValue: "N",
                  },
                  property: {
                    name: "STIP_FLAG",
                    displayLabel: "STIP_FLAG",
                    typename: "string",
                  },
                },
                {
                  value: {
                    valueFormat: 0,
                    value: "N",
                    displayValue: "N",
                  },
                  property: {
                    name: "DECADE_OF_INVESTMENT_FLAG",
                    displayLabel: "DECADE_OF_INVESTMENT_FLAG",
                    typename: "string",
                  },
                },
                {
                  value: {
                    valueFormat: 0,
                    value: "N",
                    displayValue: "N",
                  },
                  property: {
                    name: "TIP_PROPOSED_FLAG",
                    displayLabel: "TIP_PROPOSED_FLAG",
                    typename: "string",
                  },
                },
                {
                  value: {
                    valueFormat: 0,
                    value: "N",
                    displayValue: "N",
                  },
                  property: {
                    name: "TYP_PROPOSED_FLAG",
                    displayLabel: "TYP_PROPOSED_FLAG",
                    typename: "string",
                  },
                },
                {
                  value: {
                    valueFormat: 0,
                    value: "Y",
                    displayValue: "Y",
                  },
                  property: {
                    name: "OBLIGATION_PLAN_FLAG",
                    displayLabel: "OBLIGATION_PLAN_FLAG",
                    typename: "string",
                  },
                },
                {
                  value: {
                    valueFormat: 0,
                    value: "A",
                    displayValue: "A",
                  },
                  property: {
                    name: "LET_FLAG",
                    displayLabel: "LET_FLAG",
                    typename: "string",
                  },
                },
                {
                  value: {
                    valueFormat: 0,
                    value: "20140703",
                    displayValue: "20140703",
                  },
                  property: {
                    name: "LET_DATE",
                    displayLabel: "LET_DATE",
                    typename: "string",
                  },
                },
                {
                  value: {
                    valueFormat: 0,
                    value: "7/3/2014 12:00:00 AM",
                    displayValue: "7/3/2014 12:00:00 AM",
                  },
                  property: {
                    name: "LET_DATE_DISPLAY",
                    displayLabel: "LET_DATE_DISPLAY",
                    typename: "string",
                  },
                },
                {
                  value: {
                    valueFormat: 0,
                    displayValue: "",
                  },
                  property: {
                    name: "OPEN_FLAG",
                    displayLabel: "OPEN_FLAG",
                    typename: "string",
                  },
                },
                {
                  value: {
                    valueFormat: 0,
                    displayValue: "",
                  },
                  property: {
                    name: "OPEN_DATE",
                    displayLabel: "OPEN_DATE",
                    typename: "string",
                  },
                },
                {
                  value: {
                    valueFormat: 0,
                    value: "A",
                    displayValue: "A",
                  },
                  property: {
                    name: "NTP_FLAG",
                    displayLabel: "NTP_FLAG",
                    typename: "string",
                  },
                },
                {
                  value: {
                    valueFormat: 0,
                    value: 20140818,
                    displayValue: "20140818",
                  },
                  property: {
                    name: "NTP_DATE",
                    displayLabel: "NTP_DATE",
                    typename: "integer",
                  },
                },
                {
                  value: {
                    valueFormat: 0,
                    value: "A",
                    displayValue: "A",
                  },
                  property: {
                    name: "COMPLETION_FLAG",
                    displayLabel: "COMPLETION_FLAG",
                    typename: "string",
                  },
                },
                {
                  value: {
                    valueFormat: 0,
                    value: "20151007",
                    displayValue: "20151007",
                  },
                  property: {
                    name: "COMPLETION_DATE",
                    displayLabel: "COMPLETION_DATE",
                    typename: "string",
                  },
                },
                {
                  value: {
                    valueFormat: 0,
                    displayValue: "",
                  },
                  property: {
                    name: "FISCALLY_READY",
                    displayLabel: "FISCALLY_READY",
                    typename: "string",
                  },
                },
                {
                  value: {
                    valueFormat: 0,
                    displayValue: "",
                  },
                  property: {
                    name: "FISCAL_DATE",
                    displayLabel: "FISCAL_DATE",
                    typename: "string",
                  },
                },
                {
                  value: {
                    valueFormat: 0,
                    displayValue: "",
                  },
                  property: {
                    name: "PHYSICALLY_READY",
                    displayLabel: "PHYSICALLY_READY",
                    typename: "string",
                  },
                },
                {
                  value: {
                    valueFormat: 0,
                    displayValue: "",
                  },
                  property: {
                    name: "PHYSICAL_DATE",
                    displayLabel: "PHYSICAL_DATE",
                    typename: "string",
                  },
                },
                {
                  value: {
                    valueFormat: 0,
                    value: "George Dunheimer ADE CONSTR",
                    displayValue: "George Dunheimer ADE CONSTR",
                  },
                  property: {
                    name: "PROJECT_MANAGER_CONTACT_NAME",
                    displayLabel: "PROJECT_MANAGER_CONTACT_NAME",
                    typename: "string",
                  },
                },
                {
                  value: {
                    valueFormat: 0,
                    value: "6102056680",
                    displayValue: "6102056680",
                  },
                  property: {
                    name: "PROJECT_MANAGER_PHONE",
                    displayLabel: "PROJECT_MANAGER_PHONE",
                    typename: "string",
                  },
                },
                {
                  value: {
                    valueFormat: 0,
                    value: "gdunheimer@pa.gov",
                    displayValue: "gdunheimer@pa.gov",
                  },
                  property: {
                    name: "PROJECT_MANAGER_EMAIL",
                    displayLabel: "PROJECT_MANAGER_EMAIL",
                    typename: "string",
                  },
                },
                {
                  value: {
                    valueFormat: 0,
                    value: "N",
                    displayValue: "N",
                  },
                  property: {
                    name: "UNDER_CONSTRUCTION",
                    displayLabel: "UNDER_CONSTRUCTION",
                    typename: "string",
                  },
                },
                {
                  value: {
                    valueFormat: 0,
                    value: "Y",
                    displayValue: "Y",
                  },
                  property: {
                    name: "COMPLETED",
                    displayLabel: "COMPLETED",
                    typename: "string",
                  },
                },
                {
                  value: {
                    valueFormat: 0,
                    value: "N",
                    displayValue: "N",
                  },
                  property: {
                    name: "FUTURE_DEVELOPMENT",
                    displayLabel: "FUTURE_DEVELOPMENT",
                    typename: "string",
                  },
                },
                {
                  value: {
                    valueFormat: 0,
                    value: "N",
                    displayValue: "N",
                  },
                  property: {
                    name: "IN_DEVELOPMENT",
                    displayLabel: "IN_DEVELOPMENT",
                    typename: "string",
                  },
                },
                {
                  value: {
                    valueFormat: 0,
                    value: "COMPLETED",
                    displayValue: "COMPLETED",
                  },
                  property: {
                    name: "PROJECT_STAGE",
                    displayLabel: "PROJECT_STAGE",
                    typename: "string",
                  },
                },
                {
                  value: {
                    valueFormat: 0,
                    value: new Date("2014-04-18T00:00:00.000Z"),
                    displayValue: "2014-04-18T00:00:00.000Z",
                  },
                  property: {
                    name: "PROJECT_CREATION_DATE",
                    displayLabel: "PROJECT_CREATION_DATE",
                    typename: "dateTime",
                  },
                },
                {
                  value: {
                    valueFormat: 0,
                    displayValue: "",
                  },
                  property: {
                    name: "CAPITAL_BUDGET_YEAR",
                    displayLabel: "CAPITAL_BUDGET_YEAR",
                    typename: "string",
                  },
                },
                {
                  value: {
                    valueFormat: 0,
                    value: "Y",
                    displayValue: "Y",
                  },
                  property: {
                    name: "CAPTIAL_BUDGET_REQUIRED_FLAG",
                    displayLabel: "CAPTIAL_BUDGET_REQUIRED_FLAG",
                    typename: "string",
                  },
                },
                {
                  value: {
                    valueFormat: 0,
                    value: "N",
                    displayValue: "N",
                  },
                  property: {
                    name: "CAPITAL_BUDGET_APPROVED_FLAG",
                    displayLabel: "CAPITAL_BUDGET_APPROVED_FLAG",
                    typename: "string",
                  },
                },
                {
                  value: {
                    valueFormat: 0,
                    value: "Delaware Valley Regional Planning Commission MPO                           ",
                    displayValue: "Delaware Valley Regional Planning Commission MPO                           ",
                  },
                  property: {
                    name: "PLANNING_PARTNER_NAME",
                    displayLabel: "PLANNING_PARTNER_NAME",
                    typename: "string",
                  },
                },
                {
                  value: {
                    valueFormat: 0,
                    value: "District 6-0                  ",
                    displayValue: "District 6-0                  ",
                  },
                  property: {
                    name: "RESPONSIBLE_DISTRICT_NAME",
                    displayLabel: "RESPONSIBLE_DISTRICT_NAME",
                    typename: "string",
                  },
                },
                {
                  value: {
                    valueFormat: 0,
                    value: 15,
                    displayValue: "15",
                  },
                  property: {
                    name: "RESPONSIBLE_COUNTY_CODE",
                    displayLabel: "RESPONSIBLE_COUNTY_CODE",
                    typename: "integer",
                  },
                },
                {
                  value: {
                    valueFormat: 0,
                    value: "Chester       ",
                    displayValue: "Chester       ",
                  },
                  property: {
                    name: "RESPONSIBLE_COUNTY_NAME",
                    displayLabel: "RESPONSIBLE_COUNTY_NAME",
                    typename: "string",
                  },
                },
                {
                  value: {
                    valueFormat: 0,
                    value: "PennDOT",
                    displayValue: "PennDOT",
                  },
                  property: {
                    name: "PROJECT_SPONSOR_NAME",
                    displayLabel: "PROJECT_SPONSOR_NAME",
                    typename: "string",
                  },
                },
                {
                  value: {
                    valueFormat: 0,
                    value: "N",
                    displayValue: "N",
                  },
                  property: {
                    name: "SD_BRIDGE_WORK_FLAG",
                    displayLabel: "SD_BRIDGE_WORK_FLAG",
                    typename: "string",
                  },
                },
                {
                  value: {
                    valueFormat: 0,
                    displayValue: "",
                  },
                  property: {
                    name: "OPEN_TO_TRAFFIC_DATE",
                    displayLabel: "OPEN_TO_TRAFFIC_DATE",
                    typename: "string",
                  },
                },
                {
                  value: {
                    valueFormat: 0,
                    displayValue: "",
                  },
                  property: {
                    name: "ORIGINAL_CONTRACT_AMOUNT",
                    displayLabel: "ORIGINAL_CONTRACT_AMOUNT",
                    typename: "string",
                  },
                },
                {
                  value: {
                    valueFormat: 0,
                    displayValue: "",
                  },
                  property: {
                    name: "CURRENT_CONTRACT_AMOUNT",
                    displayLabel: "CURRENT_CONTRACT_AMOUNT",
                    typename: "string",
                  },
                },
                {
                  value: {
                    valueFormat: 0,
                    value: "7/3/2014 12:00:00 AM",
                    displayValue: "7/3/2014 12:00:00 AM",
                  },
                  property: {
                    name: "ESTIMATED_LET_DATE",
                    displayLabel: "ESTIMATED_LET_DATE",
                    typename: "string",
                  },
                },
                {
                  value: {
                    valueFormat: 0,
                    displayValue: "",
                  },
                  property: {
                    name: "DOI_DATE",
                    displayLabel: "DOI_DATE",
                    typename: "string",
                  },
                },
                {
                  value: {
                    valueFormat: 0,
                    displayValue: "",
                  },
                  property: {
                    name: "DOI_ID",
                    displayLabel: "DOI_ID",
                    typename: "string",
                  },
                },
                {
                  value: {
                    valueFormat: 0,
                    value: 102572,
                    displayValue: "102572",
                  },
                  property: {
                    name: "PRIMARY_PROJECT_ID",
                    displayLabel: "PRIMARY_PROJECT_ID",
                    typename: "integer",
                  },
                },
                {
                  value: {
                    valueFormat: 0,
                    displayValue: "",
                  },
                  property: {
                    name: "PRIMARY_CONTRACT_AMOUNT",
                    displayLabel: "PRIMARY_CONTRACT_AMOUNT",
                    typename: "string",
                  },
                },
                {
                  value: {
                    valueFormat: 0,
                    value: "Y",
                    displayValue: "Y",
                  },
                  property: {
                    name: "PRIMARY_PROJECT_FLAG",
                    displayLabel: "PRIMARY_PROJECT_FLAG",
                    typename: "string",
                  },
                },
                {
                  value: {
                    valueFormat: 0,
                    value: "T",
                    displayValue: "T",
                  },
                  property: {
                    name: "HAS_CONSTRUCTION_PHASE",
                    displayLabel: "HAS_CONSTRUCTION_PHASE",
                    typename: "string",
                  },
                },
                {
                  value: {
                    valueFormat: 0,
                    value: "F",
                    displayValue: "F",
                  },
                  property: {
                    name: "HAS_FINAL_DESIGN_PHASE",
                    displayLabel: "HAS_FINAL_DESIGN_PHASE",
                    typename: "string",
                  },
                },
                {
                  value: {
                    valueFormat: 0,
                    value: "F",
                    displayValue: "F",
                  },
                  property: {
                    name: "HAS_PRELIMINARY_ENGINEER_PHASE",
                    displayLabel: "HAS_PRELIMINARY_ENGINEER_PHASE",
                    typename: "string",
                  },
                },
                {
                  value: {
                    valueFormat: 0,
                    value: "F",
                    displayValue: "F",
                  },
                  property: {
                    name: "HAS_PLAN_RESEARCH_ADMIN_PHASE",
                    displayLabel: "HAS_PLAN_RESEARCH_ADMIN_PHASE",
                    typename: "string",
                  },
                },
                {
                  value: {
                    valueFormat: 0,
                    value: "F",
                    displayValue: "F",
                  },
                  property: {
                    name: "HAS_RIGHT_OF_WAY_PHASE",
                    displayLabel: "HAS_RIGHT_OF_WAY_PHASE",
                    typename: "string",
                  },
                },
                {
                  value: {
                    valueFormat: 0,
                    value: "F",
                    displayValue: "F",
                  },
                  property: {
                    name: "HAS_STUDY_PHASE",
                    displayLabel: "HAS_STUDY_PHASE",
                    typename: "string",
                  },
                },
                {
                  value: {
                    valueFormat: 0,
                    value: "F",
                    displayValue: "F",
                  },
                  property: {
                    name: "HAS_UTILITY_PHASE",
                    displayLabel: "HAS_UTILITY_PHASE",
                    typename: "string",
                  },
                },
                {
                  value: {
                    valueFormat: 0,
                    value: 67,
                    displayValue: "67",
                  },
                  property: {
                    name: "CTY_CODE",
                    displayLabel: "CTY_CODE",
                    typename: "integer",
                  },
                },
                {
                  value: {
                    valueFormat: 0,
                    value: 8009,
                    displayValue: "8009",
                  },
                  property: {
                    name: "ST_RT_NO",
                    displayLabel: "ST_RT_NO",
                    typename: "integer",
                  },
                },
                {
                  value: {
                    valueFormat: 0,
                    value: 1,
                    displayValue: "1",
                  },
                  property: {
                    name: "JURIS",
                    displayLabel: "JURIS",
                    typename: "integer",
                  },
                },
                {
                  value: {
                    valueFormat: 0,
                    value: 6,
                    displayValue: "6",
                  },
                  property: {
                    name: "DISTRICT_NO",
                    displayLabel: "DISTRICT_NO",
                    typename: "integer",
                  },
                },
                {
                  value: {
                    valueFormat: 0,
                    value: 250,
                    displayValue: "250",
                  },
                  property: {
                    name: "SEG_BGN",
                    displayLabel: "SEG_BGN",
                    typename: "integer",
                  },
                },
                {
                  value: {
                    valueFormat: 0,
                    value: 0,
                    displayValue: "0",
                  },
                  property: {
                    name: "OFFSET_BGN",
                    displayLabel: "OFFSET_BGN",
                    typename: "integer",
                  },
                },
                {
                  value: {
                    valueFormat: 0,
                    value: 250,
                    displayValue: "250",
                  },
                  property: {
                    name: "SEG_END",
                    displayLabel: "SEG_END",
                    typename: "integer",
                  },
                },
                {
                  value: {
                    valueFormat: 0,
                    value: 2890,
                    displayValue: "2890",
                  },
                  property: {
                    name: "OFFSET_END",
                    displayLabel: "OFFSET_END",
                    typename: "integer",
                  },
                },
                {
                  value: {
                    valueFormat: 0,
                    value: 2500000,
                    displayValue: "2500000",
                  },
                  property: {
                    name: "SEG_PT_BGN",
                    displayLabel: "SEG_PT_BGN",
                    typename: "integer",
                  },
                },
                {
                  value: {
                    valueFormat: 0,
                    value: 2502890,
                    displayValue: "2502890",
                  },
                  property: {
                    name: "SEG_PT_END",
                    displayLabel: "SEG_PT_END",
                    typename: "integer",
                  },
                },
                {
                  value: {
                    valueFormat: 0,
                    value: 2890,
                    displayValue: "2890",
                  },
                  property: {
                    name: "SEG_LNGTH_FEET",
                    displayLabel: "SEG_LNGTH_FEET",
                    typename: "integer",
                  },
                },
                {
                  value: {
                    valueFormat: 0,
                    value: 39099,
                    displayValue: "39099",
                  },
                  property: {
                    name: "NLF_ID",
                    displayLabel: "NLF_ID",
                    typename: "integer",
                  },
                },
                {
                  value: {
                    valueFormat: 0,
                    value: 1,
                    displayValue: "1",
                  },
                  property: {
                    name: "SIDE_IND",
                    displayLabel: "SIDE_IND",
                    typename: "integer",
                  },
                },
                {
                  value: {
                    valueFormat: 0,
                    value: 0,
                    displayValue: "0",
                  },
                  property: {
                    name: "NLF_CNTL_BGN",
                    displayLabel: "NLF_CNTL_BGN",
                    typename: "integer",
                  },
                },
                {
                  value: {
                    valueFormat: 0,
                    value: 2890,
                    displayValue: "2890",
                  },
                  property: {
                    name: "NLF_CNTL_END",
                    displayLabel: "NLF_CNTL_END",
                    typename: "integer",
                  },
                },
                {
                  value: {
                    valueFormat: 0,
                    value: 6590,
                    displayValue: "6590",
                  },
                  property: {
                    name: "CUM_OFFSET_BGN",
                    displayLabel: "CUM_OFFSET_BGN",
                    typename: "integer",
                  },
                },
                {
                  value: {
                    valueFormat: 0,
                    value: 9480,
                    displayValue: "9480",
                  },
                  property: {
                    name: "CUM_OFFSET_END",
                    displayLabel: "CUM_OFFSET_END",
                    typename: "integer",
                  },
                },
                {
                  value: {
                    valueFormat: 0,
                    value: "67301",
                    displayValue: "67301",
                  },
                  property: {
                    name: "COUNTY_MUNICIPALITY_CODES",
                    displayLabel: "COUNTY_MUNICIPALITY_CODES",
                    typename: "string",
                  },
                },
                {
                  value: {
                    valueFormat: 0,
                    value: "301",
                    displayValue: "301",
                  },
                  property: {
                    name: "MUNICIPALITY_CODES",
                    displayLabel: "MUNICIPALITY_CODES",
                    typename: "string",
                  },
                },
                {
                  value: {
                    valueFormat: 0,
                    value: "PHILADELPHIA ",
                    displayValue: "PHILADELPHIA ",
                  },
                  property: {
                    name: "MUNICIPALITY_NAMES",
                    displayLabel: "MUNICIPALITY_NAMES",
                    typename: "string",
                  },
                },
                {
                  value: {
                    valueFormat: 0,
                    value: "175",
                    displayValue: "175",
                  },
                  property: {
                    name: "HOUSE_DISTRICTS",
                    displayLabel: "HOUSE_DISTRICTS",
                    typename: "string",
                  },
                },
                {
                  value: {
                    valueFormat: 0,
                    value: "1",
                    displayValue: "1",
                  },
                  property: {
                    name: "SENATE_DISTRICTS",
                    displayLabel: "SENATE_DISTRICTS",
                    typename: "string",
                  },
                },
                {
                  value: {
                    valueFormat: 0,
                    value: "2/3/2022 12:00:00 AM",
                    displayValue: "2/3/2022 12:00:00 AM",
                  },
                  property: {
                    name: "CONGRESS_DISTRICTS",
                    displayLabel: "CONGRESS_DISTRICTS",
                    typename: "string",
                  },
                },
                {
                  value: {
                    valueFormat: 0,
                    value: "Marylouise Isaacson, (D)",
                    displayValue: "Marylouise Isaacson, (D)",
                  },
                  property: {
                    name: "HOUSE_LEGISLATOR_NAMES",
                    displayLabel: "HOUSE_LEGISLATOR_NAMES",
                    typename: "string",
                  },
                },
                {
                  value: {
                    valueFormat: 0,
                    value: "Nikil Saval, (D)",
                    displayValue: "Nikil Saval, (D)",
                  },
                  property: {
                    name: "SENATE_LEGISLATOR_NAMES",
                    displayLabel: "SENATE_LEGISLATOR_NAMES",
                    typename: "string",
                  },
                },
                {
                  value: {
                    valueFormat: 0,
                    value: "Brendan F. Boyle (D), Dwight Evans (D)",
                    displayValue: "Brendan F. Boyle (D), Dwight Evans (D)",
                  },
                  property: {
                    name: "CONGRESS_LEGISLATOR_NAMES",
                    displayLabel: "CONGRESS_LEGISLATOR_NAMES",
                    typename: "string",
                  },
                },
                {
                  value: {
                    valueFormat: 0,
                    value: "PHILADELPHIA",
                    displayValue: "PHILADELPHIA",
                  },
                  property: {
                    name: "COUNTY_NAME",
                    displayLabel: "COUNTY_NAME",
                    typename: "string",
                  },
                },
                {
                  value: {
                    valueFormat: 0,
                    displayValue: "",
                  },
                  property: {
                    name: "STREET_NAME",
                    displayLabel: "STREET_NAME",
                    typename: "string",
                  },
                },
                {
                  value: {
                    valueFormat: 0,
                    value: "N",
                    displayValue: "N",
                  },
                  property: {
                    name: "BRIDGE_WORK_FLAG",
                    displayLabel: "BRIDGE_WORK_FLAG",
                    typename: "string",
                  },
                },
                {
                  value: {
                    valueFormat: 0,
                    value: 20210529,
                    displayValue: "20210529",
                  },
                  property: {
                    name: "RECORD_UPDATE",
                    displayLabel: "RECORD_UPDATE",
                    typename: "integer",
                  },
                },
                {
                  value: {
                    valueFormat: 0,
                    value: new Date("2019-05-13T06:27:15.000Z"),
                    displayValue: "2019-05-13T06:27:15.000Z",
                  },
                  property: {
                    name: "CREATED_DATE",
                    displayLabel: "CREATED_DATE",
                    typename: "dateTime",
                  },
                },
                {
                  value: {
                    valueFormat: 0,
                    value: new Date("2021-05-29T07:33:09.000Z"),
                    displayValue: "2021-05-29T07:33:09.000Z",
                  },
                  property: {
                    name: "LAST_EDITED_DATE",
                    displayLabel: "LAST_EDITED_DATE",
                    typename: "dateTime",
                  },
                },
                {
                  value: {
                    valueFormat: 0,
                    value: 4960,
                    displayValue: "4960",
                  },
                  property: {
                    name: "GEOM_LENGTH_FT",
                    displayLabel: "GEOM_LENGTH_FT",
                    typename: "integer",
                  },
                },
                {
                  value: {
                    valueFormat: 0,
                    value: "POINT",
                    displayValue: "POINT",
                  },
                  property: {
                    name: "GEOMETRY_TYPE",
                    displayLabel: "GEOMETRY_TYPE",
                    typename: "string",
                  },
                },
                {
                  value: {
                    valueFormat: 0,
                    value: "N",
                    displayValue: "N",
                  },
                  property: {
                    name: "BRIDGE_WORK_LOCATION_FLAG",
                    displayLabel: "BRIDGE_WORK_LOCATION_FLAG",
                    typename: "string",
                  },
                },
                {
                  value: {
                    valueFormat: 0,
                    value: "High Friction Surfaces\r\nVarious high-crash roadway curves in D6-0\r\nTreatmnt to reduce crashes on rdwy curves",
                    displayValue: "High Friction Surfaces\r\nVarious high-crash roadway curves in D6-0\r\nTreatmnt to reduce crashes on rdwy curves",
                  },
                  property: {
                    name: "PUBLIC_NARRATIVE",
                    displayLabel: "PUBLIC_NARRATIVE",
                    typename: "string",
                  },
                },
                {
                  value: {
                    valueFormat: 0,
                    value: new Date("2020-10-20T05:31:01.000Z"),
                    displayValue: "2020-10-20T05:31:01.000Z",
                  },
                  property: {
                    name: "GIS_UPDATE_DATE",
                    displayLabel: "GIS_UPDATE_DATE",
                    typename: "dateTime",
                  },
                },
                {
                  value: {
                    valueFormat: 0,
                    value: new Date("2021-11-05T13:05:57.000Z"),
                    displayValue: "2021-11-05T13:05:57.000Z",
                  },
                  property: {
                    name: "GIS_GEOMETRY_UPDATE_DATE",
                    displayLabel: "GIS_GEOMETRY_UPDATE_DATE",
                    typename: "dateTime",
                  },
                },
                {
                  value: {
                    valueFormat: 0,
                    displayValue: "",
                  },
                  property: {
                    name: "SE_ANNO_CAD_DATA",
                    displayLabel: "SE_ANNO_CAD_DATA",
                    typename: "string",
                  },
                },
                {
                  value: {
                    valueFormat: 0,
                    value: 974725878,
                    displayValue: "974725878",
                  },
                  property: {
                    name: "GPID",
                    displayLabel: "GPID",
                    typename: "integer",
                  },
                },
                {
                  value: {
                    valueFormat: 0,
                    value: "88c9a006-4af4-47eb-bea6-553a61306cee",
                    displayValue: "88c9a006-4af4-47eb-bea6-553a61306cee",
                  },
                  property: {
                    name: "GlobalID",
                    displayLabel: "GlobalID",
                    typename: "string",
                  },
                },
              ],
            },
          ],
        },
      ],
    },
  ];

  public static phillyTransportationGetFeatureInfoQueryJson = { objectIdFieldName: "OBJECTID", uniqueIdField: { name: "OBJECTID", isSystemMaintained: true }, globalIdFieldName: "GlobalID", serverGens: { minServerGen: 617056, serverGen: 705029 }, geometryType: "esriGeometryPoint", spatialReference: { wkid: 102100, latestWkid: 3857 }, transform: { originPosition: "upperLeft", scale: [2.3886571335751796, 2.3886571335751796], translate: [-8365268.374365235, 4860172.005808106] }, fields: [{ name: "OBJECTID", type: "esriFieldTypeOID", alias: "OBJECTID", sqlType: "sqlTypeInteger", domain: null, defaultValue: null }, { name: "GISDATAPROJECT_LOCATION_DETAIL_", type: "esriFieldTypeInteger", alias: "GISDATAPROJECT_LOCATION_DETAIL_PTFID", sqlType: "sqlTypeInteger", domain: null, defaultValue: null }, { name: "PROJECT_ID", type: "esriFieldTypeInteger", alias: "PROJECT_ID", sqlType: "sqlTypeInteger", domain: null, defaultValue: null }, { name: "PROJECT_TITLE", type: "esriFieldTypeString", alias: "PROJECT_TITLE", sqlType: "sqlTypeNVarchar", length: 4000, domain: null, defaultValue: null }, { name: "PROJECT_STATUS", type: "esriFieldTypeString", alias: "PROJECT_STATUS", sqlType: "sqlTypeNVarchar", length: 4000, domain: null, defaultValue: null }, { name: "PROJECT_CLASS", type: "esriFieldTypeString", alias: "PROJECT_CLASS", sqlType: "sqlTypeNVarchar", length: 4000, domain: null, defaultValue: null }, { name: "PROJECT_CLASS_NAME", type: "esriFieldTypeString", alias: "PROJECT_CLASS_NAME", sqlType: "sqlTypeNVarchar", length: 4000, domain: null, defaultValue: null }, { name: "PROJECT_IMPROVEMENT_DESC", type: "esriFieldTypeString", alias: "PROJECT_IMPROVEMENT_DESC", sqlType: "sqlTypeNVarchar", length: 4000, domain: null, defaultValue: null }, { name: "PROJECT_SHORT_NARRATIVE", type: "esriFieldTypeString", alias: "PROJECT_SHORT_NARRATIVE", sqlType: "sqlTypeNVarchar", length: 4000, domain: null, defaultValue: null }, { name: "IMPROVEMENT_TYPE", type: "esriFieldTypeString", alias: "IMPROVEMENT_TYPE", sqlType: "sqlTypeNVarchar", length: 4000, domain: null, defaultValue: null }, { name: "IMPROVEMENT_CODE", type: "esriFieldTypeSmallInteger", alias: "IMPROVEMENT_CODE", sqlType: "sqlTypeSmallInt", domain: null, defaultValue: null }, { name: "IMPROVEMENT_SHORT_DESC", type: "esriFieldTypeString", alias: "IMPROVEMENT_SHORT_DESC", sqlType: "sqlTypeNVarchar", length: 4000, domain: null, defaultValue: null }, { name: "TYP_FRST_APR_DT", type: "esriFieldTypeDate", alias: "TYP_FRST_APR_DT", sqlType: "sqlTypeTimestamp2", length: 8, domain: null, defaultValue: null }, { name: "MAJOR_PROJECT_FLAG", type: "esriFieldTypeString", alias: "MAJOR_PROJECT_FLAG", sqlType: "sqlTypeNVarchar", length: 4000, domain: null, defaultValue: null }, { name: "TRANSPORT_MODE", type: "esriFieldTypeString", alias: "TRANSPORT_MODE", sqlType: "sqlTypeNVarchar", length: 4000, domain: null, defaultValue: null }, { name: "PLANNING_PARTNER_SHORT_NAME", type: "esriFieldTypeString", alias: "PLANNING_PARTNER_SHORT_NAME", sqlType: "sqlTypeNVarchar", length: 4000, domain: null, defaultValue: null }, { name: "RESPONSIBLE_DISTRICT_NO", type: "esriFieldTypeSmallInteger", alias: "RESPONSIBLE_DISTRICT_NO", sqlType: "sqlTypeSmallInt", domain: null, defaultValue: null }, { name: "PRIMARY_ST_RT_NO", type: "esriFieldTypeSmallInteger", alias: "PRIMARY_ST_RT_NO", sqlType: "sqlTypeSmallInt", domain: null, defaultValue: null }, { name: "DISTRICT_SECTION_ID", type: "esriFieldTypeString", alias: "DISTRICT_SECTION_ID", sqlType: "sqlTypeNVarchar", length: 4000, domain: null, defaultValue: null }, { name: "PRIMARY_LOCAL_ROAD_NUMBER", type: "esriFieldTypeSmallInteger", alias: "PRIMARY_LOCAL_ROAD_NUMBER", sqlType: "sqlTypeSmallInt", domain: null, defaultValue: null }, { name: "PROJECT_TOTAL_LENGTH", type: "esriFieldTypeSingle", alias: "PROJECT_TOTAL_LENGTH", sqlType: "sqlTypeReal", domain: null, defaultValue: null }, { name: "LOCAL_PROJECT_FLAG", type: "esriFieldTypeString", alias: "LOCAL_PROJECT_FLAG", sqlType: "sqlTypeNVarchar", length: 4000, domain: null, defaultValue: null }, { name: "LET_RESPONSIBLE_AGENCY", type: "esriFieldTypeString", alias: "LET_RESPONSIBLE_AGENCY", sqlType: "sqlTypeNVarchar", length: 4000, domain: null, defaultValue: null }, { name: "GEOGRAPHIC_DESCRIPTION", type: "esriFieldTypeString", alias: "GEOGRAPHIC_DESCRIPTION", sqlType: "sqlTypeNVarchar", length: 4000, domain: null, defaultValue: null }, { name: "PROJECT_STATE_CODE", type: "esriFieldTypeString", alias: "PROJECT_STATE_CODE", sqlType: "sqlTypeNVarchar", length: 4000, domain: null, defaultValue: null }, { name: "PROJECT_STATUS_CODE_DESC", type: "esriFieldTypeString", alias: "PROJECT_STATUS_CODE_DESC", sqlType: "sqlTypeNVarchar", length: 4000, domain: null, defaultValue: null }, { name: "CODE_ID", type: "esriFieldTypeSmallInteger", alias: "CODE_ID", sqlType: "sqlTypeSmallInt", domain: null, defaultValue: null }, { name: "POTENTIAL_COMMITTED_DATE_FLAG", type: "esriFieldTypeString", alias: "POTENTIAL_COMMITTED_DATE_FLAG", sqlType: "sqlTypeNVarchar", length: 4000, domain: null, defaultValue: null }, { name: "POTENTIAL_COMMITTED_YEAR", type: "esriFieldTypeString", alias: "POTENTIAL_COMMITTED_YEAR", sqlType: "sqlTypeNVarchar", length: 4000, domain: null, defaultValue: null }, { name: "POTENTIAL_COMMITTED_DATE", type: "esriFieldTypeString", alias: "POTENTIAL_COMMITTED_DATE", sqlType: "sqlTypeNVarchar", length: 4000, domain: null, defaultValue: null }, { name: "EST_CONSTR_PHASE_COST_AMOUNT", type: "esriFieldTypeSingle", alias: "EST_CONSTR_PHASE_COST_AMOUNT", sqlType: "sqlTypeReal", domain: null, defaultValue: null }, { name: "TYP_FLAG", type: "esriFieldTypeString", alias: "TYP_FLAG", sqlType: "sqlTypeNVarchar", length: 4000, domain: null, defaultValue: null }, { name: "TIP_FLAG", type: "esriFieldTypeString", alias: "TIP_FLAG", sqlType: "sqlTypeNVarchar", length: 4000, domain: null, defaultValue: null }, { name: "STIP_FLAG", type: "esriFieldTypeString", alias: "STIP_FLAG", sqlType: "sqlTypeNVarchar", length: 4000, domain: null, defaultValue: null }, { name: "DECADE_OF_INVESTMENT_FLAG", type: "esriFieldTypeString", alias: "DECADE_OF_INVESTMENT_FLAG", sqlType: "sqlTypeNVarchar", length: 4000, domain: null, defaultValue: null }, { name: "TIP_PROPOSED_FLAG", type: "esriFieldTypeString", alias: "TIP_PROPOSED_FLAG", sqlType: "sqlTypeNVarchar", length: 4000, domain: null, defaultValue: null }, { name: "TYP_PROPOSED_FLAG", type: "esriFieldTypeString", alias: "TYP_PROPOSED_FLAG", sqlType: "sqlTypeNVarchar", length: 4000, domain: null, defaultValue: null }, { name: "OBLIGATION_PLAN_FLAG", type: "esriFieldTypeString", alias: "OBLIGATION_PLAN_FLAG", sqlType: "sqlTypeNVarchar", length: 4000, domain: null, defaultValue: null }, { name: "LET_FLAG", type: "esriFieldTypeString", alias: "LET_FLAG", sqlType: "sqlTypeNVarchar", length: 4000, domain: null, defaultValue: null }, { name: "LET_DATE", type: "esriFieldTypeString", alias: "LET_DATE", sqlType: "sqlTypeNVarchar", length: 4000, domain: null, defaultValue: null }, { name: "LET_DATE_DISPLAY", type: "esriFieldTypeString", alias: "LET_DATE_DISPLAY", sqlType: "sqlTypeNVarchar", length: 4000, domain: null, defaultValue: null }, { name: "OPEN_FLAG", type: "esriFieldTypeString", alias: "OPEN_FLAG", sqlType: "sqlTypeNVarchar", length: 4000, domain: null, defaultValue: null }, { name: "OPEN_DATE", type: "esriFieldTypeString", alias: "OPEN_DATE", sqlType: "sqlTypeNVarchar", length: 4000, domain: null, defaultValue: null }, { name: "NTP_FLAG", type: "esriFieldTypeString", alias: "NTP_FLAG", sqlType: "sqlTypeNVarchar", length: 4000, domain: null, defaultValue: null }, { name: "NTP_DATE", type: "esriFieldTypeInteger", alias: "NTP_DATE", sqlType: "sqlTypeInteger", domain: null, defaultValue: null }, { name: "COMPLETION_FLAG", type: "esriFieldTypeString", alias: "COMPLETION_FLAG", sqlType: "sqlTypeNVarchar", length: 4000, domain: null, defaultValue: null }, { name: "COMPLETION_DATE", type: "esriFieldTypeString", alias: "COMPLETION_DATE", sqlType: "sqlTypeNVarchar", length: 4000, domain: null, defaultValue: null }, { name: "FISCALLY_READY", type: "esriFieldTypeString", alias: "FISCALLY_READY", sqlType: "sqlTypeNVarchar", length: 4000, domain: null, defaultValue: null }, { name: "FISCAL_DATE", type: "esriFieldTypeString", alias: "FISCAL_DATE", sqlType: "sqlTypeNVarchar", length: 4000, domain: null, defaultValue: null }, { name: "PHYSICALLY_READY", type: "esriFieldTypeString", alias: "PHYSICALLY_READY", sqlType: "sqlTypeNVarchar", length: 4000, domain: null, defaultValue: null }, { name: "PHYSICAL_DATE", type: "esriFieldTypeString", alias: "PHYSICAL_DATE", sqlType: "sqlTypeNVarchar", length: 4000, domain: null, defaultValue: null }, { name: "PROJECT_MANAGER_CONTACT_NAME", type: "esriFieldTypeString", alias: "PROJECT_MANAGER_CONTACT_NAME", sqlType: "sqlTypeNVarchar", length: 4000, domain: null, defaultValue: null }, { name: "PROJECT_MANAGER_PHONE", type: "esriFieldTypeString", alias: "PROJECT_MANAGER_PHONE", sqlType: "sqlTypeNVarchar", length: 4000, domain: null, defaultValue: null }, { name: "PROJECT_MANAGER_EMAIL", type: "esriFieldTypeString", alias: "PROJECT_MANAGER_EMAIL", sqlType: "sqlTypeNVarchar", length: 4000, domain: null, defaultValue: null }, { name: "UNDER_CONSTRUCTION", type: "esriFieldTypeString", alias: "UNDER_CONSTRUCTION", sqlType: "sqlTypeNVarchar", length: 4000, domain: null, defaultValue: null }, { name: "COMPLETED", type: "esriFieldTypeString", alias: "COMPLETED", sqlType: "sqlTypeNVarchar", length: 4000, domain: null, defaultValue: null }, { name: "FUTURE_DEVELOPMENT", type: "esriFieldTypeString", alias: "FUTURE_DEVELOPMENT", sqlType: "sqlTypeNVarchar", length: 4000, domain: null, defaultValue: null }, { name: "IN_DEVELOPMENT", type: "esriFieldTypeString", alias: "IN_DEVELOPMENT", sqlType: "sqlTypeNVarchar", length: 4000, domain: null, defaultValue: null }, { name: "PROJECT_STAGE", type: "esriFieldTypeString", alias: "PROJECT_STAGE", sqlType: "sqlTypeNVarchar", length: 4000, domain: null, defaultValue: null }, { name: "PROJECT_CREATION_DATE", type: "esriFieldTypeDate", alias: "PROJECT_CREATION_DATE", sqlType: "sqlTypeTimestamp2", length: 8, domain: null, defaultValue: null }, { name: "CAPITAL_BUDGET_YEAR", type: "esriFieldTypeString", alias: "CAPITAL_BUDGET_YEAR", sqlType: "sqlTypeNVarchar", length: 4000, domain: null, defaultValue: null }, { name: "CAPTIAL_BUDGET_REQUIRED_FLAG", type: "esriFieldTypeString", alias: "CAPTIAL_BUDGET_REQUIRED_FLAG", sqlType: "sqlTypeNVarchar", length: 4000, domain: null, defaultValue: null }, { name: "CAPITAL_BUDGET_APPROVED_FLAG", type: "esriFieldTypeString", alias: "CAPITAL_BUDGET_APPROVED_FLAG", sqlType: "sqlTypeNVarchar", length: 4000, domain: null, defaultValue: null }, { name: "PLANNING_PARTNER_NAME", type: "esriFieldTypeString", alias: "PLANNING_PARTNER_NAME", sqlType: "sqlTypeNVarchar", length: 4000, domain: null, defaultValue: null }, { name: "RESPONSIBLE_DISTRICT_NAME", type: "esriFieldTypeString", alias: "RESPONSIBLE_DISTRICT_NAME", sqlType: "sqlTypeNVarchar", length: 4000, domain: null, defaultValue: null }, { name: "RESPONSIBLE_COUNTY_CODE", type: "esriFieldTypeSmallInteger", alias: "RESPONSIBLE_COUNTY_CODE", sqlType: "sqlTypeSmallInt", domain: null, defaultValue: null }, { name: "RESPONSIBLE_COUNTY_NAME", type: "esriFieldTypeString", alias: "RESPONSIBLE_COUNTY_NAME", sqlType: "sqlTypeNVarchar", length: 4000, domain: null, defaultValue: null }, { name: "PROJECT_SPONSOR_NAME", type: "esriFieldTypeString", alias: "PROJECT_SPONSOR_NAME", sqlType: "sqlTypeNVarchar", length: 4000, domain: null, defaultValue: null }, { name: "SD_BRIDGE_WORK_FLAG", type: "esriFieldTypeString", alias: "SD_BRIDGE_WORK_FLAG", sqlType: "sqlTypeNVarchar", length: 4000, domain: null, defaultValue: null }, { name: "OPEN_TO_TRAFFIC_DATE", type: "esriFieldTypeString", alias: "OPEN_TO_TRAFFIC_DATE", sqlType: "sqlTypeNVarchar", length: 4000, domain: null, defaultValue: null }, { name: "ORIGINAL_CONTRACT_AMOUNT", type: "esriFieldTypeString", alias: "ORIGINAL_CONTRACT_AMOUNT", sqlType: "sqlTypeNVarchar", length: 4000, domain: null, defaultValue: null }, { name: "CURRENT_CONTRACT_AMOUNT", type: "esriFieldTypeString", alias: "CURRENT_CONTRACT_AMOUNT", sqlType: "sqlTypeNVarchar", length: 4000, domain: null, defaultValue: null }, { name: "ESTIMATED_LET_DATE", type: "esriFieldTypeString", alias: "ESTIMATED_LET_DATE", sqlType: "sqlTypeNVarchar", length: 4000, domain: null, defaultValue: null }, { name: "DOI_DATE", type: "esriFieldTypeString", alias: "DOI_DATE", sqlType: "sqlTypeNVarchar", length: 4000, domain: null, defaultValue: null }, { name: "DOI_ID", type: "esriFieldTypeString", alias: "DOI_ID", sqlType: "sqlTypeNVarchar", length: 4000, domain: null, defaultValue: null }, { name: "PRIMARY_PROJECT_ID", type: "esriFieldTypeInteger", alias: "PRIMARY_PROJECT_ID", sqlType: "sqlTypeInteger", domain: null, defaultValue: null }, { name: "PRIMARY_CONTRACT_AMOUNT", type: "esriFieldTypeString", alias: "PRIMARY_CONTRACT_AMOUNT", sqlType: "sqlTypeNVarchar", length: 4000, domain: null, defaultValue: null }, { name: "PRIMARY_PROJECT_FLAG", type: "esriFieldTypeString", alias: "PRIMARY_PROJECT_FLAG", sqlType: "sqlTypeNVarchar", length: 4000, domain: null, defaultValue: null }, { name: "HAS_CONSTRUCTION_PHASE", type: "esriFieldTypeString", alias: "HAS_CONSTRUCTION_PHASE", sqlType: "sqlTypeNVarchar", length: 4000, domain: null, defaultValue: null }, { name: "HAS_FINAL_DESIGN_PHASE", type: "esriFieldTypeString", alias: "HAS_FINAL_DESIGN_PHASE", sqlType: "sqlTypeNVarchar", length: 4000, domain: null, defaultValue: null }, { name: "HAS_PRELIMINARY_ENGINEER_PHASE", type: "esriFieldTypeString", alias: "HAS_PRELIMINARY_ENGINEER_PHASE", sqlType: "sqlTypeNVarchar", length: 4000, domain: null, defaultValue: null }, { name: "HAS_PLAN_RESEARCH_ADMIN_PHASE", type: "esriFieldTypeString", alias: "HAS_PLAN_RESEARCH_ADMIN_PHASE", sqlType: "sqlTypeNVarchar", length: 4000, domain: null, defaultValue: null }, { name: "HAS_RIGHT_OF_WAY_PHASE", type: "esriFieldTypeString", alias: "HAS_RIGHT_OF_WAY_PHASE", sqlType: "sqlTypeNVarchar", length: 4000, domain: null, defaultValue: null }, { name: "HAS_STUDY_PHASE", type: "esriFieldTypeString", alias: "HAS_STUDY_PHASE", sqlType: "sqlTypeNVarchar", length: 4000, domain: null, defaultValue: null }, { name: "HAS_UTILITY_PHASE", type: "esriFieldTypeString", alias: "HAS_UTILITY_PHASE", sqlType: "sqlTypeNVarchar", length: 4000, domain: null, defaultValue: null }, { name: "CTY_CODE", type: "esriFieldTypeSmallInteger", alias: "CTY_CODE", sqlType: "sqlTypeSmallInt", domain: null, defaultValue: null }, { name: "ST_RT_NO", type: "esriFieldTypeSmallInteger", alias: "ST_RT_NO", sqlType: "sqlTypeSmallInt", domain: null, defaultValue: null }, { name: "JURIS", type: "esriFieldTypeSmallInteger", alias: "JURIS", sqlType: "sqlTypeSmallInt", domain: null, defaultValue: null }, { name: "DISTRICT_NO", type: "esriFieldTypeSmallInteger", alias: "DISTRICT_NO", sqlType: "sqlTypeSmallInt", domain: null, defaultValue: null }, { name: "SEG_BGN", type: "esriFieldTypeSmallInteger", alias: "SEG_BGN", sqlType: "sqlTypeSmallInt", domain: null, defaultValue: null }, { name: "OFFSET_BGN", type: "esriFieldTypeSmallInteger", alias: "OFFSET_BGN", sqlType: "sqlTypeSmallInt", domain: null, defaultValue: null }, { name: "SEG_END", type: "esriFieldTypeSmallInteger", alias: "SEG_END", sqlType: "sqlTypeSmallInt", domain: null, defaultValue: null }, { name: "OFFSET_END", type: "esriFieldTypeSmallInteger", alias: "OFFSET_END", sqlType: "sqlTypeSmallInt", domain: null, defaultValue: null }, { name: "SEG_PT_BGN", type: "esriFieldTypeInteger", alias: "SEG_PT_BGN", sqlType: "sqlTypeInteger", domain: null, defaultValue: null }, { name: "SEG_PT_END", type: "esriFieldTypeInteger", alias: "SEG_PT_END", sqlType: "sqlTypeInteger", domain: null, defaultValue: null }, { name: "SEG_LNGTH_FEET", type: "esriFieldTypeInteger", alias: "SEG_LNGTH_FEET", sqlType: "sqlTypeInteger", domain: null, defaultValue: null }, { name: "NLF_ID", type: "esriFieldTypeInteger", alias: "NLF_ID", sqlType: "sqlTypeInteger", domain: null, defaultValue: null }, { name: "SIDE_IND", type: "esriFieldTypeSmallInteger", alias: "SIDE_IND", sqlType: "sqlTypeSmallInt", domain: null, defaultValue: null }, { name: "NLF_CNTL_BGN", type: "esriFieldTypeInteger", alias: "NLF_CNTL_BGN", sqlType: "sqlTypeInteger", domain: null, defaultValue: null }, { name: "NLF_CNTL_END", type: "esriFieldTypeInteger", alias: "NLF_CNTL_END", sqlType: "sqlTypeInteger", domain: null, defaultValue: null }, { name: "CUM_OFFSET_BGN", type: "esriFieldTypeInteger", alias: "CUM_OFFSET_BGN", sqlType: "sqlTypeInteger", domain: null, defaultValue: null }, { name: "CUM_OFFSET_END", type: "esriFieldTypeInteger", alias: "CUM_OFFSET_END", sqlType: "sqlTypeInteger", domain: null, defaultValue: null }, { name: "COUNTY_MUNICIPALITY_CODES", type: "esriFieldTypeString", alias: "COUNTY_MUNICIPALITY_CODES", sqlType: "sqlTypeNVarchar", length: 4000, domain: null, defaultValue: null }, { name: "MUNICIPALITY_CODES", type: "esriFieldTypeString", alias: "MUNICIPALITY_CODES", sqlType: "sqlTypeNVarchar", length: 4000, domain: null, defaultValue: null }, { name: "MUNICIPALITY_NAMES", type: "esriFieldTypeString", alias: "MUNICIPALITY_NAMES", sqlType: "sqlTypeNVarchar", length: 4000, domain: null, defaultValue: null }, { name: "HOUSE_DISTRICTS", type: "esriFieldTypeString", alias: "HOUSE_DISTRICTS", sqlType: "sqlTypeNVarchar", length: 4000, domain: null, defaultValue: null }, { name: "SENATE_DISTRICTS", type: "esriFieldTypeString", alias: "SENATE_DISTRICTS", sqlType: "sqlTypeNVarchar", length: 4000, domain: null, defaultValue: null }, { name: "CONGRESS_DISTRICTS", type: "esriFieldTypeString", alias: "CONGRESS_DISTRICTS", sqlType: "sqlTypeNVarchar", length: 4000, domain: null, defaultValue: null }, { name: "HOUSE_LEGISLATOR_NAMES", type: "esriFieldTypeString", alias: "HOUSE_LEGISLATOR_NAMES", sqlType: "sqlTypeNVarchar", length: 4000, domain: null, defaultValue: null }, { name: "SENATE_LEGISLATOR_NAMES", type: "esriFieldTypeString", alias: "SENATE_LEGISLATOR_NAMES", sqlType: "sqlTypeNVarchar", length: 4000, domain: null, defaultValue: null }, { name: "CONGRESS_LEGISLATOR_NAMES", type: "esriFieldTypeString", alias: "CONGRESS_LEGISLATOR_NAMES", sqlType: "sqlTypeNVarchar", length: 4000, domain: null, defaultValue: null }, { name: "COUNTY_NAME", type: "esriFieldTypeString", alias: "COUNTY_NAME", sqlType: "sqlTypeNVarchar", length: 4000, domain: null, defaultValue: null }, { name: "STREET_NAME", type: "esriFieldTypeString", alias: "STREET_NAME", sqlType: "sqlTypeNVarchar", length: 4000, domain: null, defaultValue: null }, { name: "BRIDGE_WORK_FLAG", type: "esriFieldTypeString", alias: "BRIDGE_WORK_FLAG", sqlType: "sqlTypeNVarchar", length: 4000, domain: null, defaultValue: null }, { name: "RECORD_UPDATE", type: "esriFieldTypeInteger", alias: "RECORD_UPDATE", sqlType: "sqlTypeInteger", domain: null, defaultValue: null }, { name: "CREATED_DATE", type: "esriFieldTypeDate", alias: "CREATED_DATE", sqlType: "sqlTypeTimestamp2", length: 8, domain: null, defaultValue: null }, { name: "LAST_EDITED_DATE", type: "esriFieldTypeDate", alias: "LAST_EDITED_DATE", sqlType: "sqlTypeTimestamp2", length: 8, domain: null, defaultValue: null }, { name: "GEOM_LENGTH_FT", type: "esriFieldTypeInteger", alias: "GEOM_LENGTH_FT", sqlType: "sqlTypeInteger", domain: null, defaultValue: null }, { name: "GEOMETRY_TYPE", type: "esriFieldTypeString", alias: "GEOMETRY_TYPE", sqlType: "sqlTypeNVarchar", length: 4000, domain: null, defaultValue: null }, { name: "BRIDGE_WORK_LOCATION_FLAG", type: "esriFieldTypeString", alias: "BRIDGE_WORK_LOCATION_FLAG", sqlType: "sqlTypeNVarchar", length: 4000, domain: null, defaultValue: null }, { name: "PUBLIC_NARRATIVE", type: "esriFieldTypeString", alias: "PUBLIC_NARRATIVE", sqlType: "sqlTypeNVarchar", length: 4000, domain: null, defaultValue: null }, { name: "GIS_UPDATE_DATE", type: "esriFieldTypeDate", alias: "GIS_UPDATE_DATE", sqlType: "sqlTypeTimestamp2", length: 8, domain: null, defaultValue: null }, { name: "GIS_GEOMETRY_UPDATE_DATE", type: "esriFieldTypeDate", alias: "GIS_GEOMETRY_UPDATE_DATE", sqlType: "sqlTypeTimestamp2", length: 8, domain: null, defaultValue: null }, { name: "SE_ANNO_CAD_DATA", type: "esriFieldTypeString", alias: "SE_ANNO_CAD_DATA", sqlType: "sqlTypeNVarchar", length: 4000, domain: null, defaultValue: null }, { name: "GPID", type: "esriFieldTypeInteger", alias: "GPID", sqlType: "sqlTypeInteger", domain: null, defaultValue: null }, { name: "GlobalID", type: "esriFieldTypeGlobalID", alias: "GlobalID", sqlType: "sqlTypeOther", length: 38, domain: null }], features: [{ attributes: { OBJECTID: 1320, GISDATAPROJECT_LOCATION_DETAIL_: 974725878, PROJECT_ID: 102572, PROJECT_TITLE: "High Friction Surfaces(F)", PROJECT_STATUS: "CAND", PROJECT_CLASS: "SAFE", PROJECT_CLASS_NAME: "Safety Improvement", PROJECT_IMPROVEMENT_DESC: "Installing high friction surfaces on top of existing roadway to decrease the number of crashes along high crash roadway curves", PROJECT_SHORT_NARRATIVE: "High Friction Surfaces  Various high-crash roadway curves in D6-0  Treatmnt to reduce crashes on rdwy curves", IMPROVEMENT_TYPE: "Surface Treatment", IMPROVEMENT_CODE: 37, IMPROVEMENT_SHORT_DESC: "Surface Treatment", TYP_FRST_APR_DT: 1399939200000, MAJOR_PROJECT_FLAG: "N", TRANSPORT_MODE: "H", PLANNING_PARTNER_SHORT_NAME: "DVRPC", RESPONSIBLE_DISTRICT_NO: 6, PRIMARY_ST_RT_NO: 3033, DISTRICT_SECTION_ID: "HFS", PRIMARY_LOCAL_ROAD_NUMBER: 0, PROJECT_TOTAL_LENGTH: 6.77, LOCAL_PROJECT_FLAG: "N", LET_RESPONSIBLE_AGENCY: null, GEOGRAPHIC_DESCRIPTION: "Various high-crash roadway curves in District 6-0", PROJECT_STATE_CODE: "CAND", PROJECT_STATUS_CODE_DESC: "Candidate", CODE_ID: 43, POTENTIAL_COMMITTED_DATE_FLAG: null, POTENTIAL_COMMITTED_YEAR: null, POTENTIAL_COMMITTED_DATE: "6/12/2014 12:00:00 AM", EST_CONSTR_PHASE_COST_AMOUNT: 2445000, TYP_FLAG: "N", TIP_FLAG: "N", STIP_FLAG: "N", DECADE_OF_INVESTMENT_FLAG: "N", TIP_PROPOSED_FLAG: "N", TYP_PROPOSED_FLAG: "N", OBLIGATION_PLAN_FLAG: "Y", LET_FLAG: "A", LET_DATE: "20140703", LET_DATE_DISPLAY: "7/3/2014 12:00:00 AM", OPEN_FLAG: null, OPEN_DATE: null, NTP_FLAG: "A", NTP_DATE: 20140818, COMPLETION_FLAG: "A", COMPLETION_DATE: "20151007", FISCALLY_READY: null, FISCAL_DATE: null, PHYSICALLY_READY: null, PHYSICAL_DATE: null, PROJECT_MANAGER_CONTACT_NAME: "George Dunheimer ADE CONSTR", PROJECT_MANAGER_PHONE: "6102056680", PROJECT_MANAGER_EMAIL: "gdunheimer@pa.gov", UNDER_CONSTRUCTION: "N", COMPLETED: "Y", FUTURE_DEVELOPMENT: "N", IN_DEVELOPMENT: "N", PROJECT_STAGE: "COMPLETED", PROJECT_CREATION_DATE: 1397779200000, CAPITAL_BUDGET_YEAR: null, CAPTIAL_BUDGET_REQUIRED_FLAG: "Y", CAPITAL_BUDGET_APPROVED_FLAG: "N", PLANNING_PARTNER_NAME: "Delaware Valley Regional Planning Commission MPO                           ", RESPONSIBLE_DISTRICT_NAME: "District 6-0                  ", RESPONSIBLE_COUNTY_CODE: 15, RESPONSIBLE_COUNTY_NAME: "Chester       ", PROJECT_SPONSOR_NAME: "PennDOT", SD_BRIDGE_WORK_FLAG: "N", OPEN_TO_TRAFFIC_DATE: null, ORIGINAL_CONTRACT_AMOUNT: null, CURRENT_CONTRACT_AMOUNT: null, ESTIMATED_LET_DATE: "7/3/2014 12:00:00 AM", DOI_DATE: null, DOI_ID: null, PRIMARY_PROJECT_ID: 102572, PRIMARY_CONTRACT_AMOUNT: null, PRIMARY_PROJECT_FLAG: "Y", HAS_CONSTRUCTION_PHASE: "T", HAS_FINAL_DESIGN_PHASE: "F", HAS_PRELIMINARY_ENGINEER_PHASE: "F", HAS_PLAN_RESEARCH_ADMIN_PHASE: "F", HAS_RIGHT_OF_WAY_PHASE: "F", HAS_STUDY_PHASE: "F", HAS_UTILITY_PHASE: "F", CTY_CODE: 67, ST_RT_NO: 8009, JURIS: 1, DISTRICT_NO: 6, SEG_BGN: 250, OFFSET_BGN: 0, SEG_END: 250, OFFSET_END: 2890, SEG_PT_BGN: 2500000, SEG_PT_END: 2502890, SEG_LNGTH_FEET: 2890, NLF_ID: 39099, SIDE_IND: 1, NLF_CNTL_BGN: 0, NLF_CNTL_END: 2890, CUM_OFFSET_BGN: 6590, CUM_OFFSET_END: 9480, COUNTY_MUNICIPALITY_CODES: "67301", MUNICIPALITY_CODES: "301", MUNICIPALITY_NAMES: "PHILADELPHIA ", HOUSE_DISTRICTS: "175", SENATE_DISTRICTS: "1", CONGRESS_DISTRICTS: "2/3/2022 12:00:00 AM", HOUSE_LEGISLATOR_NAMES: "Marylouise Isaacson, (D)", SENATE_LEGISLATOR_NAMES: "Nikil Saval, (D)", CONGRESS_LEGISLATOR_NAMES: "Brendan F. Boyle (D), Dwight Evans (D)", COUNTY_NAME: "PHILADELPHIA", STREET_NAME: null, BRIDGE_WORK_FLAG: "N", RECORD_UPDATE: 20210529, CREATED_DATE: 1557728835000, LAST_EDITED_DATE: 1622273589000, GEOM_LENGTH_FT: 4960, GEOMETRY_TYPE: "POINT", BRIDGE_WORK_LOCATION_FLAG: "N", PUBLIC_NARRATIVE: "High Friction Surfaces\r\nVarious high-crash roadway curves in D6-0\r\nTreatmnt to reduce crashes on rdwy curves", GIS_UPDATE_DATE: 1603171861000, GIS_GEOMETRY_UPDATE_DATE: 1636117557000, SE_ANNO_CAD_DATA: null, GPID: 974725878, GlobalID: "88c9a006-4af4-47eb-bea6-553a61306cee" } }] };

  // Geometry features
  public static phillySimplePolyQueryJson = {
    objectIdFieldName: "FID", uniqueIdField: { name: "FID", isSystemMaintained: true }, globalIdFieldName: "GlobalID", geometryProperties: { shapeAreaFieldName: "Shape__Area", shapeLengthFieldName: "Shape__Length", units: "esriMeters" }, serverGens: { minServerGen: 617069, serverGen: 701173 }, geometryType: "esriGeometryPolygon", spatialReference: { wkid: 102100, latestWkid: 3857 }, transform: { originPosition: "upperLeft", scale: [1.1943285667766759, 1.1943285667766759], translate: [-8366491.366817627, 4858337.5171295125] }, fields: [], features: [{ attributes: {}, geometry: { rings: [[[274, 472], [-3, 18], [-16, -3], [3, -17], [0, -1], [16, 3]]] } }],
  };

  public static phillySimplePolyQueryPbf = {
    version: "", queryResult: { featureResult: { objectIdFieldName: "FID", uniqueIdField: { name: "FID", isSystemMaintained: true }, globalIdFieldName: "GlobalID", geohashFieldName: "", geometryProperties: { shapeAreaFieldName: "Shape__Area", shapeLengthFieldName: "Shape__Length", units: "esriMeters" }, serverGens: { minServerGen: 617069, serverGen: 701173 }, geometryType: 3, spatialReference: { wkid: 102100, lastestWkid: 3857, vcsWkid: 0, latestVcsWkid: 0, wkt: "" }, exceededTransferLimit: false, hasZ: false, hasM: false, transform: { quantizeOriginPostion: 0, scale: { xScale: 1.1943285667766759, yScale: 1.1943285667766759, mScale: 0, zScale: 0 }, translate: { xTranslate: -8366491.366817627, yTranslate: 4858337.5171295125, mTranslate: 0, zTranslate: 0 } }, fields: [], values: [], features: [{ attributes: [], geometry: { lengths: [6], coords: [274, 472, -3, 18, -16, -3, 3, -17, 0, -1, 16, 3] } }] } },
  };

  public static phillyDoubleRingPolyQueryJson = {
    objectIdFieldName: "FID", uniqueIdField: { name: "FID", isSystemMaintained: true }, globalIdFieldName: "GlobalID", geometryProperties: { shapeAreaFieldName: "Shape__Area", shapeLengthFieldName: "Shape__Length", units: "esriMeters" }, serverGens: { minServerGen: 617069, serverGen: 701173 }, geometryType: "esriGeometryPolygon", spatialReference: { wkid: 102100, latestWkid: 3857 }, transform: { originPosition: "upperLeft", scale: [0.5971642833956139, 0.5971642833956139], translate: [-8365879.870591431, 4857726.020903323] }, fields: [], features: [{ attributes: {}, geometry: { rings: [[[398, 127], [-7, -1], [-18, -3], [-7, -1], [0, -3], [-12, -2], [1, -5], [1, -6], [-18, -3], [-1, 0], [0, -1], [3, -15], [21, 3], [6, -39], [10, 2], [3, 0], [61, 11], [-1, 6], [-8, 43], [-1, 6], [-19, -4], [-2, 12], [-12, -2], [0, 2]], [[417, 109], [3, -16], [-21, -3], [-2, 15], [16, 3], [4, 1]]] } }],
  };

  public static phillyDoubleRingPolyQueryPbf = {
    version: "", queryResult: { featureResult: { objectIdFieldName: "FID", uniqueIdField: { name: "FID", isSystemMaintained: true }, globalIdFieldName: "GlobalID", geohashFieldName: "", geometryProperties: { shapeAreaFieldName: "Shape__Area", shapeLengthFieldName: "Shape__Length", units: "esriMeters" }, serverGens: { minServerGen: 617069, serverGen: 701173 }, geometryType: 3, spatialReference: { wkid: 102100, lastestWkid: 3857, vcsWkid: 0, latestVcsWkid: 0, wkt: "" }, exceededTransferLimit: false, hasZ: false, hasM: false, transform: { quantizeOriginPostion: 0, scale: { xScale: 0.5971642833956139, yScale: 0.5971642833956139, mScale: 0, zScale: 0 }, translate: { xTranslate: -8365879.870591431, yTranslate: 4857726.020903323, mTranslate: 0, zTranslate: 0 } }, fields: [], values: [], features: [{ attributes: [], geometry: { lengths: [24, 6], coords: [398, 127, -7, -1, -18, -3, -7, -1, 0, -3, -12, -2, 1, -5, 1, -6, -18, -3, -1, 0, 0, -1, 3, -15, 21, 3, 6, -39, 10, 2, 3, 0, 61, 11, -1, 6, -8, 43, -1, 6, -19, -4, -2, 12, -12, -2, 0, 2, 417, 109, 3, -16, -21, -3, -2, 15, 16, 3, 4, 1] } }] } },
  };

  public static phillySimplePathQueryPbf = {
    version: "", queryResult: { featureResult: { objectIdFieldName: "OBJECTID", uniqueIdField: { name: "OBJECTID", isSystemMaintained: true }, globalIdFieldName: "GlobalID", geohashFieldName: "", geometryProperties: { shapeAreaFieldName: "", shapeLengthFieldName: "Shape__Length_2", units: "esriMeters" }, serverGens: { minServerGen: 617022, serverGen: 701134 }, geometryType: 2, spatialReference: { wkid: 102100, lastestWkid: 3857, vcsWkid: 0, latestVcsWkid: 0, wkt: "" }, exceededTransferLimit: false, hasZ: false, hasM: false, transform: { quantizeOriginPostion: 0, scale: { xScale: 19.10925706863054, yScale: 19.10925706863054, mScale: 0, zScale: 0 }, translate: { xTranslate: -8365268.374365235, yTranslate: 4872401.930332029, mTranslate: 0, zTranslate: 0 } }, fields: [], values: [], features: [{ attributes: [], geometry: { lengths: [24], coords: [360, 491, -2, -1, -1, 0, -1, 0, -1, 0, -1, 1, -4, 1, -10, 2, -15, 3, -1, 0, -1, 0, -2, 0, -1, 0, -1, 0, -1, -1, -1, 0, -2, -1, 0, -1, -1, 0, -1, 0, -1, 0, -1, 0, -1, 0, -1, 0] } }] } },
  };

  public static phillySimplePathQueryJson = {
    objectIdFieldName: "OBJECTID", uniqueIdField: { name: "OBJECTID", isSystemMaintained: true }, globalIdFieldName: "GlobalID", geometryProperties: { shapeLengthFieldName: "Shape__Length_2", units: "esriMeters" }, serverGens: { minServerGen: 617022, serverGen: 701134 }, geometryType: "esriGeometryPolyline", spatialReference: { wkid: 102100, latestWkid: 3857 }, transform: { originPosition: "upperLeft", scale: [19.10925706863054, 19.10925706863054], translate: [-8365268.374365235, 4872401.930332029] }, fields: [], features: [{ attributes: {}, geometry: { paths: [[[360, 491], [-2, -1], [-1, 0], [-1, 0], [-1, 0], [-1, 1], [-4, 1], [-10, 2], [-15, 3], [-1, 0], [-1, 0], [-2, 0], [-1, 0], [-1, 0], [-1, -1], [-1, 0], [-2, -1], [0, -1], [-1, 0], [-1, 0], [-1, 0], [-1, 0], [-1, 0], [-1, 0]]] } }],
  };

  public static phillyMultiPathQueryPbf = {
    version: "", queryResult: { featureResult: { objectIdFieldName: "OBJECTID", uniqueIdField: { name: "OBJECTID", isSystemMaintained: true }, globalIdFieldName: "GlobalID", geohashFieldName: "", geometryProperties: { shapeAreaFieldName: "", shapeLengthFieldName: "Shape__Length_2", units: "esriMeters" }, serverGens: { minServerGen: 617022, serverGen: 701134 }, geometryType: 2, spatialReference: { wkid: 102100, lastestWkid: 3857, vcsWkid: 0, latestVcsWkid: 0, wkt: "" }, exceededTransferLimit: false, hasZ: false, hasM: false, transform: { quantizeOriginPostion: 0, scale: { xScale: 19.10925706863054, yScale: 19.10925706863054, mScale: 0, zScale: 0 }, translate: { xTranslate: -8365268.374365235, yTranslate: 4872401.930332029, mTranslate: 0, zTranslate: 0 } }, fields: [], values: [], features: [{ attributes: [], geometry: { lengths: [22, 2], coords: [360, 491, -2, -1, -1, 0, -1, 0, -1, 0, -1, 1, -4, 1, -10, 2, -15, 3, -1, 0, -1, 0, -2, 0, -1, 0, -1, 0, -1, -1, -1, 0, -2, -1, 0, -1, -1, 0, -1, 0, -1, 0, -1, 0, -1, 0, -1, 0] } }] } },
  };

  public static phillyMultiPathQueryJson = {
    objectIdFieldName: "OBJECTID", uniqueIdField: { name: "OBJECTID", isSystemMaintained: true }, globalIdFieldName: "GlobalID", geometryProperties: { shapeLengthFieldName: "Shape__Length_2", units: "esriMeters" }, serverGens: { minServerGen: 617022, serverGen: 701134 }, geometryType: "esriGeometryPolyline", spatialReference: { wkid: 102100, latestWkid: 3857 }, transform: { originPosition: "upperLeft", scale: [19.10925706863054, 19.10925706863054], translate: [-8365268.374365235, 4872401.930332029] }, fields: [], features: [{ attributes: {}, geometry: { paths: [[[360, 491], [-2, -1], [-1, 0], [-1, 0], [-1, 0], [-1, 1], [-4, 1], [-10, 2], [-15, 3], [-1, 0], [-1, 0], [-2, 0], [-1, 0], [-1, 0], [-1, -1], [-1, 0], [-2, -1], [0, -1], [-1, 0], [-1, 0], [-1, 0], [-1, 0]], [[-1, 0], [-1, 0]]] } }],
  };

  public static phillySimplePointQueryPbf = {
    version: "", queryResult: { featureResult: { objectIdFieldName: "OBJECTID", uniqueIdField: { name: "OBJECTID", isSystemMaintained: true }, globalIdFieldName: "GlobalID", geohashFieldName: "", serverGens: { minServerGen: 617056, serverGen: 701159 }, geometryType: 0, spatialReference: { wkid: 102100, lastestWkid: 3857, vcsWkid: 0, latestVcsWkid: 0, wkt: "" }, exceededTransferLimit: false, hasZ: false, hasM: false, transform: { quantizeOriginPostion: 0, scale: { xScale: 4.777314267153997, yScale: 4.777314267153997, mScale: 0, zScale: 0 }, translate: { xTranslate: -8365268.374365235, yTranslate: 4860172.005808106, mTranslate: 0, zTranslate: 0 } }, fields: [], values: [], features: [{ attributes: [], geometry: { lengths: [], coords: [88, 488] } }] } },
  };

  public static phillyExceededTransferLimitPbf = {
    version: "", queryResult: { featureResult: { objectIdFieldName: "OBJECTID", uniqueIdField: { name: "OBJECTID", isSystemMaintained: true }, globalIdFieldName: "GlobalID", geohashFieldName: "", serverGens: { minServerGen: 617056, serverGen: 701159 }, geometryType: 0, spatialReference: { wkid: 102100, lastestWkid: 3857, vcsWkid: 0, latestVcsWkid: 0, wkt: "" }, exceededTransferLimit: true, hasZ: false, hasM: false, transform: { quantizeOriginPostion: 0, scale: { xScale: 4.777314267153997, yScale: 4.777314267153997, mScale: 0, zScale: 0 }, translate: { xTranslate: -8365268.374365235, yTranslate: 4860172.005808106, mTranslate: 0, zTranslate: 0 } }, fields: [], values: [], features: [{ attributes: [], geometry: { lengths: [], coords: [88, 488] } }] } },
  };

  public static phillySimplePointQueryJson = {
    objectIdFieldName: "OBJECTID", uniqueIdField: { name: "OBJECTID", isSystemMaintained: true }, globalIdFieldName: "GlobalID", serverGens: { minServerGen: 617056, serverGen: 701159 }, geometryType: "esriGeometryPoint", spatialReference: { wkid: 102100, latestWkid: 3857 }, transform: { originPosition: "upperLeft", scale: [4.777314267153997, 4.777314267153997], translate: [-8365268.374365235, 4860172.005808106] }, fields: [], features: [{ attributes: {}, geometry: { x: 88, y: 488 } }],
  };

  // Drawing infos
  public static phillySimplePolyDrawingInfo = {
    drawingInfo: { renderer: { type: "simple", symbol: { type: "esriSFS", style: "esriSFSSolid", color: [76, 129, 205, 191], outline: { type: "esriSLS", style: "esriSLSSolid", color: [0, 0, 0, 255], width: 0.75 } } }, transparency: 0, labelingInfo: null },
  };

  public static phillySimpleLineDrawingInfo = {
    drawingInfo: { renderer: { type: "simple", symbol: { type: "esriSLS", style: "esriSLSSolid", color: [165, 83, 183, 255], width: 1 } }, transparency: 0, labelingInfo: null },
  };

  public static phillySimplePointDrawingInfo = {
    drawingInfo: { renderer: { type: "simple", symbol: { type: "esriPMS", url: "RedSphere.png", imageData: "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", contentType: "image/png", width: 15, height: 15 } } },
  };

  public static phillySimpleSMSDrawingInfo = {
    drawingInfo: { renderer: { type: "simple",  symbol: { type: "esriSMS", style: "esriSMSCircle", color: [165, 83, 183, 255], size: 2} } },
  };

  // This is the resulting  serializaed  MapLayerFeatureInfo objects (i.e expected result)
  public static phillyAirportGetFeatureInfoResultRef = [
    {
      layerName: "dummyFeatureLayer",
      subLayerInfos: [
        {
          subLayerName: "SampleLayer",
          displayFieldName: "SampleLayer",
          features: [
            {
              attributes: [
                {
                  value: {
                    valueFormat: 0,
                    value: 7263,
                    displayValue: "7263",
                  },
                  property: {
                    name: "FID",
                    displayLabel: "FID",
                    typename: "integer",
                  },
                },
                {
                  value: {
                    valueFormat: 0,
                    value: 7262,
                    displayValue: "7262",
                  },
                  property: {
                    name: "OBJECTID",
                    displayLabel: "OBJECTID",
                    typename: "integer",
                  },
                },
                {
                  value: {
                    valueFormat: 0,
                    value: "Philadelphia International Airport",
                    displayValue: "Philadelphia International Airport",
                  },
                  property: {
                    name: "NAME",
                    displayLabel: "NAME",
                    typename: "string",
                  },
                },
                {
                  value: {
                    valueFormat: 0,
                    value: "8500 ESSINGTON AVE",
                    displayValue: "8500 ESSINGTON AVE",
                  },
                  property: {
                    name: "ADDRESS",
                    displayLabel: "ADDRESS",
                    typename: "string",
                  },
                },
                {
                  value: {
                    valueFormat: 0,
                    value: "Airport Ground",
                    displayValue: "Airport Ground",
                  },
                  property: {
                    name: "FEAT_TYPE",
                    displayLabel: "FEAT_TYPE",
                    typename: "string",
                  },
                },
                {
                  value: {
                    valueFormat: 0,
                    value: " ",
                    displayValue: " ",
                  },
                  property: {
                    name: "SUB_TYPE",
                    displayLabel: "SUB_TYPE",
                    typename: "string",
                  },
                },
                {
                  value: {
                    valueFormat: 0,
                    value: " ",
                    displayValue: " ",
                  },
                  property: {
                    name: "VANITY_NAM",
                    displayLabel: "VANITY_NAM",
                    typename: "string",
                  },
                },
                {
                  value: {
                    valueFormat: 0,
                    value: " ",
                    displayValue: " ",
                  },
                  property: {
                    name: "SECONDARY_",
                    displayLabel: "SECONDARY_",
                    typename: "string",
                  },
                },
                {
                  value: {
                    valueFormat: 0,
                    value: "N",
                    displayValue: "N",
                  },
                  property: {
                    name: "BLDG",
                    displayLabel: "BLDG",
                    typename: "string",
                  },
                },
                {
                  value: {
                    valueFormat: 0,
                    value: "Philadelphia International Airport",
                    displayValue: "Philadelphia International Airport",
                  },
                  property: {
                    name: "PARENT_NAM",
                    displayLabel: "PARENT_NAM",
                    typename: "string",
                  },
                },
                {
                  value: {
                    valueFormat: 0,
                    value: "Airport Ground",
                    displayValue: "Airport Ground",
                  },
                  property: {
                    name: "PARENT_TYP",
                    displayLabel: "PARENT_TYP",
                    typename: "string",
                  },
                },
                {
                  value: {
                    valueFormat: 0,
                    value: 2138.20481476,
                    displayValue: "2138.20481476",
                  },
                  property: {
                    name: "ACREAGE",
                    displayLabel: "ACREAGE",
                    typename: "double",
                  },
                },
                {
                  value: {
                    valueFormat: 0,
                    value: 2310.1488647,
                    displayValue: "2310.1488647",
                  },
                  property: {
                    name: "PARENT_ACR",
                    displayLabel: "PARENT_ACR",
                    typename: "double",
                  },
                },
                {
                  value: {
                    valueFormat: 0,
                    value: 93139822.3684692,
                    displayValue: "93139822.3684692",
                  },
                  property: {
                    name: "Shape__Are",
                    displayLabel: "Shape__Are",
                    typename: "double",
                  },
                },
                {
                  value: {
                    valueFormat: 0,
                    value: 134658.82110625,
                    displayValue: "134658.82110625",
                  },
                  property: {
                    name: "Shape__Len",
                    displayLabel: "Shape__Len",
                    typename: "double",
                  },
                },
                {
                  value: {
                    valueFormat: 0,
                    value: 14707928.28125,
                    displayValue: "14707928.28125",
                  },
                  property: {
                    name: "Shape__Area",
                    displayLabel: "Shape__Area",
                    typename: "double",
                  },
                },
                {
                  value: {
                    valueFormat: 0,
                    value: 53502.38080783,
                    displayValue: "53502.38080783",
                  },
                  property: {
                    name: "Shape__Length",
                    displayLabel: "Shape__Length",
                    typename: "double",
                  },
                },
                {
                  value: {
                    valueFormat: 0,
                    value: "9ffc895b-64d1-4b42-9577-c16c654d94c7",
                    displayValue: "9ffc895b-64d1-4b42-9577-c16c654d94c7",
                  },
                  property: {
                    name: "GlobalID",
                    displayLabel: "GlobalID",
                    typename: "string",
                  },
                },
              ],
            },
          ],
        },
      ],
    },
  ];
  public static fieldsCoverageGetFeatureInfoResultRef = [
    {
      layerName: "dummyFeatureLayer",
      subLayerInfos: [
        {
          subLayerName: "SampleLayer",
          displayFieldName: "SampleLayer",
          features: [
            {
              attributes: [
                {
                  value: {
                    valueFormat: 0,
                    value: 1,
                    displayValue: "1",
                  },
                  property: {
                    name: "field_SmallInteger",
                    displayLabel: "field_SmallInteger",
                    typename: "integer",
                  },
                },
                {
                  value: {
                    valueFormat: 0,
                    value: 2,
                    displayValue: "2",
                  },
                  property: {
                    name: "field_Integer",
                    displayLabel: "field_Integer",
                    typename: "integer",
                  },
                },
                {
                  value: {
                    valueFormat: 0,
                    value: 3.1,
                    displayValue: "3.1",
                  },
                  property: {
                    name: "field_Single",
                    displayLabel: "field_Single",
                    typename: "float",
                  },
                },
                {
                  value: {
                    valueFormat: 0,
                    value: 4.1,
                    displayValue: "4.1",
                  },
                  property: {
                    name: "field_Double",
                    displayLabel: "field_Double",
                    typename: "double",
                  },
                },
                {
                  value: {
                    valueFormat: 0,
                    value: "field 5",
                    displayValue: "field 5",
                  },
                  property: {
                    name: "field_String",
                    displayLabel: "field_String",
                    typename: "string",
                  },
                },
                {
                  value: {
                    valueFormat: 0,
                    value: new Date("1970-01-01T00:00:00.006Z"),
                    displayValue: "1970-01-01T00:00:00.006Z",
                  },
                  property: {
                    name: "field_Date",
                    displayLabel: "field_Date",
                    typename: "dateTime",
                  },
                },
                {
                  value: {
                    valueFormat: 0,
                    value: undefined,
                    displayValue: "",
                  },
                  property: {
                    name: "field_OID",
                    displayLabel: "field_OID",
                    typename: "number",
                  },
                },
              ],
            },
          ],
        },
      ],
    },
  ];

  public static fieldsCoveragePbufferCollection =
    {
      version: "",
      queryResult:
      {
        featureResult:
        {
          objectIdFieldName: "FID",
          uniqueIdField:
          {
            name: "FID",
            isSystemMaintained: true,
          },
          globalIdFieldName: "GlobalID",
          geohashFieldName: "",
          serverGens:
          {
            minServerGen: 617069,
            serverGen: 698319,
          },
          geometryType: 3,
          spatialReference:
          {
            wkid: 102100,
            lastestWkid: 3857,
            vcsWkid: 0,
            latestVcsWkid: 0,
            wkt: "",
          },
          exceededTransferLimit: false,
          hasZ: false,
          hasM: false,
          transform:
          {
            quantizeOriginPostion: 0,
            scale:
            {
              xScale: 9.554628534318908,
              yScale: 9.554628534318908,
              mScale: 0,
              zScale: 0,
            },
            translate:
            {
              xTranslate: -8379944.283793945,
              yTranslate: 4847942.0812841775,
              mTranslate: 0,
              zTranslate: 0,
            },
          },
          fields: [
            {
              name: "field_SmallInteger",
              fieldType: 0,
              alias: "field_SmallInteger",
              sqlType: 0,
              domain: "",
              defaultValue: "",
            },
            {
              name: "field_Integer",
              fieldType: 1,
              alias: "field_Integer",
              sqlType: 0,
              domain: "",
              defaultValue: "",
            },
            {
              name: "field_Single",
              fieldType: 2,
              alias: "field_Single",
              sqlType: 7,
              domain: "",
              defaultValue: "",
            },
            {
              name: "field_Double",
              fieldType: 3,
              alias: "field_Double",
              sqlType: 6,
              domain: "",
              defaultValue: "",
            },
            {
              name: "field_String",
              fieldType: 4,
              alias: "field_String",
              sqlType: 15,
              domain: "",
              defaultValue: "",
            },
            {
              name: "field_Date",
              fieldType: 5,
              alias: "field_Date",
              sqlType: 4,
              domain: "",
              defaultValue: "",
            },
            {
              name: "field_OID",
              fieldType: 6,
              alias: "field_OID",
              sqlType: 0,
              domain: "",
              defaultValue: "",
            },
            {
              name: "field_Geometry",
              fieldType: 7,
              alias: "field_Geometry",
              sqlType: 8,
              domain: "",
              defaultValue: "",
            },
            {
              name: "field_Raster",
              fieldType: 8,
              alias: "field_Raster",
              sqlType: 0,
              domain: "",
              defaultValue: "",
            },
            {
              name: "field9",
              fieldType: 0,
              alias: "field9",
              sqlType: 0,
              domain: "",
              defaultValue: "",
            },
          ],
          values: [],
          features: [
            {
              attributes: [
                {
                  sint_value: 1,
                },
                {
                  int64_value: 2,
                },
                {
                  float_value: 3.1,
                },
                {
                  double_value: 4.1,
                },
                {
                  string_value: "field 5",
                },
                {
                  uint_value: 6,
                },
                {
                  bool_value: true,
                },
                {
                  uint64_value: 8,
                },
                {
                  sint64_value: 9,
                },
              ],
            },
          ],
        },
      },
    };

  public static polygonDrawingInfo = { drawingInfo: { renderer: { type: "simple", symbol: { type: "esriSFS", style: "esriSFSSolid", color: [76, 129, 205, 191], outline: { type: "esriSLS", style: "esriSLSSolid", color: [0, 0, 0, 255], width: 0.75 } } }, transparency: 0, labelingInfo: null } };
  public static lineDrawingInfo = { drawingInfo: { renderer: { type: "simple", symbol: { type: "esriSLS", style: "esriSLSSolid", color: [165, 83, 183, 255], width: 1 } }, transparency: 0, labelingInfo: null } };
  public static pointDrawingInfo = { drawingInfo: { renderer: { type: "simple", symbol: { type: "esriPMS", url: "RedSphere.png", imageData: "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", contentType: "image/png", width: 15, height: 15 } } } };

}

