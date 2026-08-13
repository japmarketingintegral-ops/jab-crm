import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  experimental: {
    serverActions: {
      // Default es 1MB — muy poco para adjuntos de pedidos (fotos, PDFs,
      // clips cortos). 25MB cubre eso con margen sobre el límite de 20MB
      // que ya pone la propia action por archivo.
      bodySizeLimit: '25mb',
    },
  },
};

export default nextConfig;
