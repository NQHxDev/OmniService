'use client';

import React, { useEffect, useState } from 'react';
import Link from 'next/link';
import { useAuth } from '@/lib/auth-context';
import { PackageCheck, Building2, CheckCircle2, XCircle, ArrowRight, TrendingUp } from 'lucide-react';
import { suppliersApi, SupplierItem, productsApi, ProductItem } from '@/lib/api';

export default function DashboardOverviewPage() {
   const { user } = useAuth();
   const [suppliers, setSuppliers] = useState<SupplierItem[]>([]);
   const [loadingSuppliers, setLoadingSuppliers] = useState<boolean>(true);
   const [products, setProducts] = useState<ProductItem[]>([]);
   const [loadingProducts, setLoadingProducts] = useState<boolean>(true);

   useEffect(() => {
      let isMounted = true;
      suppliersApi
         .list({ limit: 10 })
         .then((res) => {
            if (isMounted && res?.data?.items) {
               setSuppliers(res.data.items);
            }
         })
         .catch(() => {
            // Keep fallback or empty
         })
         .finally(() => {
            if (isMounted) setLoadingSuppliers(false);
         });

      productsApi
         .list({ status: 'DRAFT', moderationStatus: 'PENDING_APPROVAL', limit: 20 })
         .then((res) => {
            if (isMounted && res?.data?.items) {
               setProducts(res.data.items);
            }
         })
         .catch(() => {
            // Error handling
         })
         .finally(() => {
            if (isMounted) setLoadingProducts(false);
         });

      return () => {
         isMounted = false;
      };
   }, []);

   const underReviewSuppliers = suppliers.filter((s) => s.supplierStatus === 'UNDER_REVIEW');
   const verifiedSuppliers = suppliers.filter((s) => s.supplierStatus === 'ACTIVE' || s.isVerified);
   const rejectedSuppliers = suppliers.filter((s) => s.supplierStatus === 'REJECTED');

   const pendingProducts = products.filter(
      (p) => p.moderationStatus === 'PENDING_APPROVAL' || p.moderationStatus === 'EDIT_PENDING_APPROVAL',
   );
   const pendingProductsCount = pendingProducts.length;

   const stats = [
      {
         label: 'Sản phẩm chờ duyệt',
         value: loadingProducts ? '...' : String(pendingProductsCount),
         change: `${pendingProductsCount} sản phẩm cần xét duyệt`,
         icon: PackageCheck,
         color: 'text-amber-600 dark:text-amber-400',
         bg: 'bg-amber-50 dark:bg-amber-950/50 border border-amber-200/60 dark:border-amber-800/50',
         href: '/dashboard/products',
      },
      {
         label: 'Hồ sơ Supplier chờ duyệt',
         value: loadingSuppliers ? '...' : String(underReviewSuppliers.length),
         change: `${underReviewSuppliers.length} hồ sơ đã nộp KYB`,
         icon: Building2,
         color: 'text-indigo-600 dark:text-indigo-400',
         bg: 'bg-indigo-50 dark:bg-indigo-950/50 border border-indigo-200/60 dark:border-indigo-800/50',
         href: '/dashboard/suppliers',
      },
      {
         label: 'Supplier đã kích hoạt',
         value: loadingSuppliers ? '...' : String(verifiedSuppliers.length),
         change: 'Đang hoạt động',
         icon: CheckCircle2,
         color: 'text-emerald-600 dark:text-emerald-400',
         bg: 'bg-emerald-50 dark:bg-emerald-950/50 border border-emerald-200/60 dark:border-emerald-800/50',
         href: '/dashboard/suppliers',
      },
      {
         label: 'Yêu cầu từ chối',
         value: loadingSuppliers ? '...' : String(rejectedSuppliers.length),
         change: 'Hồ sơ bị từ chối',
         icon: XCircle,
         color: 'text-rose-600 dark:text-rose-400',
         bg: 'bg-rose-50 dark:bg-rose-950/50 border border-rose-200/60 dark:border-rose-800/50',
         href: '/dashboard/suppliers',
      },
   ];

   return (
      <div className="space-y-8">
         {/* Welcome Banner */}
         <div className="rounded-2xl bg-gradient-to-r from-indigo-700 via-indigo-800 to-slate-900 dark:from-indigo-900 dark:via-indigo-950 dark:to-slate-900 p-8 text-white shadow-xl shadow-indigo-900/10 dark:shadow-indigo-950/40 border border-indigo-600/20">
            <h1 className="text-2xl font-bold">Xin chào, {user?.email?.split('@')[0] || 'Quản trị viên'} 👋</h1>
            <p className="mt-2 text-indigo-100/90 text-sm max-w-2xl">
               Chào mừng bạn quay lại hệ thống quản trị trung tâm OmniServices. Hiện tại có{' '}
               <strong className="text-amber-300">
                  {loadingProducts ? '...' : `${pendingProductsCount} sản phẩm`}
               </strong>{' '}
               và <strong className="text-amber-300">{underReviewSuppliers.length} hồ sơ KYB Nhà cung cấp</strong> đang
               chờ đội kiểm duyệt xử lý.
            </p>
            <div className="mt-6 flex flex-wrap gap-3">
               <Link
                  href="/dashboard/products"
                  className="inline-flex items-center gap-2 rounded-xl bg-white px-4 py-2.5 text-xs font-semibold text-indigo-900 shadow-sm transition hover:bg-indigo-50"
               >
                  <PackageCheck className="h-4 w-4 text-indigo-600" />
                  <span>Xử lý duyệt sản phẩm</span>
               </Link>
               <Link
                  href="/dashboard/suppliers"
                  className="inline-flex items-center gap-2 rounded-xl bg-white/10 px-4 py-2.5 text-xs font-semibold text-white backdrop-blur transition hover:bg-white/20"
               >
                  <Building2 className="h-4 w-4" />
                  <span>Xử lý duyệt Supplier</span>
               </Link>
            </div>
         </div>

         {/* Stats Cards */}
         <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-5">
            {stats.map((stat, i) => {
               const Icon = stat.icon;
               return (
                  <div
                     key={i}
                     className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-6 shadow-sm transition hover:shadow-md dark:hover:border-slate-700"
                  >
                     <div className="flex items-center justify-between">
                        <span className="text-xs font-medium text-slate-500 dark:text-slate-400 uppercase tracking-wider">
                           {stat.label}
                        </span>
                        <div
                           className={`h-10 w-10 rounded-xl ${stat.bg} ${stat.color} flex items-center justify-center`}
                        >
                           <Icon className="h-5 w-5" />
                        </div>
                     </div>
                     <div className="mt-4 flex items-baseline justify-between">
                        <span className="text-3xl font-bold tracking-tight text-slate-900 dark:text-white">
                           {stat.value}
                        </span>
                        <span className="text-xs font-medium text-slate-500 dark:text-slate-400 flex items-center gap-1">
                           <TrendingUp className="h-3.5 w-3.5 text-emerald-500 dark:text-emerald-400" />
                           {stat.change}
                        </span>
                     </div>
                     {stat.href && (
                        <Link
                           href={stat.href}
                           className="mt-4 inline-flex items-center gap-1 text-xs font-semibold text-indigo-600 dark:text-indigo-400 hover:text-indigo-800 dark:hover:text-indigo-300"
                        >
                           <span>Xem danh sách chi tiết</span>
                           <ArrowRight className="h-3 w-3" />
                        </Link>
                     )}
                  </div>
               );
            })}
         </div>

         {/* Quick Action Sections */}
         <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Products Quick Panel */}
            <div className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-6 shadow-sm">
               <div className="flex items-center justify-between pb-4 border-b border-slate-100 dark:border-slate-800">
                  <div className="flex items-center gap-2.5">
                     <PackageCheck className="h-5 w-5 text-indigo-600 dark:text-indigo-400" />
                     <h2 className="text-base font-bold text-slate-900 dark:text-white">Sản phẩm cần duyệt gấp</h2>
                  </div>
                  <Link
                     href="/dashboard/products"
                     className="text-xs font-medium text-indigo-600 dark:text-indigo-400 hover:underline"
                  >
                     Xem tất cả →
                  </Link>
               </div>
               <div className="mt-4 divide-y divide-slate-100 dark:divide-slate-800">
                  {loadingProducts ? (
                     <div className="py-6 text-center text-xs text-slate-400">Đang tải danh sách sản phẩm...</div>
                  ) : pendingProducts.length === 0 ? (
                     <div className="py-6 text-center text-xs text-slate-400">Không có sản phẩm nào chờ duyệt</div>
                  ) : (
                     pendingProducts.slice(0, 4).map((p) => (
                        <div key={p.productId} className="py-3 flex items-center justify-between text-sm">
                           <div>
                              <p className="font-medium text-slate-900 dark:text-slate-100 truncate max-w-xs">
                                 {p.productName}
                              </p>
                              <p className="text-xs text-slate-500 dark:text-slate-400">
                                 {p.supplierName || p.supplierId} • {p.whoCategoryCode}
                              </p>
                           </div>
                           <div className="flex items-center gap-3">
                              <span className="text-xs text-slate-400 dark:text-slate-500">
                                 {p.submittedAt || p.createdAt || 'Mới gửi'}
                              </span>
                              <span className="px-2 py-0.5 rounded-full text-[11px] font-medium bg-amber-50 text-amber-700 border border-amber-200 dark:bg-amber-950/50 dark:text-amber-300 dark:border-amber-800/60">
                                 {p.moderationStatus === 'EDIT_PENDING_APPROVAL' ? 'Duyệt sửa' : 'Chờ duyệt'}
                              </span>
                           </div>
                        </div>
                     ))
                  )}
               </div>
            </div>

            {/* Suppliers Quick Panel */}
            <div className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-6 shadow-sm">
               <div className="flex items-center justify-between pb-4 border-b border-slate-100 dark:border-slate-800">
                  <div className="flex items-center gap-2.5">
                     <Building2 className="h-5 w-5 text-indigo-600 dark:text-indigo-400" />
                     <h2 className="text-base font-bold text-slate-900 dark:text-white">Nhà cung cấp chờ phê duyệt</h2>
                  </div>
                  <Link
                     href="/dashboard/suppliers"
                     className="text-xs font-medium text-indigo-600 dark:text-indigo-400 hover:underline"
                  >
                     Xem tất cả →
                  </Link>
               </div>
               <div className="mt-4 divide-y divide-slate-100 dark:divide-slate-800">
                  {suppliers.slice(0, 4).map((s) => (
                     <div key={s.supplierId} className="py-3 flex items-center justify-between text-sm">
                        <div>
                           <p className="font-medium text-slate-900 dark:text-slate-100">
                              {s.businessName || s.supplierName}
                           </p>
                           <p className="text-xs text-slate-500 dark:text-slate-400">
                              Mã: {s.supplierCode} • MST: {s.taxCode || s.citizenId || 'Chưa nộp'}
                           </p>
                        </div>
                        <div className="flex items-center gap-3">
                           <span className="text-xs text-slate-400 dark:text-slate-500">{s.city || 'Toàn quốc'}</span>
                           {s.supplierStatus === 'UNDER_REVIEW' && (
                              <span className="px-2 py-0.5 rounded-full text-[11px] font-medium bg-amber-50 text-amber-700 border border-amber-200 dark:bg-amber-950/50 dark:text-amber-300 dark:border-amber-800/60">
                                 Chờ duyệt KYB
                              </span>
                           )}
                           {s.supplierStatus === 'PENDING' && (
                              <span className="px-2 py-0.5 rounded-full text-[11px] font-medium bg-sky-50 text-sky-700 border border-sky-200 dark:bg-sky-950/50 dark:text-sky-300 dark:border-sky-800/60">
                                 Chờ nộp
                              </span>
                           )}
                           {s.supplierStatus === 'ACTIVE' && (
                              <span className="px-2 py-0.5 rounded-full text-[11px] font-medium bg-emerald-50 text-emerald-700 border border-emerald-200 dark:bg-emerald-950/50 dark:text-emerald-300 dark:border-emerald-800/60">
                                 Đã duyệt
                              </span>
                           )}
                           {s.supplierStatus === 'REJECTED' && (
                              <span className="px-2 py-0.5 rounded-full text-[11px] font-medium bg-rose-50 text-rose-700 border border-rose-200 dark:bg-rose-950/50 dark:text-rose-300 dark:border-rose-800/60">
                                 Từ chối
                              </span>
                           )}
                        </div>
                     </div>
                  ))}
                  {suppliers.length === 0 && !loadingSuppliers && (
                     <p className="py-6 text-center text-xs text-slate-400 dark:text-slate-500">
                        Không có nhà cung cấp nào.
                     </p>
                  )}
               </div>
            </div>
         </div>
      </div>
   );
}
