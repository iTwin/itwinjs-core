/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/

import UIKit
import IModelJsNative
import AppAuth
#if SWIFT_PACKAGE
import AppAuthCore
#endif

// NOTE: This file is largely based on ITMOIDCAuthorizationClient.swift in iTwin/mobile-sdk-ios.

// MARK: - Helpers

/// A struct to hold the settings used by DtaOidcAuthorizationClient
struct DtaOidcAuthSettings {
    var issuerUrl: String
    var clientId: String
    var redirectUrl: String
    var scope: String
}

typealias DtaOidcAuthorizationClientCallback = (Error?) -> ()

// MARK: - DtaOidcAuthorizationClient class

/// An implementation of the AuthorizationClient protocol that uses the AppAuth library to prompt the user.
class DtaOidcAuthorizationClient: NSObject, DtaAuthorizationClient, OIDAuthStateChangeDelegate, OIDAuthStateErrorDelegate {
    /// Instance for `onAccessTokenChanged` property from the `AuthorizationClient` protocol.
    public var onAccessTokenChanged: AccessTokenChangedCallback?
    /// Instance for `errorDomain` property from the `DtaAuthorizationClient` protocol.
    public let errorDomain = "com.bentley.display-test-app"

    let logger = PrintLogger()
    /// The AuthSettings object from imodeljs.
    var authSettings: DtaOidcAuthSettings?
    /// The OIDAuthState from the AppAuth library
    var authState: OIDAuthState? {
        willSet {
            authState?.stateChangeDelegate = nil
            authState?.errorDelegate = nil
            newValue?.stateChangeDelegate = self
            newValue?.errorDelegate = self
        }
    }
    /// The user info from the auth server.
    var userInfo: NSDictionary?
    /// The service configuration from the issuer URL.
    var serviceConfig: OIDServiceConfiguration?
    private var currentAuthorizationFlow: OIDExternalUserAgentSession?

    /// Initializes and returns a newly allocated authorization client object with the specified view controller.
    /// - Parameter configData: A JSON object containing at least an `IMJS_OIDC_CLIENT_ID` value, and optionally `IMJS_OIDC_ISSUER_URL`, `IMJS_OIDC_REDIRECT_URI`, and/or `IMJS_OIDC_SCOPE` values. If `IMJS_OIDC_CLIENT_ID` is not present this initializer will fail.
    init?(configData: JSON) {
        super.init()
        let issuerUrl = configData["IMJS_OIDC_ISSUER_URL"] as? String ?? "https://ims.bentley.com/"
        let clientId = configData["IMJS_OIDC_CLIENT_ID"] as? String ?? ""
        let redirectUrl = configData["IMJS_OIDC_REDIRECT_URI"] as? String ?? "imodeljs://app/signin-callback"
        let scope = configData["IMJS_OIDC_SCOPE"] as? String ?? "email openid profile organization itwinjs"
        authSettings = DtaOidcAuthSettings(issuerUrl: issuerUrl, clientId: clientId, redirectUrl: redirectUrl, scope: scope)
        
        if checkSettings() != nil {
            return nil
        }
        loadState()
    }

    /// Creates a mutable dictionary populated with the common keys and values needed for every keychain query.
    /// - Returns: An NSMutableDictionary with the common query items, or nil if issuerUrl and clientId are not set in authSettings.
    func commonKeychainQuery() -> NSMutableDictionary? {
        guard let issuerUrl = authSettings?.issuerUrl,
              let clientId = authSettings?.clientId else {
            return nil
        }
        return (([
            kSecClass as String: kSecClassGenericPassword,
            kSecAttrService as String: "DtaOidcAuthorizationClient",
            kSecAttrAccount as String: "\(issuerUrl)@\(clientId)",
        ] as NSDictionary).mutableCopy() as! NSMutableDictionary)
    }
    
