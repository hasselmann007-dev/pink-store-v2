import 'dotenv/config';
import express from 'express';
import cors from 'cors';
import fetch from 'node-fetch';

const app = express();


// ---------------------------------------------------------------------
// Middlewares básicos
// ---------------------------------------------------------------------
app.use(cors());
app.use(express.json());

// ---------------------------------------------------------------------
// Configurações GhostsPay
// ---------------------------------------------------------------------
const PORT = process.env.PORT || 4000;

const GHOSTS_SECRET_KEY = process.env.GHOSTS_SECRET_KEY;
const GHOSTS_COMPANY_ID = process.env.GHOSTS_COMPANY_ID;
const GHOSTS_POSTBACK_URL =
  process.env.GHOSTS_POSTBACK_URL ||
  'http://localhost:4000/api/ghostspay/webhook';

const GHOSTS_BASE_URL =
  process.env.GHOSTS_BASE_URL || 'https://api.ghostspaysv2.com/functions/v1';

// Verificação simples das credenciais
if (!GHOSTS_SECRET_KEY || !GHOSTS_COMPANY_ID) {
  console.warn(
    '⚠️ Atenção: GHOSTS_SECRET_KEY ou GHOSTS_COMPANY_ID não configurados no .env.'
  );
} else {
  console.log('✅ Credenciais GhostsPay carregadas do .env');
}

// ---------------------------------------------------------------------
// Helper para header de autenticação na GhostsPay
// ---------------------------------------------------------------------
function getAuthHeaders() {
  return {
    Authorization: `Bearer ${GHOSTS_SECRET_KEY}`,
    'Content-Type': 'application/json',
    'x-company-id': GHOSTS_COMPANY_ID,
  };
}

// ---------------------------------------------------------------------
// Store em memória para status de pagamentos (id -> info)
// ---------------------------------------------------------------------
const paymentStore = new Map();

// ---------------------------------------------------------------------
// Função utilitária para montar payload GhostsPay
// ---------------------------------------------------------------------
function buildGhostsPayPayload({
  amountInCents,
  customer,
  cart,
  shipping,
  paymentMethod,
  bumpAdded,
}) {
  const items = (cart || []).map((item) => ({
    title: item.name,
    unitPrice: Math.round(item.price * 100),
    quantity: item.qty || 1,
    externalRef: item.productId || item.id,
  }));

  return {
    amount: amountInCents,
    description: 'Compra na Pink Store',
    paymentMethod, // "PIX" (ou "CREDIT_CARD" se futuramente voltar)
    installments: 1,
    postbackUrl: GHOSTS_POSTBACK_URL,
    companyId: GHOSTS_COMPANY_ID,
    customer: {
      name: customer?.name || 'Cliente',
      email: customer?.email || 'cliente@email.com',
    },
    items,
    shipping: shipping
      ? {
          zipCode: shipping.zipCode,
          street: shipping.street,
          neighborhood: shipping.neighborhood || '',
          city: shipping.city,
          state: shipping.state || '',
          number: shipping.number,
          complement: shipping.complement || '',
        }
      : undefined,
    metadata: {
      bumpAdded: !!bumpAdded,
      source: 'pink-store-frontend',
    },
  };
}

