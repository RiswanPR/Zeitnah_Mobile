import React, {
  forwardRef,
  memo,
  useCallback,
  useEffect,
  useImperativeHandle,
  useRef,
  useState,
} from 'react';
import {
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
import { WebView, WebViewNavigation } from 'react-native-webview';
import type {
  ShouldStartLoadRequest,
  WebViewErrorEvent,
  WebViewHttpErrorEvent,
  WebViewMessageEvent,
  WebViewRenderProcessGoneEvent,
} from 'react-native-webview/lib/WebViewTypes';
import { useNetInfo } from '@react-native-community/netinfo';

import { CinematicLoader } from '@/components/cinematic-loader';
import {
  VdoPlayerEmbedded,
  type VdoEmbedInfo,
  type VdoPlayerLayout,
  type VdoPlayerEmbeddedRef,
} from '@/components/vdo-player-embedded';
import { ZeitnahColors } from '@/constants/theme';

const TARGET_URL = 'https://zeitnahacademy.com';
const WEBVIEW_SOURCE = { uri: TARGET_URL };
const ANDROID_CHROME_USER_AGENT =
  'Mozilla/5.0 (Linux; Android 14; Mobile) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/133.0.0.0 Mobile Safari/537.36';

interface WebProgressBarRef {
  setProgress: (value: number) => void;
  finish: () => void;
  reset: () => void;
}

const WebProgressBar = memo(
  forwardRef<WebProgressBarRef>(function WebProgressBar(_, ref) {
    const [progress, setProgressState] = useState(0);

    useImperativeHandle(
      ref,
      () => ({
        setProgress: (value: number) => {
          setProgressState(value);
        },
        finish: () => {
          setProgressState(1);
          setTimeout(() => {
            setProgressState(0);
          }, 150);
        },
        reset: () => {
          setProgressState(0);
        },
      }),
      []
    );

    if (progress <= 0 || progress >= 1) {
      return null;
    }

    return (
      <View style={styles.progressBarContainer} pointerEvents="none">
        <View
          style={[
            styles.progressBar,
            { width: `${Math.round(progress * 100)}%` },
          ]}
        />
      </View>
    );
  })
);

interface OfflineBannerProps {
  visible: boolean;
}

const OfflineBanner = memo(function OfflineBanner({ visible }: OfflineBannerProps) {
  if (!visible) return null;

  return (
    <View style={styles.offlineBannerContainer} pointerEvents="none">
      <View style={styles.offlineBannerPill}>
        <View style={styles.offlineDot} />
        <Text style={styles.offlineText}>Offline — Showing cached content</Text>
      </View>
    </View>
  );
});

interface ErrorOverlayProps {
  message: string;
  isOffline: boolean;
  onRetry: () => void;
}

const ErrorOverlay = memo(function ErrorOverlay({
  message,
  isOffline,
  onRetry,
}: ErrorOverlayProps) {
  const displayTitle = isOffline ? 'No Internet Connection' : 'Connection Failed';
  const displaySubtitle =
    message ||
    (isOffline
      ? 'Please check your Wi-Fi or mobile data connection and try again.'
      : 'Unable to reach Zeitnah Academy. Please check your network and try again.');

  return (
    <View style={styles.errorContainer} pointerEvents="box-none">
      <View style={styles.errorCard} pointerEvents="auto">
        <View
          style={[
            styles.errorIconBadge,
            isOffline && styles.errorIconBadgeOffline,
          ]}>
          <Text
            style={[
              styles.errorIconText,
              isOffline && styles.errorIconTextOffline,
            ]}>
            !
          </Text>
        </View>
        <Text style={styles.errorTitle}>{displayTitle}</Text>
        <Text style={styles.errorSubtitle}>{displaySubtitle}</Text>
        <Pressable
          style={({ pressed }) => [
            styles.retryButton,
            pressed && styles.retryButtonPressed,
          ]}
          onPress={onRetry}>
          <Text style={styles.retryButtonText}>Retry</Text>
        </Pressable>
      </View>
    </View>
  );
});

export default function HomeScreen() {
  const webViewRef = useRef<WebView>(null);
  const progressBarRef = useRef<WebProgressBarRef>(null);
  const canGoBackRef = useRef(false);
  const [isReady, setIsReady] = useState(false);
  const [hasError, setHasError] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');

  // Native online/offline state
  const netInfo = useNetInfo();
  const isOffline =
    netInfo.isConnected === false || netInfo.isInternetReachable === false;

  // Native VdoCipher player state (Embedded hardware FairPlay/Widevine player)
  const [nativePlayerEmbedInfo, setNativePlayerEmbedInfo] =
    useState<VdoEmbedInfo | null>(null);
  const [nativePlayerLayout, setNativePlayerLayout] =
    useState<VdoPlayerLayout | null>(null);
  const [isNativePlayerVisible, setIsNativePlayerVisible] = useState(false);
  const [isNativePlayerFullscreen, setIsNativePlayerFullscreen] = useState(false);
  const isNativePlayerVisibleRef = useRef(false);
  const nativePlayerEmbedInfoRef = useRef<VdoEmbedInfo | null>(null);
  const vdoPlayerRef = useRef<VdoPlayerEmbeddedRef>(null);

  const handleCloseNativePlayer = useCallback(() => {
    isNativePlayerVisibleRef.current = false;
    nativePlayerEmbedInfoRef.current = null;
    setIsNativePlayerVisible(false);
    setNativePlayerEmbedInfo(null);
    setNativePlayerLayout(null);
    setIsNativePlayerFullscreen(false);
    webViewRef.current?.injectJavaScript(`
      if (typeof window.__onNativeVdoPlayerClosed === 'function') {
        window.__onNativeVdoPlayerClosed();
      }
      true;
    `);
  }, []);

  const handleNativePlayerProgress = useCallback(
    (progress: {
      currentTimeMs: number;
      currentTimeSeconds: number;
      durationMs?: number;
      durationSeconds?: number;
    }) => {
      const currentTimeMs =
        typeof progress?.currentTimeMs === 'number'
          ? progress.currentTimeMs
          : 0;
      const currentTimeSeconds =
        typeof progress?.currentTimeSeconds === 'number'
          ? progress.currentTimeSeconds
          : Math.round((currentTimeMs / 1000) * 100) / 100;
      const durationSeconds =
        typeof progress?.durationSeconds === 'number'
          ? progress.durationSeconds
          : typeof progress?.durationMs === 'number' && progress.durationMs > 0
          ? Math.round((progress.durationMs / 1000) * 100) / 100
          : undefined;
      const classId = nativePlayerEmbedInfoRef.current?.classId;

      webViewRef.current?.injectJavaScript(`
        if (typeof window.__onNativeVdoProgress === 'function') {
          window.__onNativeVdoProgress({
            currentTimeMs: ${currentTimeMs},
            currentTimeSeconds: ${currentTimeSeconds},
            ${typeof durationSeconds === 'number' ? `durationSeconds: ${durationSeconds},` : ''}
            ${classId ? `classId: ${JSON.stringify(classId)},` : ''}
            completed: false
          });
        }
        true;
      `);
    },
    []
  );

  const handleNativePlayerEnded = useCallback(() => {
    const classId = nativePlayerEmbedInfoRef.current?.classId;
    webViewRef.current?.injectJavaScript(`
      if (typeof window.__onNativeVdoProgress === 'function') {
        window.__onNativeVdoProgress({
          completed: true,
          ${classId ? `classId: ${JSON.stringify(classId)}` : ''}
        });
      }
      true;
    `);
  }, []);

  const handleNativePlayerError = useCallback((errorMessage: string) => {
    webViewRef.current?.injectJavaScript(`
      if (typeof window.__onNativeVdoError === 'function') {
        window.__onNativeVdoError(${JSON.stringify(errorMessage)});
      }
      true;
    `);
  }, []);

  // Auto-retry when connection restores after a connection failure
  const prevOfflineRef = useRef(isOffline);
  useEffect(() => {
    if (prevOfflineRef.current && !isOffline && hasError) {
      setHasError(false);
      setErrorMessage('');
      webViewRef.current?.reload();
    }
    prevOfflineRef.current = isOffline;
  }, [isOffline, hasError]);

  // Register Android hardware back-button listener
  useEffect(() => {
    if (Platform.OS !== 'android') return;

    const handleBackPress = () => {
      // If native video player is in fullscreen, exit fullscreen first
      if (isNativePlayerVisible && isNativePlayerFullscreen) {
        const handled = vdoPlayerRef.current?.handleBackButtonClick();
        if (handled) return true;
      }

      // If native video player is active (and not fullscreen), close it
      if (isNativePlayerVisible) {
        handleCloseNativePlayer();
        return true;
      }

      // If error overlay is active and user can go back, navigate back and clear error
      if (hasError && canGoBackRef.current && webViewRef.current) {
        setHasError(false);
        setErrorMessage('');
        webViewRef.current.goBack();
        return true;
      }

      // If in-WebView navigation can go back, navigate back
      if (canGoBackRef.current && webViewRef.current) {
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
  }, [hasError, isNativePlayerVisible, isNativePlayerFullscreen, handleCloseNativePlayer]);

  const handleNavigationStateChange = useCallback((navState: WebViewNavigation) => {
    canGoBackRef.current = navState.canGoBack;
    if (!navState.loading) {
      setIsReady(true);
      setHasError((prev) => (prev ? false : prev));
    }

    // Automatically close native player if the user navigates away from class/lesson page
    if (navState.url) {
      const url = navState.url.toLowerCase();
      const isClassroomUrl = url.includes('/courses/class/');
      if (!isClassroomUrl && isNativePlayerVisibleRef.current) {
        handleCloseNativePlayer();
      }
    }
  }, [handleCloseNativePlayer]);

  const handleRetry = useCallback(() => {
    setHasError(false);
    setErrorMessage('');
    setIsReady(false);
    progressBarRef.current?.setProgress(0.2);
    webViewRef.current?.reload();
  }, []);

  const handleLoadStart = useCallback(() => {
    setHasError(false);
    progressBarRef.current?.setProgress(0.25);
  }, []);

  const handleLoadProgress = useCallback(
    ({ nativeEvent }: { nativeEvent: { progress: number } }) => {
      progressBarRef.current?.setProgress(nativeEvent.progress);
    },
    []
  );

  const handleLoadEnd = useCallback(() => {
    setIsReady(true);
    progressBarRef.current?.finish();
  }, []);

  const handleError = useCallback((event: WebViewErrorEvent) => {
    setHasError(true);
    const description = event.nativeEvent.description || '';
    if (
      description.includes('ERR_INTERNET_DISCONNECTED') ||
      description.includes('ERR_NAME_NOT_RESOLVED') ||
      event.nativeEvent.code === -2
    ) {
      setErrorMessage(
        'No internet connection. Please check your network and try again.'
      );
    } else {
      setErrorMessage(description || 'Failed to load page content');
    }
    progressBarRef.current?.reset();
  }, []);

  const handleHttpError = useCallback((event: WebViewHttpErrorEvent) => {
    if (event.nativeEvent.statusCode >= 500) {
      setHasError(true);
      setErrorMessage(`Server error (${event.nativeEvent.statusCode}). Please try again shortly.`);
      progressBarRef.current?.reset();
    }
  }, []);

  // Gracefully recover if Android OS terminates the WebView render process under low memory
  const handleRenderProcessGone = useCallback(
    (syntheticEvent: WebViewRenderProcessGoneEvent) => {
      const { nativeEvent } = syntheticEvent;
      console.warn('WebView render process terminated. didCrash:', nativeEvent?.didCrash);
      if (nativeEvent?.didCrash) {
        setHasError(true);
        setErrorMessage('Web process terminated unexpectedly. Tap Retry to reload.');
      } else {
        webViewRef.current?.reload();
      }
    },
    []
  );

  const handleFileDownload = useCallback(
    ({ nativeEvent: { downloadUrl } }: { nativeEvent: { downloadUrl: string } }) => {
      if (downloadUrl) {
        Linking.openURL(downloadUrl).catch((err) => {
          console.warn('Failed to open downloaded file URL:', err);
        });
      }
    },
    []
  );

  const handleMessage = useCallback((event: WebViewMessageEvent) => {
    try {
      if (!event?.nativeEvent?.data || typeof event.nativeEvent.data !== 'string') {
        return;
      }

      const data = JSON.parse(event.nativeEvent.data);

      // 1. Handle native VdoCipher DRM playback request from web classroom
      if (data?.type === 'PLAY_VDOCIPHER_NATIVE' && data?.payload) {
        const payload = data.payload;
        if (
          typeof payload.otp === 'string' &&
          typeof payload.playbackInfo === 'string' &&
          payload.otp.length > 0 &&
          payload.playbackInfo.length > 0
        ) {
          // If embedded layout coordinates are provided, validate and store them
          if (
            payload.layout &&
            typeof payload.layout.width === 'number' &&
            typeof payload.layout.height === 'number' &&
            typeof payload.layout.x === 'number' &&
            typeof payload.layout.y === 'number'
          ) {
            setNativePlayerLayout({
              x: Math.round(payload.layout.x),
              y: Math.round(payload.layout.y),
              width: Math.max(0, Math.round(payload.layout.width)),
              height: Math.max(0, Math.round(payload.layout.height)),
              visible: payload.layout.visible !== false,
            });
          }

          // Prevent duplicate launches if already active with exact same credentials
          if (
            isNativePlayerVisibleRef.current &&
            nativePlayerEmbedInfoRef.current?.otp === payload.otp &&
            nativePlayerEmbedInfoRef.current?.playbackInfo === payload.playbackInfo
          ) {
            return;
          }
          const embedInfo: VdoEmbedInfo = {
            otp: payload.otp,
            playbackInfo: payload.playbackInfo,
            classId: typeof payload.classId === 'string' ? payload.classId : undefined,
            title: typeof payload.title === 'string' ? payload.title : undefined,
            resumeTimeMs:
              typeof payload.resumeTimeMs === 'number' && payload.resumeTimeMs > 0
                ? Math.round(payload.resumeTimeMs)
                : undefined,
          };
          nativePlayerEmbedInfoRef.current = embedInfo;
          isNativePlayerVisibleRef.current = true;
          setNativePlayerEmbedInfo(embedInfo);
          setIsNativePlayerVisible(true);
          return;
        }
      }

      // Handle layout geometry updates from web classroom scroll / resize / drawer open
      if (data?.type === 'UPDATE_VDOCIPHER_LAYOUT' && data?.payload?.layout) {
        const layout = data.payload.layout;
        if (
          typeof layout.width === 'number' &&
          typeof layout.height === 'number' &&
          typeof layout.x === 'number' &&
          typeof layout.y === 'number'
        ) {
          setNativePlayerLayout({
            x: Math.round(layout.x),
            y: Math.round(layout.y),
            width: Math.max(0, Math.round(layout.width)),
            height: Math.max(0, Math.round(layout.height)),
            visible: layout.visible !== false,
          });
        }
        return;
      }

      // 2. Handle native player close request from web classroom
      if (data?.type === 'CLOSE_VDOCIPHER_NATIVE') {
        handleCloseNativePlayer();
        return;
      }

      // 3. Handle seek request from web classroom (chapters, bookmarks, notes)
      if (data?.type === 'SEEK_VDOCIPHER_NATIVE' && data?.payload) {
        const payload = data.payload;
        const targetMs =
          typeof payload.timeMs === 'number' && !isNaN(payload.timeMs)
            ? Math.max(0, Math.round(payload.timeMs))
            : typeof payload.timeSeconds === 'number' && !isNaN(payload.timeSeconds)
            ? Math.max(0, Math.round(payload.timeSeconds * 1000))
            : null;
        if (targetMs !== null) {
          vdoPlayerRef.current?.seek(targetMs);
        }
        return;
      }

      // 3. Handle fallback OPEN_IN_SAFARI request
      if (data?.type !== 'OPEN_IN_SAFARI' || typeof data.url !== 'string') {
        return;
      }

      let parsed: URL;
      try {
        parsed = new URL(data.url);
      } catch {
        // Reject malformed or non-parseable URLs safely
        return;
      }

      // Enforce strict HTTPS scheme (reject javascript:, data:, file:, intent:, etc.)
      if (parsed.protocol !== 'https:') {
        return;
      }

      // Enforce exact trusted hostnames (reject lookalikes and unauthorized subdomains)
      const host = parsed.hostname.toLowerCase();
      const isAllowedHost =
        host === 'zeitnahacademy.com' || host === 'www.zeitnahacademy.com';
      if (!isAllowedHost) {
        return;
      }

      // Enforce allowed paths for course/classroom video playback handoff
      const normalizedPath = parsed.pathname.replace(/\/+$/, '') || '/';
      const isAllowedPath =
        normalizedPath === '/courses' ||
        normalizedPath.startsWith('/courses/') ||
        normalizedPath.startsWith('/course/');
      if (!isAllowedPath) {
        return;
      }

      // Strip query parameters used for internal routing/fallback flags
      parsed.searchParams.delete('open_external');
      parsed.searchParams.delete('target');
      parsed.searchParams.delete('fallback');

      const targetUrl = parsed.toString();
      Linking.openURL(targetUrl).catch((err) => {
        console.warn('[ZeitnahMobile] Failed to open URL in Safari:', err);
      });
    } catch {
      // Ignore non-JSON or unexpected messages without crashing
    }
  }, [handleCloseNativePlayer]);

  const handleShouldStartLoadWithRequest = useCallback(
    (request: ShouldStartLoadRequest): boolean => {
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
        url.startsWith('intent:') ||
        url.startsWith('x-safari-https:') ||
        url.startsWith('x-safari-http:')
      ) {
        Linking.openURL(url).catch((err) => {
          console.warn('Failed to open app link:', err);
        });
        return false;
      }

      try {
        const parsedUrl = new URL(url);
        const host = parsedUrl.hostname.toLowerCase();

        // Check if explicit request to open in system browser (e.g. Safari for FairPlay DRM video playback)
        if (
          parsedUrl.searchParams.get('open_external') === 'true' ||
          parsedUrl.searchParams.get('target') === '_system'
        ) {
          parsedUrl.searchParams.delete('open_external');
          parsedUrl.searchParams.delete('target');
          const externalUrl = parsedUrl.toString();
          Linking.openURL(externalUrl).catch((err) => {
            console.warn('Failed to open external browser URL:', err);
          });
          return false;
        }

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

        // External websites open in default device browser
        Linking.openURL(url).catch((err) => {
          console.warn('Failed to open external URL:', err);
        });
        return false;
      } catch {
        return false;
      }
    },
    []
  );

  return (
    <SafeAreaView style={styles.container} edges={['top', 'left', 'right']}>
      <StatusBar style="light" />

      {/* Isolated progress bar (Updates only itself, zero parent/WebView re-renders) */}
      <WebProgressBar ref={progressBarRef} />

      {/* Non-intrusive compact offline notification banner when website is already loaded */}
      <OfflineBanner visible={isOffline && isReady && !hasError} />

      {/* Main Content Wrapper (WebView + Embedded Native VdoCipher Player) */}
      <View style={styles.contentWrapper}>
        <WebView
          ref={webViewRef}
          source={WEBVIEW_SOURCE}
          style={styles.webView}
          // Scripting & Storage for full authentication support
          javaScriptEnabled={true}
          domStorageEnabled={true}
          sharedCookiesEnabled={true}
          thirdPartyCookiesEnabled={true}
          // Media & DRM Video Playback
          allowsProtectedMedia={true}
          allowsInlineMediaPlayback={true}
          mediaPlaybackRequiresUserAction={false}
          allowsFullscreenVideo={true}
          allowsAirPlayForMediaPlayback={true}
          allowsPictureInPictureMediaPlayback={true}
          androidLayerType="hardware"
          // Caching & Performance
          cacheEnabled={true}
          cacheMode="LOAD_DEFAULT"
          // Navigation & Security
          originWhitelist={['*']}
          mixedContentMode="compatibility"
          onNavigationStateChange={handleNavigationStateChange}
          onShouldStartLoadWithRequest={handleShouldStartLoadWithRequest}
          // Lifecycle, Progress & Recovery
          onLoadStart={handleLoadStart}
          onLoadProgress={handleLoadProgress}
          onLoadEnd={handleLoadEnd}
          onError={handleError}
          onHttpError={handleHttpError}
          onRenderProcessGone={handleRenderProcessGone}
          // File downloads support
          onFileDownload={handleFileDownload}
          // Native Bridge Messaging (opens clean URL in Mobile Safari without query flags)
          onMessage={handleMessage}
          // Layout & Behavior
          scalesPageToFit={false}
          textZoom={100}
          pullToRefreshEnabled={true}
          contentInsetAdjustmentBehavior="never"
          applicationNameForUserAgent="ZeitnahMobile/1.0.3"
          userAgent={
            Platform.OS === 'android' ? ANDROID_CHROME_USER_AGENT : undefined
          }
        />

        {/* Embedded Native VdoCipher Player (Hardware Playback rendered inside the existing course screen) */}
        {isNativePlayerVisible && (
          <VdoPlayerEmbedded
            ref={vdoPlayerRef}
            visible={isNativePlayerVisible}
            embedInfo={nativePlayerEmbedInfo}
            layout={nativePlayerLayout}
            title={nativePlayerEmbedInfo?.title}
            onProgress={handleNativePlayerProgress}
            onEnded={handleNativePlayerEnded}
            onError={handleNativePlayerError}
            onEnterFullscreen={() => setIsNativePlayerFullscreen(true)}
            onExitFullscreen={() => setIsNativePlayerFullscreen(false)}
          />
        )}
      </View>

      {/* Cinematic Dark Loading Screen (smooth logo reveal, ambient glow, seamless exit fade) */}
      <CinematicLoader isReady={isReady} hasError={hasError} />

      {/* Error Fallback Overlay (Keeps WebView warm in memory underneath) */}
      {hasError && (
        <ErrorOverlay
          message={errorMessage}
          isOffline={isOffline}
          onRetry={handleRetry}
        />
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: ZeitnahColors.background,
  },
  contentWrapper: {
    flex: 1,
    position: 'relative',
    overflow: 'hidden',
  },
  webView: {
    flex: 1,
    backgroundColor: ZeitnahColors.background,
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
    backgroundColor: ZeitnahColors.brandMint,
  },
  offlineBannerContainer: {
    position: 'absolute',
    top: 8,
    left: 0,
    right: 0,
    alignItems: 'center',
    zIndex: 998,
  },
  offlineBannerPill: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: ZeitnahColors.cardSurface,
    paddingVertical: 6,
    paddingHorizontal: 14,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: ZeitnahColors.borderSubtle,
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.35,
    shadowRadius: 8,
    elevation: 6,
  },
  offlineDot: {
    width: 7,
    height: 7,
    borderRadius: 3.5,
    backgroundColor: ZeitnahColors.warning,
    marginRight: 8,
  },
  offlineText: {
    color: ZeitnahColors.secondaryText,
    fontSize: 12,
    fontWeight: '600',
    letterSpacing: 0.2,
  },
  errorContainer: {
    ...StyleSheet.absoluteFill,
    backgroundColor: ZeitnahColors.background,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 24,
    zIndex: 60,
  },
  errorCard: {
    width: '100%',
    maxWidth: 360,
    backgroundColor: ZeitnahColors.cardSurface,
    borderRadius: 16,
    padding: 24,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: ZeitnahColors.borderSubtle,
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.4,
    shadowRadius: 16,
    elevation: 8,
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
  errorIconBadgeOffline: {
    backgroundColor: 'rgba(245, 158, 11, 0.15)',
    borderColor: 'rgba(245, 158, 11, 0.3)',
  },
  errorIconText: {
    color: ZeitnahColors.error,
    fontSize: 24,
    fontWeight: '700',
  },
  errorIconTextOffline: {
    color: ZeitnahColors.warning,
  },
  errorTitle: {
    color: ZeitnahColors.primaryText,
    fontSize: 18,
    fontWeight: '600',
    marginBottom: 8,
    textAlign: 'center',
  },
  errorSubtitle: {
    color: ZeitnahColors.secondaryText,
    fontSize: 14,
    lineHeight: 20,
    textAlign: 'center',
    marginBottom: 24,
  },
  retryButton: {
    backgroundColor: ZeitnahColors.brandYellow,
    paddingVertical: 13,
    paddingHorizontal: 32,
    borderRadius: 12,
    width: '100%',
    alignItems: 'center',
    shadowColor: ZeitnahColors.brandYellow,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 6,
    elevation: 3,
  },
  retryButtonPressed: {
    opacity: 0.85,
    transform: [{ scale: 0.98 }],
  },
  retryButtonText: {
    color: ZeitnahColors.background,
    fontSize: 15,
    fontWeight: '700',
    letterSpacing: 0.3,
  },
});