    /// Loads the stored secret data from the app keychain.
    /// - Returns: A Data object with the encoded secret data, or nil if nothing is currently saved in the keychain.
    func loadFromKeychain() -> Data? {
        guard let getQuery = commonKeychainQuery() else {
            return nil
        }
        getQuery[kSecMatchLimit as String] = kSecMatchLimitOne
        getQuery[kSecReturnData as String] = kCFBooleanTrue
        var item: CFTypeRef?
        let status = SecItemCopyMatching(getQuery as CFMutableDictionary, &item)
        if status != errSecItemNotFound, status != errSecSuccess {
            logger.log(.warning, "Unknown error: \(status)")
        }
        guard status == errSecSuccess else { return nil }
        return item as? Data
    }
    
    /// Saves the given secret data to the app's keychain.
    /// - Parameter value: A Data object containing the DtaOidcAuthorizationClient secret data.
    /// - Returns: true if it succeeds, or false otherwise.
    @discardableResult func saveToKeychain(value: Data) -> Bool {
        guard let query = commonKeychainQuery() else {
            return false
        }
        query[kSecValueData as String] = value
        var status = SecItemAdd(query as CFMutableDictionary, nil)
        if status == errSecDuplicateItem {
            query.removeObject(forKey: kSecValueData as String)
            status = SecItemUpdate(query as CFMutableDictionary, [kSecValueData as String: value] as CFDictionary)
        }
        return status == errSecSuccess
    }
    
    /// Deletes the DtaOidcAuthorizationClient secret data from the app's keychain.
    /// - Returns: true if it succeeds, or false otherwise.
    @discardableResult func deleteFromKeychain() -> Bool {
        guard let deleteQuery = commonKeychainQuery() as CFDictionary? else {
            return false
        }
        let status = SecItemDelete(deleteQuery)
        return status == errSecSuccess
    }
    
    /// Loads the DtaOidcAuthorizationClient's state data from the keychain.
    func loadState() {
        self.authState = nil
        self.userInfo = nil
        self.serviceConfig = nil
        if let archivedKeychainData = loadFromKeychain(),
           let unarchiver = try? NSKeyedUnarchiver(forReadingFrom: archivedKeychainData) {
            unarchiver.requiresSecureCoding = false
            if let keychainDict = unarchiver.decodeObject(of: NSDictionary.self, forKey: NSKeyedArchiveRootObjectKey) {
                self.authState = keychainDict["access-token"] as? OIDAuthState
                self.userInfo = keychainDict["user-info"] as? NSDictionary
                self.serviceConfig = keychainDict["service-config"] as? OIDServiceConfiguration
            }
        }
    }
    
    /// Saves the DtaOidcAuthorizationClient's state data to the keychain.
    func saveState() {
        var keychainDict: [String: Any] = [:]
        if let authState = authState {
            keychainDict["access-token"] = authState
        }
        if let userInfo = userInfo {
            keychainDict["user-info"] = userInfo
        }
        if let serviceConfig = serviceConfig {
            keychainDict["service-config"] = serviceConfig
        }
        if !keychainDict.isEmpty {
            let nsDict = NSDictionary(dictionary: keychainDict)
            if let archivedKeychainDict = try? NSKeyedArchiver.archivedData(withRootObject: nsDict, requiringSecureCoding: true) {
                saveToKeychain(value: archivedKeychainDict)
            }
        }
    }
    
    /// Called when the auth state changes.
    func stateChanged() {
        saveState()
    }
    
    private func isInvalidGrantError(_ error: NSError) -> Bool {
        return error.code == OIDErrorCodeOAuth.invalidGrant.rawValue && error.domain == OIDOAuthTokenErrorDomain
    }

    private func isTokenRefreshError(_ error: NSError) -> Bool {
        return error.code == OIDErrorCode.tokenRefreshError.rawValue && error.domain == OIDGeneralErrorDomain
    }

