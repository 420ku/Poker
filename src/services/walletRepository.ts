import { supabase } from '../lib/supabase/client';

export interface WalletTopupHistoryItem {
  id: string;
  amount_php: number;
  credits: number;
  status: 'pending' | 'completed' | 'expired' | 'failed';
  created_at: string;
}

export interface WalletSummary {
  balanceCredits: number;
  topups: WalletTopupHistoryItem[];
}

function requireSupabase() {
  if (!supabase) {
    throw new Error(
      'Supabase is not configured. Add SUPABASE_URL and SUPABASE_PUBLISHABLE_KEY to .env.',
    );
  }
  return supabase;
}

export async function loadWalletSummary(userId: string): Promise<WalletSummary> {
  const client = requireSupabase();
  const [walletResult, topupsResult] = await Promise.all([
    client
      .from('wallets')
      .select('balance_credits')
      .eq('user_id', userId)
      .single(),
    client
      .from('wallet_topups')
      .select('id, amount_php, credits, status, created_at')
      .eq('user_id', userId)
      .order('created_at', { ascending: false })
      .limit(10),
  ]);

  if (walletResult.error) throw walletResult.error;
  if (topupsResult.error) throw topupsResult.error;

  return {
    balanceCredits: Number(walletResult.data.balance_credits),
    topups: (topupsResult.data ?? []) as WalletTopupHistoryItem[],
  };
}

export async function createWalletTopup(amountPhp: number): Promise<{
  topupId: string;
  checkoutUrl: string;
  amountPhp: number;
  credits: number;
}> {
  const client = requireSupabase();
  const { data, error } = await client.functions.invoke('create-wallet-topup', {
    body: { amountPhp },
  });

  if (error) throw error;
  if (!data?.checkoutUrl || !data?.topupId) {
    throw new Error('Wallet service did not return a checkout URL.');
  }

  return data as {
    topupId: string;
    checkoutUrl: string;
    amountPhp: number;
    credits: number;
  };
}