// ---------------------------------------------------------------------
// Rota principal de checkout
// ---------------------------------------------------------------------
// ---------------------------------------------------------------------
// ROTA DE CHECKOUT
// ---------------------------------------------------------------------
app.post("/api/checkout", async (req, res) => {
  try {
    const { cart, customer, shipping, paymentMethod, bumpAdded } = req.body;

    console.log("🛒 Payload recebido no /api/checkout:");
    console.log(JSON.stringify(req.body, null, 2));

    if (!cart || !Array.isArray(cart) || cart.length === 0) {
      return res.status(400).json({
        ok: false,
        error: "Carrinho vazio ou inválido",
      });
    }

// calcula total
    const subtotal = cart.reduce(
      (acc, item) => acc + (Number(item.price) * Number(item.qty || 1)),
      0
    );

    // mesma regra do frontend: FRETE GRÁTIS acima de 199,90
    const SHIPPING_THRESHOLD = 199.9;
    const BASE_SHIPPING = 14.9;

    const shippingValue =
      subtotal > SHIPPING_THRESHOLD ? 0 : BASE_SHIPPING;

    // mesmo valor do bump que você usa no frontend (ORDER_BUMP_ITEM.price)
    const ORDER_BUMP_PRICE = 9.9;
    const bumpValue = bumpAdded ? Number(ORDER_BUMP_PRICE) : 0;

    const total = subtotal + shippingValue + bumpValue;
    const amountInCents = Math.round(total * 100);

    console.log("🧾 Resumo do checkout:");
    console.log(`- Subtotal: ${subtotal}`);
    console.log(`- Frete: ${shippingValue}`);
    console.log(`- Bump: ${bumpValue}`);
    console.log(`- Total: ${total}`);
    console.log(`- amountInCents: ${amountInCents}`);

    // monta payload GhostsPay
    const ghostsPayload = {
      amount: amountInCents,
      description: "Compra na Pink Store",
      paymentMethod: "PIX",
      installments: 1,
      postbackUrl: GHOSTS_POSTBACK_URL,
      companyId: GHOSTS_COMPANY_ID,
      customer: {
        name: customer?.name || "Cliente",
        email: customer?.email || "cliente@email.com",
      },
      items: cart.map((item) => ({
        title: item.name,
        unitPrice: Math.round(Number(item.price) * 100),
        quantity: item.qty || 1,
        externalRef: item.productId || item.id,
      })),
      metadata: {
        bumpAdded: !!bumpAdded,
        source: "pink-store-frontend",
      },
    };

    console.log("➡️ Enviando para GhostsPay:", JSON.stringify(ghostsPayload, null, 2));

    const authToken = Buffer
      .from(`${GHOSTS_SECRET_KEY}:${GHOSTS_COMPANY_ID}`)
      .toString("base64");

    const response = await fetch(`${GHOSTS_BASE_URL}/transactions`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Basic ${authToken}`,
      },
      body: JSON.stringify(ghostsPayload),
    });

    const rawText = await response.text();
    let ghostData;

    try {
      ghostData = JSON.parse(rawText);
    } catch {
      console.error("GhostsPay retornou algo que não é JSON:", rawText);
      ghostData = { raw: rawText };
    }

    console.log(
      "⬅️ Resposta GhostsPay (status",
      response.status,
      "):",
      ghostData
    );

    if (!response.ok) {
      return res.status(response.status).json({
        ok: false,
        error:
          ghostData.message ||
          ghostData.error ||
          ghostData.raw ||
          "Falha ao criar pagamento na GhostsPay",
        gatewayStatus: response.status,
        gatewayResponse: ghostData,
      });
    }

return res.json({
  ok: true,
  payment: ghostData,
  gatewayStatus: response.status,

  // adiciona o valor real vindo do gateway
  pix: {
    qrcode: ghostData.pix?.qrcode || null,
    expirationDate: ghostData.pix?.expirationDate || null,
    amount: ghostData.amount || amountInCents   //  <<<<<<  🔥 ESTA LINHA É O QUE FALTAVA!
  },

  status: ghostData.status,
});

  } catch (err) {
    console.error("Erro no /api/checkout:", err);
    return res.status(500).json({
      ok: false,
      error: "Erro interno no servidor",
    });
  }
});


// ---------------------------------------------------------------------
// Webhook GhostsPay → atualiza status no paymentStore
// ---------------------------------------------------------------------
app.post('/api/ghostspay/webhook', express.json(), async (req, res) => {
  try {
    const event = req.body;
    console.log('📬 Webhook GhostsPay recebido:', event?.id, event?.status);

    if (!event || !event.id) {
      return res
        .status(400)
        .json({ ok: false, error: 'Webhook sem ID de pagamento' });
    }

    const existing = paymentStore.get(event.id) || {};

    paymentStore.set(event.id, {
      status: event.status || existing.status || 'unknown',
      amount: event.amount ?? existing.amount ?? 0,
      gatewayResponse: event,
    });

    return res.json({ ok: true });
  } catch (err) {
    console.error('Erro ao processar webhook GhostsPay:', err);
    return res.status(500).json({ ok: false });
  }
});

// ---------------------------------------------------------------------
// Endpoint para o frontend consultar o status do pagamento
// ---------------------------------------------------------------------
app.get('/api/payment-status/:id', (req, res) => {
  const { id } = req.params;

  if (!id) {
    return res.status(400).json({ ok: false, error: 'ID não informado' });
  }

  const info = paymentStore.get(id);

  if (!info) {
    return res
      .status(404)
      .json({ ok: false, error: 'Pagamento não encontrado' });
  }

  return res.json({
    ok: true,
    id,
    status: info.status,
    amount: info.amount,
    gatewayResponse: info.gatewayResponse,
  });
});

// ---------------------------------------------------------------------
// Healthcheck simples pra testar se backend está no ar
// ---------------------------------------------------------------------
app.get('/api/health', (req, res) => {
  res.json({ ok: true, message: 'Backend de pagamentos online ✅' });
});

// ---------------------------------------------------------------------
// Inicialização do servidor
// ---------------------------------------------------------------------
app.listen(PORT, () => {
  console.log(`🚀 Backend rodando em http://localhost:${PORT}`);
});
