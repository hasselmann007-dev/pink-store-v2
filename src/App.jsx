import React, { useState, useEffect } from 'react';
import productsData from "../products.js";
import { 
  ShoppingBag, Search, Menu, X, User, Heart, Star, 
  ChevronRight, Truck, CreditCard, ShieldCheck, 
  Plus, Minus, CheckCircle, MapPin,
  Clock, ThumbsUp, Frown, Zap
} from 'lucide-react';
import { QRCodeCanvas } from 'qrcode.react';

// ---------------------------------------------------------------------
// PRODUTO EXTRA (ORDER BUMP) – ofertinha no checkout
// ---------------------------------------------------------------------
const ORDER_BUMP_ITEM = {
  id: 'bump_01',
  name: "Esponja de Maquiagem Soft Blender",
  price: 9.90,
  image: "/product/esponja.jpeg",
  qty: 1
};

// ---------------------------------------------------------------------
// BOTÃO GENÉRICO
// ---------------------------------------------------------------------
const Button = ({ children, variant = 'primary', className = '', onClick, disabled, loading, size = 'md' }) => {
  const sizes = {
    sm: "px-4 py-2 text-xs",
    md: "px-6 py-3 text-sm",
    lg: "px-8 py-4 text-base"
  };
  
  const baseStyle = `rounded font-bold transition-all duration-200 flex items-center justify-center gap-2 uppercase tracking-wide disabled:opacity-50 disabled:cursor-not-allowed ${sizes[size]}`;
  
  const variants = {
    primary: "bg-[#E91E63] hover:bg-[#C2185B] text-white shadow-lg shadow-[#E91E63]/30 hover:shadow-xl hover:-translate-y-0.5",
    secondary: "bg-black hover:bg-gray-800 text-white",
    outline: "border-2 border-black text-black hover:bg-black hover:text-white",
    ghost: "text-gray-600 hover:bg-gray-100",
    success: "bg-green-600 hover:bg-green-700 text-white shadow-lg shadow-green-600/20"
  };

  return (
    <button 
      onClick={onClick} 
      disabled={disabled || loading}
      className={`${baseStyle} ${variants[variant]} ${className}`}
    >
      {loading ? <span className="animate-spin">↻</span> : children}
    </button>
  );
};

