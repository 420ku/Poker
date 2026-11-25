# Supabase environments

This project uses two separate Supabase environments:

| Environment | Purpose | Where it runs |
| --- | --- | --- |
| Local development | Build and test poker features, migrations, RLS, and Realtime | Supabase CLI + Podman on your workstation |
| Production | Real users and production data | Hosted Supabase project |

The app must use local credentials during development and production credentials only in production builds. Never use production data as local seed data.

## 1. Prepare Podman on CachyOS

Install Podman and enable its user-level Docker-compatible API socket:

```sh
sudo pacman -S podman
systemctl --user enable --now podman.socket
```

For the Supabase CLI's Docker-compatible client, point `DOCKER_HOST` at the Podman socket:

```sh
export DOCKER_HOST="unix://${XDG_RUNTIME_DIR}/podman/podman.sock"
```

Persist this in Zsh:

```sh
grep -qxF 'export DOCKER_HOST="unix://${XDG_RUNTIME_DIR}/podman/podman.sock"' ~/.zshrc || \
  echo 'export DOCKER_HOST="unix://${XDG_RUNTIME_DIR}/podman/podman.sock"' >> ~/.zshrc
source ~/.zshrc
```

Verify the socket and runtime:

```sh
podman info
podman ps
test -S "${XDG_RUNTIME_DIR}/podman/podman.sock" && echo "Podman socket ready"
```

Keep this socket bound to your local user. Do not expose the Podman API over TCP.

## 2. Initialize the local Supabase project

Run from the repository root:

```sh
cd ~/Developer/Poker

# Install and pin the Supabase CLI in this project
bun add --dev supabase

# Generate the CLI configuration and local Supabase directory
bunx supabase init

# Start the local Supabase services
bunx supabase start
```

The first start downloads container images and can take several minutes. Supabase recommends at least 7 GB of RAM for the full local stack.

After startup, inspect the generated local credentials:

```sh
bunx supabase status
```

Default local endpoints:

| Service | Address |
| --- | --- |
| API | `http://127.0.0.1:54321` |
| PostgreSQL | `127.0.0.1:54322` |
| Supabase Studio | `http://127.0.0.1:54323` |
| Mailpit | `http://127.0.0.1:54324` |

Open Studio at http://127.0.0.1:54323. Use the local publishable key printed by `supabase status` when configuring the mobile client. Never put the local secret key in the app.

Commit `supabase/config.toml`, migrations, and safe development seed files. Do not commit `supabase/.temp/`, local secrets, or real user data.

## 3. Create the hosted production project

1. Open https://supabase.com/dashboard and create a new project in your Supabase organization.
2. Name it clearly, for example `poker-production`.
3. Choose a region close to your users (Singapore is a sensible starting point for a Philippines-focused audience when available).
4. Generate a strong database password and save it in a password manager. Do not put it in Git or in the mobile app.
5. Wait for the hosted database to finish provisioning.
6. Copy the project reference from the dashboard URL: `https://supabase.com/dashboard/project/<project-ref>`.

Keep this project separate from local development. Do not use production to test incomplete poker rules, RLS policies, or seed data.

## 4. Authenticate the CLI and link production

From the repository root:

```sh
bunx supabase login
bunx supabase projects list
bunx supabase link --project-ref <project-ref>
```

The link command prompts for the database password. The project reference/link metadata is local CLI state under `supabase/.temp/`; it is not the mobile app's connection configuration.

Linking does not change where ordinary local commands run:
- `bunx supabase start` and `bunx supabase db reset` target the local stack.
- Commands with `--remote` target the linked hosted project.
- Always confirm the linked project before running remote commands.

## 5. Promote migrations safely

Create all schema changes as migrations, then test them locally before production:

```sh
# Create a migration
bunx supabase migration new create_initial_poker_schema

# Edit the generated SQL under supabase/migrations/

# Rebuild local database and replay every migration
bunx supabase db reset

# Review local schema and test RLS/game RPC behavior in Studio
```

When ready to deploy reviewed migrations:

```sh
# Preview pending changes against linked production
bunx supabase db push --dry-run --remote

# Apply pending migrations only after reviewing the preview
bunx supabase db push --remote

# Compare local and remote migration history
bunx supabase migration list --remote
```

Do not run `db reset --remote` against production. It is destructive. Do not use `--include-seed` on production; seed data is for local development and disposable test environments.

## 6. Mobile app credential boundaries

When the Supabase client is implemented, the React Native app should receive only:

- Local development: local Supabase URL and local publishable key.
- Production build: hosted production URL and hosted publishable key.

The Supabase publishable key is designed for client applications, but it is not an authorization boundary. Enable and test RLS for every exposed table and validate every RPC. Never bundle a `service_role` key, secret API key, database password, or privileged token into the mobile app.

This repository is currently a React Native CLI starter and does not yet load Supabase environment variables. Add a React Native-compatible environment/configuration package as part of the Supabase client integration; do not assume Expo's `EXPO_PUBLIC_*` variables work here.

## Daily commands

```sh
bunx supabase start          # Start local services
bunx supabase status         # Show local URLs and keys
bunx supabase stop           # Stop local services; keep local data
bunx supabase db reset       # Rebuild local DB from migrations + seed
podman ps                    # Inspect running containers
```

## Official documentation

- [Supabase local development](https://supabase.com/docs/guides/local-development)
- [Supabase CLI setup](https://supabase.com/docs/guides/local-development/cli/getting-started)
- [Local development workflow](https://supabase.com/docs/guides/local-development/cli-workflows)
- [Docker and Podman runtimes](https://supabase.com/docs/guides/local-development/docker-and-native-runtimes)