    /// Refreshes the user's access token.
    /// - Parameter completion: Callback to call upon success or error.
    func refreshAccessToken(_ completion: @escaping DtaOidcAuthorizationClientCallback) {
        guard let authState = authState else {
            signIn() { error in
                if let error = error {
                    completion(error)
                } else {
                    self.refreshAccessToken(completion)
                }
            }
            return
        }
        authState.performAction() { accessToken, idToken, error in
            if let error = error as NSError? {
                self.logger.log(.error, "Error fetching fresh tokens: \(error)")
                if self.isInvalidGrantError(error) || self.isTokenRefreshError(error) {
                    self.innerSignOut()
                    self.signIn(completion)
                } else {
                    completion(error)
                }
                return
            }
            completion(error)
        }
    }

    /// Top view controller for presenting web app.
    /// - Returns: The top view controller.
    static var topViewController: UIViewController? {
        let keyWindow = UIApplication
            .shared
            .connectedScenes
            .flatMap { ($0 as? UIWindowScene)?.windows ?? [] }
            .first { $0.isKeyWindow }
        if var topController = keyWindow?.rootViewController {
            while let presentedViewController = topController.presentedViewController {
                topController = presentedViewController
            }
            return topController
        }
        return nil
    }

    /// Presents a Safari WebView to the user to sign in.
    /// - Parameters:
    ///   - serviceConfig: The service configuration for the issuer URL.
    ///   - clientID: The imodeljs app's clientID.
    ///   - clientSecret: The optional clientSecret.
    ///   - completion: The callback to call upon success or error.
    func doAuthCodeExchange(serviceConfig: OIDServiceConfiguration?, clientID: String?, clientSecret: String?, onComplete completion: @escaping DtaOidcAuthorizationClientCallback) {
        guard let authSettings = authSettings else {
            completion(error(reason: "DtaOidcAuthorizationClient: not initialized"))
            return
        }
        guard let redirectUrl = URL(string: authSettings.redirectUrl) else {
            completion(error(reason: "DtaOidcAuthorizationClient: invalid or empty redirectUrl"))
            return
        }
        guard let serviceConfig = serviceConfig else {
            completion(error(reason: "DtaOidcAuthorizationClient: missing server config"))
            return
        }
        guard let clientID = clientID else {
            completion(error(reason: "DtaOidcAuthorizationClient: missing clientID"))
            return
        }
        let scopes = NSString(string: authSettings.scope).components(separatedBy: " ")
        let request = OIDAuthorizationRequest(configuration: serviceConfig,
                                              clientId: clientID,
                                              clientSecret: clientSecret,
                                              scopes: scopes,
                                              redirectURL: redirectUrl,
                                              responseType: OIDResponseTypeCode,
                                              additionalParameters: nil)
        DispatchQueue.main.async {
            if let viewController = DtaOidcAuthorizationClient.topViewController {
                // Note: The return value below is only really used by AppAuth in versions of iOS prior to iOS 11.
                // However, even though we require iOS 12.2, if we ignore the value, it gets deleted by the system,
                // which prevents everything from working. So, store the value in our member variable.
                self.currentAuthorizationFlow = OIDAuthState.authState(byPresenting: request, presenting: viewController) { authState, error in
                    self.authState = authState
                    if authState == nil {
                        if let error = error {
                            self.logger.log(.warning, "Authorization error: \(error.localizedDescription)")
                        } else {
                            self.logger.log(.error, "Unknown authorization error")
                        }
                    }
                    completion(error)
                }
            }
        }
    }
    
    /// Check to see if the authSettings member variable contains valid data.
    /// - Returns: An NSError if the settings are invalid, or nil if they are valid.
    func checkSettings() -> NSError? {
        guard let authSettings = authSettings else {
            return error(reason: "DtaOidcAuthorizationClient: initialize() was never called")
        }
        if authSettings.clientId.count == 0 {
            return error(reason: "DtaOidcAuthorizationClient: initialize() was called with invalid or empty clientId")
        }
        if authSettings.scope.count == 0 {
            return error(reason: "DtaOidcAuthorizationClient: initialize() was called with invalid or empty scope")
        }
        guard let _ = URL(string: authSettings.redirectUrl) else {
            return error(reason: "DtaOidcAuthorizationClient: initialize() was called with invalid or empty redirectUrl")
        }
        guard let _ = URL(string: authSettings.issuerUrl) else {
            return error(reason: "DtaOidcAuthorizationClient: initialize() was called with invalid or empty issuerUrl")
        }
        return nil
    }
    
