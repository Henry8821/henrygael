package com.novastrike.game;

import android.app.Activity;
import android.os.Build;
import android.os.Bundle;
import android.os.Vibrator;
import android.util.Log;
import android.view.View;
import android.view.Window;
import android.view.WindowManager;
import android.webkit.ConsoleMessage;
import android.webkit.WebChromeClient;
import android.webkit.WebSettings;
import android.webkit.WebView;
import android.webkit.WebViewClient;
import android.widget.Toast;

/**
 * NOVA STRIKE - GameActivity
 *
 * Runs the full HTML5 game inside a hardware-accelerated full-screen WebView.
 * Assets loaded from: file:///android_asset/www/index.html
 *
 * minSdkVersion=21  targetSdkVersion=29
 * SDK path: C:\Users\HP\android-sdks
 * Installed platforms: android-23, android-29
 */
public class GameActivity extends Activity {

    private static final String TAG      = "NovaStrike";
    private static final String GAME_URL = "file:///android_asset/www/index.html";

    private WebView mWebView;

    @Override
    protected void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);

        // Remove title bar
        requestWindowFeature(Window.FEATURE_NO_TITLE);

        // Fullscreen window
        getWindow().setFlags(
            WindowManager.LayoutParams.FLAG_FULLSCREEN,
            WindowManager.LayoutParams.FLAG_FULLSCREEN);

        // Keep screen on during gameplay
        getWindow().addFlags(WindowManager.LayoutParams.FLAG_KEEP_SCREEN_ON);

        // WebView is the only view
        mWebView = new WebView(this);
        setContentView(mWebView);

        // Full immersive mode — hides nav bar and status bar
        applyImmersiveMode();

        // Configure WebView settings
        setupWebSettings();

        // Set up clients
        setupWebViewClient();
        setupWebChromeClient();

        // Attach JS bridge
        mWebView.addJavascriptInterface(new JsBridge(), "AndroidBridge");

        // Load the game
        mWebView.loadUrl(GAME_URL);
    }

    // ── Immersive fullscreen ──────────────────────────────────────────
    private void applyImmersiveMode() {
        mWebView.setSystemUiVisibility(
            View.SYSTEM_UI_FLAG_LAYOUT_STABLE
            | View.SYSTEM_UI_FLAG_LAYOUT_HIDE_NAVIGATION
            | View.SYSTEM_UI_FLAG_LAYOUT_FULLSCREEN
            | View.SYSTEM_UI_FLAG_HIDE_NAVIGATION
            | View.SYSTEM_UI_FLAG_FULLSCREEN
            | View.SYSTEM_UI_FLAG_IMMERSIVE_STICKY);
    }

    // ── WebSettings ───────────────────────────────────────────────────
    private void setupWebSettings() {
        WebSettings ws = mWebView.getSettings();

        // JavaScript — required for the game
        ws.setJavaScriptEnabled(true);

        // localStorage — saves scores, settings, achievements
        ws.setDomStorageEnabled(true);
        ws.setDatabaseEnabled(true);

        // Allow file:// to load other file:// resources (game assets)
        ws.setAllowFileAccessFromFileURLs(true);
        ws.setAllowUniversalAccessFromFileURLs(true);

        // Web Audio API — play sounds without user gesture
        ws.setMediaPlaybackRequiresUserGesture(false);

        // Viewport — fill the screen properly
        ws.setLoadWithOverviewMode(true);
        ws.setUseWideViewPort(true);

        // No zoom in a game
        ws.setSupportZoom(false);
        ws.setBuiltInZoomControls(false);
        ws.setDisplayZoomControls(false);

        // Cache
        ws.setCacheMode(WebSettings.LOAD_DEFAULT);

        // Mixed content — needed for CDN resources (Bootstrap, FontAwesome)
        if (Build.VERSION.SDK_INT >= 21) {
            ws.setMixedContentMode(WebSettings.MIXED_CONTENT_ALWAYS_ALLOW);
        }
    }

    // ── WebViewClient ─────────────────────────────────────────────────
    private void setupWebViewClient() {
        mWebView.setWebViewClient(new WebViewClient() {

            @Override
            public boolean shouldOverrideUrlLoading(WebView view, String url) {
                view.loadUrl(url);
                return true;
            }

            @Override
            public void onPageFinished(WebView view, String url) {
                super.onPageFinished(view, url);
                // Inject Android compatibility polyfills
                view.loadUrl("javascript:(function(){"
                    + "window.IS_ANDROID=true;"
                    + "if(!CanvasRenderingContext2D.prototype.roundRect){"
                    + "CanvasRenderingContext2D.prototype.roundRect=function(x,y,w,h,r){"
                    + "this.beginPath();"
                    + "this.moveTo(x+r,y);this.lineTo(x+w-r,y);"
                    + "this.arcTo(x+w,y,x+w,y+r,r);this.lineTo(x+w,y+h-r);"
                    + "this.arcTo(x+w,y+h,x+w-r,y+h,r);this.lineTo(x+r,y+h);"
                    + "this.arcTo(x,y+h,x,y+h-r,r);this.lineTo(x,y+r);"
                    + "this.arcTo(x,y,x+r,y,r);this.closePath();};"
                    + "}"
                    + "window.onerror=function(m,s,l){console.log('ERR:'+m+' '+s+':'+l);return true;};"
                    + "})();");
            }
        });
    }

    // ── WebChromeClient ───────────────────────────────────────────────
    private void setupWebChromeClient() {
        mWebView.setWebChromeClient(new WebChromeClient() {
            @Override
            public boolean onConsoleMessage(ConsoleMessage cm) {
                Log.d(TAG, cm.message()
                    + " [" + cm.sourceId() + ":" + cm.lineNumber() + "]");
                return true;
            }
        });
    }

    // ── Lifecycle ─────────────────────────────────────────────────────

    @Override
    public void onBackPressed() {
        // Pause game on back press instead of closing app
        mWebView.loadUrl("javascript:"
            + "if(window.G&&window.G.running&&!window.G.paused)"
            + "{if(window.togglePause)togglePause();}");
    }

    @Override
    protected void onPause() {
        super.onPause();
        mWebView.loadUrl("javascript:"
            + "if(window.G&&window.G.running&&!window.G.paused)"
            + "{if(window.togglePause)togglePause();}");
        mWebView.onPause();
    }

    @Override
    protected void onResume() {
        super.onResume();
        mWebView.onResume();
        applyImmersiveMode();
    }

    @Override
    protected void onDestroy() {
        if (mWebView != null) {
            mWebView.stopLoading();
            mWebView.destroy();
            mWebView = null;
        }
        super.onDestroy();
    }

    // ── JavaScript Bridge ─────────────────────────────────────────────

    public class JsBridge {

        /** Show a native Android Toast notification */
        public void showToast(final String message) {
            runOnUiThread(new Runnable() {
                public void run() {
                    Toast.makeText(GameActivity.this,
                        message, Toast.LENGTH_SHORT).show();
                }
            });
        }

        /** Vibrate device for given milliseconds */
        public void vibrate(final int ms) {
            Vibrator v = (Vibrator) getSystemService(VIBRATOR_SERVICE);
            if (v != null) {
                v.vibrate(ms);
            }
        }

        /** Returns "android" so game JS knows the platform */
        public String getPlatform() {
            return "android";
        }

        /** Returns Android API level */
        public int getApiLevel() {
            return Build.VERSION.SDK_INT;
        }
    }
}
