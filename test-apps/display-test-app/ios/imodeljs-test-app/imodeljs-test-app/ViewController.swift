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
    private var documentCompletion : ((URL?) -> Void)? = nil

    private func parseArguments() {
        // args can come from Xcode or when running the simulator (xcrun simctl launch), useful for automation
        ProcessInfo.processInfo.arguments[1...].forEach { arg in
            if arg.hasPrefix("IMJS_") {
                let split = arg.split(separator: "=", maxSplits: 1)
                if split.count == 2 {
                    configData[String(split[0])] = String(split[1])
                }
            }
        }
    }

    func setupBackend() {
        let url = URL(fileURLWithPath: Bundle.main.bundlePath.appending("/Assets/www/mobile/main.js"))
        if let envUrl = Bundle.main.url(forResource: "env", withExtension: "json", subdirectory: "Assets/www/mobile"),
           let envString = try? String(contentsOf: envUrl),
           let envData = JSON.fromString(envString) {
            configData = envData
        }
        parseArguments()
        authClient = DtaServiceAuthorizationClient(configData: configData) ?? DtaOidcAuthorizationClient(configData: configData)
        IModelJsHost.sharedInstance().loadBackend(url, withAuthClient: authClient, withInspect: true)
    }

    func setupFrontend(bimFile: URL? = nil, iModelId: String? = nil, iTwinId: String? = nil) {
        let config = WKWebViewConfiguration()
        let wwwRoot = URL(fileURLWithPath: Bundle.main.resourcePath!.appending("/Assets/www"))
        config.setURLSchemeHandler(AssetHandler(root: wwwRoot), forURLScheme: "imodeljs")
        let webView = WKWebView(frame: .zero, configuration: config)
#if DEBUG && compiler(>=5.8)
        if #available(iOS 16.4, *) {
            webView.isInspectable = true
        }
#endif
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
        var hashParams = "#port=\(host.getPort())&platform=ios&standalone=true"

        if let bimFilePath = bimFile?.path.encodedForURLQuery() {
            hashParams.append("&iModelName=" + bimFilePath)
        }
        if let iModelId = iModelId?.encodedForURLQuery(), let iTwinId = iTwinId?.encodedForURLQuery() {
            hashParams.append("&iModelId=\(iModelId)&iTwinId=\(iTwinId)")
        }
        if configData["IMJS_IGNORE_CACHE"] != nil {
            hashParams.append("&ignoreCache=true")
        }

        webView.addUserContentController(OpenModelHander(self))
        webView.addUserContentController(ModelOpenedHandler())
        webView.addUserContentController(FirstRenderFinishedHandler(exitOnMessage: configData["IMJS_EXIT_AFTER_MODEL_OPENED"] != nil))
        let baseURL = configData["IMJS_DEBUG_URL"] as? String ?? "imodeljs://app"
        webView.load(URLRequest(url: URL(string: baseURL + hashParams)!))
        host.register(webView)
    }

    func showAlert(message: String, completionHandler: @escaping () -> Void = {}) {
        let alert = UIAlertController(title: message, message: nil, preferredStyle: .alert)
        alert.addAction(UIAlertAction(title: "OK", style: .cancel) { action in
            completionHandler()
        })
        self.present(alert, animated: true)
    }

    /// Show alert for webkit alert
    func webView(_ webView: WKWebView, runJavaScriptAlertPanelWithMessage message: String, initiatedByFrame frame: WKFrameInfo, completionHandler: @escaping () -> Void) {
        showAlert(message: message, completionHandler: completionHandler)
    }

    func pickSnapshot(completion: @escaping (URL?) -> Void) {
        self.documentCompletion = completion
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

    private func callDocumentCompletion(_ url: URL?) {
        documentCompletion?(url)
        documentCompletion = nil
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
            callDocumentCompletion(url)
        } else {
            // The picked file is not in our Documents directory; copy it there so that SQLite lock file and
            // iTwin tiles file can be created.
            let destUrl = URL(fileURLWithPath: documentsDirectoryPath).appendingPathComponent(url.lastPathComponent)
            copyExternalFileWithPrompt(srcUrl: url, destUrl: destUrl) {
                self.callDocumentCompletion(destUrl)
            }
        }
    }

    func documentPickerWasCancelled(_ controller: UIDocumentPickerViewController) {
        callDocumentCompletion(nil)
    }

    override func viewDidLoad() {
        super.viewDidLoad()
        setupBackend()
        if let standaloneFilename = configData["IMJS_STANDALONE_FILENAME"] as? String {
            let bimFile = getDocumentsDirectory().appendingPathComponent(standaloneFilename)
            let exists = FileManager.default.fileExists(atPath: bimFile.path)
            if configData["IMJS_EXIT_AFTER_MODEL_OPENED"] != nil, !exists {
                print("ERROR: \(standaloneFilename) does not exist in the app's Documents directory")
                exit(EXIT_FAILURE)
            } else {
                setupFrontend(bimFile: exists ? bimFile : nil)
                if !exists {
                    print("File does not exist: \(bimFile.path)")
                    // alert the user after the view controller has loaded
                    DispatchQueue.main.asyncAfter(deadline: DispatchTime.now()) {
                        self.showAlert(message: "File does not exist: \(bimFile.path)")
                    }
                }
            }
        } else if let _ = authClient,
                  let iModelId = configData["IMJS_IMODEL_ID"] as? String,
                  let iTwinId = configData["IMJS_ITWIN_ID"] as? String {
            setupFrontend(bimFile: nil, iModelId: iModelId, iTwinId: iTwinId)
        } else {
            setupFrontend()
        }
    }

    class OpenModelHander: NSObject, MessageHandler {
        static let NAME = "openModel"
        private var viewController: ViewController

        init (_ viewController: ViewController) {
            self.viewController = viewController
        }

        func userContentController(_ userContentController: WKUserContentController, didReceive message: WKScriptMessage) {
            if let webView = self.viewController.webView, let promiseName = message.body as? String, promiseName.count > 0 {
                viewController.pickSnapshot() { url in
                    let fileName = (url?.path.count ?? 0) > 0 ? "\"\(url!.path)\"" : "undefined";
                    let js = "window.\(promiseName)(\(fileName));"
                    webView.evaluateJavaScript(js)
                }
            }
        }
    }

    class ModelOpenedHandler : NSObject, MessageHandler {
        static let NAME = "modelOpened"

        func userContentController(_ userContentController: WKUserContentController, didReceive message: WKScriptMessage) {
            if let stringMessage = message.body as? String {
                print("iModel opened: \(stringMessage)")
            }
        }
    }

    class FirstRenderFinishedHandler : NSObject, MessageHandler {
        static let NAME = "firstRenderFinished"
        private var exitOnMessage: Bool

        init(exitOnMessage: Bool) {
            self.exitOnMessage = exitOnMessage
        }

        func userContentController(_ userContentController: WKUserContentController, didReceive message: WKScriptMessage) {
            // Note: don't change this string without also updating runIosSimulator.ts as it is also hardcoded there.
            // Despite us providing a proper success/error exit status, it doesn't get returned by simctl so the script relies
            // on this string to know if it succeeded.
            print("First render finished.")
            if exitOnMessage {
                exit(EXIT_SUCCESS)
            }
        }
    }
}

protocol MessageHandler : WKScriptMessageHandler {
    static var NAME: String { get }
}

extension WKWebView {
    func addUserContentController(_ messageHandler: MessageHandler) {
        self.configuration.userContentController.add(messageHandler, name: type(of: messageHandler).NAME)
    }
}
