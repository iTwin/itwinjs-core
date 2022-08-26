/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/

import UIKit
import WebKit
import IModelJsNative

class ViewController: UIViewController, WKUIDelegate, WKNavigationDelegate, UIDocumentPickerDelegate {
    private var webView : WKWebView? = nil

    func setupBackend () {
        let url = URL(fileURLWithPath: Bundle.main.bundlePath.appending("/Assets/main.js"))
        IModelJsHost.sharedInstance().loadBackend(url, withAuthClient: nil, withInspect: true)
    }
    
    func setupFrontend (bimFile: URL?) {
        let config = WKWebViewConfiguration()
        let wwwRoot = URL(fileURLWithPath: Bundle.main.resourcePath!.appending("/Assets/www"))
        config.setURLSchemeHandler(AssetHandler(root: wwwRoot), forURLScheme: "imodeljs")
        let webView = WKWebView(frame: .zero, configuration: config)
        self.webView = webView
        webView.translatesAutoresizingMaskIntoConstraints = false
        self.view.addSubview(webView)
        webView.uiDelegate = self
        webView.navigationDelegate = self
        NSLayoutConstraint.activate([
            webView.leftAnchor.constraint(equalTo: self.view.leftAnchor),
            webView.bottomAnchor.constraint(equalTo: self.view.bottomAnchor),
            webView.rightAnchor.constraint(equalTo: self.view.rightAnchor),
            webView.topAnchor.constraint(equalTo: self.view.topAnchor),
        ])
        self.view.setNeedsLayout()
    
        let host = IModelJsHost.sharedInstance()
        var queryParam = "#port=\(host.getPort())&platform=ios"

        if let bimFile = bimFile {
            // Note: URL strings probably allow other characters, but we know for sure that these all work.
            // Also, we can't use `CharacterSet.alphanumerics` as a base, because that includes all Unicode
            // upper case and lower case letters, and we only want ASCII upper case and lower case letters.
            // Similarly, `CharacterSet.decimalDigits` includes the Unicode category Number, Decimal Digit,
            // which contains 660 characters.
            let allowedCharacters = CharacterSet(charactersIn: "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789-_.")
            if let encodedPath = bimFile.path.addingPercentEncoding(withAllowedCharacters: allowedCharacters) {
                queryParam.append("&standalone=true&iModelName=" + encodedPath)
            }
        }

        webView.load(URLRequest(url: URL(string: "imodeljs://app" + queryParam)!))
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
        let picker = UIDocumentPickerViewController(documentTypes: ["public.data"], in: .open)
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
  
    func documentPicker(_ controller: UIDocumentPickerViewController, didPickDocumentAt url: URL) {
        setupFrontend(bimFile: url)
    }
    
    override func viewDidLoad() {
        super.viewDidLoad()
        setupBackend()
    }
}
