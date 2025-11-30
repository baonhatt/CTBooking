import { useEffect, useState } from "react";
import { motion } from "framer-motion";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { ArrowRight } from "lucide-react";
import { getActiveToys } from "@/lib/api";

export default function ProductSection() {
  const [products, setProducts] = useState<any[]>([]);
  useEffect(() => {
    (async () => {
      try {
        const { items } = await getActiveToys();
        setProducts(items.map((t: any) => ({ id: t.id, name: t.name, category: t.category || "TOY", price: Number(t.price), image: t.image_url })));
      } catch {}
    })();
  }, []);
  return (
    <section id="products" className="py-20 bg-gradient-section relative overflow-hidden">
      <div className="container mx-auto px-4 relative z-10">
        <div className="flex items-center justify-between mb-12">
          <motion.div
            initial={{ opacity: 0, x: -50 }}
            whileInView={{ opacity: 1, x: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.6 }}
          >
            <h2 className="text-4xl md:text-5xl font-bold text-white mb-2">
              CINESPHERE STORE
            </h2>
            <p className="text-xl text-gray-300">Mang trải nghiệm về nhà cùng bạn</p>
          </motion.div>
          
          <motion.button
            initial={{ opacity: 0, x: 50 }}
            whileInView={{ opacity: 1, x: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.6 }}
            className="text-purple-400 hover:text-purple-300 font-semibold flex items-center gap-2 transition-colors"
          >
            XEM TẤT CẢ <ArrowRight className="h-5 w-5" />
          </motion.button>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
          {products.map((product, index) => (
            <motion.div
              key={product.id}
              initial={{ opacity: 0, y: 50 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ duration: 0.6, delay: index * 0.1 }}
              whileHover={{ y: -10 }}
              className="group"
            >
              <Card className="bg-black/40 backdrop-blur-sm border border-white/10 hover:border-white/30 transition-all duration-300 overflow-hidden h-full">
                <div className="relative h-64 overflow-hidden">
                  <motion.img
                    src={product.image}
                    alt={product.name}
                    className="w-full h-full object-cover"
                    whileHover={{ scale: 1.1 }}
                    transition={{ duration: 0.3 }}
                  />
                  <div className="absolute top-4 left-4">
                    <span className="px-3 py-1 bg-blue-500 text-white text-xs font-semibold rounded-full">
                      {product.category}
                    </span>
                  </div>
                </div>
                <CardContent className="p-6">
                  <h3 className="text-xl font-semibold text-white mb-2">{product.name}</h3>
                  <div className="flex items-center justify-between">
                    <span className="text-2xl font-bold text-white">
                      {product.price.toLocaleString("vi-VN")}₫
                    </span>
                    <Button className="bg-gradient-to-r from-blue-500 to-purple-500 hover:from-blue-600 hover:to-purple-600 text-white">
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
