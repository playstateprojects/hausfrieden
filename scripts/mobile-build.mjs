// Bumps the build number, stamps it into the Android and iOS projects, then builds and syncs the native web bundle.
import { execSync } from 'node:child_process';
import { readFileSync, writeFileSync } from 'node:fs';

const run = (c) => execSync(c, { stdio: 'inherit' });

// Single source of truth: build number in mobile-build.json
const f = 'mobile-build.json';
const state = JSON.parse(readFileSync(f, 'utf8')); // { "build": 1, "version": "1.0" }
state.build += 1;
writeFileSync(f, JSON.stringify(state, null, '\t') + '\n');

// Android: versionCode = build, versionName = version.build
const gradle = 'android/app/build.gradle';
writeFileSync(
	gradle,
	readFileSync(gradle, 'utf8')
		.replace(/versionCode \d+/, `versionCode ${state.build}`)
		.replace(/versionName "[^"]*"/, `versionName "${state.version}.${state.build}"`)
);

// iOS: CURRENT_PROJECT_VERSION = build (marketing version stays as-is)
const pbx = 'ios/App/App.xcodeproj/project.pbxproj';
writeFileSync(pbx, readFileSync(pbx, 'utf8').replace(/CURRENT_PROJECT_VERSION = [^;]+;/g, `CURRENT_PROJECT_VERSION = ${state.build};`));

// the native build (adapter-static + API base from .env.native), not the Cloudflare one
run('npm run build:native');
run('npx cap sync android');
run('npx cap sync ios');
console.log(`\nBuilt ${state.version} (${state.build})`);
