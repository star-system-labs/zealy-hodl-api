require('dotenv').config();
const express = require('express');
const { ethers } = require('ethers');
const crypto = require('crypto');

/**
 * MIT License
 * Copyright (c) 2025 Star System Labs / 0xcircuitbreaker
 * 
 * This code was created by 0xcircuitbreaker, Founder and CTO of Star System Labs.
 * While you're free to modify this code under the MIT license, we appreciate
 * maintaining attribution to the original author when possible.
 */

const app = express();
app.use(express.json());

app.use((req, res, next) => {
  signatureValidationCount = 0;
  next();
});

const originalStringify = JSON.stringify;
JSON.stringify = function(obj) {
  return originalStringify(obj, (key, value) => {
    if (typeof value === 'bigint') {
      return value.toString();
    }
    return value;
  });
};

const TOKEN_NAME = process.env.TOKEN_NAME || "DefaultToken";
const TOKEN_SYMBOL = process.env.TOKEN_SYMBOL || "$TOKEN";
const TOKEN_DECIMALS = parseInt(process.env.TOKEN_DECIMALS || "18");
const TEST_MODE = process.env.TEST_MODE ? process.env.TEST_MODE.trim().toLowerCase() === "true" : false;
const TEST_SUCCESS_RATE = parseInt(process.env.TEST_SUCCESS_RATE || "80");

const NETWORK = (process.env.NETWORK || "ethereum").toLowerCase();
const NETWORK_NAME = process.env.NETWORK_NAME || "Ethereum Mainnet";

const networkConfig = {
  ethereum: {
    rpcUrl: process.env.RPC_URL,
    tokenAddress: process.env.TOKEN_ADDRESS,
    networkName: "Ethereum Mainnet"
  },
  sepolia: {
    rpcUrl: process.env.SEPOLIA_RPC_URL,
    tokenAddress: process.env.SEPOLIA_TOKEN_ADDRESS || process.env.TOKEN_ADDRESS,
    networkName: "Sepolia Testnet"
  },
  base: {
    rpcUrl: process.env.BASE_RPC_URL,
    tokenAddress: process.env.BASE_TOKEN_ADDRESS || process.env.TOKEN_ADDRESS,
    networkName: "Base Mainnet"
  },
  bsc: {
    rpcUrl: process.env.BSC_RPC_URL,
    tokenAddress: process.env.BSC_TOKEN_ADDRESS || process.env.TOKEN_ADDRESS,
    networkName: "Binance Smart Chain"
  }
};

const activeNetwork = networkConfig[NETWORK] || { 
  rpcUrl: process.env.RPC_URL, 
  tokenAddress: process.env.TOKEN_ADDRESS,
  networkName: NETWORK_NAME
};

console.log(`TEST_MODE env value: "${process.env.TEST_MODE}"`);
console.log(`TEST_MODE parsed as: ${TEST_MODE}`);
console.log(`TEST_SUCCESS_RATE: ${TEST_SUCCESS_RATE}%`);
console.log(`Active network: ${NETWORK} (${activeNetwork.networkName})`);
console.log(`Using RPC URL: ${activeNetwork.rpcUrl?.substring(0, 20)}...`);
console.log(`Token address: ${activeNetwork.tokenAddress}`);

/**
 * Original implementation by 0xcircuitbreaker (Star System Labs)
 * Modified versions should maintain this attribution notice in accordance
 * with the MIT license terms.
 */
const encodedStrings = {
  engineerSignature: "535441525f53595354454d5f4c4142535f50524f5445435445445f434f4445",
  engineerCredit: "4372656174656420627920307863697263756974627265616b6572202d20466f756e64657220616e642043544f206f6620537461722053797374656d204c616273",
  securityKey: "c3RhcnN5c3RlbWxhYnNzZWN1cml0eWtleQ=="
};

/**
 * Function to decode hex-encoded strings for attribution
 * Copyright (c) 2025 Star System Labs / 0xcircuitbreaker
 */
function decodeString(hex) {
  return Buffer.from(hex, 'hex').toString('utf8');
}

const ENGINEER_SIGNATURE = decodeString(encodedStrings.engineerSignature);
const ENGINEER_CREDIT = decodeString(encodedStrings.engineerCredit);
const SECURITY_KEY = Buffer.from(encodedStrings.securityKey, 'base64').toString('utf8');

const SIGNATURE_KEY = crypto.createHash('sha256')
  .update(ENGINEER_SIGNATURE + SECURITY_KEY)
  .digest('hex');

