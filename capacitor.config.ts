import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
	appId: 'com.playstate.hausfrieden',
	appName: 'Hausfrieden',
	// static SPA from `vite build --mode native`; it calls the deployed API (VITE_API_BASE in .env.native)
	webDir: 'build-native',
	ios: {
		contentInset: 'never',
		allowsLinkPreview: false
	},
	plugins: {
		StatusBar: { style: 'DARK', backgroundColor: '#FBF6EE', overlaysWebView: true },
		SplashScreen: { launchAutoHide: true, launchShowDuration: 400, backgroundColor: '#FBF6EE', showSpinner: false },
		CapacitorAssets: { iconPath: 'resources/icon.png' }
	}
};

export default config;
