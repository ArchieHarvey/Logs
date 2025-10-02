# Discord Bot with Git Update Automation

This project provides a Discord bot written in JavaScript (Node.js) that supports both prefix-based text commands and modern slash commands. It also includes a Git monitoring service that watches the repository for remote updates, posts a notification to a dedicated Discord channel, and (upon confirmation) automatically pulls the latest changes, pushes them upstream, and restarts the bot.

## Features

- **Text commands** with a configurable prefix (default: `!`).
- **Slash commands** powered by Discord's interactions API.
- **GitHub update monitor** that checks for new commits on the upstream branch and announces them in a fixed channel.
- **One-click updates**: authorised users can confirm the update via a button, triggering `git pull`, `git push`, and a clean restart of the bot worker.
- **Structured codebase** with clear separation of configuration, commands, events, services, and utilities.

## Getting started

### Prerequisites

- Node.js 18 or later.
- A Discord application with a bot token.
- A Git repository with a configured upstream remote (e.g. `origin/main`).

> **Note:** Installing dependencies from the public npm registry may require additional configuration in restricted environments.

### Installation

1. Clone the repository and install dependencies:

   ```bash
   npm install
   ```

2. Create a `.env` file based on the provided example:

   ```bash
   cp .env.example .env
   ```

3. Update `.env` with your Discord credentials and configuration:

   - `BOT_TOKEN`: Bot token from the Discord developer portal.
   - `CLIENT_ID`: Application (client) ID.
   - `GUILD_ID`: (Optional) Guild ID for faster slash-command deployment during development.
   - `UPDATE_CHANNEL_ID`: Channel ID that should receive Git update notifications.
   - `COMMAND_PREFIX`: Prefix for text commands (defaults to `!`).
   - `GIT_POLL_INTERVAL_MINUTES`: How often to poll for remote changes (defaults to 5 minutes).

4. Deploy slash commands (run again whenever slash commands change):

   ```bash
   npm run deploy:commands
   ```

5. Start the bot:

   ```bash
   npm start
   ```

## Project structure

```
src/
├── bot/
│   ├── bot.js                # Core bot logic
│   ├── commands/             # Text and slash command implementations
│   ├── events/               # Discord event bindings
│   ├── loaders/              # Helpers for loading commands
│   ├── services/             # Git monitoring service
│   └── util/                 # Logger utility
├── config/                   # Environment configuration loader
├── index.js                  # Supervisor that restarts the worker on demand
└── worker.js                 # Actual bot worker process
```

## Git update workflow

1. The `GitMonitor` service periodically executes `git fetch`/`git status` to check if the local repository is behind the upstream branch.
2. When the bot detects that it is behind, it sends a message with a confirmation button to `UPDATE_CHANNEL_ID`.
3. A user with the **Manage Server** permission can click the button to execute the update.
4. The bot runs `git pull` followed by `git push`. On success, the confirmation message is updated and the bot restarts automatically via the supervisor (`src/index.js`).

## Adding commands

- **Text commands**: add a new file to `src/bot/commands/text`. Export an object with `name`, `description`, and `execute`.
- **Slash commands**: add a new file to `src/bot/commands/slash`. Export an object with `data` (a `SlashCommandBuilder`) and `execute`.
- After modifying slash commands, run `npm run deploy:commands`.

## License

MIT