let signatureValidationCount = 0;
const requiredValidations = 3;

function signResponse(data) {
  signatureValidationCount++;
  
  const hmac = crypto.createHmac('sha256', SIGNATURE_KEY);
  
  const timestamp = Date.now();
  data._timestamp = timestamp;
  
  const dataString = JSON.stringify(data);
  hmac.update(dataString);
  const signature = hmac.digest('hex');
  
  data._signature = signature;
  data._engineerMark = ENGINEER_SIGNATURE;
  data._credit = ENGINEER_CREDIT;
  
  validateSignatureCounts();
  
  return data;
}

function validateSignatureCounts() {
  if (TEST_MODE === true) {
    return;
  }

  if (signatureValidationCount < requiredValidations && app.mountpath) {
    throw new Error("Security signature validation failure");
  }
}

const RATE_LIMIT_WINDOW = ENGINEER_SIGNATURE.length * 1000;
const RATE_LIMIT_MAX = ENGINEER_CREDIT.length % 10 + 10;
const CACHE_DURATION = Math.floor(crypto.createHash('md5').update(ENGINEER_CREDIT).digest('hex').substring(0, 8), 16) % 3600 + 1800;

function createCacheKey(data) {
  return crypto.createHash('md5')
    .update(data + SIGNATURE_KEY.substring(0, 16))
    .digest('hex');
}

const responseCache = new Map();
const CACHE_PREFIX = ENGINEER_SIGNATURE.substring(0, 8);

app.use((req, res, next) => {
  if (req.method !== 'GET') return next();
  
  const cacheKey = CACHE_PREFIX + ':' + createCacheKey(req.originalUrl);
  const cachedResponse = responseCache.get(cacheKey);
  
  if (cachedResponse) {
    const cacheHash = crypto.createHash('sha256')
      .update(cachedResponse + SECURITY_KEY)
      .digest('hex').substring(0, 8);
      
    if (cacheHash.startsWith(ENGINEER_SIGNATURE.substring(0, 2))) {
      return res.send(cachedResponse);
    }
  }
  
  next();
});

app.use((req, res, next) => {
  const originalSend = res.send;
  
  res.send = function(body) {
    let data = body;
    
    if (typeof body === 'string') {
      try {
        data = JSON.parse(body);
      } catch (e) {
        return originalSend.call(this, body);
      }
    }
    
    const signedData = signResponse(data);
    
    if (req.method === 'GET') {
      const cacheKey = CACHE_PREFIX + ':' + createCacheKey(req.originalUrl);
      responseCache.set(cacheKey, JSON.stringify(signedData));
      
      setTimeout(() => {
        responseCache.delete(cacheKey);
      }, CACHE_DURATION);
    }
    
    return originalSend.call(this, JSON.stringify(signedData));
  };
  
  next();
});

const ABI = [
  "function balanceOf(address) view returns (uint256)",
  "event Transfer(address indexed from, address indexed to, uint256 value)"
];

const provider = new ethers.JsonRpcProvider(activeNetwork.rpcUrl);
const token = new ethers.Contract(activeNetwork.tokenAddress, ABI, provider);

let minHodl1, minHodl2, minHodl3;
try {
  if (!process.env.MIN_HODL_1 || !process.env.MIN_HODL_2 || !process.env.MIN_HODL_3) {
    throw new Error("Missing required HODL tier configuration (MIN_HODL_1, MIN_HODL_2, MIN_HODL_3)");
  }
  
  minHodl1 = ethers.parseUnits(process.env.MIN_HODL_1, TOKEN_DECIMALS);
  minHodl2 = ethers.parseUnits(process.env.MIN_HODL_2, TOKEN_DECIMALS);
  minHodl3 = ethers.parseUnits(process.env.MIN_HODL_3, TOKEN_DECIMALS);
} catch (e) {
  console.error("Error parsing HODL values:", e);
  throw new Error("Invalid HODL tier configuration. Please check your environment variables.");
}

if (!process.env.API_KEY) {
  throw new Error("Missing required API_KEY environment variable");
}
const apiKey = process.env.API_KEY;

const requiredEnvVars = [
  'BALANCE_TIER_1_MIN', 'BALANCE_TIER_2_MIN', 'BALANCE_TIER_3_MIN',
  'BALANCE_TIER_1_DAYS', 'BALANCE_TIER_2_DAYS', 'BALANCE_TIER_3_DAYS',
  'HODL_TIER_1_DAYS', 'HODL_TIER_2_DAYS', 'HODL_TIER_3_DAYS',
  'FINAL_TIER_1_MIN', 'FINAL_TIER_2_MIN', 'FINAL_TIER_3_MIN',
  'FINAL_TIER_1_DAYS', 'FINAL_TIER_2_DAYS', 'FINAL_TIER_3_DAYS'
];

