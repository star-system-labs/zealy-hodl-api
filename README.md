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

| Variable Group | Description |
|----------|-------------|
| BALANCE_TIER_X_MIN | Balance required for tier X (1-3) |
| BALANCE_TIER_X_DAYS | Days held required for tier X (1-3) |
| MIN_HODL_X | Minimum token amount for HODL tier X (1-3) |
| HODL_TIER_X_DAYS | Days held required for HODL tier X (1-3) |
| FINAL_TIER_X_MIN | Balance required for final tier X (1-3) |
| FINAL_TIER_X_DAYS | Days held required for final tier X (1-3) |

These settings let you customize the requirements for each tier independently.

#### Network Configuration
You can connect to multiple networks by setting the appropriate environment variables:

| Variable | Description |
|----------|-------------|
| NETWORK | Network to use: ethereum, sepolia, base, bsc |
| NETWORK_NAME | Network name displayed in responses |

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

## Usage

### Zealy Integration

Create three types of API quests in Zealy, each with specific quest IDs:

#### Balance Tiers
| Tier | Quest ID | Requirements |
|------|----------|--------------|
| Tier 1 | balance-tier-1 | 100+ tokens, 1+ days |
| Tier 2 | balance-tier-2 | 1000+ tokens, 1+ days |
| Tier 3 | balance-tier-3 | 10000+ tokens, 1+ days |

#### HODL Time Tiers
| Tier | Quest ID | Requirements |
|------|----------|--------------|
| Tier 1 | hodl-tier-1 | 1 token, 7+ days |
| Tier 2 | hodl-tier-2 | 1 token, 30+ days |
| Tier 3 | hodl-tier-3 | 1 token, 90+ days |

#### Combined Tiers
| Tier | Quest ID | Requirements |
|------|----------|--------------|
| Tier 1 | final-tier-1 | 100+ tokens, 7+ days |
| Tier 2 | final-tier-2 | 1000+ tokens, 30+ days |
| Tier 3 | final-tier-3 | 10000+ tokens, 90+ days |

#### Tier Hierarchy
The API automatically determines the highest tier the user qualifies for using this hierarchy:
- Tier level (3, 2, 1) is the primary factor - higher tiers always outrank lower tiers
- Within the same tier level, tier types are ranked: Final > Balance = HODL
- Example: Balance Tier 2 outranks Final Tier 1, because tier level has priority

This means the system will always return the highest numerical tier a user qualifies for, regardless of tier type.

### API Endpoints

#### Verification Endpoint
```
POST /zealy/claim
```

Headers:
```
X-API-Key: your-api-key
Content-Type: application/json
```

Request Body:
```json
{
  "userId": "user-id",
  "communityId": "community-id",
  "questId": "tier-id",
  "requestId": "request-id",
  "accounts": {
    "wallet": "0x..."
  }
}
```

Response:
```json
{
  "message": "User qualifies for the combined tier: final-tier-2",
  "token": {
    "name": "YourToken",
    "symbol": "$TOKEN",
    "contract": "0x...",
    "network": "Ethereum Mainnet"
  },
  "wallet": "0x...",
  "questId": "final-tier-2",
  "userMetrics": {
    "currentBalance": 2500,
    "daysHeld": 45
  },
  "requestedTier": {
    "id": "final-tier-2",
    "qualified": true,
    "type": "combined"
  },
  "allTiers": {
    "balance": { /* all balance tier results */ },
    "hodl": { /* all hodl tier results */ },
    "final": { /* all final tier results */ }
  },
  "flatTiers": {
    "balance_tier_1_qualified": true,
    "balance_tier_2_qualified": true,
    "balance_tier_3_qualified": false,
    "hodl_tier_1_qualified": true,
    "hodl_tier_2_qualified": true,
    "hodl_tier_3_qualified": false,
    "final_tier_1_qualified": true,
    "final_tier_2_qualified": true,
    "final_tier_3_qualified": false
  },
  "highestQualifyingTiers": {
    "balance": "balance-tier-2",
    "hodl": "hodl-tier-2",
    "final": "final-tier-2",
    "overall": "final-tier-2"
  }
}
```

## Testing

### Test Mode

Enable test mode by setting environment variables:

```bash
# In your .env file
TEST_MODE=true
TEST_SUCCESS_RATE=50
TEST_ZERO_BALANCE=false
FORCE_TEST_RESULT=success
```

You can control test outcomes with these options:

| Variable | Values | Description |
|----------|--------|-------------|
| TEST_MODE | true/false | Enable or disable test mode |
| TEST_SUCCESS_RATE | 0-100 | Percentage chance of random qualification success |
| TEST_ZERO_BALANCE | true/false | Force zero balance in all test responses |
| FORCE_TEST_RESULT | success/failure | Override random success rate with forced outcome |

Or using npm commands:
```bash
# Basic test commands
npm run test                # Default test mode
npm run test:zero           # Test with zero balance
npm run test:success        # Force all tests to succeed
npm run test:failure        # Force all tests to fail

# Control success rate
npm run test:50             # 50% success rate
npm run test:90             # 90% success rate
```

### Test Endpoint
```
POST /zealy/test
```

Headers:
```
X-API-Key: your-api-key
Content-Type: application/json
```

Request Body:
```json
{
  "wallet": "0xTestWallet123",
  "questId": "balance-tier-2",
  "forceSuccess": true,
  "zeroBalance": false
}
```

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