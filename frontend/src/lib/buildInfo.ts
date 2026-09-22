/** Build-time constants injected by Vite `define` in vite.config.ts */

export const APP_VERSION = __APP_VERSION__;
export const BUILD_DATE = __BUILD_DATE__;
export const GIT_COMMIT = __GIT_COMMIT__;
export const GIT_REPO = __GIT_REPO__;
export const CHANGELOG = __CHANGELOG__;

export const COMMIT_URL = `https://github.com/${GIT_REPO}/commit/${GIT_COMMIT}`;
export const RELEASES_URL = `https://github.com/${GIT_REPO}/releases`;
