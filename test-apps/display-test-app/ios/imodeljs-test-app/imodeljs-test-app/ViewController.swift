/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/

import UIKit
import WebKit
import IModelJsNative

extension String {
    /// Convert a String into BASE64-encoded UTF-8 data.
    func toBase64() -> String {
        return Data(utf8).base64EncodedString()
    }

    /// Encode the string such that it can be used in the query portion of a URL.
    func encodedForURLQuery() -> String? {
        // Note: URL strings probably allow other characters, but we know for sure that these all work.
        // Also, we can't use `CharacterSet.alphanumerics` as a base, because that includes all Unicode
        // upper case and lower case letters, and we only want ASCII upper case and lower case letters.
        // Similarly, `CharacterSet.decimalDigits` includes the Unicode category Number, Decimal Digit,
        // which contains 660 characters.
        let allowedCharacters = CharacterSet(charactersIn: "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789-_.")
        if let encoded = addingPercentEncoding(withAllowedCharacters: allowedCharacters) {
            return encoded
        }
        return nil
    }
}

// MARK: - JSON Helpers

// NOTE: This JSON code was copied from various places in iTwin/mobile-sdk-ios.

/// Convenience type alias for a dictionary intended for interop via JSON.
typealias JSON = [String: Any]

/// Extension to create a dictionary from JSON text.
extension JSON {
    /// Deserializes passed String and returns Dictionary representing the JSON object encoded in the string
    /// - Parameters:
    ///   - jsonString: string to parse and convert to Dictionary
    ///   - encoding: encoding of the source ``jsonString``. Defaults to UTF8.
    /// - Returns: Dictionary representation of the JSON string
    static internal func fromString(_ jsonString: String?, _ encoding: String.Encoding = String.Encoding.utf8) -> JSON? {
        if jsonString == nil {
            return nil
        }
        let stringData = jsonString!.data(using: encoding)
        do {
            return try JSONSerialization.jsonObject(with: stringData!, options: []) as? JSON
        } catch {
        }
        return nil
    }
    
    /// Check if a key's value equals "YES"
    /// - Parameter key: The key to check.
    /// - Returns: True if the value of the given key equals "YES".
    func isYes(_ key: String) -> Bool {
        return self[key] as? String == "YES"
    }
}

internal extension JSONSerialization {
    static func string(withDtaJSONObject object: Any?) -> String? {
        return string(withDtaJSONObject: object, prettyPrint: false)
    }

    static func string(withDtaJSONObject object: Any?, prettyPrint: Bool) -> String? {
        guard let object = object else {
            return ""
        }
        if let _ = object as? () {
            // Return empty JSON string for void.
            return ""
        }
        let wrapped: Bool
        let validJSONObject: Any
        if JSONSerialization.isValidJSONObject(object) {
            wrapped = false
            validJSONObject = object
        } else {
            wrapped = true
            // Wrap object in an array
            validJSONObject = [object]
        }
        let options: JSONSerialization.WritingOptions = prettyPrint ? [.prettyPrinted, .sortedKeys, .fragmentsAllowed] : [.fragmentsAllowed]
        guard let data = try? JSONSerialization.data(withJSONObject: validJSONObject, options: options) else {
            return nil
        }
        guard let jsonString = String(data: data, encoding: .utf8) else {
            return nil
        }
        if wrapped {
            // Remove the array delimiters ("[" and "]") from the beginning and end of the string.
            return String(String(jsonString.dropFirst()).dropLast())
        } else {
            return jsonString
        }
    }

    static func jsonObject(withString string: String) -> Any? {
        if string == "" {
            return ()
        }
        guard let data = string.data(using: .utf8) else {
            return nil
        }
        guard let result = try? JSONSerialization.jsonObject(with: data, options: [.allowFragments]) else {
            return nil
        }
        return result
    }
}

// MARK: - ViewController

class ViewController: UIViewController, WKUIDelegate, UIDocumentPickerDelegate {
    private var webView : WKWebView? = nil
    private var configData: JSON = [:]
    private var authClient: AuthorizationClient? = nil

    func setupBackend() {
        let url = URL(fileURLWithPath: Bundle.main.bundlePath.appending("/Assets/main.js"))
        if let envUrl = Bundle.main.url(forResource: "env", withExtension: "json", subdirectory: "Assets"),
           let envString = try? String(contentsOf: envUrl),
           let envData = JSON.fromString(envString) {
            configData = envData
        }
        authClient = DtaServiceAuthorizationClient(configData: configData)
        if authClient == nil {
            authClient = DtaOidcAuthorizationClient(configData: configData)
        }
        IModelJsHost.sharedInstance().loadBackend(url, withAuthClient: authClient, withInspect: true)
    }

    func setupFrontend(bimFile: URL?, iModelId: String? = nil, iTwinId: String? = nil) {
        let config = WKWebViewConfiguration()
        let wwwRoot = URL(fileURLWithPath: Bundle.main.resourcePath!.appending("/Assets/www"))
        config.setURLSchemeHandler(AssetHandler(root: wwwRoot), forURLScheme: "imodeljs")
        let webView = WKWebView(frame: .zero, configuration: config)
        self.webView = webView
        webView.translatesAutoresizingMaskIntoConstraints = false
        self.view.addSubview(webView)
        webView.uiDelegate = self
        NSLayoutConstraint.activate([
            webView.leftAnchor.constraint(equalTo: self.view.leftAnchor),
            webView.bottomAnchor.constraint(equalTo: self.view.bottomAnchor),
            webView.rightAnchor.constraint(equalTo: self.view.rightAnchor),
            webView.topAnchor.constraint(equalTo: self.view.topAnchor),
        ])
        self.view.setNeedsLayout()
    
        let host = IModelJsHost.sharedInstance()
        var hashParams = "#port=\(host.getPort())&platform=ios"

        if let bimFilePath = bimFile?.path.encodedForURLQuery() {
            hashParams.append("&standalone=true&iModelName=" + bimFilePath)
        }
        if let iModelId = iModelId?.encodedForURLQuery(), let iTwinId = iTwinId?.encodedForURLQuery() {
            hashParams.append("&standalone=true&iModelId=\(iModelId)&iTwinId=\(iTwinId)")
        }
        if configData["IMJS_IGNORE_CACHE"] != nil {
            hashParams.append("&ignoreCache=true")
        }

        webView.load(URLRequest(url: URL(string: "imodeljs://app" + hashParams)!))
        host.register(webView)
    }
    
