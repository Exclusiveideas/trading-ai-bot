import type { BrokerPosition, ExecutionResult } from "./types";

function getMetaApiToken(): string {
  const token = process.env.METAAPI_TOKEN;
  if (!token) throw new Error("Missing METAAPI_TOKEN in .env");
  return token;
}

function getMetaApiAccountId(): string {
  const id = process.env.METAAPI_ACCOUNT_ID;
  if (!id) throw new Error("Missing METAAPI_ACCOUNT_ID in .env");
  return id;
}

type MetaApiConnection = {
  account: unknown;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  connection: any;
};

let connectionPromise: Promise<MetaApiConnection> | null = null;

async function connectAccount(): Promise<MetaApiConnection> {
  const MetaApi = (await import("metaapi.cloud-sdk")).default;
  const api = new MetaApi(getMetaApiToken());
  const account = await api.metatraderAccountApi.getAccount(
    getMetaApiAccountId(),
  );
  await account.waitConnected();
  const connection = account.getRPCConnection();
  await connection.connect();
  await connection.waitSynchronized();
  return { account, connection };
}

export async function getConnection(): Promise<MetaApiConnection> {
  if (!connectionPromise) {
    connectionPromise = connectAccount();
  }
  return connectionPromise;
}

export function resetConnection(): void {
  connectionPromise = null;
}

export async function getAccountInfo(): Promise<{
  equity: number;
  balance: number;
  margin: number;
  freeMargin: number;
  currency: string;
}> {
  const { connection } = await getConnection();
  return connection.getAccountInformation();
}

export async function getOpenPositions(): Promise<BrokerPosition[]> {
  const { connection } = await getConnection();
  const positions = await connection.getPositions();
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  return positions.map((p: any) => ({
    id: String(p.id),
    symbol: p.symbol,
    type: p.type === "POSITION_TYPE_BUY" ? ("buy" as const) : ("sell" as const),
    volume: p.volume,
    openPrice: p.openPrice,
    stopLoss: p.stopLoss ?? null,
    takeProfit: p.takeProfit ?? null,
    profit: p.profit,
    swap: p.swap ?? 0,
    commission: p.commission ?? 0,
  }));
}

export async function placeMarketOrder(
  symbol: string,
  direction: "buy" | "sell",
  volume: number,
  stopLoss: number,
  takeProfit: number,
): Promise<ExecutionResult> {
  try {
    const { connection } = await getConnection();
    const metaSymbol = symbol.replace("/", "");

    const result =
      direction === "buy"
        ? await connection.createMarketBuyOrder(
            metaSymbol,
            volume,
            stopLoss,
            takeProfit,
          )
        : await connection.createMarketSellOrder(
            metaSymbol,
            volume,
            stopLoss,
            takeProfit,
          );

    return {
      success: true,
      orderId: result.orderId ?? result.positionId ?? null,
      error: null,
    };
  } catch (err) {
    return {
      success: false,
      orderId: null,
      error: err instanceof Error ? err.message : String(err),
    };
  }
}

export async function closePosition(
  positionId: string,
): Promise<ExecutionResult> {
  try {
    const { connection } = await getConnection();
    await connection.closePosition(positionId);
    return { success: true, orderId: positionId, error: null };
  } catch (err) {
    return {
      success: false,
      orderId: positionId,
      error: err instanceof Error ? err.message : String(err),
    };
  }
}

export async function closeAllPositions(): Promise<{
  closed: number;
  errors: string[];
}> {
  const positions = await getOpenPositions();
  let closed = 0;
  const errors: string[] = [];

  for (const pos of positions) {
    const result = await closePosition(pos.id);
    if (result.success) {
      closed++;
    } else {
      errors.push(`${pos.symbol} ${pos.id}: ${result.error}`);
    }
  }

  return { closed, errors };
}
