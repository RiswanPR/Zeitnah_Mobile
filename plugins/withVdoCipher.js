const { withProjectBuildGradle } = require('@expo/config-plugins');

/**
 * Expo Config Plugin for VdoCipher Native Android SDK
 * Ensures the VdoCipher Maven repository is present in root build.gradle
 */
function withVdoCipher(config) {
  return withProjectBuildGradle(config, (gradleConfig) => {
    if (gradleConfig.modResults.language === 'groovy') {
      const vdoMaven = `        maven { url "https://github.com/VdoCipher/maven-repo/raw/master/repo" }`;
      const contents = gradleConfig.modResults.contents;

      if (!contents.includes('github.com/VdoCipher/maven-repo')) {
        // Inject into allprojects -> repositories block
        gradleConfig.modResults.contents = contents.replace(
          /allprojects\s*\{\s*repositories\s*\{/,
          `allprojects {\n    repositories {\n${vdoMaven}\n`
        );
      }
    }
    return gradleConfig;
  });
}

module.exports = withVdoCipher;
