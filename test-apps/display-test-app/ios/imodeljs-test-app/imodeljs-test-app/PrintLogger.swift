/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/

import Foundation

// NOTE: This file is largely based on PrintLogger.swift in iTwin/mobile-samples.

class PrintLogger {
    public enum Severity: String {
        case fatal
        case error
        case warning
        case info
        case debug
        case trace

        public init?(_ value: String?) {
            guard var lowercaseValue = value?.lowercased() else {
                return nil
            }
            switch lowercaseValue {
            case "log":
                lowercaseValue = "debug"
            case "assert":
                lowercaseValue = "fatal"
            case "warn":
                lowercaseValue = "warning"
            default:
                break
            }
            if let result = Severity(rawValue: lowercaseValue) {
                self = result
            } else {
                return nil
            }
        }

        public var description: String { return rawValue.uppercased() }
    }

    func log(_ severity: Severity?, _ logMessage: String) {
        let dateFmt = DateFormatter()
        dateFmt.dateFormat = "yyyy-MM-dd HH:mm:ss.SSS"
        print("\(dateFmt.string(from: Date())): \(severity?.description ?? "<UNKNOWN>") \(logMessage)")
    }
}
