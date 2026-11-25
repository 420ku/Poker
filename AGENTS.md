# AGENTS.md

## Project overview

- This repository is a React Native CLI poker app with Texas Hold’em and Chinese Poker modes, currently played against local computer opponents.
- Current stack: React Native 0.88.1, React 19.3.0, TypeScript 6, Jest 29, and ESLint with the React Native config.
- Node.js requirement: >= 22.11.0.
- The app includes Texas Hold’em domain logic and screens, Chinese Poker domain logic and screens, and Supabase-backed Hold’em session saves. Inspect current source and migrations before changing these systems.
- Supabase is the planned backend: use Supabase Auth, Postgres, Row Level Security (RLS), database functions/RPC, and Realtime where appropriate. Do not introduce a separate backend server unless a task specifically requires one.

## Working rules

1. Inspect the existing implementation and package scripts before changing files. Follow established patterns; do not replace working project configuration without a concrete reason.
2. Keep the app in React Native CLI. Do not migrate to Expo, Next.js, or another framework without an explicit request.
3. Use TypeScript for application code. Keep domain logic independent from React Native UI and Supabase client code.
4. Prefer small, focused changes. Do not add dependencies when the platform or existing packages already solve the problem.
5. Preserve Android and iOS support. Test platform-specific changes on the relevant platform and avoid hard-coding platform assumptions.
6. Do not commit secrets, credentials, signing keys, production data, generated build output, or local environment files.
7. Update documentation, types, migrations, and tests whenever a change alters behavior or the data contract.
8. Do not claim a build, test, migration, or device check passed unless it was actually run and its result was inspected.

## Existing commands

Run from repository root:

- `bun install` — install dependencies using the checked-in `bun.lock`.
- `bun run start` — start Metro.
- `bun run android` — build and launch Android development app.
- `bun run ios` — build and launch iOS development app (macOS with Xcode required).
- `bun run lint` — run ESLint.
- `bun run test` — run Jest.

Use the repository's lockfile and scripts. Do not regenerate or replace `bun.lock` with an npm or Yarn lockfile unless explicitly requested. If using another package manager is unavoidable, explain why and keep lockfiles consistent.

## Suggested application organization

The project is currently a starter and may not have these directories yet. Introduce structure incrementally; do not create empty folders preemptively.

- `src/features/auth/` — sign-in, sign-up, session, and account flows.
- `src/features/lobby/` — table discovery, table creation/joining, and waiting room.
- `src/features/table/` — poker table UI, player actions, cards, and live hand state.
- `src/features/profile/` — player profile and preferences.
- `src/domain/poker/` — framework-independent Hold'em types, validation, hand evaluation, and display helpers.
- `src/lib/supabase/` — Supabase client and typed backend helpers.
- `src/services/` — application-facing repositories or service adapters.
- `src/types/` — shared API and generated database types when a central location is useful.

Keep components focused. Keep poker rules out of screen components, and keep Supabase queries out of presentation components. Prefer typed service/repository functions over scattered direct table queries.

## Supabase integration and security

### Client setup and credentials

- Use the official `@supabase/supabase-js` client. Add React Native-compatible URL and session-storage dependencies only when implementing Supabase integration.
- Create one configured Supabase client and reuse it; do not instantiate clients during component renders.
- This is a React Native CLI app, not an Expo app. Do not assume `EXPO_PUBLIC_*` environment-variable handling. Choose and document an environment/configuration approach compatible with React Native CLI.
- The mobile app may contain the Supabase project URL and publishable (formerly anon) key. These are public client credentials and are safe only when database grants and RLS are correctly configured.
- Never place the Supabase `service_role` key, secret API keys, database password, JWT signing secret, or other privileged credentials in the mobile app, repository, or client-accessible configuration.
- Persist Auth sessions using an appropriate React Native storage adapter. Prefer platform-secure storage for sensitive session material when practical; do not invent a custom token-storage mechanism.
- Handle session restoration, token refresh, sign-out, expired sessions, and network failures explicitly. Do not log access tokens or refresh tokens.

### Database schema and migrations

