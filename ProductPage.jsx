import React, { useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import products from '../data/products.js';

/**
 * Página de produto individual. Recupera o ID a partir da URL usando
 * useParams() e encontra o produto no objeto de dados. Exibe
 * detalhes básicos e oferece um link para voltar à lista de produtos.
 */
export default function ProductPage() {
  const { id } = useParams();
  const product = products[id];

  // CEP / Frete
  const [cep, setCep] = useState('');
  const [shippingInfo, setShippingInfo] = useState(null);
  const [cepLoading, setCepLoading] = useState(false);
  const [cepError, setCepError] = useState('');

  // Consulta CEP na API ViaCEP
  const handleCepSearch = async () => {
    const cleanCep = cep.replace(/\D/g, ''); // só números

    if (cleanCep.length !== 8) {
      setCepError('Digite um CEP válido com 8 dígitos.');
      setShippingInfo(null);
      return;
    }

    try {
      setCepLoading(true);
      setCepError('');

      const response = await fetch(`https://viacep.com.br/ws/${cleanCep}/json/`);

      if (!response.ok) {
        throw new Error('Erro ao consultar CEP');
      }

      const data = await response.json();

      if (data.erro) {
        setCepError('CEP não encontrado.');
        setShippingInfo(null);
        return;
      }

      // endereço retornado pela API
      setShippingInfo({
        cep: cleanCep,
        logradouro: data.logradouro,
        bairro: data.bairro,
        cidade: data.localidade,
        uf: data.uf,
      });
    } catch (err) {
      console.error(err);
      setCepError('Não foi possível consultar o CEP no momento.');
      setShippingInfo(null);
    } finally {
      setCepLoading(false);
    }
  };

  // Se não encontrar o produto
  if (!product) {
    return (
      <div className="p-6">
        <h1 className="text-2xl font-bold">Produto não encontrado</h1>
        <p className="mt-2">
          Parece que este produto não existe ou foi removido.
        </p>
        <Link to="/" className="text-pink-600 underline mt-4 inline-block">
          Voltar para a loja
        </Link>
      </div>
    );
  }

  return (
    <div className="p-6">
      <Link to="/" className="text-pink-600 underline mb-4 inline-block">
        ← Voltar
      </Link>

      <div className="flex flex-col md:flex-row gap-8">
        <img
          src={product.image}
          alt={product.name}
          className="w-80 h-80 object-cover rounded-xl shadow-md"
        />

        <div className="flex-1">
          <h1 className="text-3xl font-bold mb-2">{product.name}</h1>

          <p className="text-2xl text-pink-600 font-semibold mb-4">
            R$ {product.price}
          </p>

          <p className="prose dark:prose-invert max-w-prose mb-6">
            {product.description ||
              'Descrição detalhada do produto ainda indisponível.'}
          </p>

          {/* BLOCO DE CEP / FRETE */}
          <div className="bg-gray-50 border border-gray-200 rounded-lg p-4 mb-6">
            <h2 className="text-sm font-semibold mb-2 text-gray-700">
              Calcular frete e prazo
            </h2>

            <div className="flex items-center gap-2">
              <input
                type="text"
                value={cep}
                onChange={(e) => {
                  setCep(e.target.value);
                  setCepError('');
                  setShippingInfo(null);
                }}
                placeholder="Digite seu CEP"
                className="border border-gray-300 rounded-lg px-3 py-2 text-sm w-40 focus:outline-none focus:ring-2 focus:ring-pink-500 focus:border-pink-500"
              />

              <button
                type="button"
                onClick={handleCepSearch}
                disabled={cepLoading}
                className="bg-pink-600 hover:bg-pink-700 text-white text-xs font-semibold px-4 py-2 rounded-lg disabled:opacity-60"
              >
                {cepLoading ? 'Consultando...' : 'Calcular'}
              </button>

              <button
                type="button"
                className="text-xs text-gray-500 underline"
              >
                Não sei meu CEP
              </button>
            </div>

            {/* Mensagem de erro */}
            {cepError && (
              <p className="text-xs text-red-500 mt-2">{cepError}</p>
            )}

            {/* Resultado do endereço / frete */}
            {shippingInfo && !cepError && (
              <div className="mt-3 text-xs text-gray-700 space-y-1">
                <p>
                  Entrega para:{' '}
                  <strong>
                    {shippingInfo.logradouro && `${shippingInfo.logradouro}, `}
                    {shippingInfo.bairro && `${shippingInfo.bairro} - `}
                    {shippingInfo.cidade}/{shippingInfo.uf}
                  </strong>
                </p>
                <p>
                  Frete estimado:{' '}
                  <strong className="text-green-600">
                    R$ 12,90 (até 2 dias úteis)
                  </strong>
                </p>
              </div>
            )}
          </div>

          <button
            className="bg-pink-600 hover:bg-pink-700 text-white font-medium py-2 px-6 rounded-lg transition-colors"
            onClick={() =>
              alert('Funcionalidade de compra ainda não implementada')
            }
          >
            Comprar agora
          </button>
        </div>
      </div>
    </div>
  );
}