    /// Fetch and return the userInfo data from the userinfo endpoint, if needed. If userInfo has already been fetched, convert it to a JSON string and return it.
    /// - Parameter completion: The callback to call with the JSON-encoded userInfo string.
    func fetchUserInfo(_ completion: @escaping (String?, Error?) -> ()) {
        if userInfo != nil {
            if let userInfoJson = JSONSerialization.string(withDtaJSONObject: userInfo) {
                completion(userInfoJson, nil)
            } else {
                userInfo = nil
            }
        }
        guard let authState = authState else {
            completion(nil, error(reason: "DtaOidcAuthorizationClient not signed in"))
            return
        }
        guard let userinfoEnpoint = authState.lastAuthorizationResponse.request.configuration.discoveryDocument?.userinfoEndpoint else {
            completion(nil, error(reason: "DtaOidcAuthorizationClient: Userinfo endpoint not declared in discovery document"))
            return
        }
        authState.performAction() { accessToken, idToken, error in
            if let error = error {
                self.logger.log(.error, "DtaOidcAuthorizationClient: Error fetching fresh tokens: \(error)")
                completion(nil, error)
                return
            }
            guard let accessToken = accessToken else {
                completion(nil, self.error(reason: "DtaOidcAuthorizationClient: No access token after fetching fresh tokens"))
                return
            }
            var request = URLRequest(url: userinfoEnpoint)
            let authorizationHeaderValue = "Bearer \(accessToken)"
            request.addValue(authorizationHeaderValue, forHTTPHeaderField: "Authorization")
            let configuration = URLSessionConfiguration.default
            let session = URLSession(configuration: configuration)
            let postDataTask = session.dataTask(with: request) { data, response, error in
                DispatchQueue.main.async {
                    if let error = error {
                        completion(nil, self.error(reason: "DtaOidcAuthorizationClient: HTTP Request failed fetching user info: \(error)"))
                        return
                    }
                    guard let httpResponse = response as? HTTPURLResponse else {
                        completion(nil, self.error(reason: "DtaOidcAuthorizationClient: Response not HTTP fetching user info"))
                        return
                    }
                    guard let data = data else {
                        completion(nil, self.error(reason: "DtaOidcAuthorizationClient: No data fetching user info"))
                        return
                    }
                    let responseText = String(data: data, encoding: .utf8)
                    guard let jsonDictionaryOrArray = try? JSONSerialization.jsonObject(with: data, options: []) else {
                        completion(nil, self.error(reason: "DtaOidcAuthorizationClient: Error parsing response as JSON"))
                        return
                    }
                    guard let jsonDictionary = jsonDictionaryOrArray as? [AnyHashable: Any] else {
                        completion(nil, self.error(reason: "DtaOidcAuthorizationClient: Error parsing response as JSON"))
                        return
                    }
                    if httpResponse.statusCode != 200 {
                        // Server replied with an error
                        if httpResponse.statusCode == 401 {
                            // "401 Unauthorized" generally indicates there is an issue with the authorization
                            // grant. Puts OIDAuthState into an error state.
                            let oauthError = OIDErrorUtilities.resourceServerAuthorizationError(withCode: 0, errorResponse: jsonDictionary, underlyingError: error)
                            authState.update(withAuthorizationError: oauthError)
                            self.logger.log(.error, "DtaOidcAuthorizationClient: Authorization error: \(oauthError)")
                            completion(nil, self.error(reason: "DtaOidcAuthorizationClient: Authorization error"))
                        } else {
                            if let error = error {
                                completion(nil, self.error(reason: "DtaOidcAuthorizationClient: Unknown error: \(error)"))
                            } else {
                                completion(nil, self.error(reason: "DtaOidcAuthorizationClient: Unknown error"))
                            }
                        }
                        return
                    }
                    // Success response
                    self.userInfo = jsonDictionary as NSDictionary
                    completion(responseText, nil)
                }
            }
            postDataTask.resume()
        }
    }
    
