'use client';

import { createContext, useContext, useEffect, useState } from 'react';

/**
 * 7.10: trang Chi tiet du an thay khoi ten app tren sidebar bang ten du an (dong dam) + ma du an
 * (dong mo). AppShell (client) khong tu lay duoc du lieu du an, nen trang Chi tiet render
 * <SidebarProjectBrand> de day len; roi trang thi component go ra -> sidebar tra lai ten app.
 */
export type ProjectBrand = { name: string; code: string };

type Ctx = { brand: ProjectBrand | null; setBrand: (b: ProjectBrand | null) => void };

const SidebarBrandContext = createContext<Ctx>({ brand: null, setBrand: () => {} });

export function SidebarBrandProvider({ children }: { children: React.ReactNode }) {
  const [brand, setBrand] = useState<ProjectBrand | null>(null);
  return <SidebarBrandContext.Provider value={{ brand, setBrand }}>{children}</SidebarBrandContext.Provider>;
}

export function useSidebarBrand(): ProjectBrand | null {
  return useContext(SidebarBrandContext).brand;
}

export function SidebarProjectBrand({ name, code }: ProjectBrand) {
  const { setBrand } = useContext(SidebarBrandContext);
  useEffect(() => {
    setBrand({ name, code });
    return () => setBrand(null);
  }, [name, code, setBrand]);
  return null;
}
