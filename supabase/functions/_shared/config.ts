// Vulture Vision — global configuration.
// Single source of truth for endpoints, instruments, risk params, cadences.
// Secrets are read from Deno.env at call time (not captured at import).

export const TRADING_MODE: "paper" | "live" = "paper";

export const ENDPOINTS = {
  paper: {
    binance_rest: "https://testnet.binance.vision",
    binance_ws: "wss://testnet.binance.vision/ws",
    bybit_rest: "https://api-testnet.bybit.com",
    bybit_ws: "wss://stream-testnet.bybit.com",
    dydx_rest: "https://indexer.dydx.trade/testnet",
    oanda_rest: "https://api-fxpractice.oanda.com/v3",
    oanda_stream: "https://stream-fxpractice.oanda.com/v3",
    alpaca_rest: "https://paper-api.alpaca.markets",
    alpaca_ws: "wss://stream.data.alpaca.markets/v2/iex",
    ethereum_rpc: () => `https://sepolia.infura.io/v3/${env("INFURA_KEY")}`,
    etherscan_rest: "https://api-sepolia.etherscan.io/api",
  },
} as const;

export const ACTIVE = ENDPOINTS[TRADING_MODE];

// ── secret accessor ─────────────────────────────────────────
export function env(k: string, fallback = ""): string {
  return Deno.env.get(k) ?? fallback;
}
export const Secrets = {
  get BINANCE_KEY()    { return env("BINANCE_TESTNET_KEY"); },
  get BINANCE_SECRET() { return env("BINANCE_TESTNET_SECRET"); },
  get BYBIT_KEY()      { return env("BYBIT_TESTNET_KEY"); },
  get BYBIT_SECRET()   { return env("BYBIT_TESTNET_SECRET"); },
  get OANDA_TOKEN()    { return env("OANDA_PRACTICE_TOKEN"); },
  get OANDA_ACCOUNT()  { return env("OANDA_ACCOUNT_ID"); },
  get ALPACA_KEY()     { return env("ALPACA_PAPER_KEY"); },
  get ALPACA_SECRET()  { return env("ALPACA_PAPER_SECRET"); },
  get INFURA_KEY()     { return env("INFURA_KEY"); },
  get ANTHROPIC_KEY()  { return env("ANTHROPIC_API_KEY"); },
  get POLYGON_KEY()    { return env("POLYGON_KEY"); },
  get NEWS_API_KEY()   { return env("NEWS_API_KEY"); },
  get ETHERSCAN_KEY()  { return env("ETHERSCAN_API_KEY"); },
  get BLUEQUBIT_KEY()  { return env("BLUEQUBIT_KEY"); },
};

// ── instruments ─────────────────────────────────────────────
export const CRYPTO_INSTRUMENTS = [
  "BTCUSDT","ETHUSDT","SOLUSDT","BNBUSDT","ADAUSDT",
  "DOTUSDT","AVAXUSDT","MATICUSDT","LINKUSDT","UNIUSDT",
];
export const FOREX_INSTRUMENTS = ["EUR_USD","GBP_USD","USD_JPY","AUD_USD"];
export const EQUITY_INSTRUMENTS = ["SPY","QQQ","HYG","TLT","GLD"];
export const ALL_INSTRUMENTS = [...CRYPTO_INSTRUMENTS, ...FOREX_INSTRUMENTS, ...EQUITY_INSTRUMENTS];

// ── risk parameters ─────────────────────────────────────────
export const RISK = {
  MAX_POSITION_SIZE_USD: 100.0,
  MAX_PORTFOLIO_EXPOSURE: 0.90,
  MAX_DRAWDOWN_THRESHOLD: 0.15,
  MIN_COHERENCE_TO_TRADE: 0.30,
  STOP_LOSS_MULTIPLIER: 1.5,
  TAKE_PROFIT_MULTIPLE: 2.0,
  MIN_ORDER_USD: 5.0,
};

export const PAPER_GATE = {
  min_win_rate: 0.55,
  min_sharpe: 1.5,
  max_drawdown: 0.15,
  min_weeks_clean: 3,
  min_trades: 30,
};

// ── quantum (analytic-only in edge runtime) ─────────────────
export const QUANTUM_BACKENDS = {
  primary: "analytic_born_rule",
  secondary: "analytic_born_rule",
  tertiary: "analytic_born_rule",
  cloud: "bluequbit",
};
export const N_QUBITS = 10;

// ── loop cadences (seconds) — used by pg_cron schedules ─────
export const INTERVALS = {
  TRADING_LOOP: 10,
  CORRELATION: 60,
  FEATURE: 5,
  AMPLITUDE: 30,
  QAOA: 60,
  QAE: 60,
  LSTM_CRYPTO: 1,
  LSTM_SLOW: 60,
  HEGELIAN: 900,
  MIROFISH: 300,
  HAMILTONIAN_UPDATE: 86400,
  ONCHAIN: 30,
  NEWS: 60,
  PORTFOLIO_SYNC: 30,
  SYNTHESIS: 900,
};

// ── warm_state keys for synthesis/trades/kill-switch ────────
export const StateKeys = {
  TRADE_HISTORY: "trade_history",
  SYNTHESIS_HISTORY: "synthesis_history",
  KILL_SWITCH_LOG: "kill_switch_alerts",
  KILL_SWITCH_ACTIVE: "kill_switch_active",
};