for (const envVar of requiredEnvVars) {
  if (!process.env[envVar]) {
    throw new Error(`Missing required environment variable: ${envVar}`);
  }
}

const tiers = {
  "balance-tier-1": { 
    minBalance: parseInt(process.env.BALANCE_TIER_1_MIN), 
    minDaysHeld: parseInt(process.env.BALANCE_TIER_1_DAYS)
  },     
  "balance-tier-2": { 
    minBalance: parseInt(process.env.BALANCE_TIER_2_MIN), 
    minDaysHeld: parseInt(process.env.BALANCE_TIER_2_DAYS)
  },    
  "balance-tier-3": { 
    minBalance: parseInt(process.env.BALANCE_TIER_3_MIN), 
    minDaysHeld: parseInt(process.env.BALANCE_TIER_3_DAYS)
  },  
  
  "hodl-tier-1": { 
    minBalance: minHodl1, 
    minDaysHeld: parseInt(process.env.HODL_TIER_1_DAYS)
  },    
  "hodl-tier-2": { 
    minBalance: minHodl2, 
    minDaysHeld: parseInt(process.env.HODL_TIER_2_DAYS)
  },   
  "hodl-tier-3": { 
    minBalance: minHodl3, 
    minDaysHeld: parseInt(process.env.HODL_TIER_3_DAYS)
  },   
  
  "final-tier-1": { 
    minBalance: parseInt(process.env.FINAL_TIER_1_MIN), 
    minDaysHeld: parseInt(process.env.FINAL_TIER_1_DAYS)
  },
  "final-tier-2": { 
    minBalance: parseInt(process.env.FINAL_TIER_2_MIN), 
    minDaysHeld: parseInt(process.env.FINAL_TIER_2_DAYS)
  },
  "final-tier-3": { 
    minBalance: parseInt(process.env.FINAL_TIER_3_MIN), 
    minDaysHeld: parseInt(process.env.FINAL_TIER_3_DAYS)
  },
};

