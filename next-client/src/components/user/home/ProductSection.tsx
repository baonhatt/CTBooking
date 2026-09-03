'use client';

import { motion } from 'framer-motion';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { ArrowRight, Sparkles } from 'lucide-react';
import { optimizeCloudinaryUrl, generateCloudinarySrcSet } from '@/lib/utils';

export default function ProductSection({ initialProducts = [] }: { initialProducts?: any[] }) {
  const products = initialProducts.map((t: any) => ({
    id: t.id,
    name: t.name,
    category: t.category || 'TOY',
    price: Number(t.price),
    image: t.image_url
  }));

  if (products.length === 0) return null;

  return (
    <section
      id="store"
      className="relative py-20 bg-gradient-to-b from-[#050915] via-[#0b0f24] to-[#030712] overflow-hidden"
    >
      <div className="absolute inset-0 neon-noise opacity-50 pointer-events-none" />
      <div className="absolute -left-10 top-16 w-[550px] h-[550px] rounded-full bg-[radial-gradient(circle,_rgba(147,51,234,0.18)_0%,_transparent_70%)] pointer-events-none" />
      <div className="absolute right-0 bottom-10 w-[550px] h-[550px] rounded-full bg-[radial-gradient(circle,_rgba(6,182,212,0.18)_0%,_transparent_70%)] pointer-events-none" />

      <div className="container mx-auto px-4 relative z-10">
        <div className="flex flex-col md:flex-row items-start md:items-end justify-between mb-12 gap-4">
          <motion.div
            initial={{ opacity: 0, x: -30 }}
            whileInView={{ opacity: 1, x: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.5 }}
            className="space-y-3"
          >
            <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-pink-500/15 border border-pink-500/30 text-pink-300 text-xs font-bold uppercase tracking-widest backdrop-blur-md shadow-[0_0_20px_rgba(236,72,153,0.2)]">
              <Sparkles className="w-4 h-4 text-pink-400" />
              <span>CINESPHERE STORE</span>
            </div>
            <h2 className="text-3xl sm:text-4xl md:text-5xl font-black text-white tracking-tight leading-tight">
              <span className="bg-gradient-to-r from-cyan-300 to-blue-400 bg-clip-text text-transparent">
                CINESPHERE
              </span>{' '}
              <span className="bg-gradient-to-r from-purple-400 to-pink-400 bg-clip-text text-transparent">STORE</span>
            </h2>
            <p className="text-slate-300 text-sm sm:text-base">Mang trải nghiệm về nhà cùng bạn</p>
          </motion.div>

          <motion.button
            initial={{ opacity: 0, x: 30 }}
            whileInView={{ opacity: 1, x: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.5 }}
            className="text-pink-400 hover:text-pink-300 font-bold text-sm uppercase tracking-wider flex items-center gap-2 transition-colors group px-4 py-2 rounded-xl bg-pink-500/10 border border-pink-500/20 hover:border-pink-500/40"
          >
            XEM TẤT CẢ <ArrowRight className="h-4 w-4 group-hover:translate-x-1 transition-transform" />
          </motion.button>
        </div>

        <div className="flex gap-6 overflow-x-auto pb-4 md:pb-0 md:grid md:grid-cols-2 lg:grid-cols-4 md:gap-6 md:overflow-visible snap-x snap-mandatory scrollbar-hide">
          {products.map((product, index) => (
            <motion.div
              key={product.id}
              initial={{ opacity: 0, y: 30 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ duration: 0.45, delay: index * 0.08 }}
              whileHover={{ y: -6 }}
              className="group min-w-[280px] max-w-[300px] md:min-w-0 md:max-w-none snap-start"
            >
              <Card className="bg-slate-900/70 backdrop-blur-xl border border-white/10 hover:border-pink-400/40 hover:shadow-[0_0_35px_rgba(236,72,153,0.2)] transition-all duration-300 overflow-hidden h-full rounded-2xl flex flex-col justify-between">
                <div>
                  <div className="relative h-60 overflow-hidden">
                    <motion.img
                      src={optimizeCloudinaryUrl(product.image, 400)}
                      srcSet={generateCloudinarySrcSet(product.image, [300, 400, 600])}
                      sizes="(max-width: 768px) 300px, 400px"
                      alt={product.name}
                      width={300}
                      height={240}
                      loading="lazy"
                      className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
                    />
                    <div className="absolute inset-0 bg-gradient-to-t from-slate-950/80 via-transparent to-transparent" />
                    <div className="absolute top-3 left-3">
                      <span className="px-2.5 py-1 bg-slate-950/70 backdrop-blur-md text-cyan-300 text-[11px] font-bold rounded-lg border border-cyan-500/30 shadow-md">
                        {product.category}
                      </span>
                    </div>
                  </div>
                  <CardContent className="p-5 space-y-3">
                    <h3 className="text-lg font-bold text-white group-hover:text-pink-200 transition-colors line-clamp-1">
                      {product.name}
                    </h3>
                    <div className="py-2 border-t border-white/10">
                      <span className="text-2xl font-black text-transparent bg-clip-text bg-gradient-to-r from-pink-300 via-fuchsia-300 to-purple-200">
                        {product.price.toLocaleString('vi-VN')}₫
                      </span>
                    </div>
                  </CardContent>
                </div>
                <div className="p-5 pt-0">
                  <Button className="w-full h-10 rounded-xl bg-gradient-to-r from-pink-500 via-fuchsia-600 to-purple-600 hover:from-pink-600 hover:to-purple-700 text-white font-bold text-xs shadow-[0_0_20px_rgba(236,72,153,0.3)] hover:scale-[1.02] active:scale-95 transition-all">
                    Mua Ngay
                  </Button>
                </div>
              </Card>
            </motion.div>
          ))}
        </div>
      </div>
    </section>
  );
}
