// api/ghostspay/webhook.js
//
// Endpoint que recebe as notificações (webhook) da GhostsPay.
// Você deve configurar na GhostsPay a URL:
//   https://www.wefriday.store/api/ghostspay/webhook
//
// Esse arquivo hoje só valida e salva em memória (Map).
// Você pode trocar depois para salvar em banco de dados.

const paymentStore = new Map(); 
// Exemplo de estrutura:
// paymentStore.set(transactionId, { status: 'paid', amount: 12345, gatewayResponse: {...} });

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ ok: false, error: 'Method not allowed' });
  }

  try {
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
        console.error('❌ Erro ao fazer parse do webhook GhostsPay:', parseErr);
        return res.status(400).json({ ok: false, error: 'Webhook JSON inválido' });
      }
    }

    const event = body;

    // Aqui depende de como a GhostsPay manda o payload.
    // Adapte se vier com outro formato.
    const transactionId = event.id || event.transactionId || event.referenceId;

    if (!transactionId) {
      console.error('⚠️ Webhook recebido sem ID de transação:', event);
      return res.status(400).json({ ok: false, error: 'Webhook sem ID de transação' });
    }

    const status = event.status || 'unknown';
    const amount = event.amount ?? 0;

    // Salva em memória (apenas para teste / debug)
    paymentStore.set(transactionId, {
      status,
      amount,
      gatewayResponse: event,
    });

    console.log('✅ Webhook GhostsPay recebido:', {
      transactionId,
      status,
      amount,
    });

    // A GhostsPay espera 200 OK para saber que o webhook foi processado com sucesso.
    return res.status(200).json({ ok: true });
  } catch (err) {
    console.error('❌ Erro ao processar webhook GhostsPay:', err);
    return res.status(500).json({ ok: false, error: 'Erro interno no webhook' });
  }
}
