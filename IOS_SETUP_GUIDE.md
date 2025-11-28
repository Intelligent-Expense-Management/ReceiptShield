# iOS App Setup & Development Guide

## Overview

ReceiptShield iOS app is built using **Capacitor**, which wraps the Next.js web application into a native iOS app. This allows us to maintain a single codebase while providing a native mobile experience.

## Architecture

### How It Works

1. **Next.js Web App**: The core application is built with Next.js and React
2. **Capacitor Bridge**: Capacitor acts as a bridge between the web app and native iOS APIs
3. **iOS Native Shell**: The iOS project (`ios/App/`) contains the native iOS wrapper that loads the web app
4. **Development Mode**: During development, the iOS app can load from `http://localhost:9003` (configured in `capacitor.config.ts`)
5. **Production Mode**: The iOS app loads from the deployed website at `https://compensationengine.com`

### Key Components

- **Capacitor Config** (`capacitor.config.ts`): Defines app settings, server URLs, and iOS-specific configurations
- **iOS Project** (`ios/App/`): Native iOS project with Xcode workspace
- **CocoaPods**: Manages iOS dependencies (Capacitor plugins)
- **Web Assets**: Built Next.js app copied to `ios/App/App/public/` during sync

## Prerequisites

### Required Software

1. **macOS** (required for iOS development)
2. **Xcode** (latest version recommended)
   - Install from Mac App Store
   - Accept Xcode license: `sudo xcodebuild -license accept`
3. **CocoaPods** (iOS dependency manager)
   ```bash
   sudo gem install cocoapods
   ```
4. **Node.js** (v18 or higher)
5. **npm** or **yarn**

### Environment Setup

1. **Set UTF-8 encoding** (required for CocoaPods):
   ```bash
   export LANG=en_US.UTF-8
   # Add to ~/.zshrc or ~/.bash_profile for persistence
   ```

2. **Install project dependencies**:
   ```bash
   npm install
   ```

## Development Workflow

### 1. Start the Development Server

```bash
npm run dev
```

This starts the Next.js dev server on `http://localhost:9003`. 

**Note**: The iOS app is currently configured to use the production website (`https://compensationengine.com`). To use localhost for development, update `capacitor.config.ts` and sync.

### 2. Build the Web App (for production sync)

```bash
npm run build
```

This creates a static build in the `out` directory that Capacitor will sync to iOS.

### 3. Sync Capacitor

After making changes to the web app or Capacitor config:

```bash
npx cap sync ios
```

This command:
- Copies web assets from `out/` to `ios/App/App/public/`
- Updates iOS native dependencies
- Runs `pod install` to update CocoaPods dependencies

**Note**: If you encounter CocoaPods encoding errors, ensure `LANG=en_US.UTF-8` is set.

### 4. Open in Xcode

```bash
npx cap open ios
```

This opens the Xcode workspace where you can:
- Select a simulator device
- Build and run the app (⌘ + R)
- Debug native iOS code
- Configure app settings (bundle ID, version, etc.)

### 5. Run from Command Line

```bash
# List available simulators
xcrun simctl list devices available

# Run on specific device
npx cap run ios --target="iPhone 16 Pro"
```

## Configuration Files

### `capacitor.config.ts`

Main Capacitor configuration file:

```typescript
{
  appId: 'com.receiptshield.app',      // Bundle identifier
  appName: 'ReceiptShield',             // App display name
  webDir: 'out',                        // Web build directory
  server: {
    url: 'https://compensationengine.com',  // Production URL
    cleartext: false                     // HTTPS (production)
  },
  ios: {
    contentInset: 'automatic'           // Safe area handling
  }
}
```

**Current Configuration**: The app is configured to use the production website at `https://compensationengine.com`.

**For Local Development**: Update `server.url` to `http://localhost:9003` and set `cleartext: true`, then run `npx cap sync ios`.

### `ios/App/Podfile`

CocoaPods dependency file. Currently includes:
- Capacitor core
- Capacitor Cordova bridge

To add native plugins, add them here and run `pod install`.

### `ios/App/App/Info.plist`

iOS app metadata and permissions. Key settings:
- Bundle identifier
- App version
- Supported orientations
- Required device capabilities

## Common Tasks

### Adding a New Capacitor Plugin

1. Install the plugin:
   ```bash
   npm install @capacitor/camera  # Example
   ```

2. Sync to iOS:
   ```bash
   npx cap sync ios
   ```

3. The plugin will be automatically added to the Podfile and installed.

### Updating App Version

1. Update version in `package.json`
2. Update in Xcode: Select project → General → Version/Build
3. Or update `Info.plist` directly

### Changing Bundle Identifier

1. Update `appId` in `capacitor.config.ts`
2. Update in Xcode: Select project → General → Bundle Identifier
3. Update in `Info.plist` if needed

### Debugging

**Web App Issues**:
- Check browser console in Safari (Develop → Simulator → [Your App])
- Check Next.js dev server logs

**Native iOS Issues**:
- Check Xcode console output
- Use Xcode debugger for native code
- Check `ios/App/App/AppDelegate.swift` for native lifecycle events