    private func innerSignOut() {
        deleteFromKeychain()
        authState = nil
        serviceConfig = nil
        userInfo = nil
    }

    // MARK: - OIDAuthStateChangeDelegate Protocol implementation

    /// Called when the authorization state changes and any backing storage needs to be updated.
    /// - Parameter state: The OIDAuthState that changed.
    /// - Note: If you are storing the authorization state, you should update the storage when the state changes.
    public func didChange(_ state: OIDAuthState) {
        stateChanged()
        raiseOnAccessTokenChanged()
    }

    // MARK: - OIDAuthStateErrorDelegate Protocol implementation

    public func authState(_ state: OIDAuthState, didEncounterAuthorizationError error: Error) {
        logger.log(.error, "DtaOidcAuthorizationClient didEncounterAuthorizationError: \(error)")
    }
    
    public var isAuthorized: Bool {
        get {
            return authState?.isAuthorized ?? false
        }
    }

    func signIn(_ completion: @escaping DtaOidcAuthorizationClientCallback) {
        if let error = checkSettings() {
            completion(error)
            return
        }
        guard let authSettings = authSettings else {
            completion(error(reason: "DtaOidcAuthorizationClient not initialized"))
            return
        }
        guard let issuerUrl = URL(string: authSettings.issuerUrl) else {
            completion(error(reason: "AuthSettings provided issuer URL that is invalid"))
            return
        }
        if serviceConfig == nil {
            OIDAuthorizationService.discoverConfiguration(forIssuer: issuerUrl) { serviceConfig, error in
                if let error = error {
                    self.logger.log(.error, "Failed to discover issuer configuration from \(issuerUrl): Error \(error)")
                    completion(error)
                    return
                }
                self.serviceConfig = serviceConfig
                self.saveState()
                self.signIn(completion)
            }
            return
        }
        if authState == nil {
            doAuthCodeExchange(serviceConfig: serviceConfig, clientID: authSettings.clientId, clientSecret: nil) { error in
                completion(error)
                self.raiseOnAccessTokenChanged()
            }
        } else {
            refreshAccessToken() { error in
                if error == nil {
                    completion(error)
                } else {
                    // Refresh failed; sign out and try again from scratch.
                    self.innerSignOut()
                    self.signIn(completion)
                }
            }
        }
    }

    func signOut(_ completion: @escaping DtaOidcAuthorizationClientCallback) {
        if let error = checkSettings() {
            completion(error)
            return
        }
        innerSignOut()
        raiseOnAccessTokenChanged()
        completion(nil)
    }

    // MARK: - AuthorizationClient Protocol implementation
    public func getAccessToken(_ completion: @escaping GetAccessTokenCallback) {
        if let error = checkSettings() {
            completion(nil, nil, error)
            return
        }
        refreshAccessToken() { error in
            if let error = error {
                completion(nil, nil, error)
                return
            }
            self.fetchUserInfo() { userInfo, error in
                if let error = error {
                    completion(nil, nil, error)
                    return
                }
                guard let authState = self.authState,
                      let lastTokenResponse = authState.lastTokenResponse else {
                    completion(nil, nil, self.error(reason: "No token after refresh"))
                    return
                }
                guard let tokenString = lastTokenResponse.accessToken else {
                    completion(nil, nil, self.error(reason: "Invalid token after refresh"))
                    return
                }
                guard let expirationDate = lastTokenResponse.accessTokenExpirationDate else {
                    completion(nil, nil, self.error(reason: "Invalid expiration date after refresh"))
                    return
                }
                completion("Bearer \(tokenString)", expirationDate, nil)
            }
        }
    }
}
