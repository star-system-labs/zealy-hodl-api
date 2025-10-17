# Zealy HODL API

API for verifying token holdings and HODL time for Zealy quests.

## Overview

This API provides endpoints for Zealy to verify:
- Token balance tiers (configurable minimums, default: 100+, 1000+, 10000+ tokens)
- HODL time tiers (configurable minimums, default: 1+ token held for 7+, 30+, 90+ days)
- Combined qualification tiers (configurable requirements for both balance and time held)

The API implements an intelligent tier detection system that automatically identifies the highest qualifying tier across all categories and returns it as the result.

Created by 0xcircuitbreaker - Founder and CTO of Star System Labs.

## Setup

### 1. Clone the repository
```bash
git clone https://github.com/star-system-labs/zealy-hodl-api.git
cd zealy-hodl-api
```

### 2. Install dependencies
```bash
npm install
```

### 3. Configure environment
```bash
cp .env.example .env
```

Edit the `.env` file with your specific configuration:

| Variable | Description |
|----------|-------------|
| RPC_URL | Ethereum RPC URL (from providers like Infura or Alchemy) |
| TOKEN_ADDRESS | Contract address of the token to track |
| MIN_HODL_1, MIN_HODL_2, MIN_HODL_3 | Minimum token amounts for each HODL tier | 
| TOKEN_NAME | Display name for the token in responses |
| TOKEN_SYMBOL | Symbol for the token in responses |
| TOKEN_DECIMALS | Number of decimal places for the token (usually 18) |
| API_KEY | Secret API key for authentication |

#### Balance, HODL, and Final Tier Configuration
The API uses tiered requirements that can be configured via environment variables:

|    Variable Group   |                 Description                |
|---------------------|--------------------------------------------|
| BALANCE_TIER_X_MIN  | Balance required for tier X (1-3)          |
| BALANCE_TIER_X_DAYS | Days held required for tier X (1-3)        |
| MIN_HODL_X          | Minimum token amount for HODL tier X (1-3) |
| HODL_TIER_X_DAYS    | Days held required for HODL tier X (1-3)   |
| FINAL_TIER_X_MIN    | Balance required for final tier X (1-3)    |
| FINAL_TIER_X_DAYS   | Days held required for final tier X (1-3)  |

These settings let you customize the requirements for each tier independently.

#### Network Configuration
You can connect to multiple networks by setting the appropriate environment variables:

|   Variable   |                  Description                 |
|--------------|----------------------------------------------|
| NETWORK      | Network to use: ethereum, sepolia, base, bsc |
| NETWORK_NAME | Network name displayed in responses          |

For each supported network, add RPC URL and token address:
```
# Ethereum Mainnet (default)
RPC_URL=https://mainnet.infura.io/v3/your-key
TOKEN_ADDRESS=0x...

# Sepolia Testnet
SEPOLIA_RPC_URL=https://sepolia.infura.io/v3/your-key
SEPOLIA_TOKEN_ADDRESS=0x...

# Base L2
BASE_RPC_URL=https://mainnet.base.org
BASE_TOKEN_ADDRESS=0x...

# Binance Smart Chain
BSC_RPC_URL=https://bsc-dataseed.binance.org
BSC_TOKEN_ADDRESS=0x...
```

To switch networks, simply change the `NETWORK` value in your .env file or when running the server:
```bash
# Run on Sepolia testnet
NETWORK=sepolia npm start

# Run on Base
NETWORK=base npm start
```

For the API key for local testing, generate a secure random key:
```bash
# On Linux/Mac
openssl rand -hex 32

# On Windows PowerShell
$bytes = New-Object byte[] 32; (New-Object Security.Cryptography.RNGCryptoServiceProvider).GetBytes($bytes); [BitConverter]::ToString($bytes).Replace('-', '').ToLower()
```

Otherwise generate API key on Zealy for production API key
### 4. Start the server
```bash
npm start
```
The API will be available at `http://localhost:3000`

- **Environment secrets**: replace every placeholder (e.g. `YOUR_INFURA_KEY`, `YOUR_API_KEY`) in `.env` with live values before deployment.
- **Network selection**: set `NETWORK`/`NETWORK_NAME` and matching RPC URL + token address for the chain you support.
- **Tier thresholds**: review all `BALANCE_TIER_*`, `MIN_HODL_*`, `HODL_TIER_*`, and `FINAL_TIER_*` values to align with the live quest requirements.
- **Security**: keep `TEST_MODE` unset (defaults to `false`) in production, and distribute the `API_KEY` securely.

## Commands

- **`npm start`**
  - Launches `server.js` with production security checks enabled.