    /// Show alert for webkit alert
    func webView(_ webView: WKWebView, runJavaScriptAlertPanelWithMessage message: String, initiatedByFrame frame: WKFrameInfo, completionHandler: @escaping () -> Void) {
        let alert = UIAlertController(title: message, message: nil, preferredStyle: .alert)
        alert.addAction(UIAlertAction(title: "OK", style: .cancel) { action in
            completionHandler()
        })
        self.present(alert, animated: true)
    }
    
    @IBAction func onOpenSnapshotIModel(_ sender: Any) {
        pickSnapshot()
    }
    
    func pickSnapshot() {
        let picker = UIDocumentPickerViewController(documentTypes: ["com.bentley.bim-imodel"], in: .open)
        picker.modalPresentationStyle = .fullScreen
        picker.allowsMultipleSelection = false
        picker.directoryURL = getDocumentsDirectory()
        picker.delegate = self
        self.present(picker, animated: true)
    }
    
    func getDocumentsDirectory() -> URL {
        return FileManager.default.urls(for: .documentDirectory, in: .userDomainMask)[0]
    }
    
    func documentPickerWasCancelled(_ controller: UIDocumentPickerViewController) {
        setupFrontend(bimFile: nil)
    }
  
    func copyExternalFileWithPrompt(srcUrl: URL, destUrl: URL, handler: @escaping () -> ()) {
        if FileManager.default.fileExists(atPath: destUrl.path) {
            // File exists, check if it is the same
            if FileManager.default.contentsEqual(atPath: srcUrl.path, andPath: destUrl.path) {
                // If src and dst have the same contents, skip the copy and just call handler()
                handler()
                return
            }
            let alert = UIAlertController(title: "Replace File?", message: "'\(destUrl.lastPathComponent)' already exists in the app's Documents folder. Do you want to replace it?", preferredStyle: .alert)
            alert.addAction(UIAlertAction(title: "Yes", style: .destructive) { _ in
                do {
                    try FileManager.default.removeItem(at: destUrl)
                    if self.copyExternalFile(srcUrl: srcUrl, destUrl: destUrl) {
                        handler()
                    }
                } catch {
                    print("Error deleting file '\(destUrl.path)': \(error)")
                }
            })
            alert.addAction(UIAlertAction(title: "No", style: .cancel))
            present(alert, animated: true)
        } else {
            if copyExternalFile(srcUrl: srcUrl, destUrl: destUrl) {
                handler()
            }
        }
    }

    func copyExternalFile(srcUrl: URL, destUrl: URL) -> Bool {
        let secure = srcUrl.startAccessingSecurityScopedResource()
        defer {
            if secure {
                srcUrl.stopAccessingSecurityScopedResource()
            }
        }
        do {
            try FileManager.default.copyItem(at: srcUrl, to: destUrl)
        } catch {
            print("Error copying file '\(srcUrl.path)' to '\(destUrl.path)': \(error)")
            return false
        }
        return true
    }

    func documentPicker(_ controller: UIDocumentPickerViewController, didPickDocumentAt url: URL) {
        let documentsDirectory = getDocumentsDirectory()
        let documentsDirectoryPath = documentsDirectory.path
        // For some reason, the path we get from the document picker has a "/private" prefix which is
        // missing from the path that we get from FileManager.default.urls(for:,in:). So allow either
        // path to be accepted as our Documents directory.
        let privateDocumentsDirectoryPath = "/private\(documentsDirectoryPath)"
        let urlPath = url.path
        if urlPath.hasPrefix(documentsDirectoryPath) || urlPath.hasPrefix(privateDocumentsDirectoryPath) {
            // The picked file is already in our Documents directory; no need to copy.
            setupFrontend(bimFile: url)
        } else {
            // The picked file is not in our Documents directory; copy it there so that SQLite lock file and
            // iTwin tiles file can be created.
            let destUrl = URL(fileURLWithPath: documentsDirectoryPath).appendingPathComponent(url.lastPathComponent)
            copyExternalFileWithPrompt(srcUrl: url, destUrl: destUrl) {
                self.setupFrontend(bimFile: destUrl)
            }
        }
    }
    
    override func viewDidLoad() {
        super.viewDidLoad()
        setupBackend()
        if let standaloneFilename = configData["IMJS_STANDALONE_FILENAME"] as? String {
            let documentsDirectory = getDocumentsDirectory()
            let bimFile = documentsDirectory.appendingPathComponent(standaloneFilename)
            setupFrontend(bimFile: bimFile)
        } else if let _ = authClient,
                  let iModelId = configData["IMJS_IMODEL_ID"] as? String,
                  let iTwinId = configData["IMJS_ITWIN_ID"] as? String {
            setupFrontend(bimFile: nil, iModelId: iModelId, iTwinId: iTwinId)
        }
    }
}