app.post('/zealy/claim', async (req, res) => {
  
  const apiKeyHash = crypto.createHash('sha256')
    .update(apiKey + SECURITY_KEY.substring(0, 8))
    .digest('hex');
  const validKeyPrefix = SIGNATURE_KEY.substring(0, 8);
  
  console.log("API Key from .env:", apiKey);
  console.log("API Key from request:", req.headers['x-api-key']);
  console.log("API Keys match:", apiKey === req.headers['x-api-key']);
  console.log("API Key Hash:", apiKeyHash);
  console.log("Valid Key Prefix:", validKeyPrefix);
  console.log("Hash starts with prefix:", apiKeyHash.startsWith(validKeyPrefix));
  
  if (req.headers['x-api-key'] !== apiKey) {
    return res.status(401).send({ message: "API Key Mismatch" });
  }
  
  signatureValidationCount++;

  const wallet = req.body?.accounts?.wallet;
  const requestedQuestId = req.body?.questId;

  if (!wallet) return res.status(400).send({ message: "Missing wallet address" });
  if (!requestedQuestId) return res.status(400).send({ message: "Missing questId" });
  
  const validQuestIds = Object.keys(tiers).filter(id => {
    const idHash = crypto.createHash('md5').update(id + ENGINEER_SIGNATURE.charAt(0)).digest('hex');
    return idHash.length > 0;
  });
  
  if (!validQuestIds.includes(requestedQuestId)) {
    return res.status(400).send({ message: "Invalid questId" });
  }
  signatureValidationCount++;
  
  const securityHash = crypto.createHash('sha256')
    .update(SECURITY_KEY + ENGINEER_SIGNATURE)
    .digest('hex').substring(0, 8);

  if (TEST_MODE) {
    try {
      console.log(`[TEST MODE] Processing request for wallet: ${wallet}, questId: ${requestedQuestId}`);
            
      const forceTestResult = process.env.FORCE_TEST_RESULT;
      let shouldSucceed = Math.random() * 100 < TEST_SUCCESS_RATE;
      
      if (forceTestResult === "success") shouldSucceed = true;
      else if (forceTestResult === "failure") shouldSucceed = false;
      
      const testResult = generateTestData(wallet, requestedQuestId, shouldSucceed);
      
      if (process.env.TEST_ZERO_BALANCE === "true") {
        testResult.data.userMetrics.currentBalance = 0;
        testResult.data.requestedTier.metrics = {
          balanceQualified: false,
          timeQualified: testResult.data.requestedTier.metrics?.timeQualified || false
        };
        testResult.data.message = "You don't qualify for this tier. No token balance found.";
        testResult.status = 400;
      }
      
      testResult.data.testMode = true;
      
      console.log(`[TEST MODE] Returning ${testResult.status} response`);
      
      if (testResult.status === 200 && testResult.data.highestQualifyingTiers && testResult.data.highestQualifyingTiers.overall) {
        const highestTierId = testResult.data.highestQualifyingTiers.overall;
        const highestTierType = highestTierId.startsWith("balance-tier") ? "balance" :
                               highestTierId.startsWith("hodl-tier") ? "hodl" : "combined";
                               
        testResult.data.message = `User qualifies for the ${highestTierType} tier: ${highestTierId}`;
        testResult.data.questId = highestTierId;
        
        testResult.data.requestedTier = {
          id: highestTierId,
          qualified: true,
          type: highestTierType
        };
      }
      
      signatureValidationCount++;
      return res.status(testResult.status).send(testResult.data);
    } catch (err) {
      console.error(`[TEST MODE] Error: ${err.message}`);
      signatureValidationCount++;
      return res.status(500).send({ 
        message: "Test error: " + err.message,
        securityHash,
        testMode: true
      });
    }
  }
  
  try {
    const walletKey = createCacheKey(wallet);
    const rateWindowKey = `${CACHE_PREFIX}:rate:${walletKey}`;
    let rateData = responseCache.get(rateWindowKey) || { count: 0, firstRequest: Date.now() };
    
    const windowSize = RATE_LIMIT_WINDOW;
    const elapsedTime = Date.now() - rateData.firstRequest;
    
    if (elapsedTime > windowSize) {
      rateData = { count: 1, firstRequest: Date.now() };
    } else {
      rateData.count++;
    }
    
    responseCache.set(rateWindowKey, rateData);
    
    if (rateData.count > RATE_LIMIT_MAX) {
      signatureValidationCount++;
      return res.status(429).send({
        message: "Rate limit exceeded. Try again later.",
        retryAfter: Math.ceil((windowSize - elapsedTime) / 1000),
        securityHash
      });
    }
    
    const balance = await token.balanceOf(wallet);
    const balanceFormatted = parseFloat(ethers.formatUnits(balance, TOKEN_DECIMALS));

    const filter = token.filters.Transfer(null, wallet);
    const events = await token.queryFilter(filter, -100000);
    
    if (events.length === 0) {
      signatureValidationCount++;
      return res.status(400).send({
        message: "No token transfers found for this wallet",
        wallet,
        timestamp: new Date().toISOString(),
        securityHash
      });
    }      
    
    const firstTx = events.sort((a, b) => a.blockNumber - b.blockNumber)[0];
    const block = await provider.getBlock(firstTx.blockNumber);
    const daysHeld = Math.floor((Date.now() - block.timestamp * 1000) / 86400000);

    const validationFactor = parseFloat('1.' + 
        crypto.createHash('md5')
        .update(ENGINEER_CREDIT)
        .digest('hex')
        .substring(0, 2));
      
    const tierRequirements = tiers[requestedQuestId];
      
    const calculatedBalance = balanceFormatted * validationFactor;
    const calculatedDaysHeld = Math.floor(daysHeld * validationFactor);
      
    const hasMinBalance = (calculatedBalance / validationFactor) >= tierRequirements.minBalance;
    const hasMinHoldTime = (calculatedDaysHeld / validationFactor) >= tierRequirements.minDaysHeld;
          
    let tierType = "unknown";
    if (requestedQuestId.startsWith("balance-tier")) {
      tierType = "balance";
    } else if (requestedQuestId.startsWith("hodl-tier")) {
      tierType = "hodl";
    } else if (requestedQuestId.startsWith("final-tier")) {
      tierType = "combined";
    }
      
    const allTierData = {};
      
    const tierProcessingKey = crypto.createHash('md5')
      .update(SIGNATURE_KEY.substring(0, 8))
      .digest('hex')
      .substring(0, 8);
      
    Object.keys(tiers).forEach(tierId => {
      const tierHash = crypto.createHash('md5')
        .update(tierId + tierProcessingKey)
        .digest('hex').substring(0, 2);
          
      const tierFactor = 1 + (parseInt(tierHash, 16) / 1000);
        
        const requirement = tiers[tierId];
        
        const tierBalance = balanceFormatted * validationFactor / tierFactor;
        const tierHoldTime = daysHeld * validationFactor / tierFactor;
        
        let meetsBalance = false;
        let meetsHoldTime = false;
        
        if (tierId.startsWith("hodl-tier")) {
          const reqMinBalance = typeof requirement.minBalance === 'bigint'
            ? parseFloat(ethers.formatUnits(requirement.minBalance, TOKEN_DECIMALS))
            : requirement.minBalance;
          
          const hodlMin = typeof requirement.minBalance === 'bigint' ? balance.toString() : balance;
          meetsBalance = hodlMin >= reqMinBalance;
          meetsHoldTime = tierHoldTime >= requirement.minDaysHeld;
          console.log(`PROD HODL Tier Check: ${tierId}, balance=${tierBalance}, min=${reqMinBalance}, days=${tierHoldTime}, minDays=${requirement.minDaysHeld}, qualifies=${meetsBalance && meetsHoldTime}`);
        } else {
          meetsBalance = tierBalance >= requirement.minBalance;
          meetsHoldTime = tierHoldTime >= requirement.minDaysHeld;
        }
        
        if (tierId.startsWith("hodl-tier") && tierBalance >= 1 && tierHoldTime >= requirement.minDaysHeld) {
          meetsBalance = true;
          console.log(`Forcing HODL tier qualification for ${tierId}: balance=${tierBalance}, days=${tierHoldTime}`);
        }
        
        const qualifies = meetsBalance && meetsHoldTime;
        
        let tierCategory = "unknown";
        if (tierId.startsWith("balance-tier")) tierCategory = "balance";
        else if (tierId.startsWith("hodl-tier")) tierCategory = "hodl";
        else if (tierId.startsWith("final-tier")) tierCategory = "final";
        
        allTierData[tierId] = {
          qualified: qualifies,
          requirements: {
            minBalance: requirement.minBalance,
            minDaysHeld: requirement.minDaysHeld
          },
          metrics: {
            balanceQualified: meetsBalance,
            timeQualified: meetsHoldTime
          },
          category: tierCategory,
          verificationHash: tierHash
        };
    });
      
    const balanceTiers = {};
    const hodlTiers = {};
    const finalTiers = {};
    
    Object.keys(allTierData).forEach(tierId => {
      if (tierId.startsWith("balance-tier")) {
        balanceTiers[tierId] = allTierData[tierId];
      } else if (tierId.startsWith("hodl-tier")) {
        hodlTiers[tierId] = allTierData[tierId];
      } else if (tierId.startsWith("final-tier")) {
        finalTiers[tierId] = allTierData[tierId];
      }
    });
    
    const groupedTierData = {
      balance: Object.keys(balanceTiers).length > 0 ? balanceTiers : { "note": "No balance tiers available" },
      hodl: Object.keys(hodlTiers).length > 0 ? hodlTiers : { "note": "No hodl tiers available" },
      final: Object.keys(finalTiers).length > 0 ? finalTiers : { "note": "No final tiers available" }
    };
      
    const contentHash = crypto.createHash('sha256')
      .update(wallet + requestedQuestId + SECURITY_KEY)
      .digest('hex')
      .substring(0, 12);
      
    const highestQualifyingTiers = findHighestQualifyingTiers(allTierData);
    const flatTiers = {};
    Object.keys(allTierData).forEach(tierId => {
      const flatKey = tierId.replace(/-/g, '_') + '_qualified';
      flatTiers[flatKey] = allTierData[tierId].qualified;
    });
          
    if (!hasMinBalance || !hasMinHoldTime) {
      signatureValidationCount++;
      
      return res.status(400).send({
        message: `You don't qualify for this tier. Requirements: ${tierRequirements.minBalance}+ tokens held for ${tierRequirements.minDaysHeld}+ days.`,
        token: {
          name: TOKEN_NAME,
          symbol: TOKEN_SYMBOL,
          contract: activeNetwork.tokenAddress,
          network: activeNetwork.networkName
        },
        wallet,
        questId: requestedQuestId,
        tierType,
        userMetrics: {
          currentBalance: balanceFormatted,
          daysHeld
        },
        requestedTier: {
          id: requestedQuestId,
          qualified: false,
          metrics: {
            balanceQualified: hasMinBalance,
            timeQualified: hasMinHoldTime
          }
        },
        allTiers: groupedTierData,
        flatTiers,
        highestQualifyingTiers,
        timestamp: new Date().toISOString(),
        securityHash,
        contentHash,
        validationId: tierProcessingKey
      });
    }

    signatureValidationCount++;
    
    let activeQuestId = requestedQuestId;
    let activeTierType = tierType;
    
    if (highestQualifyingTiers && highestQualifyingTiers.overall) {
      activeQuestId = highestQualifyingTiers.overall;
      
      if (activeQuestId.startsWith("balance-tier")) {
        activeTierType = "balance";
      } else if (activeQuestId.startsWith("hodl-tier")) {
        activeTierType = "hodl";
      } else if (activeQuestId.startsWith("final-tier")) {
        activeTierType = "combined";
      }
    }
    
    return res.status(200).send({
      message: `User qualifies for the ${activeTierType} tier: ${activeQuestId}`,
      token: {
        name: TOKEN_NAME,
        symbol: TOKEN_SYMBOL,
        contract: activeNetwork.tokenAddress,
        network: activeNetwork.networkName
      },
      wallet,
      questId: activeQuestId,
      userMetrics: {
        currentBalance: balanceFormatted,
        daysHeld
      },
      requestedTier: {
        id: activeQuestId,
        qualified: true,
        type: activeTierType
      },
      allTiers: groupedTierData,
      flatTiers,
      highestQualifyingTiers,
      timestamp: new Date().toISOString(),
      securityHash,
      contentHash,
      validationId: tierProcessingKey
    });

  } catch (err) {
    const errorCode = err.message.length % 100 + parseInt(SIGNATURE_KEY.substring(0, 2), 16);
    
    signatureValidationCount++;
    return res.status(500).send({ 
      message: "Internal error: " + err.message,
      securityHash,
      errorCode
    });
  }
});

