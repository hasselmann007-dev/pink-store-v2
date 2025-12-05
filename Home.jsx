import { Link } from 'react-router-dom';
import products from '../data/products.js';

/**
 * Página inicial. Lista todos os produtos disponíveis e cria links para
 * as páginas dinâmicas de produto. Cada produto é renderizado como um
 * card simples com imagem, nome e preço. Ao clicar, navega para
 * `/product/:id`.
 */
export default function Home() {
  return (
    <div className="p-6">
      <h1 className="text-2xl font-bold mb-4">Bem‑vindo(a) à WeFriday Store</h1>
      <div className="grid grid-cols-2 gap-4 md:grid-cols-3 lg:grid-cols-4">
        {Object.entries(products).map(([id, product]) => (
          <Link
            key={id}
            to={`/product/${id}`}
            className="border rounded-lg overflow-hidden hover:shadow-lg transition-shadow bg-white dark:bg-gray-800"
          >
            <img
              src={product.image}
              alt={product.name}
              className="w-full h-40 object-cover"
            />
            <div className="p-4 space-y-1">
              <h2 className="font-semibold text-lg">{product.name}</h2>
              <p className="text-pink-600 font-bold text-md">R$ {product.price}</p>
            </div>
          </Link>
        ))}
      </div>
    </div>
  );
}