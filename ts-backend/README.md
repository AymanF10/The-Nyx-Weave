# Price Quote Scheduler

A TypeScript Node.js application that schedules price quotes for Meteora AMM pools using configurable cron expressions.

## Features

- **Configurable Scheduling**: Uses cron expressions to schedule price quote execution
- **Multiple Pool Support**: Monitors multiple pools simultaneously
- **Structured Logging**: Comprehensive logging with Winston
- **Error Handling**: Robust error handling and graceful shutdown
- **Configuration Management**: JSON-based configuration with validation
- **CLI Commands**: Multiple execution modes (start, once, status)

## Prerequisites

- Node.js 18+ 
- npm or yarn

## Installation

1. Navigate to the ts-backend directory:
```bash
cd ts-backend
```

2. Install dependencies:
```bash
npm install
```

3. Build the project:
```bash
npm run build
```

## Configuration

The application uses a JSON configuration file located at `config/pools.json`. Here's an example:

```json
{
  "pools": [
    {
      "name": "SOL-USDC",
      "address": "5BKxfWMbmYBAEWvyPZS9esPducUba9GqyMjtLCfbaqyF",
      "swapAmount": 5000000,
      "swapYtoX": true,
      "isPartialFill": false,
      "maxExtraBinArrays": 3,
      "decimals": 6
    }
  ],
  "scheduler": {
    "cronExpression": "*/30 * * * * *",
    "description": "Every 30 seconds"
  },
  "rpc": {
    "endpoint": "https://api.mainnet-beta.solana.com",
    "commitment": "finalized"
  }
}
```

### Configuration Options

#### Pool Configuration
- `name`: Human-readable name for the pool
- `address`: Solana public key of the pool
- `swapAmount`: Amount to use for price quote calculation (in smallest units)
- `swapYtoX`: Direction of the swap (true = Y to X, false = X to Y)
- `isPartialFill`: Whether to allow partial fills
- `maxExtraBinArrays`: Maximum number of extra bin arrays to use
- `decimals`: Number of decimal places for the token

#### Scheduler Configuration
- `cronExpression`: Cron expression for scheduling (e.g., "*/30 * * * * *" for every 30 seconds)
- `description`: Human-readable description of the schedule

#### RPC Configuration
- `endpoint`: Solana RPC endpoint
- `commitment`: Commitment level for RPC calls

## Usage

### Development Mode
```bash
npm run dev [command]
```

### Production Mode
```bash
npm start [command]
```

### Available Commands

1. **Start Scheduler** (default):
```bash
npm run dev start
# or simply
npm run dev
```

2. **Execute Once**:
```bash
npm run dev once
```

3. **Check Status**:
```bash
npm run dev status
```

## Cron Expression Examples

- `*/30 * * * * *` - Every 30 seconds
- `0 */1 * * * *` - Every minute
- `0 */5 * * * *` - Every 5 minutes
- `0 0 */1 * * *` - Every hour
- `0 0 0 */1 * *` - Every day at midnight

## Logging

The application logs to:
- Console (with colors)
- `logs/combined.log` (all logs)
- `logs/error.log` (error logs only)

## Important Notes

### DLMM Integration

The current implementation includes a mock DLMM class. To use with the actual Meteora AMM:

1. Replace the mock DLMM class in `src/services/price-quote.service.ts`
2. Import the actual DLMM library
3. Update the method calls to match the actual API

Example replacement:
```typescript
// Replace the mock DLMM class with:
import { DLMM } from "meteora-dlmm-sdk"; // or your actual import
```

### Error Handling

The application includes comprehensive error handling:
- Individual pool failures don't stop the entire process
- Failed quotes are logged with error details
- Graceful shutdown on SIGTERM/SIGINT
- Uncaught exception handling

### Performance Considerations

- Price quotes are executed in parallel for all pools
- Each quote has a timeout to prevent hanging
- Failed quotes are logged but don't affect other pools
- Consider RPC rate limits when setting cron intervals

## Development

### Project Structure
```
ts-backend/
├── src/
│   ├── config/
│   │   └── config-loader.ts
│   ├── services/
│   │   ├── price-quote.service.ts
│   │   └── scheduler.service.ts
│   ├── types/
│   │   └── index.ts
│   ├── utils/
│   │   └── logger.ts
│   └── index.ts
├── config/
│   └── pools.json
├── logs/
├── package.json
├── tsconfig.json
└── README.md
```

### Adding New Pools

1. Edit `config/pools.json`
2. Add new pool configuration
3. Restart the scheduler

### Customizing Scheduler

1. Modify the cron expression in `config/pools.json`
2. Update the description field
3. Restart the scheduler

## Troubleshooting

### Common Issues

1. **Configuration not found**: Ensure `config/pools.json` exists and is valid JSON
2. **RPC connection issues**: Check your RPC endpoint and network connectivity
3. **Pool address errors**: Verify pool addresses are valid Solana public keys
4. **Cron expression errors**: Use a cron expression validator to check syntax

### Debug Mode

To enable debug logging, modify the logger level in `src/utils/logger.ts`:
```typescript
level: 'debug', // Change from 'info' to 'debug'
```

## License

MIT License 