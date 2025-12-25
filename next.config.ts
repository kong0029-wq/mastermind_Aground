import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  /* config options here */
  output: "export",  // 👈 핵심: GitHub Pages 배포를 위한 정적 내보내기 설정
  images: {
    unoptimized: true, // 👈 핵심: 이미지 최적화 기능 끄기 (배포 에러 방지)
  },
};

export default nextConfig;