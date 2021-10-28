package com.bentley.imodeljs_test_app;

import androidx.annotation.Nullable;
import androidx.appcompat.app.AppCompatActivity;

import android.content.ActivityNotFoundException;
import android.content.Intent;
import android.net.Uri;
import android.os.Bundle;
import android.provider.DocumentsContract;
import android.util.Log;
import android.webkit.ConsoleMessage;
import android.webkit.PermissionRequest;
import android.webkit.URLUtil;
import android.webkit.ValueCallback;
import android.webkit.WebChromeClient;
import android.webkit.WebView;
import android.widget.Toast;

import com.bentley.itwin.AuthCompletionAction;
import com.bentley.itwin.AuthSettings;
import com.bentley.itwin.AuthTokenCompletionAction;
import com.bentley.itwin.IModelJsHost;
import com.bentley.itwin.MobileFrontend;
import com.bentley.itwin.AuthorizationClient;

import org.json.JSONObject;

import java.net.URL;
import java.net.URLEncoder;
import java.time.Instant;
import java.util.HashMap;
import java.util.Map;
import java.util.Objects;
import java.util.stream.Collectors;

class MyAuthClient extends AuthorizationClient {
    private final String tokenStr = "....";
    private String getTokenJson() {
        StringBuilder builder = new StringBuilder();
        final String tokenString = tokenStr;

        final String expiresAt = String.valueOf(Instant.now().toEpochMilli()+ 1000*60*60);
        final String startsAt= String.valueOf(Instant.now().toEpochMilli());
        builder.append("{");
        builder.append("\"tokenString\":").append("\"").append(tokenString).append("\",");
        builder.append("\"expiresAt\"  :").append(expiresAt).append(",");
        builder.append("\"startsAt\"   :").append(startsAt);
        builder.append("}");
        return builder.toString();
    }

    @Override
    public void initialize(AuthSettings authSettings, AuthCompletionAction authCompletionAction) {
        try {
            authCompletionAction.resolve();
        } catch (Exception e) {
            Log.e("%s", e.getMessage());
        }

    }
    @Override
    public void signIn(AuthCompletionAction authCompletionAction) {
        try {
            notifyUserStateChangedWithToken(getTokenJson());
            authCompletionAction.resolve();
        } catch (Exception e) {
            Log.e("%s", e.getMessage());
        }
    }

    @Override
    public void signOut(AuthCompletionAction authCompletionAction) {
        try {
            notifyUserStateChangedWithToken("");
            authCompletionAction.resolve();
        } catch (Exception e) {
            Log.e("%s", e.getMessage());
        }
    }

    @Override
    public void getAccessToken(AuthTokenCompletionAction authTokenCompletionAction) {
        try {
            authTokenCompletionAction.resolve(getTokenJson());
        } catch (Exception e) {
            Log.e("%s", e.getMessage());
        }
    }

    @Override
    public boolean isAuthorized() {
        return true;
    }
};
public class MainActivity extends AppCompatActivity {
    IModelJsHost m_host;
    final int ACTION_OPEN_BIM = 1;
    @Override
    protected void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);
        WebView.setWebContentsDebuggingEnabled(true);

        boolean alwaysExtractAssets = true; // for debugging, otherwise the host will only extract when app version changes
        m_host = new IModelJsHost(this, alwaysExtractAssets, new MyAuthClient() ,true);
        m_host.startup();


        final HashMap<String,String> config = new HashMap<>();
        config.put("iModelName",getFilesDir().getPath() + "/apx.bim");
        config.put("standalone","true");

        if (false) {
            config.put("signInForStandalone", "false");
            config.put("enableDiagnostics", "false");
            config.put("openReadWrite", "false");
            config.put("disableInstancing", "false");
            config.put("enableImprovedElision", "false");
            config.put("ignoreAreaPatterns", "false");
            config.put("enableExternalTextures", "false");
            config.put("disableMagnification", "false");
            config.put("disableBRepCache", "false");
            config.put("debugShaders", "false");
            config.put("logLevel", "debug");
            config.put("viewName", "ViewName");
        }

        final String args = config.entrySet().stream().
                map(entry -> { return entry.getKey() + "=" + entry.getValue();}).
                collect(Collectors.joining("&", "&", ""));

        Log.e("frontend args", args);
        MobileFrontend frontend = new MobileFrontend(m_host, args);
        frontend.setWebChromeClient( new WebChromeClient(){
            @Override
            public boolean onShowFileChooser(WebView webView, ValueCallback<Uri[]> filePathCallback, FileChooserParams fileChooserParams) {
                // Browse file.
                return super.onShowFileChooser(webView, filePathCallback, fileChooserParams);
            }

            @Override
            public boolean onConsoleMessage(ConsoleMessage consoleMessage) {
                Log.e("itwin-frontend", String.format("%s: %s", consoleMessage.messageLevel().name(),consoleMessage.message()));
                return super.onConsoleMessage(consoleMessage);
            }
        });

        m_host.setFrontend(frontend);
        setContentView(frontend);
        frontend.loadEntryPoint();
    }
    void browseFile() {
      Intent intent = new Intent(Intent.ACTION_OPEN_DOCUMENT);
      intent.addCategory(Intent.CATEGORY_OPENABLE);
        intent.setType("*/*");
        intent.putExtra(DocumentsContract.EXTRA_INITIAL_URI, Uri.parse(getFilesDir().getPath()));
      try{
          startActivityForResult(intent, ACTION_OPEN_BIM);
      } catch (ActivityNotFoundException e){
          Toast.makeText(MainActivity.this, "There are no file explorer clients installed.", Toast.LENGTH_SHORT).show();
      }
    }

    @Override
    protected void onActivityResult(int requestCode, int resultCode, @Nullable Intent data) {
        if (requestCode == ACTION_OPEN_BIM) {
        }
        super.onActivityResult(requestCode, resultCode, data);
    }

    @Override
    protected void onPause() {
        super.onPause();
        m_host.onPause();
    }

    @Override
    protected void onResume() {
        super.onResume();
        m_host.onResume();
    }
}