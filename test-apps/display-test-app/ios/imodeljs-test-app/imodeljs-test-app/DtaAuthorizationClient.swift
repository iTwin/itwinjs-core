/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/

import IModelJsNative

// NOTE: This file is largely based on ITMAuthorizationClient.swift in iTwin/mobile-sdk-ios.

// MARK: - DtaAuthorizationClient protocol

/// Protocol that extends `AuthorizationClient` with convenience functionality. A default extension to this protocol implements both of the provided functions.
public protocol DtaAuthorizationClient: AuthorizationClient {
    /// The default domain to use in the ``error(domain:code:reason:)-7jgxz`` function.
    var errorDomain: String { get }

    /// Creates and returns an NSError object with the specified settings.
    /// - Parameters:
    ///   - domain: The domain to use for the NSError, default to nil, which uses the value from ``errorDomain``.
    ///   - code: The code to use for the NSError, defaults 200.
    ///   - reason: The reason to use for the NSError's NSLocalizedFailureReasonErrorKey userInfo value
    /// - Returns: An NSError object with the specified values.
    func error(domain: String?, code: Int, reason: String) -> NSError
    /// Call the `onAccessTokenChanged` callback from `AuthorizationClient`, if that callback is set.
    /// - Note: This also calls `getAccessToken` to get the current token and expirationDate in order to call `onAccessTokenChanged`.
    func raiseOnAccessTokenChanged()
}

// MARK: - DtaAuthorizationClient extension with default implementations

/// Extension that provides default implementation for the functions in the `DtaAuthorizationClient` protocol.
public extension DtaAuthorizationClient {
    /// Creates and returns an NSError object with the specified settings. Provides a default value `nil` for `domain` and a default value of `200` for `code`. The `nil` default value for domain causes it to use the value stored in ``errorDomain``.
    /// - Parameters:
    ///   - domain: The domain to use for the NSError, default to nil, which uses the value from ``errorDomain``.
    ///   - code: The code to use for the NSError, defaults 200.
    ///   - reason: The reason to use for the NSError's NSLocalizedFailureReasonErrorKey userInfo value
    /// - Returns: An NSError object with the specified values.
    func error(domain: String? = nil, code: Int = 200, reason: String) -> NSError {
        return NSError(domain: domain ?? errorDomain, code: code, userInfo: [NSLocalizedFailureReasonErrorKey: reason])
    }

    /// Calls the onAccessTokenChanged callback, if that callback is set.
    func raiseOnAccessTokenChanged() {
        if let onAccessTokenChanged = onAccessTokenChanged {
            self.getAccessToken() { token, expirationDate, error in
                if let token = token,
                   let expirationDate = expirationDate {
                    onAccessTokenChanged(token, expirationDate)
                } else {
                    onAccessTokenChanged(nil, nil)
                }
            }
        }
    }
}
