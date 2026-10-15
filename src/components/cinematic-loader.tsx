import React, { memo, useEffect, useRef, useState } from 'react';
import {
  AccessibilityInfo,
  Animated,
  Easing,
  StyleSheet,
  View,
} from 'react-native';
import { Image } from 'expo-image';

import { ZeitnahColors } from '@/constants/theme';

interface CinematicLoaderProps {
  isReady: boolean;
  hasError?: boolean;
}

const ZEITNAH_LOGO = require('@/assets/images/zeitnah-logo.png');
const TRACK_WIDTH = 80;
const BEAM_WIDTH = 32;

export const CinematicLoader = memo(function CinematicLoader({
  isReady,
  hasError = false,
}: CinematicLoaderProps) {
  const [visible, setVisible] = useState(true);

  // Animated values
  const containerFadeAnim = useRef(new Animated.Value(1)).current;
  const logoFadeAnim = useRef(new Animated.Value(0)).current;
  const logoScaleAnim = useRef(new Animated.Value(0.94)).current;
  const glowPulseAnim = useRef(new Animated.Value(0)).current;
  const beamTranslateAnim = useRef(
    new Animated.Value(-BEAM_WIDTH)
  ).current;

  // Track animation instances to stop them on unmount
  const glowLoopRef = useRef<Animated.CompositeAnimation | null>(null);
  const beamLoopRef = useRef<Animated.CompositeAnimation | null>(null);

  useEffect(() => {
    let isMounted = true;

    // Reset visibility if retry occurs
    if (!isReady && !hasError) {
      setVisible(true);
      containerFadeAnim.setValue(1);
    }

    AccessibilityInfo.isReduceMotionEnabled().then((reducedMotion) => {
      if (!isMounted) return;

      if (reducedMotion) {
        // Reduced motion: instantaneous fade, no scaling, stationary glow
        Animated.parallel([
          Animated.timing(logoFadeAnim, {
            toValue: 1,
            duration: 300,
            useNativeDriver: true,
          }),
          Animated.timing(glowPulseAnim, {
            toValue: 0.35,
            duration: 400,
            useNativeDriver: true,
          }),
        ]).start();
      } else {
        // Premium restrained entrance sequence:
        // 1. Logo fades in while gently scaling from 94% to 100%
        Animated.parallel([
          Animated.timing(logoFadeAnim, {
            toValue: 1,
            duration: 600,
            easing: Easing.out(Easing.cubic),
            useNativeDriver: true,
          }),
          Animated.timing(logoScaleAnim, {
            toValue: 1,
            duration: 650,
            easing: Easing.out(Easing.cubic),
            useNativeDriver: true,
          }),
          // 2. Soft mint light rises gently behind the logo
          Animated.timing(glowPulseAnim, {
            toValue: 0.45,
            duration: 750,
            easing: Easing.out(Easing.sin),
            useNativeDriver: true,
          }),
        ]).start(({ finished }) => {
          if (!finished || !isMounted) return;

          // 3. Subtle, organic ambient breathing loop
          glowLoopRef.current = Animated.loop(
            Animated.sequence([
              Animated.timing(glowPulseAnim, {
                toValue: 0.58,
                duration: 1800,
                easing: Easing.inOut(Easing.sin),
                useNativeDriver: true,
              }),
              Animated.timing(glowPulseAnim, {
                toValue: 0.32,
                duration: 1800,
                easing: Easing.inOut(Easing.sin),
                useNativeDriver: true,
              }),
            ])
          );
          glowLoopRef.current.start();
        });

        // 4. Silky continuous traveling light beam on indicator track
        beamLoopRef.current = Animated.loop(
          Animated.sequence([
            Animated.timing(beamTranslateAnim, {
              toValue: TRACK_WIDTH,
              duration: 1400,
              easing: Easing.inOut(Easing.cubic),
              useNativeDriver: true,
            }),
            Animated.timing(beamTranslateAnim, {
              toValue: -BEAM_WIDTH,
              duration: 0,
              useNativeDriver: true,
            }),
          ])
        );
        beamLoopRef.current.start();
      }
    });

    return () => {
      isMounted = false;
      glowLoopRef.current?.stop();
      beamLoopRef.current?.stop();
    };
  }, [
    isReady,
    hasError,
    containerFadeAnim,
    logoFadeAnim,
    logoScaleAnim,
    glowPulseAnim,
    beamTranslateAnim,
  ]);

  // Handle smooth seamless exit when WebView signals readiness or error
  useEffect(() => {
    if (isReady || hasError) {
      Animated.timing(containerFadeAnim, {
        toValue: 0,
        duration: 320,
        easing: Easing.out(Easing.quad),
        useNativeDriver: true,
      }).start(({ finished }) => {
        if (finished) {
          setVisible(false);
          glowLoopRef.current?.stop();
          beamLoopRef.current?.stop();
        }
      });
    }
  }, [isReady, hasError, containerFadeAnim]);

  if (!visible) {
    return null;
  }

  return (
    <Animated.View
      style={[styles.container, { opacity: containerFadeAnim }]}
      pointerEvents={isReady || hasError ? 'none' : 'auto'}>
      {/* Soft, diffuse mint illumination radiating through and around the emblem */}
      <Animated.View
        style={[
          styles.diffuseMintAura,
          {
            opacity: glowPulseAnim,
          },
        ]}
      />

      {/* Official Centered Logo (Crisp, uncompressed, transparent background) */}
      <Animated.View
        style={[
          styles.logoContainer,
          {
            opacity: logoFadeAnim,
            transform: [{ scale: logoScaleAnim }],
          },
        ]}>
        <Image
          source={ZEITNAH_LOGO}
          style={styles.logoImage}
          contentFit="contain"
          priority="high"
          cachePolicy="memory-disk"
        />
      </Animated.View>

      {/* Refined brand progress indicator */}
      <View style={styles.indicatorContainer}>
        <View style={styles.indicatorTrack}>
          <Animated.View
            style={[
              styles.indicatorBeam,
              {
                transform: [{ translateX: beamTranslateAnim }],
              },
            ]}>
            <View style={styles.beamMintBody} />
            <View style={styles.beamYellowTip} />
          </Animated.View>
        </View>
      </View>
    </Animated.View>
  );
});