- **`npm test`**
  - Runs Jest functional tests against `/zealy/test` and `/zealy/claim` scenarios.
- **`npm run serve:test`**
  - Starts the server with `TEST_MODE=true` to generate mock blockchain data.
- **`npm run serve:test:zero`**
  - Same as above while forcing zero balances for failure-path validation.
- **`npm run serve:test:success` / `serve:test:failure`**
  - Force deterministic pass or fail responses in test mode.
- **`npm run serve:test:50` / `serve:test:90`**
  - Adjust success probability for randomized test simulations.
- **`npm run serve:ethereum` / `serve:sepolia` / `serve:base` / `serve:bsc`**
  - Bootstraps against specific chains without editing `.env`.
- **`npm run serve:test:<network>`**
  - Mixes `TEST_MODE=true` with network overrides for end-to-end staging drills.

## Usage

### API endpoints
- **`POST /zealy/claim`**
  - Verifies a live wallet against the requested quest tier using on-chain data.
  - Headers: `x-api-key: <API_KEY>`
  - Body:
    ```json
    {
      "accounts": { "wallet": "0xabc..." },
      "questId": "balance-tier-2"
    }
    ```
  - Successful responses (`200`) include `highestQualifyingTiers`, `allTiers`, and signed metadata. Failures (`400`) describe unmet thresholds and expose all tier diagnostics for UI messaging.

- **`POST /zealy/test`**
  - Generates synthetic responses without blockchain calls. Ideal for Zealy quest dry-runs, client integration tests, and monitoring.
  - Headers: `x-api-key: <API_KEY>`
  - Optional body flags: `forceSuccess`, `forceFailure`, `zeroBalance`, custom `wallet`, custom `questId`.

- **`POST /zealy/webhook`**
  - Validates Zealy HMAC signatures and responds with `{ ok: true }`. Extend this handler to trigger downstream automations (CRM logging, Discord notifications, etc.).
  - Headers: `x-zealy-signature` containing hex-encoded HMAC-SHA256 digest.

- **`GET /health`**
  - Returns service heartbeat with `status`, `timestamp`, `testMode`, and active network. Probe this endpoint for uptime monitors or Kubernetes liveness checks.

### Zealy Integration

Create three types of API quests in Zealy, each with specific quest IDs:

#### Balance Tiers
| Tier |    Quest ID      |      Requirements      |
|------|------------------|------------------------|
| Tier 1 | balance-tier-1 | 100+ tokens, 1+ days   |
| Tier 2 | balance-tier-2 | 1000+ tokens, 1+ days  |
| Tier 3 | balance-tier-3 | 10000+ tokens, 1+ days |

#### HODL Time Tiers
| Tier |   Quest ID    |    Requirements   |
|------|---------------|-------------------|
| Tier 1 | hodl-tier-1 | 1 token, 7+ days  |
| Tier 2 | hodl-tier-2 | 1 token, 30+ days |
| Tier 3 | hodl-tier-3 | 1 token, 90+ days |

#### Combined Tiers
| Tier |    Quest ID    |       Requirements       |
|------|----------------|--------------------------|
| Tier 1 | final-tier-1 | 100+ tokens, 7+ days     |
| Tier 2 | final-tier-2 | 1000+ tokens, 30+ days   |
| Tier 3 | final-tier-3 | 10000+ tokens, 90+ days  |

#### Tier Hierarchy
The API automatically determines the highest tier the user qualifies for using this hierarchy:
- Tier level (3, 2, 1) is the primary factor - higher tiers always outrank lower tiers
- Within the same tier level, tier types are ranked: Final > Balance = HODL
- Example: Balance Tier 2 outranks Final Tier 1, because tier level has priority

This means the system will always return the highest numerical tier a user qualifies for, regardless of tier type.

### Connecting to a Zealy quest
- **Configure quest IDs**: Align Zealy quest identifiers with the `tiers` map. The API always emits the canonical ID (e.g., `final-tier-2`).
- **Quest validator URL**: Point the Zealy API quest to your deployed `/zealy/claim` endpoint.
- **Authentication**: Store the `API_KEY` in Zealy’s secret manager so quest traffic includes the required header.
- **Response handling**: Zealy expects `{ questId: <tier>, message: ..., highestQualifyingTiers: ... }`. The API already formats this structure; Zealy uses the HTTP status to determine quest success/failure.
- **Auto-upgrade**: Keep `REQUIRE_QUEST_ID=false` to allow higher-tier auto-crediting when users outperform the requested quest.
- **Strict tier enforcement**: Toggle `REQUIRE_QUEST_ID=true` and set `REQUIRED_QUEST_ID` if you must prevent upgrades.

