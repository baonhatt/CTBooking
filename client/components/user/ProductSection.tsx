import { useEffect, useState } from 'react';
import { motion } from 'framer-motion';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { ArrowRight } from 'lucide-react';
import { getActiveToys } from '@/lib/api';
import { optimizeCloudinaryUrl, generateCloudinarySrcSet } from '@/lib/utils';

export default function ProductSection() {
  const [products, setProducts] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  useEffect(() => {
    (async () => {
      try {
        const { items } = await getActiveToys();
        setProducts(
          items.map((t: any) => ({
            id: t.id,
            name: t.name,
            category: t.category || 'TOY',
            price: Number(t.price),
            image: t.image_url
          }))
        );
      } catch {
        setProducts([]);
      } finally {
        setLoading(false);
      }
    })();
  }, []);
  if (loading || products.length === 0) return null;
  return (
    <section
      id="store"
      className="relative py-24 bg-gradient-to-b from-[#0f1d3a] via-[#0b1426] to-[#060915] overflow-hidden"
    >
      <div className="absolute inset-0 neon-noise opacity-50 pointer-events-none" />
      <div className="absolute -left-10 top-16 w-72 h-72 bg-purple-500/20 blur-[120px]" />
      <div className="absolute right-0 bottom-10 w-80 h-80 bg-cyan-500/20 blur-[130px]" />

      <div className="container mx-auto px-4 relative z-10">
        <div className="flex flex-col md:flex-row items-start md:items-center justify-between mb-12 gap-4">
          <motion.div
            initial={{ opacity: 0, x: -50 }}
            whileInView={{ opacity: 1, x: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.6 }}
          >
            <p className="text-sm uppercase tracking-[0.28em] text-cyan-200 mb-2">CINESPHERE STORE</p>
            <h2 className="text-4xl md:text-5xl font-extrabold text-white mb-2">
              <span className="bg-gradient-to-r from-cyan-300 to-blue-400 bg-clip-text text-transparent">
                CINESPHERE
              </span>{' '}
              <span className="bg-gradient-to-r from-purple-400 to-pink-400 bg-clip-text text-transparent">STORE</span>
            </h2>
            <p className="text-lg text-gray-300">Mang trải nghiệm về nhà cùng bạn</p>
          </motion.div>

          <motion.button
            initial={{ opacity: 0, x: 50 }}
            whileInView={{ opacity: 1, x: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.6 }}
            className="text-purple-400 hover:text-purple-300 font-semibold flex items-center gap-2 transition-colors group"
          >
            XEM TẤT CẢ <ArrowRight className="h-5 w-5 group-hover:translate-x-1 transition-transform" />
          </motion.button>
        </div>

        <div className="flex gap-6 overflow-x-auto pb-4 md:pb-0 md:grid md:grid-cols-2 lg:grid-cols-4 md:gap-6 md:overflow-visible snap-x snap-mandatory scrollbar-hide">
          {products.map((product, index) => (
            <motion.div
              key={product.id}
              initial={{ opacity: 0, y: 50 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ duration: 0.6, delay: index * 0.1 }}
              whileHover={{ y: -8 }}
              className="group min-w-[280px] max-w-[300px] md:min-w-0 md:max-w-none snap-start"
            >
              <Card className="bg-white/5 backdrop-blur-md border border-white/10 hover:border-cyan-300/50 transition-all duration-300 overflow-hidden h-full shadow-lg hover:shadow-2xl">
                <div className="relative h-64 overflow-hidden">
                  <motion.img
                    src={optimizeCloudinaryUrl(product.image, 400)}
                    srcSet={generateCloudinarySrcSet(product.image, [300, 400, 600])}
                    sizes="(max-width: 768px) 300px, 400px"
                    alt={product.name}
                    width={300}
                    height={256}
                    loading="lazy"
                    className="w-full h-full object-cover"
                    whileHover={{ scale: 1.15 }}
                    transition={{ duration: 0.5 }}
                  />
                  <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-transparent to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-300" />
                  <div className="absolute top-4 left-4">
                    <span className="px-3 py-1 bg-gradient-to-r from-cyan-500 to-blue-500 text-white text-xs font-semibold rounded-full backdrop-blur-sm border border-white/20">
                      {product.category}
                    </span>
                  </div>
                </div>
                <CardContent className="p-6 bg-gradient-to-b from-white/5 to-transparent">
                  <h3 className="text-xl font-semibold text-white mb-3 group-hover:text-cyan-200 transition-colors">
                    {product.name}
                  </h3>
                  <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
                    <span className="text-2xl md:text-3xl font-bold bg-gradient-to-r from-cyan-300 to-purple-400 bg-clip-text text-transparent">
                      {product.price.toLocaleString('vi-VN')}₫
                    </span>
                    <Button className="bg-gradient-to-r from-purple-500 via-pink-500 to-purple-600 hover:from-purple-600 hover:via-pink-600 hover:to-purple-700 text-white font-semibold shadow-lg hover:shadow-purple-500/50 transition-all duration-300 w-full sm:w-auto">
                      Mua Ngay
                    </Button>
                  </div>
                </CardContent>
              </Card>
            </motion.div>
          ))}
        </div>
      </div>
    </section>
  );
}