const styles = StyleSheet.create({
  container: {
    ...StyleSheet.absoluteFill,
    backgroundColor: ZeitnahColors.background,
    justifyContent: 'center',
    alignItems: 'center',
    zIndex: 50,
  },
  diffuseMintAura: {
    position: 'absolute',
    width: 180,
    height: 180,
    borderRadius: 90,
    backgroundColor: ZeitnahColors.brandMint,
    shadowColor: ZeitnahColors.brandMint,
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.45,
    shadowRadius: 40,
    elevation: 12,
  },
  logoContainer: {
    width: 140,
    height: 140,
    justifyContent: 'center',
    alignItems: 'center',
  },
  logoImage: {
    width: 140,
    height: 140,
  },
  indicatorContainer: {
    position: 'absolute',
    bottom: '20%',
    alignItems: 'center',
    justifyContent: 'center',
  },
  indicatorTrack: {
    width: TRACK_WIDTH,
    height: 3,
    borderRadius: 1.5,
    backgroundColor: ZeitnahColors.cardSurface,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: ZeitnahColors.borderSubtle,
    overflow: 'hidden',
  },
  indicatorBeam: {
    width: BEAM_WIDTH,
    height: '100%',
    flexDirection: 'row',
  },
  beamMintBody: {
    flex: 1,
    height: '100%',
    backgroundColor: ZeitnahColors.brandMint,
    borderRadius: 1.5,
  },
  beamYellowTip: {
    width: 6,
    height: '100%',
    backgroundColor: ZeitnahColors.brandYellow,
    borderTopRightRadius: 1.5,
    borderBottomRightRadius: 1.5,
  },
});

