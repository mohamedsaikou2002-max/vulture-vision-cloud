package com.vulturevision.mobile;

import android.app.Activity;
import android.content.Intent;
import android.graphics.Color;
import android.net.Uri;
import android.os.Bundle;
import android.webkit.JavascriptInterface;
import android.webkit.WebChromeClient;
import android.webkit.WebResourceRequest;
import android.webkit.WebResourceResponse;
import android.webkit.WebSettings;
import android.webkit.WebView;
import android.webkit.WebViewClient;
import org.json.JSONObject;
import java.io.InputStream;
import java.util.Locale;

public class MainActivity extends Activity {
    private static final String HOST = "appassets.androidplatform.net";
    private WebView view;
    private String pendingAuth;

    @Override public void onCreate(Bundle state) {
        super.onCreate(state);
        getWindow().setStatusBarColor(Color.BLACK);
        getWindow().setNavigationBarColor(Color.BLACK);
        pendingAuth = validCallback(getIntent());
        view = new WebView(this);
        view.setBackgroundColor(Color.BLACK);
        WebSettings settings = view.getSettings();
        settings.setJavaScriptEnabled(true);
        settings.setDomStorageEnabled(true);
        settings.setAllowFileAccess(false);
        settings.setAllowContentAccess(false);
        settings.setMixedContentMode(WebSettings.MIXED_CONTENT_NEVER_ALLOW);
        view.addJavascriptInterface(new MobileBridge(), "VultureAndroid");
        view.setWebChromeClient(new WebChromeClient());
        view.setWebViewClient(new WebViewClient() {
            @Override public WebResourceResponse shouldInterceptRequest(WebView webView, WebResourceRequest request) {
                Uri uri = request.getUrl();
                if (!"https".equals(uri.getScheme()) || !HOST.equals(uri.getHost())) return null;
                String relative = uri.getPath();
                if (relative == null || relative.isEmpty() || relative.equals("/")) relative = "/index.html";
                if (relative.contains("..") || relative.contains("\\")) return new WebResourceResponse("text/plain", "UTF-8", null);
                if (relative.equals("/dashboard") || relative.equals("/analytics") || relative.equals("/news")
                    || relative.equals("/socioeconomics") || relative.equals("/simulations")) relative = "/index.html";
                String mime = mimeFor(relative);
                try {
                    InputStream stream = getAssets().open("web" + relative);
                    return new WebResourceResponse(mime, "UTF-8", stream);
                } catch (Exception ignored) {
                    return new WebResourceResponse("text/plain", "UTF-8", null);
                }
            }
            @Override public boolean shouldOverrideUrlLoading(WebView webView, WebResourceRequest request) {
                Uri uri = request.getUrl();
                if ("https".equals(uri.getScheme()) && HOST.equals(uri.getHost())) return false;
                if (!request.isForMainFrame()) return false;
                openSystemBrowser(uri.toString());
                return true;
            }
        });
        setContentView(view);
        view.loadUrl("https://" + HOST + "/");
    }

    private static String mimeFor(String path) {
        String p = path.toLowerCase(Locale.ROOT);
        if (p.endsWith(".js")) return "text/javascript";
        if (p.endsWith(".css")) return "text/css";
        if (p.endsWith(".json")) return "application/json";
        if (p.endsWith(".svg")) return "image/svg+xml";
        if (p.endsWith(".png")) return "image/png";
        if (p.endsWith(".jpg") || p.endsWith(".jpeg")) return "image/jpeg";
        if (p.endsWith(".webp")) return "image/webp";
        if (p.endsWith(".woff2")) return "font/woff2";
        if (p.endsWith(".mp4")) return "video/mp4";
        if (p.endsWith(".ico")) return "image/x-icon";
        return "text/html";
    }

    private String validCallback(Intent intent) {
        Uri uri = intent == null ? null : intent.getData();
        if (uri != null && "vulturevision".equals(uri.getScheme())
            && "auth".equals(uri.getHost()) && "/callback".equals(uri.getPath()))
            return uri.toString();
        return null;
    }

    @Override protected void onNewIntent(Intent intent) {
        super.onNewIntent(intent);
        setIntent(intent);
        String callback = validCallback(intent);
        if (callback != null) {
            pendingAuth = callback;
            if (view != null) {
                String safe = JSONObject.quote(callback);
                view.evaluateJavascript("window.dispatchEvent(new CustomEvent('vv-auth-callback',{detail:" + safe + "}));", null);
            }
        }
    }

    private void openSystemBrowser(String address) {
        try {
            Uri uri = Uri.parse(address);
            if (!"https".equals(uri.getScheme()) && !"http".equals(uri.getScheme())) return;
            startActivity(new Intent(Intent.ACTION_VIEW, uri).addCategory(Intent.CATEGORY_BROWSABLE));
        } catch (Exception ignored) { }
    }

    private final class MobileBridge {
        @JavascriptInterface public void openExternal(String address) {
            runOnUiThread(() -> openSystemBrowser(address));
        }
        @JavascriptInterface public String consumeAuthCallback() {
            String cb = pendingAuth;
            pendingAuth = null;
            return cb == null ? "" : cb;
        }
    }

    @Override public void onBackPressed() {
        if (view != null && view.canGoBack()) view.goBack();
        else super.onBackPressed();
    }
}