### Building for Production

The iOS app is already configured to use the production website. To build and deploy:

1. **Ensure production URL is set** in `capacitor.config.ts`:
   ```typescript
   server: {
     url: 'https://compensationengine.com',
     cleartext: false
   }
   ```

2. **Sync Capacitor** (to apply any config changes):
   ```bash
   npx cap sync ios
   ```

3. **Archive in Xcode**:
   - Product → Archive
   - Distribute to App Store or TestFlight

**Note**: The app loads from the live website, so you don't need to build static files for the iOS app. However, ensure the website is deployed and accessible before testing.

## Troubleshooting

### CocoaPods Encoding Error

**Error**: `Unicode Normalization not appropriate for ASCII-8BIT`

**Solution**:
```bash
export LANG=en_US.UTF-8
cd ios/App
pod install
```

### Port Already in Use

**Error**: Port 9003 is already in use

**Solution**:
```bash
# Find and kill process
lsof -ti:9003 | xargs kill -9
# Or change port in capacitor.config.ts and package.json
```

### Build Errors After Pod Install

**Solution**:
1. Clean build folder in Xcode: Product → Clean Build Folder (⇧⌘K)
2. Delete `ios/App/Pods` and `Podfile.lock`
3. Run `pod install` again

### App Not Loading Web Content

**Check**:
1. Production website is accessible: `https://compensationengine.com`
2. `capacitor.config.ts` has correct `server.url` set to production URL
3. Internet connection is available (simulator or device)
4. For local development, ensure dev server is running and `server.url` points to `http://localhost:9003`
5. For physical device testing with localhost, use your Mac's IP address instead of `localhost`

## Project Structure

```
ReceiptShield/
├── capacitor.config.ts          # Capacitor configuration
├── ios/                          # iOS native project
│   └── App/
│       ├── App.xcodeproj/       # Xcode project
│       ├── App.xcworkspace/      # Xcode workspace (use this)
│       ├── App/                  # iOS app source
│       │   ├── AppDelegate.swift # App lifecycle
│       │   ├── Info.plist        # App metadata
│       │   ├── public/           # Web assets (synced)
│       │   └── capacitor.config.json  # Synced config
│       └── Podfile               # CocoaPods dependencies
└── out/                          # Next.js build output (synced to iOS)
```

## Key Dependencies

- `@capacitor/cli`: Capacitor command-line tools
- `@capacitor/core`: Core Capacitor runtime
- `@capacitor/ios`: iOS platform support

## Important Notes for Next Team

### 1. Development vs Production

- **Current Setup (Production)**: App loads from `https://compensationengine.com` (deployed website)
- **Local Development**: To use localhost, update `capacitor.config.ts`:
  ```typescript
  server: {
    url: 'http://localhost:9003',
    cleartext: true
  }
  ```
  Then run `npx cap sync ios` to apply changes.

### 2. API Routes

The app currently loads from the production website (`https://compensationengine.com`), so all API routes are handled by the deployed Next.js application. This means:
- All API endpoints work automatically
- No separate backend deployment needed
- Changes to the website are immediately reflected in the iOS app

### 3. Environment Variables

iOS app uses the same environment variables as the web app. Ensure `.env.local` is properly configured.

### 4. Firebase Configuration

The app uses Firebase for backend services. Ensure Firebase is properly configured in both web and iOS projects.

### 5. Native Features

Currently, the app uses minimal native features. To add native functionality:
- Install Capacitor plugins
- Sync with `npx cap sync ios`
- Use plugin APIs in your React/Next.js code

### 6. Testing

- Use iOS Simulator for development
- Test on physical devices before App Store submission
- Ensure all features work in both development and production modes

### 7. App Store Submission

Before submitting:
1. Update version and build number
2. Configure App Store Connect
3. Set up provisioning profiles and certificates
4. Test on physical devices
5. Prepare screenshots and metadata
6. Archive and upload from Xcode

## Quick Start Checklist

- [ ] Install Xcode and accept license
- [ ] Install CocoaPods: `sudo gem install cocoapods`
- [ ] Set UTF-8 encoding: `export LANG=en_US.UTF-8`
- [ ] Install dependencies: `npm install`
- [ ] Build web app: `npm run build`
- [ ] Sync Capacitor: `npx cap sync ios`
- [ ] Open in Xcode: `npx cap open ios`
- [ ] Sync Capacitor: `npx cap sync ios` (to apply production URL)
- [ ] Build and run in Xcode (⌘ + R)
- [ ] Verify app loads from `https://compensationengine.com`

## Additional Resources

- [Capacitor Documentation](https://capacitorjs.com/docs)
- [Capacitor iOS Guide](https://capacitorjs.com/docs/ios)
- [Next.js Documentation](https://nextjs.org/docs)
- [CocoaPods Guide](https://guides.cocoapods.org/)

---

**Last Updated**: 2025-01-27  
**Capacitor Version**: 7.4.4  
**iOS Minimum Version**: 14.0

