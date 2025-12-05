// api/checkout.js
//
// Endpoint responsável por criar o pagamento (ex: PIX) via GhostsPay.
// É chamado pelo frontend em: fetch('/api/checkout', { method: 'POST', ... })

export default async function handler(req, res) {
  // Só aceita POST
  if (req.method !== 'POST') {
    return res.status(405).json({ ok: false, error: 'Method not allowed' });
  }

  try {
    // Em Vercel, req.body geralmente já vem como objeto,
    // mas vamos garantir que, se vier como string ou buffer, a gente faz o parse.
    let body = req.body;

    if (!body || typeof body !== 'object') {
      const chunks = [];
      for await (const chunk of req) {
        chunks.push(chunk);
      }

      const rawBody = Buffer.concat(chunks).toString('utf8');

      try {
        body = JSON.parse(rawBody);
      } catch (parseErr) {
        console.error('❌ Erro ao fazer parse do JSON em /api/checkout:', parseErr);
        return res.status(400).json({ ok: false, error: 'JSON inválido no corpo da requisição' });
      }
    }

    const { cart, customer, paymentMethod, bumpAdded } = body;

    // 1) Valida carrinho
    if (!cart || !Array.isArray(cart) || cart.length === 0) {
      return res.status(400).json({ ok: false, error: 'Carrinho vazio ou inválido' });
    }

    // 2) Calcula subtotal
    const subtotal = cart.reduce(
      (acc, item) => acc + Number(item.price) * Number(item.qty || 1),
      0
    );

    // 3) Regra de frete/bump (ajuste conforme sua lógica)
    const SHIPPING_THRESHOLD = 199.9;   // a partir desse valor: frete grátis
    const BASE_SHIPPING      = 14.9;    // frete normal
    const ORDER_BUMP_PRICE   = 9.9;     // valor da oferta extra

    const shippingValue = subtotal > SHIPPING_THRESHOLD ? 0 : BASE_SHIPPING;
    const bumpValue     = bumpAdded ? ORDER_BUMP_PRICE : 0;
    const total         = subtotal + shippingValue + bumpValue;

    // GhostsPay trabalha em centavos
    const amountInCents = Math.round(total * 100);

    // 4) Monta payload para enviar à GhostsPay
    const ghostsPayload = {
      amount: amountInCents,
      description: 'Compra na WeFriday Store',
      paymentMethod: paymentMethod || 'PIX',
      installments: 1,
      postbackUrl: process.env.GHOSTS_POSTBACK_URL, // URL do webhook em produção
      companyId: process.env.GHOSTS_COMPANY_ID,
      customer: {
        name:  customer?.name  || 'Cliente WeFriday',
        email: customer?.email || 'cliente@example.com',
      },
      items: cart.map((item) => ({
        title: item.name,
        unitPrice: Math.round(Number(item.price) * 100),
        quantity: item.qty || 1,
        externalRef: item.productId || item.id,
      })),
      metadata: {
        bumpAdded: !!bumpAdded,
        source: 'wefriday-frontend',
      },
    };

    // 5) Monta autenticação Basic para GhostsPay
    const secretKey = process.env.GHOSTS_SECRET_KEY;
    const companyId = process.env.GHOSTS_COMPANY_ID;

    if (!secretKey || !companyId) {
      console.error('❌ Variáveis GHOSTS_SECRET_KEY ou GHOSTS_COMPANY_ID não configuradas.');
      return res.status(500).json({ ok: false, error: 'Credenciais GhostsPay não configuradas no servidor' });
    }

    const authToken = Buffer.from(`${secretKey}:${companyId}`).toString('base64');

    // 6) URL base da GhostsPay (padrão + override por env)
    const baseUrl = process.env.GHOSTS_BASE_URL || 'https://api.ghostspaysv2.com/functions/v1';

    // 7) Chamada para criar transação
    const ghostsResponse = await fetch(`${baseUrl}/transactions`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Basic ${authToken}`,
      },
      body: JSON.stringify(ghostsPayload),
    });

    const responseText = await ghostsResponse.text();
    let ghostData;

    try {
      ghostData = JSON.parse(responseText);
    } catch (err) {
      ghostData = { raw: responseText };
    }

    // 8) Se a GhostsPay retornou erro HTTP
    if (!ghostsResponse.ok) {
      console.error('❌ Erro GhostsPay /transactions:', ghostsResponse.status, ghostData);
      return res.status(ghostsResponse.status).json({
        ok: false,
        error: ghostData.message || ghostData.error || ghostData.raw || 'Erro GhostsPay',
        gatewayStatus: ghostsResponse.status,
        gatewayResponse: ghostData,
      });
    }

    // 9) Monta resposta para o frontend (incluindo dados de PIX se houver)
    const pixInfo = {
      qrcode:
        ghostData.pix?.qrcode ||
        ghostData.gatewayResponse?.pix?.qrcode ||
        null,
      expirationDate:
        ghostData.pix?.expirationDate ||
        ghostData.gatewayResponse?.pix?.expirationDate ||
        null,
      amount: ghostData.amount || amountInCents,
    };

    return res.status(200).json({
      ok: true,
      payment: ghostData,
      pix: pixInfo,
      status: ghostData.status || 'pending',
    });
  } catch (err) {
    console.error('❌ Erro inesperado em /api/checkout:', err);
    return res.status(500).json({ ok: false, error: 'Erro interno no servidor' });
  }
}