// ---------------------------------------------------------------------
// APP PRINCIPAL (SEM FIREBASE, TUDO EM ESTADO LOCAL)
// ---------------------------------------------------------------------
export default function App() {
  const [products, setProducts]         = useState([]);
  const [cart, setCart]                 = useState([]);
  const [loading, setLoading]           = useState(true);
  const [isCartOpen, setIsCartOpen]     = useState(false);
  const [currentRoute, setCurrentRoute] = useState('home'); // 'home' | 'product' | 'checkout'
  const [selectedProduct, setSelectedProduct] = useState(null);
  const [paymentStatus, setPaymentStatus]     = useState('idle'); // idle | processing | success | error | pix
  const [searchTerm, setSearchTerm]     = useState(''); 
  const [pixInfo, setPixInfo]           = useState(null); // dados do PIX: qrcode/copia e cola
  const [transactionId, setTransactionId] = useState(null); // id da transação na GhostsPay
  const [showPixExitDialog, setShowPixExitDialog] = useState(false);
  // -------------------------------------------------------------------
  // Polling de status do pagamento PIX
  // -------------------------------------------------------------------
  

    const API_BASE_URL =
       import.meta.env.VITE_API_BASE_URL ||
      (import.meta.env.DEV ? 'http://localhost:4000' : '');


  // -------------------------------------------------------------------
  // Aviso ao tentar sair/atualizar a página durante o PIX
  // -------------------------------------------------------------------
  useEffect(() => {
    const handleBeforeUnload = (event) => {
      if (paymentStatus === 'pix' && pixInfo) {
        event.preventDefault();
        event.returnValue = ''; // alguns browsers exigem isso
        return '';
      }
    };

    window.addEventListener('beforeunload', handleBeforeUnload);
    return () => window.removeEventListener('beforeunload', handleBeforeUnload);
  }, [paymentStatus, pixInfo]);

  // -------------------------------------------------------------------
  // Carregar produtos do products.js
  // -------------------------------------------------------------------
  useEffect(() => {
    const list = Object.entries(productsData).map(([id, p], index) => ({
      id: p.id || `prod_${String(index + 1).padStart(2, "0")}`,
      name: p.name,
      price: Number(String(p.price || "0").replace(/\./g, "").replace(",", ".")),
      oldPrice: p.oldPrice
        ? Number(String(p.oldPrice).replace(/\./g, "").replace(",", "."))
        : null,
      discount: p.discount || null,
      category: p.category || "Geral",
      image: p.image,
      rating: p.rating ?? 5,
      reviews: p.reviews ?? 0,
      description: p.description || "",
      installments: p.installments || null,
      gallery: p.gallery || null
    }));

    setProducts(list);
    setLoading(false);
  }, []);

  // -------------------------------------------------------------------
  // Utilitários de preço e carrinho
  // -------------------------------------------------------------------
  const formatPrice = (val) =>
    new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' })
      .format(val || 0);

  const cartSubTotal = cart.reduce(
    (acc, item) => acc + (item.price * item.qty),
    0
  );
  const cartCount = cart.reduce(
    (acc, item) => acc + item.qty,
    0
  );

  // Regra de frete grátis (mesma lógica para usar na sacola)
  const SHIPPING_THRESHOLD = 199.9; // valor para frete grátis
  const BASE_SHIPPING = 14.9;       // frete normal

  const faltaFreteGratis = Math.max(0, SHIPPING_THRESHOLD - cartSubTotal);
  const freteProgress = Math.min(
    100,
    (cartSubTotal / SHIPPING_THRESHOLD) * 100
  );
     const shippingCost = cartSubTotal > SHIPPING_THRESHOLD ? 0 : BASE_SHIPPING;
const finalTotal = cartSubTotal + shippingCost;
  // -------------------------------------------------------------------
  // Carrinho em memória (SEM FIREBASE)
  // -------------------------------------------------------------------
  const addToCart = (product, qty = 1) => {
    setIsCartOpen(true);
    setCart((prev) => {
      const existing = prev.find(item => item.id === product.id);
      if (existing) {
        return prev.map(item =>
          item.id === product.id
            ? { ...item, qty: item.qty + qty }
            : item
        );
      }
      return [
        ...prev,
        {
          id: product.id,
          productId: product.id,
          name: product.name,
          price: product.price,
          image: product.image,
          qty
        }
      ];
    });
  };

  const removeFromCart = (itemId) => {
    setCart(prev => prev.filter(item => item.id !== itemId));
  };

  const updateQty = (itemId, newQty) => {
    if (newQty < 1) return;
    setCart(prev =>
      prev.map(item =>
        item.id === itemId ? { ...item, qty: newQty } : item
      )
    );
  };

  // recebe o método explicitamente
  const handlePaymentProcess = async (
    formData,
    bumpFlag = false,
    paymentMethod = 'PIX' // default se não vier nada
  ) => {
    try {
      setPaymentStatus('processing');

      const API_BASE_URL =
          import.meta.env.VITE_API_BASE_URL ||
          (import.meta.env.DEV ? 'http://localhost:4000' : '');


      // -------------------------------
      // Monta o payload que vai pro backend
      // -------------------------------
      const payload = {
        cart,
        customer: {
          name: formData.name,
          email: formData.email,
        },
        shipping: formData.cep
          ? {
              zipCode: formData.cep,
              street: formData.address,
              neighborhood: '',
              city: formData.city,
              state: '',
              number: formData.number,
              complement: formData.complement || '',
            }
          : undefined,
        paymentMethod,      // "PIX"
        bumpAdded: bumpFlag // vem do parâmetro da função
      };

      const resp = await fetch(`${API_BASE_URL}/api/checkout`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });

      const data = await resp.json();

      console.log('🔎 Resposta /api/checkout:', data);

      if (!resp.ok || !data.ok) {
        console.error('Erro ao criar pagamento:', data);
        throw new Error(data.error || 'Falha ao criar pagamento');
      }

      // -------------------------------------------------
      // SE FOR PIX: mostra a tela de PIX (NÃO redireciona)
      // -------------------------------------------------
      if (paymentMethod === 'PIX') {
        // o backend manda checkoutUrl (qrcode) ou dentro de gatewayResponse.pix.qrcode
        const pixQrcode =
          data.checkoutUrl ||
          data.gatewayResponse?.pix?.qrcode ||
          data.pix?.qrcode ||
          null;

        if (!pixQrcode) {
          console.error('Resposta sem qrcode PIX:', data);
          throw new Error('Não foi possível gerar o PIX');
        }

        // guarda o ID da transação (para o polling)
        const trxId =
          data.transactionId ||
          data.gatewayResponse?.id ||
          data.id ||
          null;
        if (trxId) {
          setTransactionId(trxId);
        }

setPixInfo({
  qrcode: pixQrcode,
  expirationDate:
    data.pix?.expirationDate ||
    data.gatewayResponse?.pix?.expirationDate ||
    null,
  // pega o valor CERTO que o backend mandou (centavos)
  amount:
    data.pix?.amount ??
    data.payment?.amount ??
    data.gatewayResponse?.amount ??
    null,
});

        // estado "pix" -> mostra tela especial de pagamento
        setPaymentStatus('pix');

        // limpa o carrinho
        setCart([]);

        return; // MUITO IMPORTANTE: não deixa cair no "success"
      }

      // Caso volte a ter cartão um dia:
      setPaymentStatus('success');
      setCart([]);
    } catch (error) {
      console.error(error);
      setPaymentStatus('error');
    }
  };

  // -------------------------------------------------------------------
  // NAVBAR
  // -------------------------------------------------------------------
  const NavBar = () => (
    <>
      <div className="bg-[#E91E63] text-white text-[10px] sm:text-xs font-bold text-center py-2 tracking-widest uppercase flex justify-center items-center gap-4">
        <span className="hidden sm:inline">⚡ ENVIOS PARA TODO BRASIL</span>
        <span>🔥 FRETE GRÁTIS ACIMA DE R$ 199,90</span>
        <span className="hidden sm:inline">💳 ATÉ 10X SEM JUROS</span>
      </div>
      
      <header className="sticky top-0 z-40 bg-white/95 backdrop-blur-sm shadow-sm border-b border-gray-100">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-20">
            <button className="md:hidden text-gray-800">
              <Menu size={24} />
            </button>

            <img 
              src="/logo/logo.jpeg" 
              alt="Logo Pink Store"
              className="h-12 w-auto cursor-pointer"
              onClick={() => { setCurrentRoute('home'); setSearchTerm(''); }}
            />

            <div className="hidden md:flex flex-1 max-w-lg mx-8 relative group">
              <input 
                type="text"
                value={searchTerm}
                onChange={(e) => {
                  setSearchTerm(e.target.value);
                  if(currentRoute !== 'home') setCurrentRoute('home');
                }}
                placeholder="Buscar produtos..."
                className="w-full bg-gray-50 border border-gray-200 rounded-full py-2.5 pl-4 pr-10 text-sm focus:outline-none focus:border-[#E91E63] focus:ring-1 focus:ring-[#E91E63] transition-all"
              />
              <Search size={18} className="absolute right-3 top-3 text-gray-400 group-focus-within:text-[#E91E63]" />
            </div>

            <div className="flex items-center gap-6">
              <button 
                className="text-gray-800 hover:text-[#E91E63] relative transition-colors transform hover:scale-105 active:scale-95"
                onClick={() => setIsCartOpen(true)}
              >
                <ShoppingBag size={26} strokeWidth={2.5} />
                {cartCount > 0 && (
                  <span className="absolute -top-2 -right-2 bg-[#E91E63] text-white text-[10px] font-bold h-5 w-5 flex items-center justify-center rounded-full border-2 border-white animate-bounce-in">
                    {cartCount}
                  </span>
                )}
              </button>
            </div>
          </div>
        </div>
      </header>
    </>
  );

  // -------------------------------------------------------------------
  // HOME PAGE (lista de produtos)
  // -------------------------------------------------------------------
  const HomePage = () => {
    const bannerImages = [
      "/banner/banner1.jpeg",
      "/banner/banner2.jpeg",
      "/banner/banner3.jpeg",
      "/banner/banner4.jpeg",
      "/banner/banner5.jpeg",
    ];

    const [bannerIndex, setBannerIndex] = useState(0);

    const nextBanner = () => {
      setBannerIndex((prev) => (prev + 1) % bannerImages.length);
    };

    const prevBanner = () => {
      setBannerIndex((prev) =>
        prev === 0 ? bannerImages.length - 1 : prev - 1
      );
    };

    const filteredProducts = products.filter(p => 
      p.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      p.category.toLowerCase().includes(searchTerm.toLowerCase())
    );

    return (
      <div className="animate-fade-in">
        {!searchTerm && (
          <div className="relative w-full h-[400px] md:h-[550px] overflow-hidden mb-12">
            {/* IMAGEM DO CARROSSEL */}
            <img
              src={bannerImages[bannerIndex]}
              className="absolute inset-0 w-full h-full object-cover object-center transition-all duration-700"
              alt="Banner"
            />

            {/* SETAS */}
            <button
              onClick={prevBanner}
              className="absolute left-4 top-1/2 -translate-y-1/2 bg-black/40 hover:bg-black/60 text-white p-3 rounded-full z-20"
            >
              ❮
            </button>

            <button
              onClick={nextBanner}
              className="absolute right-4 top-1/2 -translate-y-1/2 bg-black/40 hover:bg-black/60 text-white p-3 rounded-full z-20"
            >
              ❯
            </button>

            {/* GRADIENTE + TEXTO */}
            <div className="absolute inset-0 bg-gradient-to-r from-black/70 via-black/30 to-transparent flex items-center">
              <div className="max-w-7xl mx-auto px-4 w-full">
                <div className="max-w-xl text-white">
                  <div className="inline-flex items-center gap-2 bg-[#E91E63] text-white px-3 py-1 rounded text-xs font-bold uppercase tracking-widest mb-4">
                    <Clock size={12} /> Oferta Limitada
                  </div>
                  <h1 className="text-5xl md:text-7xl font-black leading-none mb-6 drop-shadow-lg">
                    WE <br/> FRIDAY
                  </h1>
                  <p className="text-lg md:text-xl mb-8 font-light text-gray-200 max-w-md">
                    O momento que você esperava chegou. Toda a loja com descontos progressivos.
                  </p>
                  <Button 
                    variant="primary" 
                    size="lg"
                    className="px-12"
                    onClick={() => {
                      const el = document.getElementById('products');
                      el?.scrollIntoView({ behavior: 'smooth' });
                    }}
                  >
                    QUERO APROVEITAR
                  </Button>
                </div>
              </div>
            </div>
          </div>
        )}

        <div id="products" className="max-w-7xl mx-auto px-4 mb-20">
          <div className="flex items-end justify-between mb-8 border-b border-gray-200 pb-4">
            <h2 className="text-3xl font-black text-gray-900 uppercase tracking-tight">
              {searchTerm ? (
                `Resultados para "${searchTerm}"`
              ) : (
                <span>Destaques <span className="text-[#E91E63]">.</span></span>
              )}
            </h2>
          </div>

          {loading ? (
            <div className="flex justify-center py-20">
              <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-[#E91E63]"></div>
            </div>
          ) : filteredProducts.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-20 textcenter bg-gray-50 rounded-xl border border-gray-100 border-dashed">
              <div className="w-24 h-24 bg-gray-200 rounded-full flex items-center justify-center mb-6 text-gray-400">
                <Frown size={48} strokeWidth={1.5} />
              </div>
              <h3 className="text-xl font-black text-gray-900 mb-2">Ops! Produto esgotado no estoque.</h3>
              <p className="text-gray-500 max-w-md mx-auto mb-6">
                Não encontramos o que você procurou. Que tal dar uma olhada nas nossas ofertas especiais abaixo?
              </p>
              <Button variant="outline" onClick={() => setSearchTerm('')}>Ver todos os produtos</Button>
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-x-6 gap-y-10">
              {filteredProducts.map(product => (
                <div key={product.id} className="group flex flex-col bg-white">
                  <div
                    className="relative aspect-[3/4] mb-4 overflow-hidden rounded-lg bg-gray-100 border border-gray-100 cursor-pointer"
                    onClick={() => {
                      setSelectedProduct(product);
                      setCurrentRoute('product');
                      window.scrollTo(0,0);
                    }}
                  >
                    {product.discount > 0 && (
                      <span className="absolute top-0 left-0 bg-[#E91E63] text-white text-xs font-black px-3 py-1.5 z-10 uppercase tracking-wider">
                        {product.discount}% OFF
                      </span>
                    )}
                    <img 
                      src={product.image} 
                      className="w-full h-full object-cover transition-transform duration-700 group-hover:scale-110"
                      alt={product.name}
                      loading="lazy"
                    />
                  </div>

                  <div className="flex-1 flex flex-col">
                    <div className="flex items-center text-amber-400 text-[10px] font-bold mb-2 gap-1">
                      <Star size={10} fill="currentColor" />
                      <Star size={10} fill="currentColor" />
                      <Star size={10} fill="currentColor" />
                      <Star size={10} fill="currentColor" />
                      <Star size={10} fill="currentColor" />
                      {product.reviews > 0 && (
                        <span className="text-gray-400 ml-1">({product.reviews})</span>
                      )}
                    </div>
                    <h3 
                      className="font-bold text-gray-900 text-base mb-1 leading-tight cursor-pointer hover:text-[#E91E63] uppercase"
                      onClick={() => {
                        setSelectedProduct(product);
                        setCurrentRoute('product');
                        window.scrollTo(0,0);
                      }}
                    >
                      {product.name}
                    </h3>
                    <div className="mt-auto pt-2">
                      {product.oldPrice && (
                        <span className="text-xs text-gray-400 line-through block">
                          {formatPrice(product.oldPrice)}
                        </span>
                      )}
                      <span className="text-2xl font-black text-[#E91E63]">
                        {formatPrice(product.price)}
                      </span>
                      <p className="text-[10px] text-gray-500 font-bold uppercase mt-1">
                        10x de {formatPrice(product.price / 10)}
                      </p>
                    </div>
                    <Button className="mt-4 w-full text-xs py-2.5" onClick={() => addToCart(product)}>
                      Comprar
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    );
  };

  // -------------------------------------------------------------------
  // PRODUCT PAGE
  // -------------------------------------------------------------------
  const ProductPage = () => {
    const [qty, setQty] = useState(1);
    const [activeTab, setActiveTab] = useState('aval');

    const [cep, setCep] = useState('');
    const [shippingInfo, setShippingInfo] = useState(null);
    const [cepLoading, setCepLoading] = useState(false);
    const [cepError, setCepError] = useState('');

    const [viewerCount, setViewerCount] = useState(85);
    const [currentStock, setCurrentStock] = useState(10000);
    const [displayImage, setDisplayImage] = useState(selectedProduct?.image);

    useEffect(() => {
      if (selectedProduct) setDisplayImage(selectedProduct.image);
    }, [selectedProduct]);

    useEffect(() => {
      const viewerInterval = setInterval(() => {
        setViewerCount(Math.floor(Math.random() * (500 - 50 + 1)) + 50);
      }, 3500);
      return () => clearInterval(viewerInterval);
    }, []);

    useEffect(() => {
      const calculateStock = () => {
        const INITIAL_STOCK = 10000;
        const DECAY_PER_MINUTE = 100;
        const CYCLE_DURATION_MS = (INITIAL_STOCK / DECAY_PER_MINUTE) * 60 * 1000;

        const now = Date.now();
        const timeInCurrentCycle = now % CYCLE_DURATION_MS;
        const minutesPassed = timeInCurrentCycle / (60 * 1000);

        const stock = Math.floor(INITIAL_STOCK - minutesPassed * DECAY_PER_MINUTE);
        return Math.max(15, stock);
      };

      setCurrentStock(calculateStock());

      const interval = setInterval(() => {
        setCurrentStock(calculateStock());
      }, 2000);

      return () => clearInterval(interval);
    }, []);

    const handleCepSearch = async () => {
      const cleanCep = cep.replace(/\D/g, '');

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

    const MOCK_REVIEWS = [
      { id: 1, name: "Daniela D.", rating: 5, title: "cheiro incrível, bem masculino e ótima fixação" },
      { id: 2, name: "Bibiana P.", rating: 5, title: "Manda uns mimos... We 💕💕💕" },
      { id: 3, name: "Mariana A.", rating: 4, title: "Gostei muito! Chegou super rápido." }
    ];

    if (!selectedProduct) return null;

    return (
      <div className="animate-fade-in bg-white pb-20">
        <div className="border-b border-gray-100">
          <div className="max-w-7xl mx-auto px-4 py-3 text-xs font-bold uppercase text-gray-500 flex items-center gap-2">
            <span className="cursor-pointer hover:text-black" onClick={() => setCurrentRoute('home')}>Home</span>
            <ChevronRight size={12} />
            <span className="cursor-pointer hover:text:black">{selectedProduct.category}</span>
            <ChevronRight size={12} />
            <span className="text-[#E91E63]">{selectedProduct.name}</span>
          </div>
        </div>

        <div className="max-w-7xl mx-auto px-4 py-8">
          <div className="grid md:grid-cols-12 gap-10">
            <div className="md:col-span-7">
              <div className="aspect-[4/4] md:aspect-[4/3] rounded-sm overflow-hidden bg-gray-50 border border-gray-100 relative group">
                <img
                  src={displayImage}
                  className="w-full h-full object-cover transition-opacity duration-300"
                  alt={selectedProduct.name}
                />

                {selectedProduct.discount > 0 && (
                  <div className="absolute top-0 left-0 bg-[#E91E63] text:white p-4 z-10">
                    <p className="text-2xl font-black leading-none">-{selectedProduct.discount}%</p>
                    <p className="text-xs font-bold uppercase tracking-wider">Desconto</p>
                  </div>
                )}
                <button className="absolute top-4 right-4 p-3 bg-white rounded-full shadow-md hover:text-[#E91E63] transition-colors">
                  <Heart size={20} />
                </button>
              </div>

              {selectedProduct.gallery && selectedProduct.gallery.length > 1 && (
                <div className="flex gap-3 mt-4 overflow-x-auto pb-2 scrollbar-hide">
                  {selectedProduct.gallery.map((img, index) => (
                    <button
                      key={index}
                      onClick={() => setDisplayImage(img)}
                      className={`w-20 h-20 shrink-0 border-2 rounded-md overflow-hidden ${
                        displayImage === img ? 'border-[#E91E63]' : 'border-transparent hover:border-gray-300'
                      }`}
                    >
                      <img src={img} className="w-full h-full object-cover" alt={`view ${index}`} />
                    </button>
                  ))}
                </div>
              )}
            </div>

            <div className="md:col-span-5 flex flex-col">
              <h1 className="text-3xl md:text-4xl font-black text-gray-900 leading-tight uppercase mb-2">
                {selectedProduct.name}
              </h1>

              <div className="flex items-center gap-4 mb-6 border-b border-gray-100 pb-6">
                <div className="flex text-amber-400">
                  {[1, 2, 3, 4, 5].map(i => (
                    <Star key={i} size={18} fill="currentColor" />
                  ))}
                </div>
                <span className="text-sm font-bold text-gray-500">
                  ({selectedProduct.reviews} avaliações)
                </span>
                <span className="text-gray-300">|</span>
                <span className="text-xs font-bold text-gray-500 flex items-center gap-1 transition-all duration-500">
                  <span className="w-2 h-2 bg-green-500 rounded-full animate-pulse"></span>
                  {viewerCount} pessoas vendo agora
                </span>
              </div>

              <div className="bg-gray-50 p-6 rounded-lg border border-gray-100 mb-6 relative overflow-hidden">
                <div className="absolute top-0 right-0 left-0 bg-[#E91E63] text-white text-xs font-bold px-4 py-2 flex flex-col gap-1">
                  <div className="flex justify-between items-center">
                    <span className="flex items-center gap-1">
                      <Zap size={14} fill="white" /> ALTA PROCURA
                    </span>
                    <span>RESTAM {currentStock.toLocaleString('pt-BR')} UNIDADES</span>
                  </div>
                  <div className="w-full h-1.5 bg-black/20 rounded-full overflow-hidden">
                    <div
                      className="h-full bg-white animate-pulse-slow"
                      style={{ width: `${(currentStock / 10000) * 100}%` }}
                    ></div>
                  </div>
                </div>

                <div className="mt-10">
                  {selectedProduct.oldPrice && (
                    <p className="text-gray-500 text-sm line-through mb-1">
                      De: {formatPrice(selectedProduct.oldPrice)}
                    </p>
                  )}
                  <div className="flex items-baseline gap-2">
                    <span className="text-5xl font-black text-[#E91E63] tracking-tighter">
                      {formatPrice(selectedProduct.price)}
                    </span>
                    {selectedProduct.discount && (
                      <span className="text-sm font-bold text-green-600 bg-green-100 px-2 py-1 rounded">
                        -{selectedProduct.discount}%
                      </span>
                    )}
                  </div>
                  <p className="text-gray-900 font-bold mt-2">
                    em até{' '}
                    <span className="text-black text-lg">
                      10x de {formatPrice(selectedProduct.price / 10)}
                    </span>{' '}
                    sem juros
                  </p>
                </div>
              </div>

              <div className="space-y-4 mb-8">
                <div className="flex gap-4">
                  <div className="w-32 flex items-center border-2 border-gray-200 rounded h-14">
                    <button
                      onClick={() => setQty(Math.max(1, qty - 1))}
                      className="h-full px-4 hover:bg-gray-100 text-gray-600"
                    >
                      <Minus size={16} />
                    </button>
                    <span className="flex-1 text-center font-bold text-lg">{qty}</span>
                    <button
                      onClick={() => setQty(qty + 1)}
                      className="h-full px-4 hover:bg-gray-100 text-gray-600"
                    >
                      <Plus size={16} />
                    </button>
                  </div>
                  <Button
                    className="flex-1 h-14 text-lg shadow-xl shadow-[#E91E63]/20 animate-pulse-slow"
                    onClick={() => addToCart(selectedProduct, qty)}
                  >
                    ADICIONAR À SACOLA
                  </Button>
                </div>
                <Button
                  variant="success"
                  className="w-full h-12 text-base"
                  onClick={() => {
                    addToCart(selectedProduct, qty);
                    setIsCartOpen(false);
                    setCurrentRoute('checkout');
                  }}
                >
                  COMPRAR AGORA
                </Button>
              </div>

              {/* BLOCO CEP */}
              <div className="border-t border-b border-gray-100 py-6 mb-6">
                <div className="flex items-center gap-2 font-bold text-sm uppercase mb-3">
                  <Truck size={18} className="text-gray-400" />
                  Calcular Frete e Prazo
                </div>

                <div className="flex gap-2 items-center">
                  <input
                    value={cep}
                    onChange={(e) => {
                      setCep(e.target.value);
                      setCepError('');
                      setShippingInfo(null);
                    }}
                    placeholder="00000-000"
                    className="bg-gray-50 border border-gray-200 px-4 py-2 rounded w-40 text-sm outline-none focus:border-black"
                  />
                  <button
                    type="button"
                    onClick={handleCepSearch}
                    disabled={cepLoading}
                    className="bg-[#E91E63] text-white text-xs font-bold px-4 py-2 rounded disabled:opacity-60"
                  >
                    {cepLoading ? 'Consultando...' : 'Calcular'}
                  </button>
                  <button className="text-xs font-bold underline hover:text-[#E91E63]">
                    NÃO SEI MEU CEP
                  </button>
                </div>

                {cepError && (
                  <p className="text-xs text-red-500 mt-2">{cepError}</p>
                )}

                {shippingInfo && !cepError && (
                  <div className="mt-4 space-y-2 text-sm animate-fade-in">
                    <div className="flex flex-col gap-1 p-3 bg-green-50 border border-green-100 rounded">
                      <span className="font-bold text-gray-800">
                        Entrega para:{' '}
                        {shippingInfo.logradouro && `${shippingInfo.logradouro}, `}
                        {shippingInfo.bairro && `${shippingInfo.bairro} - `}
                        {shippingInfo.cidade}/{shippingInfo.uf}
                      </span>
                      <span className="font-bold text-green-600">
                        Frete estimado: R$ 19,90 (até 2 dias úteis)
                      </span>
                    </div>
                  </div>
                )}
              </div>

              <div className="grid grid-cols-2 gap-4 text-xs text-gray-500">
                <div className="flex items-center gap-2 border border-gray-100 p-2 rounded">
                  <ShieldCheck className="text-green-500" size={20} />
                  <span>Garantia de 7 dias para trocas</span>
                </div>
                <div className="flex items-center gap-2 border border-gray-100 p-2 rounded">
                  <ThumbsUp className="text-blue-500" size={20} />
                  <span>98% de aprovação dos clientes</span>
                </div>
              </div>
            </div>
          </div>

          {/* ABA DE DESCRIÇÃO / AVALIAÇÕES */}
          <div className="mt-16 max-w-6xl mx-auto">
            <div className="flex border-b border-gray-200 mb-8 overflow-x-auto">
              {['Descrição', 'Como Usar', 'Ingredientes', 'Avaliações'].map((tab) => {
                const key = tab.toLowerCase().substring(0, 4);
                return (
                  <button
                    key={key}
                    onClick={() => setActiveTab(key)}
                    className={`px-8 py-4 font-bold uppercase tracking-wider text-sm border-b-2 transition-colors whitespace-nowrap ${
                      activeTab === key
                        ? 'border-[#E91E63] text-black'
                        : 'border-transparent text-gray-400 hover:text-gray-600'
                    }`}
                  >
                    {tab}
                  </button>
                );
              })}
            </div>

            <div className="prose max-w-none text-gray-600 leading-relaxed">
              {activeTab === 'desc' && (
                <div className="animate-fade-in">
                  <h3 className="text-2xl font-black text-gray-900 mb-4 uppercase">
                    {selectedProduct.name}
                  </h3>
                  <p className="mb-4">{selectedProduct.description}</p>
                  <p>
                    Desenvolvido com tecnologia exclusiva, este produto entrega
                    resultados visíveis desde a primeira aplicação. Sua fórmula
                    contém ativos concentrados que agem profundamente.
                  </p>
                </div>
              )}
              {activeTab === 'aval' && (
                <div className="animate-fade-in">
                  <h3 className="text-xl font-black text-gray-900 mb-6 text-center">
                    Avaliações de Clientes
                  </h3>
                  <div className="grid gap-4">
                    {MOCK_REVIEWS.map((review) => (
                      <div key={review.id} className="bg-gray-50 p-4 rounded-lg">
                        <div className="flex items-center gap-2 mb-2">
                          <span className="font-bold text-gray-900">
                            {review.name}
                          </span>
                          <div className="flex text-amber-400 text-xs">
                            {[...Array(5)].map((_, i) => (
                              <Star
                                key={i}
                                size={10}
                                fill={i < review.rating ? 'currentColor' : 'none'}
                              />
                            ))}
                          </div>
                        </div>
                        <p className="text-sm text-gray-600">{review.title}</p>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    );
  };

  // -------------------------------------------------------------------
  // CHECKOUT PAGE
  // -------------------------------------------------------------------
  const CheckoutPage = () => {
    const [formData, setFormData] = useState({
      email: '',
      name: '',
      cep: '',
      address: '',
      number: '',
      city: '',
      complement: '',
    });

    const [bumpAdded, setBumpAdded] = useState(false);

    const [paymentMethod] = useState('PIX');

    const handleChange = (e) =>
      setFormData((prev) => ({ ...prev, [e.target.name]: e.target.value }));

// Cálculo total
const subtotal = cart.reduce(
  (acc, item) => acc + (Number(item.price) * Number(item.qty || 1)),
  0
);

const shippingValue = subtotal > 199.9 ? 0 : 14.9;
const bumpValue = bumpAdded ? Number(ORDER_BUMP_ITEM.price) : 0;
const total = subtotal + shippingValue + bumpValue;
const amountInCents = Math.round(total * 100);

    const handleBumpToggle = () => {
      setBumpAdded((prev) => !prev);
    };

    // carrinho vazio (e não foi sucesso)
    if (cart.length === 0 && paymentStatus !== 'success' && paymentStatus !== 'pix') {
      return (
        <div className="flex flex-col items-center justify-center py-20">
          <ShoppingBag size={64} className="text-gray-300 mb-4" />
          <h2 className="text-2xl font-bold text-gray-900">
            Seu carrinho está vazio
          </h2>
          <Button
            variant="outline"
            className="mt-4"
            onClick={() => setCurrentRoute('home')}
          >
            Voltar a comprar
          </Button>
        </div>
      );
    }

    // tela de pagamento PIX enquanto o cliente não paga
if (paymentStatus === 'pix' && pixInfo) {
  // valor em reais (backend manda em centavos)
const pixAmount = pixInfo?.amount
  ? Number(pixInfo.amount) / 100
  : Number(finalTotal);
  // data de expiração formatada bonitinha
  const pixExpiresAt = pixInfo.expiresAt
    ? new Date(pixInfo.expiresAt).toLocaleString('pt-BR')
    : null;

  return (
    <div className="max-w-3xl mx-auto px-4 py-16 text-center">
      <h2 className="text-2xl md:text-3xl font-black mb-4">
        Pague com PIX
      </h2>

                <div className="flex flex-col items-center gap-6">
        {/* QR CODE VISUAL */}
        <div className="bg-white p-4 rounded-lg shadow border border-gray-200">
          <QRCodeCanvas
            value={pixInfo.qrcode}
            size={220}
            includeMargin={true}
          />
        </div>

        {/* VALOR + EXPIRAÇÃO */}
        <div className="text-sm text-gray-700 text-left">
          <p><strong>Valor:</strong> {formatPrice(pixAmount)}</p>
          {pixExpiresAt && (
            <p className="text-xs text-gray-500">
              Expira em: {pixExpiresAt}
            </p>
          )}
        </div>

        {/* CÓDIGO COPIA E COLA */}
        <textarea
          readOnly
          rows={4}
          className="w-full max-w-xl bg-gray-100 border border-gray-200 rounded p-3 text-xs break-all"
          value={pixInfo.qrcode}
        />

        <Button
          onClick={() => {
            if (navigator.clipboard?.writeText) {
              navigator.clipboard.writeText(pixInfo.qrcode);
            }
          }}
        >
          COPIAR CÓDIGO PIX
        </Button>

        <p className="text-xs text-gray-500 mt-2">
          Após realizar o pagamento, você receberá a confirmação por e-mail.
        </p>



 <Button
  variant="outline"
  size="sm"
  onClick={() => {
    setShowPixExitDialog(true);
  }}
>
  Voltar à loja
</Button>

{showPixExitDialog && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center">
          <div className="bg-white rounded-2xl p-6 max-w-sm w-full text-left shadow-lg">
            <h2 className="text-lg font-bold text-gray-900 mb-2">
              Cancelar pagamento PIX?
            </h2>

            <p className="text-sm text-gray-600 mb-4">
              Se você sair dessa tela agora, o pagamento por PIX poderá não ser concluído e seu pedido poderá ser cancelado.
            </p>

            <div className="flex justify-end gap-3">
              <Button
                variant="outline"
                size="sm"
                onClick={() => setShowPixExitDialog(false)}
              >
                Continuar na tela de PIX
              </Button>

              <Button
                size="sm"
                onClick={() => {
                  setShowPixExitDialog(false);
                  setPaymentStatus('idle');
                  setPixInfo(null);
                  setTransactionId(null);
                  setCurrentRoute('home');
                }}
              >
                Cancelar PIX e voltar à loja
              </Button>
            </div>
          </div>
        </div>
      )}
          </div>
        </div>
      );
    }

    // tela de sucesso
    if (paymentStatus === 'success') {
      return (
        <div className="flex flex-col items-center justify-center py-20 text-center animate-fade-in">
          <div className="w-24 h-24 bg-green-100 rounded-full flex items-center justify-center mb-6 text-green-600">
            <CheckCircle size={48} />
          </div>
          <h2 className="text-3xl font-black text-gray-900 mb-2">
            Pedido Confirmado!
          </h2>
          <p className="text-gray-600 mb-8 max-w-md">
            Obrigado por comprar na Pink Store. Você receberá um e-mail com os
            detalhes.
          </p>
          <Button
            onClick={() => {
              setPaymentStatus('idle');
              setCurrentRoute('home');
            }}
          >
            Continuar Comprando
          </Button>
        </div>
      );
    }

    return (
      <div className="max-w-4xl mx-auto px-4 py-10">
        <div className="flex items-center gap-2 mb-8 text-sm font-bold text-gray-400">
          <span
            onClick={() => setCurrentRoute('home')}
            className="cursor-pointer hover:text-black"
          >
            HOME
          </span>
          <ChevronRight size={12} />
          <span className="text-black">CHECKOUT</span>
        </div>

        <div className="grid md:grid-cols-3 gap-8">
          {/* COLUNA FORMULÁRIOS */}
          <div className="md:col-span-2 space-y-6">
            {/* Dados pessoais */}
            <div className="bg-white p-6 rounded border border-gray-200">
              <h3 className="font-black text-gray-900 mb-4 uppercase flex items-center gap-2 text-lg">
                <User size={20} /> Dados Pessoais
              </h3>
              <div className="grid gap-4">
                <input
                  name="email"
                  placeholder="E-mail"
                  className="bg-gray-50 border-gray-200 border p-3 rounded text-sm outline-none focus:border-[#E91E63]"
                  onChange={handleChange}
                  value={formData.email}
                />
                <input
                  name="name"
                  placeholder="Nome Completo"
                  className="bg-gray-50 border-gray-200 border p-3 rounded text-sm outline-none focus:border-[#E91E63]"
                  onChange={handleChange}
                  value={formData.name}
                />
              </div>
            </div>

            {/* Endereço */}
            <div className="bg-white p-6 rounded border border-gray-200">
              <h3 className="font-black text-gray-900 mb-4 uppercase flex items-center gap-2 text-lg">
                <MapPin size={20} /> Endereço
              </h3>
              <div className="grid grid-cols-3 gap-4">
                <input
                  name="cep"
                  placeholder="CEP"
                  className="bg-gray-50 border-gray-200 border p-3 rounded text-sm outline-none focus:border-[#E91E63] col-span-1"
                  onChange={handleChange}
                  value={formData.cep}
                />
                <input
                  name="address"
                  placeholder="Endereço"
                  className="bg-gray-50 border-gray-200 border p-3 rounded text-sm outline-none focus:border-[#E91E63] col-span-2"
                  onChange={handleChange}
                  value={formData.address}
                />
                <input
                  name="number"
                  placeholder="Número"
                  className="bg-gray-50 border-gray-200 border p-3 rounded text-sm outline-none focus:border-[#E91E63] col-span-1"
                  onChange={handleChange}
                  value={formData.number}
                />
                <input
                  name="city"
                  placeholder="Cidade"
                  className="bg-gray-50 border-gray-200 border p-3 rounded text-sm outline-none focus:border-[#E91E63] col-span-2"
                  onChange={handleChange}
                  value={formData.city}
                />
              </div>
            </div>

            {/* Pagamento */}
            <div className="bg-white p-6 rounded border border-gray-200">
              <h3 className="font-black text-gray-900 mb-4 uppercase flex items-center gap-2 text-lg">
                <CreditCard size={20} /> Pagamento
              </h3>

              <div className="p-4 bg-green-50 border border-green-200 rounded text-sm text-left">
                <p className="font-bold text-green-700 mb-1">
                  Pagamento via PIX
                </p>
                <p className="text-green-700/80">
                  Após clicar em <strong>Finalizar Compra</strong>, vamos gerar um
                  QR Code e o código PIX copia e cola para você pagar pelo banco.
                </p>
              </div>
            </div>
          </div>

          {/* COLUNA RESUMO */}
          <div className="md:col-span-1">
            <div className="bg-gray-50 p-6 rounded border border-gray-200 sticky top-24">
              <h3 className="font-black text-gray-900 mb-6 uppercase text-lg">
                Resumo
              </h3>

              <div className="space-y-4 mb-6">
                {cart.map((item) => (
                  <div
                    key={item.id}
                    className="flex gap-3 text-sm border-b border-gray-200 pb-3 last:border-0"
                  >
                    <div className="w-12 h-12 bg-white rounded border border-gray-200 overflow-hidden shrink-0">
                      <img
                        src={item.image}
                        className="w-full h-full object-cover"
                        alt={item.name}
                      />
                    </div>
                    <div className="flex-1">
                      <p className="font-bold text-gray-900 line-clamp-1">
                        {item.name}
                      </p>
                      <p className="text-xs text-gray-500">qtd: {item.qty}</p>
                    </div>
                    <span className="font-bold text-gray-900">
                      {formatPrice(item.price * item.qty)}
                    </span>
                  </div>
                ))}
              </div>

              {/* BUMP / OFERTA ESPECIAL */}
              <div className="bg-white border-2 border-dashed border-[#E91E63]/30 rounded-lg p-3 mb-6 relative overflow-hidden">
                <div className="absolute top-0 right-0 bg-[#E91E63] text-white text-[10px] font-bold px-2 py-0.5 rounded-bl">
                  OFERTA ÚNICA
                </div>
                <div className="flex items-start gap-3">
                  <div className="w-14 h-14 bg-gray-100 rounded shrink-0">
                    <img
                      src={ORDER_BUMP_ITEM.image}
                      className="w-full h-full object-cover rounded"
                      alt={ORDER_BUMP_ITEM.name}
                    />
                  </div>
                  <div>
                    <p className="text-xs font-black text-gray-900 uppercase leading-tight mb-1">
                      {ORDER_BUMP_ITEM.name}
                    </p>
                    <p className="text-sm font-bold text-[#E91E63]">
                      {formatPrice(ORDER_BUMP_ITEM.price)}
                    </p>
                  </div>
                </div>
                <div
                  className="mt-3 flex items-center gap-2 cursor-pointer"
                  onClick={handleBumpToggle}
                >
                  <div
                    className={`w-5 h-5 border-2 rounded flex items-center justify-center transition-colors ${
                      bumpAdded
                        ? 'bg-[#E91E63] border-[#E91E63]'
                        : 'border-gray-300'
                    }`}
                  >
                    {bumpAdded && (
                      <CheckCircle size={14} className="text-white" />
                    )}
                  </div>
                  <span className="text-xs font-bold text-gray-600 select-none">
                    Sim, quero aproveitar esta oferta!
                  </span>
                </div>
              </div>

              {/* Totais */}
              <div className="border-t border-gray-200 pt-4 space-y-2 text-sm">
                <div className="flex justify-between text-gray-500">
                  <span>Subtotal</span>
                  <span>{formatPrice(cartSubTotal)}</span>
                </div>
                <div className="flex justify-between text-gray-500">
                  <span>Frete (Expresso)</span>
                  <span
                    className={
                      shippingCost === 0
                        ? 'text-green-600 font-bold'
                        : 'text-gray-900'
                    }
                  >
                    {shippingCost === 0
                      ? 'Grátis'
                      : formatPrice(shippingCost)}
                  </span>
                </div>
                {bumpAdded && (
                  <div className="flex justify-between text-[#E91E63] font-bold">
                    <span>Oferta Especial</span>
                    <span>{formatPrice(ORDER_BUMP_ITEM.price)}</span>
                  </div>
                )}
                <div className="flex justify-between text-xl font-black text-gray-900 pt-4 border-t border-gray-200 mt-2">
                  <span>Total</span>
                  <span>{formatPrice(finalTotal)}</span>
                </div>
              </div>

{/* BOTÃO FINALIZAR */}
<Button
  className="w-full mt-4"
  disabled={cart.length === 0 || paymentStatus === 'processing'}
  loading={paymentStatus === 'processing'}
  onClick={() => {
    if (cart.length === 0) return;

    // só pra você ver no console que clicou
    console.log('🟢 FINALIZAR COMPRA clicado', {
      formData,
      bumpAdded,
      paymentMethod,
    });

    // 👉 AGORA SIM: chama a função que fala com o backend e gera o PIX
    handlePaymentProcess(formData, bumpAdded, paymentMethod);
  }}
>
  FINALIZAR COMPRA
</Button> </div>
          </div>
        </div>
      </div>
    );
  };

  // -------------------------------------------------------------------
  // DRAWER DO CARRINHO
  // -------------------------------------------------------------------
  const CartDrawer = () => (
    <div className={`fixed inset-0 z-[60] ${isCartOpen ? 'pointer-events-auto' : 'pointer-events-none'}`}>
      <div
        className={`absolute inset-0 bg-black/60 backdrop-blur-sm transition-opacity duration-300 ${
          isCartOpen ? 'opacity-100' : 'opacity-0'
        }`}
        onClick={() => setIsCartOpen(false)}
      />
      <div
        className={`absolute top-0 right-0 w-full max-w-md h-full bg-white shadow-2xl transform transition-transform duration-300 flex flex-col ${
          isCartOpen ? 'translate-x-0' : 'translate-x-full'
        }`}
      >
        <div className="p-5 border-b border-gray-100 flex items-center justify-between bg:white">
          <h2 className="font-black text-xl uppercase flex items-center gap-2">
            <ShoppingBag className="text-[#E91E63]" /> Sua Sacola
          </h2>
          <button onClick={() => setIsCartOpen(false)} className="p-2 hover:bg-gray-100 rounded-full">
            <X size={24} />
          </button>
        </div>
        <div className="flex-1 overflow-y-auto p-5 space-y-6">
          {cart.length === 0 ? (
            <div className="text-center py-10 text-gray-400">
              <p>Sua sacola está vazia.</p>
              <Button
                variant="ghost"
                className="mt-4"
                onClick={() => setIsCartOpen(false)}
              >
                Começar a comprar
              </Button>
            </div>
          ) : (
            cart.map(item => (
              <div key={item.id} className="flex gap-4 animate-fade-in">
                <div className="w-20 h-20 bg-gray-100 rounded-md overflow-hidden flex-shrink-0 border border-gray-200">
                  <img src={item.image} className="w-full h-full object-cover" alt={item.name}/>
                </div>
                <div className="flex-1 flex flex-col justify-between">
                  <div>
                    <h4 className="text-sm font-bold text-gray-900 line-clamp-2">
                      {item.name}
                    </h4>
                    <p className="text-xs text-gray-500 mt-1">
                      {formatPrice(item.price)} un.
                    </p>
                  </div>
                  <div className="flex items-center justify-between mt-2">
                    <div className="flex items-center border border-gray-300 rounded h-8">
                      <button
                        onClick={() => item.qty === 1 ? removeFromCart(item.id) : updateQty(item.id, item.qty - 1)}
                        className="px-2 h-full hover:bg-gray-100 text-gray-600"
                      >
                        <Minus size={12}/>
                      </button>
                      <span className="px-2 text-xs font-bold">{item.qty}</span>
                      <button
                        onClick={() => updateQty(item.id, item.qty + 1)}
                        className="px-2 h-full hover:bg-gray-100 text-gray-600"
                      >
                        <Plus size={12}/>
                      </button>
                    </div>
                    <button
                      onClick={() => removeFromCart(item.id)}
                      className="text-xs text-red-500 font-bold hover:underline"
                    >
                      Remover
                    </button>
                  </div>
                </div>
              </div>
            ))
          )}
        </div>
        {cart.length > 0 && (
          <div className="p-5 bg-gray-50 border-t border-gray-200">
            {/* Barra de progresso do frete grátis */}
            <div className="mb-4">
              <div className="flex justify-between text-xs mb-1">
                <span>
                  Frete grátis a partir de {formatPrice(SHIPPING_THRESHOLD)}
                </span>
                <span>{freteProgress.toFixed(0)}%</span>
              </div>

              <div className="w-full h-2 bg-gray-200 rounded-full overflow-hidden">
                <div
                  className="h-2 bg-[#E91E63] rounded-full transition-all"
                  style={{ width: `${freteProgress}%` }}
                />
              </div>

              {faltaFreteGratis > 0 ? (
                <p className="text-xs text-gray-600 mt-1">
                  Faltam <strong>{formatPrice(faltaFreteGratis)}</strong> para você
                  ganhar frete grátis 🛵
                </p>
              ) : (
                <p className="text-xs text-green-600 mt-1 font-semibold">
                  Você já ganhou frete grátis! ✨
                </p>
              )}
            </div>

            {/* Subtotal + botão finalizar */}
            <div className="flex justify-between items-center mb-4">
              <span className="text-gray-600 font-medium">Subtotal</span>
              <span className="text-xl font-black text-gray-900">
                {formatPrice(cartSubTotal)}
              </span>
            </div>

            <Button
              className="w-full py-4 text-base shadow-lg shadow-[#E91E63]/30"
              onClick={() => {
                setIsCartOpen(false);
                setCurrentRoute('checkout');
              }}
            >
              Finalizar Compra
            </Button>
              {/* 🔥 NOVO BOTÃO ADICIONADO */}
  <Button
    variant="outline"
    className="w-full mt-2"
    onClick={() => {
      setIsCartOpen(false);
      setCurrentRoute("home");
    }}
  >
    CONTINUAR COMPRANDO
  </Button>
</div>
          
        )}
      </div>
    </div>
  );

  // -------------------------------------------------------------------
  // FOOTER
  // -------------------------------------------------------------------
  const Footer = () => (
    <footer className="bg-black text-white pt-16 pb-8 mt-20">
      <div className="max-w-7xl mx-auto px-4">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-10 mb-12">
          <div>
            <img 
              src="/logo/logo.jpeg" 
              alt="Logo Pink Store"
              className="h-12 w-auto cursor-pointer"
              onClick={() => { setCurrentRoute('home'); setSearchTerm(''); }}
            />
            <p className="text-gray-400 text-sm leading-relaxed">
              A marca revolucionária de beleza. Produtos de alta performance com preços acessíveis para você brilhar.
            </p>
          </div>
          <div>
            <h5 className="font-bold text-sm uppercase mb-4 tracking-widest">Institucional</h5>
            <ul className="space-y-2 text-sm text-gray-400">
              <li><a href="#" className="hover:text-white">Sobre a Marca</a></li>
              <li><a href="#" className="hover:text-white">Trabalhe Conosco</a></li>
              <li><a href="#" className="hover:text-white">Política de Privacidade</a></li>
            </ul>
          </div>
          <div>
            <h5 className="font-bold text-sm uppercase mb-4 tracking-widest">Ajuda</h5>
            <ul className="space-y-2 text-sm text-gray-400">
              <li><a href="#" className="hover:text-white">Trocas e Devoluções</a></li>
              <li><a href="#" className="hover:text-white">Fale Conosco</a></li>
              <li><a href="#" className="hover:text-white">Rastrear Pedido</a></li>
            </ul>
          </div>
          <div>
            <h5 className="font-bold text-sm uppercase mb-4 tracking-widest">Pagamento</h5>
            <div className="flex gap-2 text-gray-400">
              <CreditCard />
              <CreditCard />
              <CreditCard />
            </div>
          </div>
        </div>
        <div className="border-t border-gray-800 pt-8 text-center text-xs text-gray-500">
          <p>© 2025 Pink Store. Todos os direitos reservados.</p>
        </div>
      </div>
    </footer>
  );

  // -------------------------------------------------------------------
  // RENDER FINAL
  // -------------------------------------------------------------------
  return (
    <div className="font-sans bg-white min-h-screen text-gray-900">
      <NavBar />
      <main>
        {currentRoute === 'home' && <HomePage />}
        {currentRoute === 'product' && <ProductPage />}
        {currentRoute === 'checkout' && <CheckoutPage />}
      </main>
      <Footer />
      <CartDrawer />
    </div>
  );
}
