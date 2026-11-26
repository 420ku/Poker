# Google OAuth sign-in

The React Native app uses Supabase Auth with the PKCE authorization-code flow and the native deep link:

```text
poker://auth/callback
```

The app initially creates an anonymous Supabase session only as a temporary identity to support Google identity linking. An anonymous or guest session cannot access the lobby, Texas Hold’em, Chinese Poker, saved games, or wallet. The home screen shows only the Google sign-in action until Supabase confirms that the current user has a linked Google identity.

Supabase sessions are memory-only (`persistSession: false`). Poker also signs out the local Supabase session when the app enters the background, except while the system browser is completing an OAuth flow. This means switching away from Poker also signs the user out; the next time Poker becomes active, the Google-only sign-in screen is shown. A force-quit or process termination also loses the in-memory session even if the operating system does not deliver a background event.

The OAuth request uses Google's `select_account` prompt so users are asked to choose a Google account again. This signs the user out of Poker's Supabase session; it does not sign the device or browser out of Google itself.

The Google action links a Google identity to the existing guest user rather than creating a replacement account. This preserves the existing Supabase user ID, wallet ownership, and saved Hold'em session.

## 1. Configure Google OAuth credentials

1. Open [Google Cloud Console](https://console.cloud.google.com/).
2. Select or create a Google Cloud project and configure the OAuth consent screen.
3. Create an OAuth client ID with application type **Web application**.
4. In **Authorized redirect URIs**, add the callback URL shown by your Supabase project's Google provider setup. For a hosted project it is normally:

   ```text
   https://<project-ref>.supabase.co/auth/v1/callback
   ```

5. Copy the Google client ID and client secret.

Do not add the Google client secret to the mobile app or repository.

## 2. Enable Google in Supabase

1. Open **Supabase Dashboard → Authentication → Sign In / Providers → Google**.
2. Enable Google and paste the Google OAuth client ID and client secret.
3. Save the provider settings.
4. Open **Authentication → Sign In / Providers** (or the project's identity-linking setting) and enable **Manual Identity Linking**. Supabase requires this to convert the app's anonymous guest user into a permanent Google-linked user.

## 3. Allow the mobile redirect URL

In **Supabase Dashboard → Authentication → URL Configuration → Redirect URLs**, add this exact redirect:

```text
poker://auth/callback
```

The app's native Android manifest and iOS Info.plist register the `poker` URL scheme. iOS SceneDelegate already forwards incoming URLs to React Native.

## 4. Rebuild the native app

Deep-link registration is native configuration, so reload Metro alone is not enough.

Android:

```sh
bun run android
```

iOS (on macOS with Xcode):

```sh
cd ios
bundle exec pod install
cd ..
bun run ios
```

No additional React Native package is required for this browser-based OAuth flow.

## 5. Verify sign-in

1. Launch the app. Before Google authentication, confirm the only available action is **CONTINUE WITH GOOGLE**.
2. Tap **CONTINUE WITH GOOGLE**.
3. Complete Google consent in the system browser.
4. Confirm the browser returns to Poker and the authenticated lobby appears with the linked Google email.
5. Confirm Texas Hold’em, Chinese Poker, saved-game resume, and wallet are available only after the Google identity is linked.
6. Confirm the same Supabase user still owns the wallet row and saved Hold'em session.

When the Google identity is already linked to a different Poker user (for example, signing in from a second device), the app offers to sign in to that existing profile. Accepting this switches to the existing Supabase user and restores that profile's wallet and saved Hold'em session. The guest profile created on the new device is not merged automatically; do not accept this fallback when you need to keep unsynced guest data from that device.

If the Supabase session is signed out or no longer has a Google identity, the app returns to the Google-only sign-in screen and clears the active in-memory game from the UI. The game lobby and wallet are not rendered for anonymous sessions.

The OAuth PKCE code verifier remains temporarily available in the configured native storage so the browser callback can complete. Supabase access and refresh tokens are not persisted. The Google OAuth client secret remains in Supabase configuration.

## Troubleshooting

- **Redirect URL not allowed:** add `poker://auth/callback` to Supabase's Redirect URLs exactly.
- **Google `redirect_uri_mismatch`:** use the exact Supabase callback URI displayed by the Google provider configuration in Google Cloud Console.
- **Identity linking disabled:** enable Manual Identity Linking in Supabase Auth settings.
- **App does not reopen:** reinstall/rebuild the native app after changing AndroidManifest.xml or Info.plist and confirm the OS has registered the `poker` scheme.
- **Identity already linked:** the selected Google account is already attached to another Supabase user. Do not delete either account or move wallet rows manually without first reconciling ownership.