- Store schema changes as ordered SQL migrations under `supabase/migrations/` when Supabase CLI is introduced.
- Treat migrations as the source of truth. Do not rely on undocumented manual Dashboard edits for schema or policy changes.
- Keep generated Supabase TypeScript database types in sync with migrations.
- Use Postgres constraints, foreign keys, unique indexes, and check constraints for invariants that the database can enforce.
- Use UUID identifiers where appropriate. Use integer chip counts and integer minor units for any currency-like value; never use floating-point arithmetic for chips or balances.
- Keep durable hand history and action records sufficient to reconstruct and audit a hand. Avoid storing unnecessary personal data.

### Row Level Security (RLS)

- Enable RLS on every table exposed through Supabase's Data API. Review table grants as well as policies; policies do not automatically remove broad grants.
- Write least-privilege policies for each operation. Default to deny; grant only the reads and writes required by the feature.
- Derive the acting user from the authenticated JWT using `auth.uid()`. Never trust a client-supplied `user_id`, role, seat ownership, stack, or admin flag for authorization.
- Enforce table membership and player ownership in database policies/functions. A user must not read another player's private cards or private account data.
- Restrict writes to authoritative game tables. Clients should normally perform game actions through validated Postgres RPC functions rather than directly updating hand, seat, stack, pot, deck, or winner records.
- Review every SQL function's execution privileges. Avoid `SECURITY DEFINER` unless necessary; when used, set a safe `search_path`, fully qualify referenced objects, validate caller authorization inside the function, and grant execute only to intended roles.
- Add tests for both allowed and denied access, including attempts to access another table or player's private data.

### Authoritative game backend

The backend is authoritative for all game outcomes and consequential state.

- Never trust the mobile client to shuffle/deal cards, choose random seeds, evaluate winners, validate betting actions, advance game phases, calculate pots, split pots, or modify stacks.
- Generate and shuffle the deck on the server/database side using a cryptographically secure random source and a well-tested shuffle implementation. Do not expose the deck order, random seed, burn cards, or undealt cards to clients.
- Implement consequential state transitions in transactional Postgres functions/RPC (or another explicitly approved trusted server-side component). Do not implement game authority solely in client state or Realtime callbacks.
- Lock the relevant hand/table/seat rows while applying concurrent actions. Validate the hand status, current phase, acting player, turn order, stack, action amount, minimum raise/re-raise rules, and table membership before mutating state.
- Make action requests idempotent (for example, with a client-generated action UUID stored under a unique constraint) so retries or reconnects cannot apply the same action twice.
- Include a hand/table state version or sequence number. Reject stale actions and make clients refresh authoritative state after conflicts.
- Apply each action and its related effects atomically: action history, commitments, pot/side pots, stack changes, turn advancement, phase transitions, and eventual payouts must not be partially committed.
- Keep a durable, append-only hand/action history where practical. Record enough information to investigate disputes and recover interrupted hands.
- Define disconnect, timeout, sit-out, leave-table, and abandoned-hand behavior in backend rules. Client timers are display hints; server/database time and state decide when a deadline expires.
- Keep chip accounting conserved. Account for blinds, antes, folds, all-ins, side pots, ties, odd chips, and players who are no longer eligible to win a side pot.
- Do not use JavaScript floating-point values for chip calculations. Validate all action amounts as bounded integers.
- Treat UI animations and optimistic updates as temporary presentation only. Reconcile them with the authoritative response/state.

### Realtime and private information

- Use Supabase Realtime Broadcast for low-latency game events where appropriate. Prefer private channels with authorization policies for table-specific traffic.
- Use Realtime Presence for ephemeral connection/online indicators and optionally ready-state display, not as the durable source of seats, stacks, turn order, or game state.
- Persist important state in Postgres first; broadcast notifications after the authoritative transition. A missed event must be recoverable by fetching the current authorized snapshot.
- On reconnect, reauthenticate, rejoin authorized channels, fetch the latest snapshot, and resume from the server's version/sequence. Do not assume the client received every event.
- Separate public table state from player-private state. Shared payloads may contain public community cards and visible actions, but never include all hole cards, deck contents, or private player data.
- Deliver a player's hole cards only through an authorization path that verifies that player is a participant in that hand. Do not rely on hiding fields in the UI.
- Validate Realtime channel authorization for both subscribing and publishing. Do not make table channels public merely to simplify subscriptions.
- Unsubscribe channels and clean up listeners when leaving a table or unmounting screens.