### Zealy quest enforcement toggle
- **`REQUIRE_QUEST_ID`**: When `true`, `/zealy/claim` and `/zealy/test` only accept the quest ID specified in `REQUIRED_QUEST_ID`. Requests with other IDs fail with `400`.
- **`REQUIRED_QUEST_ID`**: The exact quest identifier to enforce when the toggle is enabled. Must exist in the configured tiers.
- Default configuration keeps the toggle off so the API can auto-upgrade users to higher tiers when available.

### Zealy webhook endpoint
- **Endpoint**: `POST /zealy/webhook`
- **Signature header**: `x-zealy-signature` (hex-encoded HMAC-SHA256 digest).
- **Secret**: Configure `ZEALY_WEBHOOK_SECRET` so the service can validate webhook authenticity.
- **Behavior**: Valid signatures return `200 { ok: true }`; invalid or missing signatures return `401`. Extend this handler to trigger quest automations.

### Health check endpoint
- **Endpoint**: `GET /health`
- **Purpose**: Monitor service availability for load balancers and uptime monitoring
- **Response**: `200` with server status, timestamp, test mode flag, and network name
- **Usage**: Configure your monitoring tools or load balancers to poll this endpoint

### Sample Zealy verification flow
1. **User submits wallet** in a Zealy quest UI.
2. **Zealy calls `/zealy/claim`** with your API key and quest ID.
3. **API evaluates all tiers**, upgrades the quest ID if appropriate, and returns signed results.
4. **Zealy unlocks rewards** based on the HTTP status and returned quest ID.
5. Optional: **Zealy webhook** pushes quest completion events back to your server, where you can fan out notifications or analytics.

### Automated tests
- **Functional suite** (deterministic checks on `/zealy/test` and `/zealy/claim`):
  ```bash
  npm test
  ```
- **Sequential load smoke (200 requests against `/zealy/test`)**:
  ```bash
  npx jest --runTestsByPath __tests__/load.test.js --runInBand --no-cache
  ```

  Customize in higher-volume scenarios with environment variables:
  - `LOAD_TEST_ITERATIONS` – total requests (default `200`)
  - `LOAD_TEST_BATCH_SIZE` – concurrent requests per batch (default `50`, set to `1` for sequential)
  - `LOAD_TEST_TIMEOUT_MS` – test timeout window (default `120000` ms)
  - `LOAD_TEST_BATCH_DELAY_MS` – delay in ms between batches (default `0`)

  Examples:
  ```bash
  # POSIX (macOS/Linux)
  LOAD_TEST_ITERATIONS=20000 LOAD_TEST_BATCH_SIZE=200 npx jest --runTestsByPath __tests__/load.test.js --runInBand --no-cache

  # Windows PowerShell
  $env:LOAD_TEST_ITERATIONS=20000; $env:LOAD_TEST_BATCH_SIZE=200; npx jest --runTestsByPath __tests__/load.test.js --runInBand --no-cache; Remove-Item Env:LOAD_TEST_ITERATIONS; Remove-Item Env:LOAD_TEST_BATCH_SIZE
  ```

## Beyond Zealy integrations

- **Discord bot**
  - Use `/zealy/claim` to verify a member’s wallet before granting roles. Example flow:
    1. Bot receives `/verify-wallet` slash command, prompts for address.
    2. Bot server calls the API with your secret `API_KEY`.
    3. On success, bot assigns tier-based roles (e.g., `hodl-tier-3`). Failures return the explanatory message for user feedback.
- **Telegram bot**
  - Harness `/zealy/test` in `TEST_MODE` for community games or practice quests without on-chain lookups.
  - In production, connect `/zealy/claim` to reward tiered access (e.g., premium channels) using the highest qualifying tier.
- **Data pipelines**
  - Stream `highestQualifyingTiers` into analytics warehouses or loyalty dashboards.
  - Combine with `/zealy/webhook` to trigger CRM updates, marketing automations, or real-time alerts.

## License

MIT License

Copyright (c) 2025 Star System Labs / 0xcircuitbreaker

Permission is hereby granted, free of charge, to any person obtaining a copy
of this software and associated documentation files (the "Software"), to deal
in the Software without restriction, including without limitation the rights
to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
copies of the Software, and to permit persons to whom the Software is
furnished to do so, subject to the following conditions:

The above copyright notice and this permission notice shall be included in all
copies or substantial portions of the Software.

IMPORTANT: While not legally binding, we kindly request maintaining attribution
to 0xcircuitbreaker and Star System Labs in derivatives of this work.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
SOFTWARE.