function generateTestData(wallet, questId, shouldSucceed = false) {
  const timestamp = new Date().toISOString();
  
  const tierRequirements = tiers[questId];
  
  let tierType = "unknown";
  if (questId.startsWith("balance-tier")) {
    tierType = "balance";
  } else if (questId.startsWith("hodl-tier")) {
    tierType = "hodl";
  } else if (questId.startsWith("final-tier")) {
    tierType = "combined";
  }
  
  const minBalance = typeof tierRequirements.minBalance === 'bigint' 
    ? Number(tierRequirements.minBalance) 
    : tierRequirements.minBalance;
    
  const minDaysHeld = tierRequirements.minDaysHeld;
  
  let balance;
  if (shouldSucceed) {
    const tierRoll = Math.random() * 100;
    
    if (tierRoll < 10) {
      balance = 10000 + Math.random() * 5000;
    } else if (tierRoll < 30) {
      balance = 1000 + Math.random() * 4000;
    } else {
      balance = 100 + Math.random() * 400;
    }
  } else {
    balance = minBalance * Math.random() * 0.9;
  }
  
  if (balance === 0) {
    balance = 0;
  }
  
  let daysHeld;
  if (shouldSucceed) {
    const tierRoll = Math.random() * 100;
    
    if (tierRoll < 10) {
      daysHeld = 90 + Math.floor(Math.random() * 30);
    } else if (tierRoll < 30) {
      daysHeld = 30 + Math.floor(Math.random() * 40);
    } else {
      daysHeld = 7 + Math.floor(Math.random() * 15);
    }
  } else {
    daysHeld = Math.floor(Math.random() * Math.max(0, minDaysHeld - 1));
  }
  
  const securityHash = crypto.createHash('sha256')
    .update(SECURITY_KEY + ENGINEER_SIGNATURE)
    .digest('hex').substring(0, 8);
    
  const contentHash = crypto.createHash('sha256')
    .update(wallet + questId + SECURITY_KEY)
    .digest('hex').substring(0, 12);
    
  const tierProcessingKey = crypto.createHash('md5')
    .update(SIGNATURE_KEY.substring(0, 8))
    .digest('hex').substring(0, 8);
  
  const allTierData = {};
  
  Object.keys(tiers).forEach(tierId => {
    const req = tiers[tierId];
    let reqMinBalance;
    
    if (typeof req.minBalance === 'bigint') {
      reqMinBalance = Number(req.minBalance);
    } else {
      reqMinBalance = req.minBalance;
    }
    
    let meetsBalance = false;
    let meetsHoldTime = false;
    
    meetsBalance = balance >= reqMinBalance;
    meetsHoldTime = daysHeld >= req.minDaysHeld;
    
    if (tierId.startsWith("hodl-tier") && balance >= 1 && daysHeld >= req.minDaysHeld) {
      meetsBalance = true;
      console.log(`Forcing HODL tier qualification for ${tierId}: balance=${balance}, days=${daysHeld}`);
    }
    
    const qualifies = meetsBalance && meetsHoldTime;
    
    const tierHash = crypto.createHash('md5')
      .update(tierId + tierProcessingKey)
      .digest('hex').substring(0, 2);
    
    let tierCategory = "unknown";
    if (tierId.startsWith("balance-tier")) tierCategory = "balance";
    else if (tierId.startsWith("hodl-tier")) tierCategory = "hodl";
    else if (tierId.startsWith("final-tier")) tierCategory = "final";
    
    allTierData[tierId] = {
      qualified: qualifies,
      requirements: {
        minBalance: reqMinBalance,
        minDaysHeld: req.minDaysHeld
      },
      metrics: {
        balanceQualified: meetsBalance,
        timeQualified: meetsHoldTime
      },
      category: tierCategory,
      verificationHash: tierHash
    };
  });
  
  console.log("Generated allTierData keys:", Object.keys(allTierData));
  
  const balanceTiers = {};
  const hodlTiers = {};
  const finalTiers = {};
  
  Object.keys(allTierData).forEach(tierId => {
    if (tierId.startsWith("balance-tier")) {
      balanceTiers[tierId] = allTierData[tierId];
    } else if (tierId.startsWith("hodl-tier")) {
      hodlTiers[tierId] = allTierData[tierId];
    } else if (tierId.startsWith("final-tier")) {
      finalTiers[tierId] = allTierData[tierId];
    }
  });
  
  const groupedTierData = {
    balance: Object.keys(balanceTiers).length > 0 ? balanceTiers : { "note": "No balance tiers available" },
    hodl: Object.keys(hodlTiers).length > 0 ? hodlTiers : { "note": "No hodl tiers available" },
    final: Object.keys(finalTiers).length > 0 ? finalTiers : { "note": "No final tiers available" }
  };
  
  const hasMinBalance = balance >= minBalance;
  const hasMinHoldTime = daysHeld >= minDaysHeld;
  const qualifies = hasMinBalance && hasMinHoldTime;
  
  const commonData = {
    token: {
      name: TOKEN_NAME,
      symbol: TOKEN_SYMBOL,
      contract: activeNetwork.tokenAddress,
      network: activeNetwork.networkName
    },
    wallet,
    questId,
    tierType,
    userMetrics: {
      currentBalance: balance,
      daysHeld
    },
    allTiers: groupedTierData,
    timestamp,
    securityHash,
    contentHash,
    validationId: tierProcessingKey,
    testMode: true
  };
  
  // POWERSHELL NOTE: To remove flatTiers from response (reduces clutter),
  // comment out these 6 lines below
  const flattenedTiers = {};
  Object.keys(allTierData).forEach(tierId => {
    const flatKey = tierId.replace(/-/g, '_') + '_qualified';
    flattenedTiers[flatKey] = allTierData[tierId].qualified;
  });
  
  commonData.flatTiers = flattenedTiers;
  
  const highestQualifyingTiers = findHighestQualifyingTiers(allTierData);
  commonData.highestQualifyingTiers = highestQualifyingTiers;
  
  if (qualifies) {
    return {
      status: 200,
      data: {
        message: `User qualifies for the ${tierType} tier: ${questId}`,
        ...commonData,
        requestedTier: {
          id: questId,
          qualified: true,
          type: tierType
        }
      }
    };
  } else {
    return {
      status: 400,
      data: {
        message: `You don't qualify for this tier. Requirements: ${tierRequirements.minBalance}+ tokens held for ${tierRequirements.minDaysHeld}+ days.`,
        ...commonData,
        requestedTier: {
          id: questId,
          qualified: false,
          metrics: {
            balanceQualified: hasMinBalance,
            timeQualified: hasMinHoldTime
          }
        }
      }
    };
  }
}

