package com.ytmusic.mobile;

import android.app.Dialog;
import android.content.Context;
import android.content.Intent;
import android.graphics.Bitmap;
import android.graphics.Color;
import android.graphics.Typeface;
import android.net.Uri;
import android.os.Bundle;
import android.util.TypedValue;
import android.view.Gravity;
import android.view.View;
import android.view.ViewGroup;
import android.view.Window;
import android.view.WindowManager;
import android.webkit.CookieManager;
import android.webkit.WebChromeClient;
import android.webkit.WebResourceRequest;
import android.webkit.WebSettings;
import android.webkit.WebView;
import android.webkit.WebViewClient;
import android.widget.LinearLayout;
import android.widget.ProgressBar;
import android.widget.TextView;

import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;

@CapacitorPlugin(name = "GoogleAuth")
public class GoogleAuthPlugin extends Plugin {

    private static final String YOUTUBE_MUSIC_LOGIN_URL =
            "https://accounts.google.com/ServiceLogin?service=youtube&passive=true&continue=https%3A%2F%2Fmusic.youtube.com%2F";
    private static final String USER_AGENT_CHROME_MOBILE =
            "Mozilla/5.0 (Linux; Android 14; Pixel 8 Pro) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.6778.200 Mobile Safari/537.36";

    private Dialog loginDialog;
    private PluginCall activeCall;

