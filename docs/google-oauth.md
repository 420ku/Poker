# Google OAuth sign-in

The React Native app uses Supabase Auth with the PKCE authorization-code flow and the native deep link:

```text
poker://auth/callback
```

The app initially creates an anonymous Supabase user so guests can save game sessions and use the demo wallet. The Google action links a Google identity to that same user rather than creating a replacement account. This preserves the existing Supabase user ID, wallet ownership, and saved Hold'em session.

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

1. Launch the app while signed in as the guest profile.
2. Tap **SIGN IN** on the Google account card.
3. Complete Google consent in the system browser.
4. The browser should return to Poker. The account card should show the connected Google email.
5. Confirm the same Supabase user still owns the wallet row and saved Hold'em session.

When the Google identity is already linked to a different Poker user (for example, signing in from a second device), the app offers to sign in to that existing profile. Accepting this switches to the existing Supabase user and restores that profile's wallet and saved Hold'em session. The guest profile created on the new device is not merged automatically; do not accept this fallback when you need to keep unsynced guest data from that device.

The mobile app stores only Supabase's user session in AsyncStorage. The Google OAuth client secret remains in Supabase configuration.

## Troubleshooting

- **Redirect URL not allowed:** add `poker://auth/callback` to Supabase's Redirect URLs exactly.
- **Google `redirect_uri_mismatch`:** use the exact Supabase callback URI displayed by the Google provider configuration in Google Cloud Console.
- **Identity linking disabled:** enable Manual Identity Linking in Supabase Auth settings.
- **App does not reopen:** reinstall/rebuild the native app after changing AndroidManifest.xml or Info.plist and confirm the OS has registered the `poker` scheme.
- **Identity already linked:** the selected Google account is already attached to another Supabase user. Do not delete either account or move wallet rows manually without first reconciling ownership.