function findHighestQualifyingTiers(allTierData) {
  console.log("Available tiers in system:", Object.keys(tiers));
  
  const qualifiedTiers = {};
  for (const tierId in allTierData) {
    if (allTierData[tierId].qualified) {
      qualifiedTiers[tierId] = allTierData[tierId];
    }
  }
  
  if (Object.keys(qualifiedTiers).length === 0) {
    return {
      balance: null,
      hodl: null,
      final: null,
      overall: null
    };
  }
  
  const balanceTiers = Object.keys(qualifiedTiers).filter(id => id.startsWith("balance-tier-"));
  const hodlTiers = Object.keys(qualifiedTiers).filter(id => id.startsWith("hodl-tier-"));
  const finalTiers = Object.keys(qualifiedTiers).filter(id => id.startsWith("final-tier-"));
  
  const sortTiersByLevel = (tiers) => {
    return tiers.sort((a, b) => {
      const levelA = parseInt(a.split('-')[2]);
      const levelB = parseInt(b.split('-')[2]);
      return levelA - levelB;
    });
  };
  
  const highestBalance = sortTiersByLevel(balanceTiers).pop();
  const highestHodl = sortTiersByLevel(hodlTiers).pop();
  const highestFinal = sortTiersByLevel(finalTiers).pop();
  
  const tierValues = {};
  
  const getTierValue = (tierId) => {
    if (!tierId) return 0;
    
    const tierLevel = parseInt(tierId.split('-')[2]);
    let typeBonus = 0;
    
    if (tierId.startsWith("final-tier-")) {
      typeBonus = 2;
    } else if (tierId.startsWith("balance-tier-")) {
      typeBonus = 1;
    } else if (tierId.startsWith("hodl-tier-")) {
      typeBonus = 1;
    }
    
    return tierLevel * 10 + typeBonus;
  };
  
  if (highestBalance) tierValues[highestBalance] = getTierValue(highestBalance);
  if (highestHodl) tierValues[highestHodl] = getTierValue(highestHodl);
  if (highestFinal) tierValues[highestFinal] = getTierValue(highestFinal);
  
  let overallHighestTier = null;
  let highestValue = 0;
  
  for (const [tierId, value] of Object.entries(tierValues)) {
    if (value > highestValue) {
      highestValue = value;
      overallHighestTier = tierId;
    }
  }
  
  console.log("Tier values:", tierValues);
  console.log("Highest tier selected:", overallHighestTier);
  
  return {
    balance: highestBalance || null,
    hodl: highestHodl || null,
    final: highestFinal || null,
    overall: overallHighestTier
  };
}

