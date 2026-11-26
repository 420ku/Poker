import { Linking } from 'react-native';
import { supabase } from '../lib/supabase/client';

export const GOOGLE_OAUTH_REDIRECT_URL = 'poker://auth/callback';

function requireSupabase() {
  if (!supabase) {
    throw new Error(
      'Supabase is not configured. Add SUPABASE_URL and SUPABASE_PUBLISHABLE_KEY to .env.',
    );
  }

  return supabase;
}

/**
 * Promote the current guest account by linking Google to its existing user ID.
 * A normal OAuth sign-in is also supported when recovering an existing profile.
 */
export async function beginGoogleSignIn(signInToExistingAccount = false): Promise<void> {
  const client = requireSupabase();
  const { data: sessionData, error: sessionError } = await client.auth.getSession();

  if (sessionError) throw sessionError;

  const session = sessionData.session;
  const identities = session?.user.identities ?? [];
  const providers = session?.user.app_metadata?.providers;
  const hasGoogleIdentity =
    identities.some(identity => identity.provider === 'google') ||
    session?.user.app_metadata?.provider === 'google' ||
    (Array.isArray(providers) && providers.includes('google'));

  if (hasGoogleIdentity) return;

  const options = {
    redirectTo: GOOGLE_OAUTH_REDIRECT_URL,
    skipBrowserRedirect: true,
  };

  const { data, error } =
    session && !signInToExistingAccount
      ? await client.auth.linkIdentity({ provider: 'google', options })
      : await client.auth.signInWithOAuth({ provider: 'google', options });

  if (error) throw error;
  if (!data.url) throw new Error('Supabase did not return a Google authorization URL.');

  await Linking.openURL(data.url);
}

/**
 * Complete the PKCE callback received through the poker:// deep link.
 */
export async function completeGoogleOAuth(callbackUrl: string): Promise<void> {
  const client = requireSupabase();
  const parsedUrl = new URL(callbackUrl);

  if (
    parsedUrl.protocol !== 'poker:' ||
    parsedUrl.hostname !== 'auth' ||
    parsedUrl.pathname !== '/callback'
  ) {
    throw new Error('Unexpected Google sign-in callback URL.');
  }
  const hashParams = new URLSearchParams(parsedUrl.hash.replace(/^#/, ''));
  const getParameter = (name: string) =>
    parsedUrl.searchParams.get(name) ?? hashParams.get(name);

  const callbackError =
    getParameter('error_description') ?? getParameter('error');
  const callbackErrorCode = getParameter('error_code');

  if (callbackError) {
    throw new Error(
      callbackErrorCode ? `${callbackErrorCode}: ${callbackError}` : callbackError,
    );
  }

  const code = getParameter('code');
  if (!code) {
    throw new Error('Google sign-in callback did not contain an authorization code.');
  }

  const { error } = await client.auth.exchangeCodeForSession(code);
  if (error) throw error;
}
