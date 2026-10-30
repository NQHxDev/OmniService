'use client';

import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
   Building2,
   Search,
   Filter,
   Check,
   X,
   Eye,
   BadgeCheck,
   RefreshCw,
   AlertCircle,
   FileText,
   CreditCard,
   UserCheck,
   ExternalLink,
   AlertTriangle,
   CheckCircle2,
} from 'lucide-react';
import { suppliersApi, SupplierItem } from '@/lib/api';

const PRESET_REJECTION_REASONS = [
   'Mã số thuế không tồn tại hoặc không khớp trên Tổng cục Thuế',
   'Giấy phép kinh doanh mờ, hết hạn hoặc không hợp lệ',
   'Ảnh CCCD/Hộ chiếu người đại diện không rõ nét hoặc bị cắt góc',
   'Thông tin tài khoản ngân hàng thụ hưởng không trùng khớp với hồ sơ',
];

export default function SupplierApprovalPage() {
   const [suppliers, setSuppliers] = useState<SupplierItem[]>([]);
   const [isLoading, setIsLoading] = useState<boolean>(true);
   const [isRefreshing, setIsRefreshing] = useState<boolean>(false);
   const [error, setError] = useState<string | null>(null);

   const [searchTerm, setSearchTerm] = useState('');
   const [filterStatus, setFilterStatus] = useState<string>('ALL');
   const [selectedSupp, setSelectedSupp] = useState<SupplierItem | null>(null);

   // Reject Modal State
   const [rejectModalSupplier, setRejectModalSupplier] = useState<SupplierItem | null>(null);
   const [rejectReason, setRejectReason] = useState<string>('');
   const [rejectError, setRejectError] = useState<string | null>(null);

   // In-flight action tracking
   const [actionLoadingId, setActionLoadingId] = useState<string | null>(null);

   // Toast notification
   const [toast, setToast] = useState<{ message: string; type: 'success' | 'error' | 'info' } | null>(null);

   const showToast = useCallback((message: string, type: 'success' | 'error' | 'info' = 'success') => {
      setToast({ message, type });
      setTimeout(() => {
         setToast((current) => (current?.message === message ? null : current));
      }, 4500);
   }, []);

   const fetchSuppliers = useCallback(
      async (isManualRefresh = false) => {
         if (isManualRefresh) {
            setIsRefreshing(true);
         } else {
            setIsLoading(true);
         }
         setError(null);

         try {
            const res = await suppliersApi.list({ limit: 100 });
            const list = res.data?.items ?? [];
            setSuppliers(list);
         } catch (err: unknown) {
            const msg = err instanceof Error ? err.message : 'Không thể tải danh sách nhà cung cấp';
            setError(msg);
            showToast(msg, 'error');
         } finally {
            setIsLoading(false);
            setIsRefreshing(false);
         }
      },
      [showToast],
   );

   useEffect(() => {
      void fetchSuppliers();
   }, [fetchSuppliers]);

   // Handle Approve (Verify) via Real API
   const handleApprove = async (supplierId: string) => {
      setActionLoadingId(supplierId);
      try {
         const res = await suppliersApi.verify(supplierId, true);
         const updated = res.data;

         setSuppliers((prev) =>
            prev.map((s) =>
               s.supplierId === supplierId
                  ? {
                       ...s,
                       ...updated,
                       supplierStatus: 'ACTIVE',
                       isVerified: true,
                       verifiedAt: updated?.verifiedAt ?? new Date().toISOString(),
                    }
                  : s,
            ),
         );

         if (selectedSupp?.supplierId === supplierId) {
            setSelectedSupp((prev) =>
               prev
                  ? {
                       ...prev,
                       ...updated,
                       supplierStatus: 'ACTIVE',
                       isVerified: true,
                       verifiedAt: updated?.verifiedAt ?? new Date().toISOString(),
                    }
                  : null,
            );
         }

         showToast('Xác thực và kích hoạt tài khoản nhà cung cấp thành công!', 'success');
      } catch (err: unknown) {
         const msg = err instanceof Error ? err.message : 'Phê duyệt thất bại. Vui lòng kiểm tra quyền Admin.';
         showToast(msg, 'error');
      } finally {
         setActionLoadingId(null);
      }
   };

   // Open Reject Modal
   const openRejectModal = (supplier: SupplierItem) => {
      setRejectModalSupplier(supplier);
      setRejectReason('');
      setRejectError(null);
   };

   // Handle Reject via Real API
   const handleConfirmReject = async () => {
      if (!rejectModalSupplier) return;
      const trimmed = rejectReason.trim();
      if (!trimmed) {
         setRejectError('Vui lòng nhập lý do từ chối hồ sơ');
         return;
      }

      const supplierId = rejectModalSupplier.supplierId;
      setActionLoadingId(supplierId);
      setRejectError(null);

      try {
         const res = await suppliersApi.reject(supplierId, trimmed);
         const updated = res.data;

         setSuppliers((prev) =>
            prev.map((s) =>
               s.supplierId === supplierId
                  ? {
                       ...s,
                       ...updated,
                       supplierStatus: 'REJECTED',
                       isVerified: false,
                       rejectionReason: trimmed,
                    }
                  : s,
            ),
         );

         if (selectedSupp?.supplierId === supplierId) {
            setSelectedSupp((prev) =>
               prev
                  ? {
                       ...prev,
                       ...updated,
                       supplierStatus: 'REJECTED',
                       isVerified: false,
                       rejectionReason: trimmed,
                    }
                  : null,
            );
         }

         showToast(`Đã từ chối hồ sơ nhà cung cấp: ${rejectModalSupplier.supplierName}`, 'info');
         setRejectModalSupplier(null);
         setRejectReason('');
      } catch (err: unknown) {
         const msg = err instanceof Error ? err.message : 'Từ chối thất bại. Vui lòng kiểm tra lại.';
         setRejectError(msg);
         showToast(msg, 'error');
      } finally {
         setActionLoadingId(null);
      }
   };

   // Computed Stats
   const counts = useMemo(() => {
      const underReview = suppliers.filter((s) => s.supplierStatus === 'UNDER_REVIEW').length;
      const pendingSubmission = suppliers.filter((s) => s.supplierStatus === 'PENDING').length;
      const verified = suppliers.filter((s) => s.supplierStatus === 'ACTIVE' || s.isVerified).length;
      const rejected = suppliers.filter((s) => s.supplierStatus === 'REJECTED').length;
      return { underReview, pendingSubmission, verified, rejected, total: suppliers.length };
   }, [suppliers]);

   // Filtered suppliers
   const filtered = useMemo(() => {
      const q = searchTerm.trim().toLowerCase();
      return suppliers.filter((s) => {
         const matchesSearch =
            !q ||
            s.supplierName?.toLowerCase().includes(q) ||
            s.businessName?.toLowerCase().includes(q) ||
            s.taxCode?.toLowerCase().includes(q) ||
            s.supplierCode?.toLowerCase().includes(q) ||
            s.contactEmail?.toLowerCase().includes(q) ||
            s.contactPhone?.toLowerCase().includes(q) ||
            s.bankAccountHolder?.toLowerCase().includes(q);

         let matchesStatus = true;
         if (filterStatus === 'ALL') {
            matchesStatus = true;
         } else if (filterStatus === 'PENDING_GROUP') {
            matchesStatus = s.supplierStatus === 'PENDING' || s.supplierStatus === 'UNDER_REVIEW';
         } else if (filterStatus === 'ACTIVE_GROUP') {
            matchesStatus = s.supplierStatus === 'ACTIVE' || s.isVerified;
         } else {
            matchesStatus = s.supplierStatus === filterStatus;
         }

         return matchesSearch && matchesStatus;
      });
   }, [suppliers, searchTerm, filterStatus]);

   return (
      <div className="space-y-6">
         {/* Toast Alert */}
         {toast && (
            <div
               className={`fixed top-5 right-5 z-50 flex items-center gap-3 px-4 py-3 rounded-2xl shadow-xl border text-xs font-semibold transition-all animate-in fade-in slide-in-from-top-4 ${
                  toast.type === 'success'
                     ? 'bg-emerald-50 border-emerald-200 text-emerald-800'
                     : toast.type === 'error'
                       ? 'bg-rose-50 border-rose-200 text-rose-800'
                       : 'bg-indigo-50 border-indigo-200 text-indigo-800'
               }`}
            >
               {toast.type === 'success' && <CheckCircle2 className="h-4 w-4 text-emerald-600 flex-shrink-0" />}
               {toast.type === 'error' && <AlertCircle className="h-4 w-4 text-rose-600 flex-shrink-0" />}
               {toast.type === 'info' && <AlertTriangle className="h-4 w-4 text-indigo-600 flex-shrink-0" />}
               <span>{toast.message}</span>
               <button onClick={() => setToast(null)} className="ml-2 hover:opacity-75">
                  <X className="h-3.5 w-3.5" />
               </button>
            </div>
         )}

         {/* Header */}
         <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
            <div>
               <h1 className="text-xl font-bold text-slate-900 dark:text-white flex items-center gap-2">
                  <Building2 className="h-6 w-6 text-indigo-600 dark:text-indigo-400" />
                  <span>Quản lý Phê duyệt Nhà cung cấp (Suppliers)</span>
               </h1>
               <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
                  Thẩm định hồ sơ pháp lý, mã số thuế, CCCD đại diện và duyệt kích hoạt merchant store qua API thật.
               </p>
            </div>

            {/* Actions & Status Counts */}
            <div className="flex flex-wrap items-center gap-2">
               <button
                  onClick={() => fetchSuppliers(true)}
                  disabled={isLoading || isRefreshing}
                  title="Làm mới dữ liệu từ hệ thống"
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-white dark:bg-slate-900 text-slate-700 dark:text-slate-200 text-xs font-semibold border border-slate-200 dark:border-slate-800 shadow-sm hover:bg-slate-50 dark:hover:bg-slate-800 transition disabled:opacity-50"
               >
                  <RefreshCw
                     className={`h-3.5 w-3.5 ${isRefreshing ? 'animate-spin text-indigo-600 dark:text-indigo-400' : ''}`}
                  />
                  <span>Làm mới</span>
               </button>

               <span className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-amber-50 text-amber-700 border border-amber-200 dark:bg-amber-950/40 dark:text-amber-300 dark:border-amber-800/60 text-xs font-semibold">
                  <span className="h-2 w-2 rounded-full bg-amber-500 animate-pulse" />
                  <span>Chờ duyệt KYB:</span>
                  <span className="font-bold">{counts.underReview}</span>
               </span>
               <span className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-sky-50 text-sky-700 border border-sky-200 dark:bg-sky-950/40 dark:text-sky-300 dark:border-sky-800/60 text-xs font-semibold">
                  <span>Chờ nộp hồ sơ:</span>
                  <span className="font-bold">{counts.pendingSubmission}</span>
               </span>
               <span className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-emerald-50 text-emerald-700 border border-emerald-200 dark:bg-emerald-950/40 dark:text-emerald-300 dark:border-emerald-800/60 text-xs font-semibold">
                  <span>Đã xác thực:</span>
                  <span className="font-bold">{counts.verified}</span>
               </span>
               <span className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-rose-50 text-rose-700 border border-rose-200 dark:bg-rose-950/40 dark:text-rose-300 dark:border-rose-800/60 text-xs font-semibold">
                  <span>Từ chối:</span>
                  <span className="font-bold">{counts.rejected}</span>
               </span>
            </div>
         </div>

         {/* Error Banner */}
         {error && (
            <div className="flex items-center justify-between p-4 rounded-2xl bg-rose-50 border border-rose-200 dark:bg-rose-950/40 dark:border-rose-900/60 text-rose-700 dark:text-rose-300 text-xs font-medium">
               <div className="flex items-center gap-2">
                  <AlertCircle className="h-4 w-4 text-rose-600 flex-shrink-0" />
                  <span>Lỗi kết nối API: {error}</span>
               </div>
               <button
                  onClick={() => fetchSuppliers()}
                  className="px-3 py-1 rounded-lg bg-rose-600 text-white font-semibold hover:bg-rose-700 transition"
               >
                  Thử lại
               </button>
            </div>
         )}

         {/* Filter and Search Bar */}
         <div className="flex flex-col sm:flex-row items-center justify-between gap-3 bg-white dark:bg-slate-900 p-4 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm">
            <div className="relative w-full sm:w-80">
               <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400 dark:text-slate-500" />
               <input
                  type="text"
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  placeholder="Tìm theo tên DN, MST, mã NCC, SĐT..."
                  className="w-full rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800/70 py-2 pl-10 pr-4 text-xs text-slate-900 dark:text-white placeholder-slate-400 dark:placeholder-slate-500 transition focus:border-indigo-600 focus:bg-white dark:focus:bg-slate-800 focus:outline-none"
               />
            </div>

            <div className="flex items-center gap-2 w-full sm:w-auto">
               <Filter className="h-4 w-4 text-slate-400 dark:text-slate-500" />
               <select
                  value={filterStatus}
                  onChange={(e) => setFilterStatus(e.target.value)}
                  className="rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800/70 py-2 px-3 text-xs text-slate-700 dark:text-slate-200 focus:border-indigo-600 focus:outline-none font-medium"
               >
                  <option value="ALL">Tất cả trạng thái ({counts.total})</option>
                  <option value="UNDER_REVIEW">Chờ duyệt hồ sơ KYB ({counts.underReview})</option>
                  <option value="PENDING">Chờ nộp hồ sơ ({counts.pendingSubmission})</option>
                  <option value="ACTIVE_GROUP">Đã xác minh (Active) ({counts.verified})</option>
                  <option value="REJECTED">Đã từ chối ({counts.rejected})</option>
               </select>
            </div>
         </div>

         {/* Suppliers Table */}
         <div className="overflow-hidden rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 shadow-sm">
            <div className="overflow-x-auto">
               <table className="w-full text-left text-xs">
                  <thead className="border-b border-slate-200 dark:border-slate-800 bg-slate-50/75 dark:bg-slate-800/50 text-slate-500 dark:text-slate-400 font-semibold uppercase tracking-wider">
                     <tr>
                        <th className="px-5 py-3.5">Mã / Nhà cung cấp</th>
                        <th className="px-5 py-3.5">Đại diện / Liên hệ</th>
                        <th className="px-5 py-3.5">Mã số thuế / CCCD</th>
                        <th className="px-5 py-3.5">Khu vực</th>
                        <th className="px-5 py-3.5">Loại hình</th>
                        <th className="px-5 py-3.5">Trạng thái</th>
                        <th className="px-5 py-3.5 text-right">Thao tác</th>
                     </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                     {isLoading ? (
                        <tr>
                           <td colSpan={7} className="py-12 text-center text-slate-400 dark:text-slate-500">
                              <div className="flex flex-col items-center justify-center gap-2">
                                 <RefreshCw className="h-6 w-6 animate-spin text-indigo-600 dark:text-indigo-400" />
                                 <p className="text-xs font-medium text-slate-500 dark:text-slate-400">
                                    Đang tải dữ liệu nhà cung cấp từ hệ thống...
                                 </p>
                              </div>
                           </td>
                        </tr>
                     ) : filtered.length === 0 ? (
                        <tr>
                           <td colSpan={7} className="py-12 text-center text-slate-400 dark:text-slate-500">
                              Không tìm thấy nhà cung cấp nào phù hợp.
                           </td>
                        </tr>
                     ) : (
                        filtered.map((item) => {
                           const canReview = item.supplierStatus === 'UNDER_REVIEW';
                           const isActionLoading = actionLoadingId === item.supplierId;

                           return (
                              <tr
                                 key={item.supplierId}
                                 className="hover:bg-slate-50/80 dark:hover:bg-slate-800/40 transition"
                              >
                                 <td className="px-5 py-4">
                                    <p className="font-semibold text-slate-900 dark:text-slate-100">
                                       {item.businessName || item.supplierName}
                                    </p>
                                    <p className="font-mono text-[11px] text-slate-400 dark:text-slate-500">
                                       Mã: {item.supplierCode} • ID: {item.supplierId.slice(0, 8)}...
                                    </p>
                                 </td>
                                 <td className="px-5 py-4">
                                    <p className="font-medium text-slate-800 dark:text-slate-200">
                                       {item.bankAccountHolder || item.supplierName}
                                    </p>
                                    <p className="text-[11px] text-slate-500 dark:text-slate-400">
                                       {item.contactPhone || item.contactEmail || 'Chưa cập nhật'}
                                    </p>
                                 </td>
                                 <td className="px-5 py-4">
                                    <p className="font-mono font-semibold text-slate-700 dark:text-slate-300">
                                       {item.taxCode || item.citizenId || '---'}
                                    </p>
                                    {item.taxCode && item.citizenId && (
                                       <p className="font-mono text-[10px] text-slate-400 dark:text-slate-500">
                                          CCCD: {item.citizenId}
                                       </p>
                                    )}
                                 </td>
                                 <td className="px-5 py-4 text-slate-600 dark:text-slate-400">
                                    {item.city || 'Toàn quốc'}
                                 </td>
                                 <td className="px-5 py-4">
                                    <span className="inline-block px-2 py-0.5 rounded text-[10px] font-semibold bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-300">
                                       {item.merchantType === 'ENTERPRISE' ? 'Doanh nghiệp' : 'Cá nhân / Hộ KD'}
                                    </span>
                                 </td>
                                 <td className="px-5 py-4">
                                    {item.supplierStatus === 'UNDER_REVIEW' && (
                                       <span className="inline-flex items-center gap-1 rounded-full bg-amber-50 text-amber-700 border border-amber-200 dark:bg-amber-950/50 dark:text-amber-300 dark:border-amber-800/60 px-2.5 py-1 text-[11px] font-semibold">
                                          <span className="h-1.5 w-1.5 rounded-full bg-amber-500 animate-pulse" />
                                          Chờ duyệt KYB
                                       </span>
                                    )}
                                    {item.supplierStatus === 'PENDING' && (
                                       <span className="inline-flex items-center gap-1 rounded-full bg-sky-50 text-sky-700 border border-sky-200 dark:bg-sky-950/50 dark:text-sky-300 dark:border-sky-800/60 px-2.5 py-1 text-[11px] font-semibold">
                                          <span className="h-1.5 w-1.5 rounded-full bg-sky-500" />
                                          Chờ nộp hồ sơ
                                       </span>
                                    )}
                                    {(item.supplierStatus === 'ACTIVE' || item.isVerified) && (
                                       <span className="inline-flex items-center gap-1 rounded-full bg-emerald-50 text-emerald-700 border border-emerald-200 dark:bg-emerald-950/50 dark:text-emerald-300 dark:border-emerald-800/60 px-2.5 py-1 text-[11px] font-semibold">
                                          <BadgeCheck className="h-3.5 w-3.5 text-emerald-600 dark:text-emerald-400" />
                                          Đã xác minh
                                       </span>
                                    )}
                                    {item.supplierStatus === 'REJECTED' && (
                                       <span className="inline-flex items-center gap-1 rounded-full bg-rose-50 text-rose-700 border border-rose-200 dark:bg-rose-950/50 dark:text-rose-300 dark:border-rose-800/60 px-2.5 py-1 text-[11px] font-semibold">
                                          <span className="h-1.5 w-1.5 rounded-full bg-rose-500" />
                                          Từ chối
                                       </span>
                                    )}
                                    {item.supplierStatus === 'SUSPENDED' && (
                                       <span className="inline-flex items-center gap-1 rounded-full bg-slate-100 text-slate-700 border border-slate-200 dark:bg-slate-800 dark:text-slate-300 dark:border-slate-700 px-2.5 py-1 text-[11px] font-semibold">
                                          Tạm ngưng
                                       </span>
                                    )}
                                 </td>
                                 <td className="px-5 py-4 text-right">
                                    <div className="flex items-center justify-end gap-1.5">
                                       {canReview && (
                                          <>
                                             <button
                                                onClick={() => handleApprove(item.supplierId)}
                                                disabled={isActionLoading}
                                                title="Xác minh & Kích hoạt tài khoản qua API thật"
                                                className="flex h-8 w-8 items-center justify-center rounded-lg bg-emerald-50 text-emerald-600 hover:bg-emerald-100 dark:bg-emerald-950/50 dark:text-emerald-400 dark:hover:bg-emerald-900/50 transition disabled:opacity-50"
                                             >
                                                {isActionLoading ? (
                                                   <RefreshCw className="h-3.5 w-3.5 animate-spin" />
                                                ) : (
                                                   <Check className="h-4 w-4" />
                                                )}
                                             </button>
                                             <button
                                                onClick={() => openRejectModal(item)}
                                                disabled={isActionLoading}
                                                title="Từ chối hồ sơ kèm lý do"
                                                className="flex h-8 w-8 items-center justify-center rounded-lg bg-rose-50 text-rose-600 hover:bg-rose-100 dark:bg-rose-950/50 dark:text-rose-400 dark:hover:bg-rose-900/50 transition disabled:opacity-50"
                                             >
                                                <X className="h-4 w-4" />
                                             </button>
                                          </>
                                       )}
                                       <button
                                          onClick={() => setSelectedSupp(item)}
                                          title="Xem chi tiết hồ sơ pháp lý & KYB"
                                          className="flex h-8 w-8 items-center justify-center rounded-lg border border-slate-200 dark:border-slate-700 text-slate-500 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-slate-800 transition"
                                       >
                                          <Eye className="h-4 w-4" />
                                       </button>
                                    </div>
                                 </td>
                              </tr>
                           );
                        })
                     )}
                  </tbody>
               </table>
            </div>
         </div>

         {/* Supplier Detail Dossier Modal */}
         {selectedSupp && (
            <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 dark:bg-black/70 p-4 backdrop-blur-sm overflow-y-auto">
               <div className="w-full max-w-2xl rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 p-6 shadow-2xl space-y-5 my-8">
                  <div className="flex items-start justify-between">
                     <div>
                        <div className="flex items-center gap-2">
                           <span className="text-xs font-mono text-indigo-600 dark:text-indigo-400 uppercase font-semibold">
                              Hồ sơ nhà cung cấp • {selectedSupp.supplierCode}
                           </span>
                           {selectedSupp.isVerified && (
                              <span className="inline-flex items-center gap-1 rounded-full bg-emerald-50 dark:bg-emerald-950/50 px-2 py-0.5 text-[10px] font-bold text-emerald-700 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800/60">
                                 <BadgeCheck className="h-3 w-3 text-emerald-600 dark:text-emerald-400" />
                                 ĐÃ XÁC MINH
                              </span>
                           )}
                           {selectedSupp.supplierStatus === 'UNDER_REVIEW' && (
                              <span className="inline-flex items-center gap-1 rounded-full bg-amber-50 dark:bg-amber-950/50 px-2 py-0.5 text-[10px] font-bold text-amber-700 dark:text-amber-300 border border-amber-200 dark:border-amber-800/60">
                                 CHỜ DUYỆT KYB
                              </span>
                           )}
                        </div>
                        <h3 className="text-lg font-bold text-slate-900 dark:text-white mt-1">
                           {selectedSupp.businessName || selectedSupp.supplierName}
                        </h3>
                        <p className="text-xs text-slate-500 dark:text-slate-400">UUID: {selectedSupp.supplierId}</p>
                     </div>
                     <button
                        onClick={() => setSelectedSupp(null)}
                        className="h-8 w-8 rounded-lg text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 flex items-center justify-center"
                     >
                        <X className="h-4 w-4" />
                     </button>
                  </div>

                  {/* Legal & Business Dossier Grid */}
                  <div className="space-y-4">
                     <div className="border border-slate-100 dark:border-slate-800 rounded-xl p-4 bg-slate-50/60 dark:bg-slate-800/50 space-y-3">
                        <h4 className="text-xs font-bold text-slate-800 dark:text-slate-200 flex items-center gap-1.5 uppercase tracking-wider">
                           <Building2 className="h-4 w-4 text-indigo-600 dark:text-indigo-400" />
                           <span>Thông tin đăng ký kinh doanh</span>
                        </h4>
                        <div className="grid grid-cols-2 gap-3 text-xs">
                           <div>
                              <p className="text-slate-500 dark:text-slate-400">Tên doanh nghiệp / Gian hàng:</p>
                              <p className="font-semibold text-slate-800 dark:text-slate-200">
                                 {selectedSupp.businessName || selectedSupp.supplierName}
                              </p>
                           </div>
                           <div>
                              <p className="text-slate-500 dark:text-slate-400">Mã số thuế (MST):</p>
                              <p className="font-semibold font-mono text-slate-800 dark:text-slate-200">
                                 {selectedSupp.taxCode || 'Chưa cung cấp'}
                              </p>
                           </div>
                           <div>
                              <p className="text-slate-500 dark:text-slate-400">Mô hình kinh doanh:</p>
                              <p className="font-semibold text-slate-800 dark:text-slate-200">
                                 {selectedSupp.merchantType === 'ENTERPRISE' ? 'Doanh nghiệp' : 'Cá nhân / Hộ KD'}
                              </p>
                           </div>
                           <div>
                              <p className="text-slate-500 dark:text-slate-400">Giấy phép ĐKKD:</p>
                              {selectedSupp.businessLicenseUrl ? (
                                 <a
                                    href={selectedSupp.businessLicenseUrl}
                                    target="_blank"
                                    rel="noreferrer"
                                    className="font-semibold text-indigo-600 dark:text-indigo-400 hover:underline flex items-center gap-1"
                                 >
                                    <FileText className="h-3.5 w-3.5" />
                                    <span>Xem tài liệu PDF/Ảnh</span>
                                    <ExternalLink className="h-3 w-3" />
                                 </a>
                              ) : (
                                 <p className="text-slate-400 dark:text-slate-500 italic">Chưa tải lên</p>
                              )}
                           </div>
                        </div>
                     </div>

                     <div className="border border-slate-100 dark:border-slate-800 rounded-xl p-4 bg-slate-50/60 dark:bg-slate-800/50 space-y-3">
                        <h4 className="text-xs font-bold text-slate-800 dark:text-slate-200 flex items-center gap-1.5 uppercase tracking-wider">
                           <UserCheck className="h-4 w-4 text-indigo-600 dark:text-indigo-400" />
                           <span>Người đại diện & Định danh CCCD</span>
                        </h4>
                        <div className="grid grid-cols-2 gap-3 text-xs">
                           <div>
                              <p className="text-slate-500 dark:text-slate-400">Số CCCD / CMND / Hộ chiếu:</p>
                              <p className="font-semibold font-mono text-slate-800 dark:text-slate-200">
                                 {selectedSupp.citizenId || 'Chưa cung cấp'}
                              </p>
                           </div>
                           <div>
                              <p className="text-slate-500 dark:text-slate-400">Ngày cấp CCCD:</p>
                              <p className="font-semibold text-slate-800 dark:text-slate-200">
                                 {selectedSupp.citizenIdIssuedDate
                                    ? new Date(selectedSupp.citizenIdIssuedDate).toLocaleDateString('vi-VN')
                                    : '---'}
                              </p>
                           </div>
                           <div className="col-span-2">
                              <p className="text-slate-500 dark:text-slate-400 mb-1">
                                 Ảnh định danh CCCD mặt trước & mặt sau:
                              </p>
                              <div className="grid grid-cols-2 gap-2">
                                 {selectedSupp.idCardFrontUrl ? (
                                    <a
                                       href={selectedSupp.idCardFrontUrl}
                                       target="_blank"
                                       rel="noreferrer"
                                       className="p-2 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 hover:border-indigo-400 flex items-center gap-2 text-indigo-600 dark:text-indigo-400"
                                    >
                                       <ExternalLink className="h-3.5 w-3.5" />
                                       <span>Xem ảnh mặt trước</span>
                                    </a>
                                 ) : (
                                    <div className="p-2 rounded-lg border border-slate-200 dark:border-slate-800 bg-slate-100 dark:bg-slate-800/40 text-slate-400 dark:text-slate-500 text-center">
                                       Chưa có mặt trước
                                    </div>
                                 )}
                                 {selectedSupp.idCardBackUrl ? (
                                    <a
                                       href={selectedSupp.idCardBackUrl}
                                       target="_blank"
                                       rel="noreferrer"
                                       className="p-2 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 hover:border-indigo-400 flex items-center gap-2 text-indigo-600 dark:text-indigo-400"
                                    >
                                       <ExternalLink className="h-3.5 w-3.5" />
                                       <span>Xem ảnh mặt sau</span>
                                    </a>
                                 ) : (
                                    <div className="p-2 rounded-lg border border-slate-200 dark:border-slate-800 bg-slate-100 dark:bg-slate-800/40 text-slate-400 dark:text-slate-500 text-center">
                                       Chưa có mặt sau
                                    </div>
                                 )}
                              </div>
                           </div>
                        </div>
                     </div>

                     <div className="border border-slate-100 dark:border-slate-800 rounded-xl p-4 bg-slate-50/60 dark:bg-slate-800/50 space-y-3">
                        <h4 className="text-xs font-bold text-slate-800 dark:text-slate-200 flex items-center gap-1.5 uppercase tracking-wider">
                           <CreditCard className="h-4 w-4 text-indigo-600 dark:text-indigo-400" />
                           <span>Tài khoản ngân hàng & Thanh toán</span>
                        </h4>
                        <div className="grid grid-cols-3 gap-3 text-xs">
                           <div>
                              <p className="text-slate-500 dark:text-slate-400">Ngân hàng:</p>
                              <p className="font-semibold text-slate-800 dark:text-slate-200">
                                 {selectedSupp.bankName || 'Chưa cung cấp'}
                              </p>
                           </div>
                           <div>
                              <p className="text-slate-500 dark:text-slate-400">Số tài khoản:</p>
                              <p className="font-semibold font-mono text-slate-800 dark:text-slate-200">
                                 {selectedSupp.bankAccountNumber || 'Chưa cung cấp'}
                              </p>
                           </div>
                           <div>
                              <p className="text-slate-500 dark:text-slate-400">Chủ tài khoản:</p>
                              <p className="font-semibold text-slate-800 dark:text-slate-200">
                                 {selectedSupp.bankAccountHolder || 'Chưa cung cấp'}
                              </p>
                           </div>
                        </div>
                     </div>

                     <div className="border border-slate-100 dark:border-slate-800 rounded-xl p-4 bg-slate-50/60 dark:bg-slate-800/50 space-y-3">
                        <h4 className="text-xs font-bold text-slate-800 dark:text-slate-200 flex items-center gap-1.5 uppercase tracking-wider">
                           <span>Liên hệ & Địa chỉ đặt trụ sở</span>
                        </h4>
                        <div className="grid grid-cols-2 gap-3 text-xs">
                           <div>
                              <p className="text-slate-500 dark:text-slate-400">Email liên hệ:</p>
                              <p className="font-semibold text-slate-800 dark:text-slate-200">
                                 {selectedSupp.contactEmail || 'Chưa cung cấp'}
                              </p>
                           </div>
                           <div>
                              <p className="text-slate-500 dark:text-slate-400">Hotline / SĐT:</p>
                              <p className="font-semibold text-slate-800 dark:text-slate-200">
                                 {selectedSupp.contactPhone || 'Chưa cung cấp'}
                              </p>
                           </div>
                           <div className="col-span-2">
                              <p className="text-slate-500 dark:text-slate-400">Địa chỉ / Khu vực:</p>
                              <p className="font-semibold text-slate-800 dark:text-slate-200">
                                 {selectedSupp.address ? `${selectedSupp.address}, ` : ''}
                                 {selectedSupp.city || 'Chưa cập nhật'}
                              </p>
                           </div>
                        </div>
                     </div>

                     {/* Rejection / Verified Remarks */}
                     {selectedSupp.rejectionReason && (
                        <div className="p-3.5 rounded-xl bg-rose-50 border border-rose-200 dark:bg-rose-950/40 dark:border-rose-900/60 text-xs text-rose-800 dark:text-rose-300 space-y-1">
                           <p className="font-bold flex items-center gap-1.5">
                              <AlertCircle className="h-4 w-4 text-rose-600 dark:text-rose-400" />
                              <span>Lý do từ chối trước đó:</span>
                           </p>
                           <p className="text-rose-700 dark:text-rose-300 pl-5.5">{selectedSupp.rejectionReason}</p>
                        </div>
                     )}

                     {selectedSupp.verifiedAt && (
                        <div className="p-3 rounded-xl bg-emerald-50 border border-emerald-200 dark:bg-emerald-950/40 dark:border-emerald-800/60 text-xs text-emerald-800 dark:text-emerald-300">
                           <span className="font-semibold">Đã xác thực vào lúc: </span>
                           <span>{new Date(selectedSupp.verifiedAt).toLocaleString('vi-VN')}</span>
                        </div>
                     )}
                  </div>

                  {selectedSupp.supplierStatus === 'PENDING' && (
                     <div className="p-3.5 rounded-xl bg-sky-50 border border-sky-200 dark:bg-sky-950/40 dark:border-sky-800/60 text-xs text-sky-800 dark:text-sky-300 flex items-start gap-2.5">
                        <AlertCircle className="h-4 w-4 text-sky-600 dark:text-sky-400 flex-shrink-0 mt-0.5" />
                        <div>
                           <p className="font-bold">Chưa nộp hồ sơ định danh (KYB)</p>
                           <p className="text-sky-700 dark:text-sky-300 text-[11px] mt-0.5">
                              Nhà cung cấp mới đăng ký tài khoản cơ bản và chưa gửi tài liệu pháp lý (CCCD, GPĐKKD, tài
                              khoản ngân hàng). Chỉ có thể phê duyệt sau khi đối tác đã hoàn thành nộp hồ sơ.
                           </p>
                        </div>
                     </div>
                  )}

                  {/* Modal Footer Actions */}
                  <div className="flex justify-end gap-2 pt-3 border-t border-slate-100 dark:border-slate-800">
                     <button
                        onClick={() => setSelectedSupp(null)}
                        className="px-4 py-2 rounded-xl text-xs font-semibold text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800"
                     >
                        Đóng
                     </button>
                     {selectedSupp.supplierStatus === 'UNDER_REVIEW' && (
                        <>
                           <button
                              onClick={() => openRejectModal(selectedSupp)}
                              disabled={actionLoadingId === selectedSupp.supplierId}
                              className="px-4 py-2 rounded-xl text-xs font-semibold text-rose-600 dark:text-rose-400 bg-rose-50 dark:bg-rose-950/40 hover:bg-rose-100 dark:hover:bg-rose-900/50 disabled:opacity-50"
                           >
                              Từ chối hồ sơ
                           </button>
                           <button
                              onClick={() => handleApprove(selectedSupp.supplierId)}
                              disabled={actionLoadingId === selectedSupp.supplierId}
                              className="px-4 py-2 rounded-xl text-xs font-semibold text-white bg-indigo-600 hover:bg-indigo-700 shadow-sm flex items-center gap-1.5 disabled:opacity-50"
                           >
                              {actionLoadingId === selectedSupp.supplierId ? (
                                 <>
                                    <RefreshCw className="h-3.5 w-3.5 animate-spin" />
                                    <span>Đang xác minh...</span>
                                 </>
                              ) : (
                                 <>
                                    <Check className="h-3.5 w-3.5" />
                                    <span>Xác minh & Kích hoạt tài khoản</span>
                                 </>
                              )}
                           </button>
                        </>
                     )}
                  </div>
               </div>
            </div>
         )}

         {/* Reject Reason Dialog Modal */}
         {rejectModalSupplier && (
            <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 dark:bg-black/70 p-4 backdrop-blur-sm">
               <div className="w-full max-w-md rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 p-6 shadow-2xl space-y-4">
                  <div className="flex items-start justify-between">
                     <div>
                        <span className="text-xs font-mono text-rose-600 dark:text-rose-400 uppercase font-semibold">
                           Từ chối xác thực hồ sơ
                        </span>
                        <h3 className="text-base font-bold text-slate-900 dark:text-white mt-1">
                           {rejectModalSupplier.businessName || rejectModalSupplier.supplierName}
                        </h3>
                     </div>
                     <button
                        onClick={() => setRejectModalSupplier(null)}
                        className="h-8 w-8 rounded-lg text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 flex items-center justify-center"
                     >
                        <X className="h-4 w-4" />
                     </button>
                  </div>

                  <p className="text-xs text-slate-500 dark:text-slate-400">
                     Nhà cung cấp sẽ nhận được thông báo về lý do từ chối này để chỉnh sửa và bổ sung hồ sơ KYB.
                  </p>

                  {/* Preset Quick Chips */}
                  <div className="space-y-1.5">
                     <p className="text-[11px] font-semibold text-slate-600 dark:text-slate-300">Lý do thường gặp:</p>
                     <div className="flex flex-wrap gap-1.5">
                        {PRESET_REJECTION_REASONS.map((reason) => (
                           <button
                              key={reason}
                              type="button"
                              onClick={() => {
                                 setRejectReason(reason);
                                 setRejectError(null);
                              }}
                              className="text-[11px] px-2.5 py-1 rounded-lg bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 hover:bg-indigo-50 dark:hover:bg-indigo-950/60 hover:text-indigo-700 dark:hover:text-indigo-300 transition text-left"
                           >
                              {reason}
                           </button>
                        ))}
                     </div>
                  </div>

                  {/* Textarea */}
                  <div className="space-y-1.5">
                     <label className="text-xs font-semibold text-slate-700 dark:text-slate-300">
                        Lý do từ chối cụ thể *
                     </label>
                     <textarea
                        value={rejectReason}
                        onChange={(e) => {
                           setRejectReason(e.target.value);
                           if (rejectError) setRejectError(null);
                        }}
                        rows={3}
                        maxLength={500}
                        placeholder="Nhập chi tiết các mục hồ sơ không đạt yêu cầu..."
                        className="w-full rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800/70 p-3 text-xs text-slate-900 dark:text-white placeholder-slate-400 dark:placeholder-slate-500 focus:border-rose-600 focus:bg-white dark:focus:bg-slate-800 focus:outline-none"
                     />
                     <div className="flex justify-between text-[11px] text-slate-400 dark:text-slate-500">
                        {rejectError ? (
                           <span className="text-rose-600 dark:text-rose-400 font-semibold">{rejectError}</span>
                        ) : (
                           <span>Tối đa 500 ký tự</span>
                        )}
                        <span>{rejectReason.length}/500</span>
                     </div>
                  </div>

                  {/* Modal Footer */}
                  <div className="flex justify-end gap-2 pt-2 border-t border-slate-100 dark:border-slate-800">
                     <button
                        onClick={() => setRejectModalSupplier(null)}
                        disabled={actionLoadingId === rejectModalSupplier.supplierId}
                        className="px-4 py-2 rounded-xl text-xs font-semibold text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800"
                     >
                        Hủy
                     </button>
                     <button
                        onClick={handleConfirmReject}
                        disabled={actionLoadingId === rejectModalSupplier.supplierId}
                        className="px-4 py-2 rounded-xl text-xs font-semibold text-white bg-rose-600 hover:bg-rose-700 shadow-sm flex items-center gap-1.5 disabled:opacity-50"
                     >
                        {actionLoadingId === rejectModalSupplier.supplierId ? (
                           <>
                              <RefreshCw className="h-3.5 w-3.5 animate-spin" />
                              <span>Đang xử lý...</span>
                           </>
                        ) : (
                           <span>Xác nhận từ chối</span>
                        )}
                     </button>
                  </div>
               </div>
            </div>
         )}
      </div>
   );
}