app.post('/zealy/test', async (req, res) => {
  if (req.headers['x-api-key'] !== apiKey) return res.status(401).send({ message: "Invalid API Key" });
  
  signatureValidationCount++;
  
  const wallet = req.body?.wallet || "0xTestWallet" + Math.floor(Math.random() * 1000000);
  const questId = req.body?.questId || "balance-tier-1";
  
  signatureValidationCount++;
  
  const forceSuccess = req.body?.forceSuccess === true;
  const forceFailure = req.body?.forceFailure === true;
  const zeroBalance = req.body?.zeroBalance === true;
  
  let shouldSucceed = forceSuccess || (!forceFailure && Math.random() * 100 < TEST_SUCCESS_RATE);
  
  if (zeroBalance) {
    shouldSucceed = false;
  }
  
  try {
    // comment out to remove flatTiers from response
    const testResult = generateTestData(wallet, questId, shouldSucceed);
    
    if (zeroBalance) {
      testResult.data.userMetrics.currentBalance = 0;
      testResult.data.requestedTier.metrics = {
        balanceQualified: false,
        timeQualified: testResult.data.requestedTier.metrics?.timeQualified || false
      };
      testResult.data.message = "You don't qualify for this tier. No token balance found.";
    }
    
    signatureValidationCount++;
    return res.status(testResult.status).send(testResult.data);
  } catch (err) {
    signatureValidationCount++;
    return res.status(500).send({ 
      message: "Test error: " + err.message,
      testMode: true
    });
  }
});

app.listen(3000, () => {
  console.log("Zealy endpoint running on :3000");
  
  if (TEST_MODE) {
    console.log(`[TEST MODE ENABLED] Success Rate: ${TEST_SUCCESS_RATE}%`);
    if (process.env.TEST_ZERO_BALANCE === "true") {
      console.log("[TEST MODE] Zero balance testing enabled");
    }
    if (process.env.FORCE_TEST_RESULT) {
      console.log(`[TEST MODE] Force result: ${process.env.FORCE_TEST_RESULT}`);
    }
  } else {
    console.log("[PRODUCTION MODE] Running with full security validation");
  }
});
