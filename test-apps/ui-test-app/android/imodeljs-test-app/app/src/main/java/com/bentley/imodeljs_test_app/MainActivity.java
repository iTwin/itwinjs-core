package com.bentley.imodeljs_test_app;

import androidx.appcompat.app.AppCompatActivity;
import android.os.Bundle;
import android.util.Log;
import android.webkit.WebView;

import com.bentley.itwin.AuthCompletionAction;
import com.bentley.itwin.AuthSettings;
import com.bentley.itwin.AuthTokenCompletionAction;
import com.bentley.itwin.AuthorizationClient;
import com.bentley.itwin.IModelJsHost;
import com.bentley.itwin.MobileFrontend;

import java.time.Instant;

public class MainActivity extends AppCompatActivity {
    public class MyAuthClient extends AuthorizationClient {
        private final String tokenStr = "eyJhbGciOiJSUzI1NiIsImtpZCI6IkJlbnRsZXlJTVMiLCJwaS5hdG0iOiJhOG1lIn0.eyJzY29wZSI6WyJvcGVuaWQiLCJlbWFpbCIsInByb2ZpbGUiLCJvcmdhbml6YXRpb24iLCJpbW9kZWxodWIiLCJjb250ZXh0LXJlZ2lzdHJ5LXNlcnZpY2U6cmVhZC1vbmx5IiwicHJvZHVjdC1zZXR0aW5ncy1zZXJ2aWNlIiwicHJvamVjdHdpc2Utc2hhcmUiLCJ1cmxwcy10aGlyZC1wYXJ0eSIsImltb2RlbC1leHRlbnNpb24tc2VydmljZS1hcGkiLCJvZmZsaW5lX2FjY2VzcyJdLCJjbGllbnRfaWQiOiJpbW9kZWxqcy1lbGVjdHJvbi10ZXN0IiwiYXVkIjpbImh0dHBzOi8vaW1zLmJlbnRsZXkuY29tL2FzL3Rva2VuLm9hdXRoMiIsImh0dHBzOi8vaW1zb2lkYy5iZW50bGV5LmNvbS9hcy90b2tlbi5vYXV0aDIiLCJodHRwczovL2ltc29pZGMuYmVudGxleS5jb20vcmVzb3VyY2VzIiwiaW1vZGVsLWh1Yi1zZXJ2aWNlcy0yNDg1IiwiY29udGV4dC1yZWdpc3RyeS0yNzc3IiwicHJvZHVjdC1zZXR0aW5ncy1zZXJ2aWNlLTI3NTIiLCJwcm9qZWN0d2lzZS1zaGFyZS0yNTY3IiwidWxhcy1yZWFsdGltZS1sb2ctcG9zdGluZy0yNzMzIiwiaW1vZGVsLXBsdWctaW4tc2VydmljZS1hcGkiXSwic3ViIjoiYTBmZGJlODUtNzU0My00NWExLThmN2YtZGI3ZjQyZGI1YTlhIiwicm9sZSI6WyJNWV9TRUxFQ1RfQ0QiLCJQcm9qZWN0IE1hbmFnZXIiLCJTRUxFQ1RfRE9XTkxPQUQiLCJCRU5UTEVZX0VNUExPWUVFIl0sIm9yZyI6ImZhYjk3NzRiLWIzMzgtNGNjMi1hNmM5LTQ1OGJkZjdmOTY2YSIsInN1YmplY3QiOiJhMGZkYmU4NS03NTQzLTQ1YTEtOGY3Zi1kYjdmNDJkYjVhOWEiLCJpc3MiOiJodHRwczovL2ltc29pZGMuYmVudGxleS5jb20iLCJlbnRpdGxlbWVudCI6WyJCRE4iLCJTRUxFQ1RfMjAwNiIsIkJFTlRMRVlfTEVBUk4iLCJJTlRFUk5BTCJdLCJwcmVmZXJyZWRfdXNlcm5hbWUiOiJBZmZhbi5LaGFuQGJlbnRsZXkuY29tIiwiZ2l2ZW5fbmFtZSI6IkFmZmFuIiwic2lkIjoiNVNONWg1ZVhtUlI3bjhpWnZnZmpETnhDbXdBLlNVMVRMVUpsYm5Sc1pYa3RWVk0uMGZpVCIsIm5iZiI6MTYyNDM5NjMyMywidWx0aW1hdGVfc2l0ZSI6IjEwMDEzODkxMTciLCJ1c2FnZV9jb3VudHJ5X2lzbyI6IlVTIiwiYXV0aF90aW1lIjoxNjI0Mzk2NjIzLCJuYW1lIjoiQWZmYW4uS2hhbkBiZW50bGV5LmNvbSIsIm9yZ19uYW1lIjoiQmVudGxleSBTeXN0ZW1zIEluYyIsImZhbWlseV9uYW1lIjoiS2hhbiIsImVtYWlsIjoiQWZmYW4uS2hhbkBiZW50bGV5LmNvbSIsImV4cCI6MTYyNDYzOTU3NH0.bdIZI9rzOGV7VkpbVLomy7NkZ_h3aJ3yfHAZT-hZo6x_SLeSF_iap9cCdklBifq_1x7e9ooZGMNvIQIN3snR3KmB6HvXUaRyAppg_apjwcSrjLbuCU9LrMvBCktRRVngwj3WeXBDMBneX-QIYVEmwDV5IvrXtCxmD12hegYxxvvOy2Iw3avomvD_IMRvvRPP_OSkrzYoDPiUS2E1-9X54dqPa6v7ShdZrYaTTxAkyFD3j3rchDBwreQlu95IymU5JWx8Wy5qrhW_l2V-Po3f38RIKGq1pzLkwPDMp7XVych2eaXNlt2RwLM7NOouxLuREGDMM-p3czt_zg98XZmjsw";

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

    IModelJsHost m_host;

    @Override
    protected void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);

        WebView.setWebContentsDebuggingEnabled(true);
        boolean alwaysExtractAssets = true; // for debugging, otherwise the host will only extract when app version changes
        m_host = new IModelJsHost(this, alwaysExtractAssets, new MyAuthClient(), true );
        m_host.startup();
        String files = getFilesDir().getPath();
        MobileFrontend frontend = new MobileFrontend(m_host, "");
        frontend.getSettings().setAllowFileAccessFromFileURLs(true);;
        frontend.getSettings().setAllowUniversalAccessFromFileURLs(true);;

        m_host.setFrontend(frontend);
        frontend.loadEntryPoint();
        setContentView(frontend);
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