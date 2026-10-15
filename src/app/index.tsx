import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
  BackHandler,
  Linking,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { StatusBar } from 'expo-status-bar';
import {
  WebView,
  WebViewNavigation,
} from 'react-native-webview';
import type { ShouldStartLoadRequest } from 'react-native-webview/lib/WebViewTypes';

const TARGET_URL = 'https://zeitnahacademy.com';

export default function HomeScreen() {
  const webViewRef = useRef<WebView>(null);
  const [canGoBack, setCanGoBack] = useState(false);
  const [loadProgress, setLoadProgress] = useState(0);
  const [hasError, setHasError] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');

  // Support Android hardware back button to navigate WebView history
  useEffect(() => {
    if (Platform.OS !== 'android') return;

    const handleBackPress = () => {
      if (canGoBack && webViewRef.current) {
        webViewRef.current.goBack();
        return true;
      }
      return false;
    };

    const subscription = BackHandler.addEventListener(
      'hardwareBackPress',
      handleBackPress
    );
    return () => subscription.remove();
  }, [canGoBack]);

  const handleNavigationStateChange = (navState: WebViewNavigation) => {
    setCanGoBack(navState.canGoBack);
    if (!navState.loading && hasError) {
      setHasError(false);
    }
  };

  const handleRetry = useCallback(() => {
    setHasError(false);
    setErrorMessage('');
    setLoadProgress(0);
    webViewRef.current?.reload();
  }, []);

  // Safe external URL handling without breaking internal single-page navigation
  const handleShouldStartLoadWithRequest = (
    request: ShouldStartLoadRequest
  ): boolean => {
    const { url, isTopFrame } = request;

    // Always allow non-top-frame (iframes, embedded media players like VdoCipher / BunnyCDN)
    if (isTopFrame === false) {
      return true;
    }

    // Allow internal protocols
    if (
      url.startsWith('about:') ||
      url.startsWith('data:') ||
      url.startsWith('blob:')
    ) {
      return true;
    }

    // Handle communication / device schemes directly
    if (
      url.startsWith('tel:') ||
      url.startsWith('mailto:') ||
      url.startsWith('sms:') ||
      url.startsWith('whatsapp:') ||
      url.startsWith('intent:')
    ) {
      Linking.openURL(url).catch((err) => {
        console.warn('Failed to open app link:', err);
      });
      return false;
    }

    try {
      const parsedUrl = new URL(url);
      const host = parsedUrl.hostname.toLowerCase();

      // Check if internal domain
      const isInternal =
        host === 'zeitnahacademy.com' || host.endsWith('.zeitnahacademy.com');

      // Check for identity / OAuth login providers that need top-frame navigation
      const isAuthFlow =
        host === 'accounts.google.com' ||
        host.endsWith('.accounts.google.com') ||
        host === 'appleid.apple.com';

      // Check for common file downloads by extension
      const isDownloadable = /\.(pdf|zip|apk|epub|docx?|xlsx?|pptx?)$/i.test(
        parsedUrl.pathname
      );

      if (isDownloadable) {
        Linking.openURL(url).catch((err) => {
          console.warn('Failed to trigger download:', err);
        });
        return false;
      }

      if (isInternal || isAuthFlow) {
        return true;
      }

      // External websites (social media, docs, partners) open in default device browser
      Linking.openURL(url).catch((err) => {
        console.warn('Failed to open external URL:', err);
      });
      return false;
    } catch {
      return true;
    }
  };

  return (
    <SafeAreaView style={styles.container} edges={['top', 'left', 'right']}>
      <StatusBar style="light" />

      {/* Progress Bar for page transitions */}
      {loadProgress > 0 && loadProgress < 1 && (
        <View style={styles.progressBarContainer}>
          <View
            style={[
              styles.progressBar,
              { width: `${Math.round(loadProgress * 100)}%` },
            ]}
          />
        </View>
      )}

      {/* Error Fallback View */}
      {hasError ? (
        <View style={styles.errorContainer}>
          <View style={styles.errorCard}>
            <View style={styles.errorIconBadge}>
              <Text style={styles.errorIconText}>!</Text>
            </View>
            <Text style={styles.errorTitle}>Connection Failed</Text>
            <Text style={styles.errorSubtitle}>
              {errorMessage ||
                'Unable to reach Zeitnah Academy. Please check your internet connection and try again.'}
            </Text>
            <Pressable
              style={({ pressed }) => [
                styles.retryButton,
                pressed && styles.retryButtonPressed,
              ]}
              onPress={handleRetry}>
              <Text style={styles.retryButtonText}>Retry</Text>
            </Pressable>
          </View>
        </View>
      ) : (
        <WebView
          ref={webViewRef}
          source={{ uri: TARGET_URL }}
          style={styles.webView}
          // Scripting & Storage for full authentication support
          javaScriptEnabled={true}
          domStorageEnabled={true}
          sharedCookiesEnabled={true}
          thirdPartyCookiesEnabled={true}
          // Media & Video Playback
          allowsInlineMediaPlayback={true}
          mediaPlaybackRequiresUserAction={false}
          allowsFullscreenVideo={true}
          androidLayerType="hardware"
          // Navigation & Security
          originWhitelist={['*']}
          mixedContentMode="compatibility"
          onNavigationStateChange={handleNavigationStateChange}
          onShouldStartLoadWithRequest={handleShouldStartLoadWithRequest}
          // Progress & Load status
          onLoadStart={() => {
            setHasError(false);
          }}
          onLoadProgress={({ nativeEvent }) => {
            setLoadProgress(nativeEvent.progress);
          }}
          onError={({ nativeEvent }) => {
            setHasError(true);
            setErrorMessage(
              nativeEvent.description || 'Failed to load page content'
            );
          }}
          onHttpError={({ nativeEvent }) => {
            if (nativeEvent.statusCode >= 500) {
              setHasError(true);
              setErrorMessage(`Server error (${nativeEvent.statusCode})`);
            }
          }}
          // File downloads support
          onFileDownload={({ nativeEvent: { downloadUrl } }) => {
            if (downloadUrl) {
              Linking.openURL(downloadUrl).catch((err) => {
                console.warn('Failed to open downloaded file URL:', err);
              });
            }
          }}
          // Layout & Behavior
          scalesPageToFit={false}
          textZoom={100}
          pullToRefreshEnabled={true}
          applicationNameForUserAgent="ZeitnahMobile/1.0.3"
          renderLoading={() => (
            <View style={styles.loadingContainer}>
              <ActivityIndicator size="large" color="#208AEF" />
              <Text style={styles.loadingText}>Loading Zeitnah...</Text>
            </View>
          )}
          startInLoadingState={true}
        />
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#070B14',
  },
  webView: {
    flex: 1,
    backgroundColor: '#070B14',
  },
  progressBarContainer: {
    height: 3,
    width: '100%',
    backgroundColor: 'transparent',
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    zIndex: 999,
  },
  progressBar: {
    height: 3,
    backgroundColor: '#208AEF',
  },
  loadingContainer: {
    ...StyleSheet.absoluteFill,
    backgroundColor: '#070B14',
    justifyContent: 'center',
    alignItems: 'center',
    zIndex: 10,
  },
  loadingText: {
    marginTop: 14,
    color: '#94A3B8',
    fontSize: 14,
    fontWeight: '500',
    letterSpacing: 0.3,
  },
  errorContainer: {
    flex: 1,
    backgroundColor: '#070B14',
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 24,
  },
  errorCard: {
    width: '100%',
    maxWidth: 360,
    backgroundColor: '#0D1527',
    borderRadius: 16,
    padding: 24,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#1E293B',
  },
  errorIconBadge: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: 'rgba(239, 68, 68, 0.15)',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 16,
    borderWidth: 1,
    borderColor: 'rgba(239, 68, 68, 0.3)',
  },
  errorIconText: {
    color: '#EF4444',
    fontSize: 24,
    fontWeight: '700',
  },
  errorTitle: {
    color: '#F8FAFC',
    fontSize: 18,
    fontWeight: '600',
    marginBottom: 8,
    textAlign: 'center',
  },
  errorSubtitle: {
    color: '#94A3B8',
    fontSize: 14,
    lineHeight: 20,
    textAlign: 'center',
    marginBottom: 24,
  },
  retryButton: {
    backgroundColor: '#208AEF',
    paddingVertical: 12,
    paddingHorizontal: 32,
    borderRadius: 10,
    width: '100%',
    alignItems: 'center',
  },
  retryButtonPressed: {
    opacity: 0.8,
    transform: [{ scale: 0.98 }],
  },
  retryButtonText: {
    color: '#FFFFFF',
    fontSize: 15,
    fontWeight: '600',
  },
});
