const express = require('express');
const cors = require('cors');
const ccxt = require('ccxt');

const app = express();
app.use(cors());
app.use(express.json());

const PORT = 5000;

// --- CONFIGURACIÓN: Rate Limit Automático ---
const exchangeOptions = {
    enableRateLimit: true, // ccxt gestiona las esperas automáticamente
    options: { defaultType: 'spot' },
    timeout: 20000 // 20 segundos máximo por exchange (más tolerancia)
};

const exchanges = {
    binance: new ccxt.binance(exchangeOptions),
    kraken: new ccxt.kraken(exchangeOptions),
    bybit: new ccxt.bybit(exchangeOptions),
    kucoin: new ccxt.kucoin(exchangeOptions),
    bitget: new ccxt.bitget(exchangeOptions),
};

const PAIRS = [
    'BTC/USDT', 'ETH/USDT', 'BNB/USDT', 'SOL/USDT', 'XRP/USDT', 
    'ADA/USDT', 'DOGE/USDT', 'DOT/USDT', 'LTC/USDT', 'MATIC/USDT',
    // Pares cruzados necesarios para Triangular
    'ETH/BTC', 'BNB/BTC', 'SOL/BTC', 'XRP/BTC', 'ADA/BTC' 
];

// Función para pausar (Evitar ban de IP)
const sleep = (ms) => new Promise(resolve => setTimeout(resolve, ms));

async function fetchPricePrecise(exchangeName, symbol) {
    try {
        const exchange = exchanges[exchangeName];
        // Pedimos OrderBook (Libro de órdenes) las primeras 5 filas
        const orderbook = await exchange.fetchOrderBook(symbol, 5);

        if (!orderbook.bids.length || !orderbook.asks.length) return null;

        return {
            exchange: exchangeName,
            symbol: symbol,
            ask: orderbook.asks[0][0], // Mejor precio venta real
            bid: orderbook.bids[0][0], // Mejor precio compra real
        };
    } catch (error) {
        let msg = error.message;
        if (msg.includes('429')) msg = "RATE LIMIT (Demasiadas peticiones)";
        if (msg.includes('timeout')) msg = "TIMEOUT (Tardó mucho)";
        console.warn(`⚠️ ${exchangeName} [${symbol}]: ${msg}`);
        return null;
    }
}

app.get('/api/opportunities', async (req, res) => {
    const startTime = Date.now();
    console.log(`[${new Date().toLocaleTimeString()}] 🚀 Iniciando Escaneo Inteligente (Lotes)...`);
    
    let allTickers = [];
    let opportunities = [];

    // --- 1. PROCESAMIENTO POR LOTES (BATCHING) ---
    // Procesamos de a 3 pares a la vez para no saturar
    const BATCH_SIZE = 3; 
    
    for (let i = 0; i < PAIRS.length; i += BATCH_SIZE) {
        const batch = PAIRS.slice(i, i + BATCH_SIZE);
        // console.log(`   Procesando lote: ${batch.join(', ')}`);

        const promises = [];
        for (const pair of batch) {
            Object.keys(exchanges).forEach(name => {
                promises.push(fetchPricePrecise(name, pair));
            });
        }

        const results = await Promise.all(promises);
        const validResults = results.filter(r => r !== null);
        allTickers.push(...validResults);

        // Pausa de seguridad de 500ms entre lotes
        await sleep(500); 
    }

    // --- 2. LÓGICA ESPACIAL (Arbitraje Clásico) ---
    const usdtTickers = allTickers.filter(t => t.symbol.endsWith('/USDT'));

    for (let i = 0; i < usdtTickers.length; i++) {
        for (let j = 0; j < usdtTickers.length; j++) {
            const buyT = usdtTickers[i];
            const sellT = usdtTickers[j];

            if (buyT.symbol === sellT.symbol && buyT.exchange !== sellT.exchange) {
                const spread = ((sellT.bid - buyT.ask) / buyT.ask) * 100;
                if (spread > -1.0 && spread < 50) { 
                    opportunities.push({
                        id: `ESP-${buyT.symbol}-${buyT.exchange}-${sellT.exchange}-${uuid()}`,
                        pair: buyT.symbol,
                        exchangeBuy: capitalize(buyT.exchange),
                        exchangeSell: capitalize(sellT.exchange),
                        buyPrice: buyT.ask,
                        sellPrice: sellT.bid,
                        spread: spread.toFixed(2),
                        type: 'Espacial',
                        isP2P: false
                    });
                }
            }
        }
    }

    // --- 3. LÓGICA TRIANGULAR (Mismo Exchange) ---
    // Ruta: USDT -> BTC -> ALTCOIN -> USDT
    Object.keys(exchanges).forEach(exchangeName => {
        const exTickers = allTickers.filter(t => t.exchange === exchangeName);
        const btcUsdt = exTickers.find(t => t.symbol === 'BTC/USDT');

        if (btcUsdt) {
            const crossPairs = exTickers.filter(t => t.symbol.endsWith('/BTC'));
            crossPairs.forEach(crossTicker => {
                const altCoin = crossTicker.symbol.split('/')[0];
                const altUsdt = exTickers.find(t => t.symbol === `${altCoin}/USDT`);

                if (altUsdt) {
                    let start = 100;
                    // Paso 1: Comprar BTC con USDT (Precio Ask)
                    let s1_BTC = start / btcUsdt.ask;
                    // Paso 2: Comprar ALT con BTC (Precio Ask)
                    let s2_ALT = s1_BTC / crossTicker.ask;
                    // Paso 3: Vender ALT por USDT (Precio Bid)
                    let final_USD = s2_ALT * altUsdt.bid;

                    let spread = ((final_USD - start) / start) * 100;

                    if (spread > -1.0 && spread < 50) {
                        opportunities.push({
                            id: `TRI-${exchangeName}-${altCoin}-${uuid()}`,
                            pair: `BTC -> ${altCoin}`, // Nombre corto
                            exchangeBuy: capitalize(exchangeName),
                            exchangeSell: capitalize(exchangeName),
                            // Para referencia visual en la tabla:
                            buyPrice: btcUsdt.ask, 
                            sellPrice: altUsdt.bid,
                            spread: spread.toFixed(2),
                            type: 'Triangular',
                            isP2P: false
                        });
                    }
                }
            });
        }
    });

    opportunities.sort((a, b) => parseFloat(b.spread) - parseFloat(a.spread));
    
    const duration = ((Date.now() - startTime) / 1000).toFixed(1);
    console.log(`✅ Finalizado en ${duration}s. Oportunidades: ${opportunities.length}`);

    res.json({ opportunities, tickers: allTickers });
});

function uuid() { return Math.random().toString(36).substring(2) + Date.now().toString(36); }
const capitalize = (s) => s ? s.charAt(0).toUpperCase() + s.slice(1) : '';

app.listen(PORT, () => {
    console.log(`🚀 Servidor Bito Pro v3.0 (Precision+Lotes) corriendo en puerto ${PORT}`);
});