    @PluginMethod
    public void openSystemBrowser(PluginCall call) {
        getActivity().runOnUiThread(() -> {
            try {
                String url = call.getString("url", YOUTUBE_MUSIC_LOGIN_URL);
                Intent browserIntent = new Intent(Intent.ACTION_VIEW, Uri.parse(url));
                browserIntent.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK);
                getContext().startActivity(browserIntent);
                JSObject ret = new JSObject();
                ret.put("status", "browser_opened");
                ret.put("url", url);
                call.resolve(ret);
            } catch (Exception e) {
                call.reject("Fehler beim Öffnen des mobilen Browsers: " + e.getMessage());
            }
        });
    }

    @PluginMethod
    public void signIn(PluginCall call) {
        // As requested: Open normal mobile browser!
        openSystemBrowser(call);
    }

    @PluginMethod
    public void signInEmbedded(PluginCall call) {
        getActivity().runOnUiThread(() -> {
            try {
                this.activeCall = call;
                showLoginDialog();
            } catch (Exception e) {
                call.reject("Google Login konnte nicht gestartet werden: " + e.getMessage());
            }
        });
    }

    @PluginMethod
    public void signOut(PluginCall call) {
        getActivity().runOnUiThread(() -> {
            try {
                CookieManager cookieManager = CookieManager.getInstance();
                cookieManager.removeAllCookies(null);
                cookieManager.flush();
                JSObject ret = new JSObject();
                ret.put("status", "logged_out");
                call.resolve(ret);
            } catch (Exception e) {
                call.reject("Logout fehlgeschlagen: " + e.getMessage());
            }
        });
    }

    private void showLoginDialog() {
        Context context = getContext();

        loginDialog = new Dialog(context, android.R.style.Theme_Black_NoTitleBar_Fullscreen);
        Window window = loginDialog.getWindow();
        if (window != null) {
            window.setLayout(ViewGroup.LayoutParams.MATCH_PARENT, ViewGroup.LayoutParams.MATCH_PARENT);
            window.addFlags(WindowManager.LayoutParams.FLAG_DRAWS_SYSTEM_BAR_BACKGROUNDS);
            window.setStatusBarColor(Color.parseColor("#121212"));
        }

        LinearLayout rootLayout = new LinearLayout(context);
        rootLayout.setOrientation(LinearLayout.VERTICAL);
        rootLayout.setBackgroundColor(Color.parseColor("#0d0d0d"));

        // Header Bar
        LinearLayout header = new LinearLayout(context);
        header.setOrientation(LinearLayout.HORIZONTAL);
        header.setPadding(dpToPx(16), dpToPx(14), dpToPx(16), dpToPx(14));
        header.setGravity(Gravity.CENTER_VERTICAL);
        header.setBackgroundColor(Color.parseColor("#161616"));

        TextView logoView = new TextView(context);
        logoView.setText("G");
        logoView.setTextColor(Color.parseColor("#4285F4"));
        logoView.setTextSize(TypedValue.COMPLEX_UNIT_SP, 20);
        logoView.setTypeface(Typeface.DEFAULT_BOLD);
        logoView.setPadding(0, 0, dpToPx(10), 0);
        header.addView(logoView);

        LinearLayout titleCol = new LinearLayout(context);
        titleCol.setOrientation(LinearLayout.VERTICAL);
        LinearLayout.LayoutParams titleColParams =
                new LinearLayout.LayoutParams(0, ViewGroup.LayoutParams.WRAP_CONTENT, 1.0f);

        TextView titleView = new TextView(context);
        titleView.setText("Mit Google anmelden");
        titleView.setTextColor(Color.WHITE);
        titleView.setTextSize(TypedValue.COMPLEX_UNIT_SP, 15);
        titleView.setTypeface(Typeface.DEFAULT_BOLD);
        titleCol.addView(titleView);

        TextView subTitleView = new TextView(context);
        subTitleView.setText("YouTube Music Konto verknüpfen");
        subTitleView.setTextColor(Color.parseColor("#888888"));
        subTitleView.setTextSize(TypedValue.COMPLEX_UNIT_SP, 11);
        titleCol.addView(subTitleView);

        header.addView(titleCol, titleColParams);

        TextView closeBtn = new TextView(context);
        closeBtn.setText("✕");
        closeBtn.setTextColor(Color.parseColor("#cccccc"));
        closeBtn.setTextSize(TypedValue.COMPLEX_UNIT_SP, 18);
        closeBtn.setPadding(dpToPx(12), dpToPx(6), dpToPx(8), dpToPx(6));
        closeBtn.setOnClickListener(v -> {
            if (activeCall != null) {
                activeCall.reject("Anmeldung abgebrochen");
                activeCall = null;
            }
            loginDialog.dismiss();
        });
        header.addView(closeBtn);

        rootLayout.addView(
                header,
                new LinearLayout.LayoutParams(
                        ViewGroup.LayoutParams.MATCH_PARENT, ViewGroup.LayoutParams.WRAP_CONTENT));

        // Loading ProgressBar
        ProgressBar progressBar =
                new ProgressBar(context, null, android.R.attr.progressBarStyleHorizontal);
        progressBar.setMax(100);
        progressBar.setProgress(0);
        progressBar.setLayoutParams(
                new LinearLayout.LayoutParams(ViewGroup.LayoutParams.MATCH_PARENT, dpToPx(3)));
        rootLayout.addView(progressBar);

        // WebView
        WebView webView = new WebView(context);
        LinearLayout.LayoutParams webViewParams =
                new LinearLayout.LayoutParams(ViewGroup.LayoutParams.MATCH_PARENT, 0, 1.0f);
        rootLayout.addView(webView, webViewParams);

        WebSettings settings = webView.getSettings();
        settings.setJavaScriptEnabled(true);
        settings.setDomStorageEnabled(true);
        settings.setDatabaseEnabled(true);
        settings.setSaveFormData(true);
        settings.setJavaScriptCanOpenWindowsAutomatically(true);
        settings.setSupportMultipleWindows(false);
        settings.setCacheMode(WebSettings.LOAD_DEFAULT);
        // Google blocks sign-in for user agents marked as WebView ("; wv") -> use the real
        // Chrome UA of this device without the WebView marker
        String ua = settings.getUserAgentString();
        if (ua == null || ua.isEmpty()) ua = USER_AGENT_CHROME_MOBILE;
        ua = ua.replace("; wv)", ")").replace(" Version/4.0", "");
        settings.setUserAgentString(ua);

        CookieManager cookieManager = CookieManager.getInstance();
        cookieManager.setAcceptCookie(true);
        cookieManager.setAcceptThirdPartyCookies(webView, true);

        webView.setWebChromeClient(
                new WebChromeClient() {
                    @Override
                    public void onProgressChanged(WebView view, int newProgress) {
                        progressBar.setProgress(newProgress);
                        if (newProgress >= 100) {
                            progressBar.setVisibility(View.GONE);
                        } else {
                            progressBar.setVisibility(View.VISIBLE);
                        }
                    }
                });

        webView.setWebViewClient(
                new WebViewClient() {
                    private boolean checkAndResolveAuth(String currentUrl) {
                        if (currentUrl == null || activeCall == null) return false;
                        String host = Uri.parse(currentUrl).getHost();
                        // Only accept once Google redirected back to YouTube Music
                        if (host == null || !host.equals("music.youtube.com")) return false;

                        CookieManager cm = CookieManager.getInstance();
                        String cookie = cm.getCookie("https://music.youtube.com");
                        if (cookie == null) return false;
                        boolean hasAuth = cookie.contains("SAPISID=") || cookie.contains("__Secure-3PAPISID=");
                        if (!hasAuth) return false;

                        cm.flush();
                        JSObject ret = new JSObject();
                        ret.put("status", "success");
                        ret.put("cookie", cookie);
                        activeCall.resolve(ret);
                        activeCall = null;
                        if (loginDialog != null && loginDialog.isShowing()) {
                            loginDialog.dismiss();
                        }
                        return true;
                    }

                    @Override
                    public void onPageStarted(WebView view, String url, Bitmap favicon) {
                        super.onPageStarted(view, url, favicon);
                        checkAndResolveAuth(url);
                    }

                    @Override
                    public void onPageFinished(WebView view, String url) {
                        super.onPageFinished(view, url);
                        checkAndResolveAuth(url);
                    }

                    @Override
                    public boolean shouldOverrideUrlLoading(WebView view, WebResourceRequest request) {
                        String url = request.getUrl().toString();
                        String scheme = request.getUrl().getScheme();
                        // intent:// etc. cannot be opened inside the login window
                        if (scheme != null && !scheme.startsWith("http")) return true;
                        return checkAndResolveAuth(url);
                    }
                });

        loginDialog.setOnCancelListener(
                d -> {
                    if (activeCall != null) {
                        activeCall.reject("Anmeldung abgebrochen");
                        activeCall = null;
                    }
                });

        loginDialog.setContentView(rootLayout);
        loginDialog.show();

        webView.loadUrl(YOUTUBE_MUSIC_LOGIN_URL);
    }

    private int dpToPx(int dp) {
        float density = getContext().getResources().getDisplayMetrics().density;
        return Math.round(dp * density);
    }
}