## Texas Hold'em domain rules

- Use a standard 52-card deck unless a future product requirement explicitly defines another variant. No wild cards by default.
- Each player receives two private hole cards. Community cards are dealt as flop (three), turn (one), and river (one).
- At showdown, each eligible player makes the best five-card hand from any combination of their two hole cards and the five community cards.
- Implement and test standard hand rankings in this order: high card, one pair, two pair, three of a kind, straight, flush, full house, four of a kind, straight flush. Royal flush is the ace-high straight flush, not a separate category for comparison.
- Handle ace-low straights (A-2-3-4-5) correctly. Compare kickers and all tie-breakers deterministically.
- Model the dealer button, small blind, big blind, betting rounds, and action order explicitly. Heads-up play has different button/blind and pre-flop/post-flop action order from multi-player hands.
- Support fold, check, call, bet, raise, and all-in only when legal for the current state. Betting limits (No-Limit, Pot-Limit, or Fixed-Limit), blind levels, ante rules, buy-ins, and table capacity must be explicit table configuration—not hidden assumptions.
- Calculate main and side pots from each player's total committed amount, not from the current UI pot display. Players who folded are ineligible to win, but their committed chips remain in the pot.
- Split tied pots correctly and define a deterministic odd-chip rule in the product/game specification.
- Keep the pure card evaluator and rule helpers deterministic and independent of networking, time, UI, and Supabase. Server-side enforcement must use equivalent trusted logic; client-side evaluation is for display/testing only.

## Product and responsible-play constraints

- Treat chips as virtual/play-money by default. Do not add deposits, withdrawals, cash-out, real-money wagering, paid tournaments, rake, or prize payouts unless explicitly requested and the applicable legal, platform, payment, age, and licensing requirements have been reviewed.
- Do not describe virtual chips as money or imply that they have cash value.
- Add appropriate age, location, responsible-play, and legal controls if product requirements ever move beyond casual play. Escalate regulatory or payments requirements rather than guessing.

## Testing expectations

- Put poker-domain tests around card parsing, deck uniqueness, shuffle invariants, hand ranking, kicker comparisons, ace-low straights, ties, betting legality, side pots, all-ins, odd chips, and heads-up action order. For Chinese Poker, test thirteen-card deals, 3-5-5 arrangement validation, bot layouts, row comparisons, sweeps, ties, and zero-sum scoring.
- Test the evaluator against known hands and exhaustive/representative edge cases. Do not use snapshot-only tests for poker correctness.
- Test backend RPC functions for valid actions, invalid/out-of-turn actions, stale versions, duplicate action IDs, concurrent actions, disconnected players, and complete hand settlement.
- Test RLS with multiple authenticated users and verify that a player cannot read another player's hole cards or mutate another player's seat/stack.
- Test Realtime reconnect and resynchronization, including missed, duplicated, and out-of-order notifications.
- Keep tests deterministic. Inject a test-only deck/shuffle source in server-side tests; never expose a production deck override to clients.
- Run relevant tests and lint after changes. Add integration tests against a local Supabase stack when migrations/functions/RLS are introduced.

## Definition of done

Before finishing a feature:

1. Review the changed files and confirm no secrets or privileged keys were introduced.
2. Verify authorization and RLS for every newly exposed table, RPC, and Realtime channel.
3. Verify game invariants are enforced by trusted backend code, not just the UI.
4. Add or update domain, integration, and access-control tests.
5. Run the relevant project scripts and report any checks that could not be run.
6. Update setup documentation and environment-variable examples without including real credentials.

## Official references

- [Supabase React Native Auth quickstart](https://supabase.com/docs/guides/auth/quickstarts/react-native)
- [Supabase React Native / Expo quickstart](https://supabase.com/docs/guides/getting-started/quickstarts/expo-react-native) — use only the Supabase client concepts; this repository is React Native CLI, not Expo.
- [Supabase Row Level Security](https://supabase.com/docs/guides/database/postgres/row-level-security)
- [Supabase Realtime Broadcast](https://supabase.com/docs/guides/realtime/broadcast)
- [Supabase Realtime Presence](https://supabase.com/docs/guides/realtime/presence)
- [Supabase Realtime: subscribing to database changes](https://supabase.com/docs/guides/realtime/subscribing-to-database-changes)
