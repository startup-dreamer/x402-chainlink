# x402 Express Backend Example

This is a standalone Express.js backend example that uses the **published `x402-chainlink` library from npm** (not the local source).

## Features

- ✅ Uses published `x402-chainlink@1.0.0` from npmjs.com
- ✅ Independent npm package with its own dependencies
- ✅ Express.js server with x402 payment protection
- ✅ Multiple payment endpoints (USDC and LINK)
- ✅ Server-Sent Events (SSE) for settlement status
- ✅ CORS enabled for frontend integration

## Setup

1. Install dependencies:
```bash
npm install
```

2. Configure environment variables:
Create a `.env.local` file or copy from the example:
```bash
RECEIVER_ADDRESS=0x68A2610fE5221D496A987106E1735A84f324c27e
FACILITATOR_ADDRESS=0xea52C55099A65542a785280A9D47CC5A769DE7AB
EXPRESS_PORT=3001
CRE_BROADCAST=true
WORKFLOW_PATH=../../x402-workflow
CRE_TARGET=staging-settings
```

## Running

Start the development server:
```bash
npm run dev
```

The server will start on http://localhost:3001

## Endpoints

- `GET /` - API info (free)
- `GET /api/free` - Free endpoint
- `GET /api/weather` - Weather data (0.001 USDC) — x402 protected
- `GET /api/weather/settlement` - SSE stream for settlement status
- `GET /api/premium` - Premium content (0.01 USDC) — x402 protected
- `GET /api/expensive` - Expensive content (0.001 LINK) — x402 protected

## Testing

Run the test script to verify all endpoints:
```bash
./test.sh
```

Or test individual endpoints manually:

**Free endpoint:**
```bash
curl http://localhost:3001/api/free
```

**Protected endpoint (returns 402 Payment Required):**
```bash
curl -i http://localhost:3001/api/weather
```

For paid endpoints, you'll need to provide proper payment headers as specified by the x402 protocol.

## Verification

The backend is using the published `x402-chainlink@1.0.0` package from npm:
```bash
npm list x402-chainlink
```

Output:
```
x402-express-backend@1.0.0
└── x402-chainlink@1.0.0
```

## Project Structure

```
backend/
├── server.ts          # Main Express server
├── package.json       # Dependencies (uses published x402-chainlink)
├── tsconfig.json      # TypeScript configuration
├── .env.local         # Environment variables (not committed)
├── .gitignore         # Git ignore rules
├── test.sh            # Test script
└── README.md          # This file
```
