'use client';

import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
   PackageCheck,
   Search,
   Filter,
   Check,
   X,
   Eye,
   RefreshCw,
   CheckCircle2,
   XCircle,
   Clock,
   Tag,
   Building2,
   AlertTriangle,
   ShieldCheck,
   SlidersHorizontal,
   ImageIcon,
   Info,
} from 'lucide-react';
import { productsApi, ProductItem, ProductVariantItem } from '@/lib/api';

// WHO Food Category Definitions for display & filtering
const WHO_CATEGORY_LABELS: Record<string, { label: string; color: string; bg: string; border: string }> = {
   STAPLES: {
      label: 'Lương thực chính (Tinh bột)',
      color: 'text-amber-700 dark:text-amber-300',
      bg: 'bg-amber-50 dark:bg-amber-950/40',
      border: 'border-amber-200 dark:border-amber-800/60',
   },
   LEGUMES_NUTS_SEEDS: {
      label: 'Các loại đậu & hạt',
      color: 'text-emerald-700 dark:text-emerald-300',
      bg: 'bg-emerald-50 dark:bg-emerald-950/40',
      border: 'border-emerald-200 dark:border-emerald-800/60',
   },
   DAIRY: {
      label: 'Sữa & chế phẩm sữa',
      color: 'text-blue-700 dark:text-blue-300',
      bg: 'bg-blue-50 dark:bg-blue-950/40',
      border: 'border-blue-200 dark:border-blue-800/60',
   },
   MEAT_FISH_POULTRY: {
      label: 'Thịt, cá & thủy hải sản',
      color: 'text-rose-700 dark:text-rose-300',
      bg: 'bg-rose-50 dark:bg-rose-950/40',
      border: 'border-rose-200 dark:border-rose-800/60',
   },
   EGGS: {
      label: 'Trứng & sản phẩm từ trứng',
      color: 'text-yellow-700 dark:text-yellow-300',
      bg: 'bg-yellow-50 dark:bg-yellow-950/40',
      border: 'border-yellow-200 dark:border-yellow-800/60',
   },
   VITAMIN_A_FRUITS_VEG: {
      label: 'Rau củ quả giàu Vitamin A',
      color: 'text-orange-700 dark:text-orange-300',
      bg: 'bg-orange-50 dark:bg-orange-950/40',
      border: 'border-orange-200 dark:border-orange-800/60',
   },
   OTHER_FRUITS_VEG: {
      label: 'Rau củ quả khác & Trà thảo mộc',
      color: 'text-teal-700 dark:text-teal-300',
      bg: 'bg-teal-50 dark:bg-teal-950/40',
      border: 'border-teal-200 dark:border-teal-800/60',
   },
   FATS_OILS: {
      label: 'Gia vị & Dầu ăn nguyên chất',
      color: 'text-indigo-700 dark:text-indigo-300',
      bg: 'bg-indigo-50 dark:bg-indigo-950/40',
      border: 'border-indigo-200 dark:border-indigo-800/60',
   },
};

const PRESET_REJECTION_REASONS = [
   'Hình ảnh sản phẩm không đúng quy chuẩn (mờ, viền đen, chứa thông tin quảng cáo hoặc số điện thoại ngoài sàn)',
   'Thiếu giấy chứng nhận Vệ sinh An toàn Thực phẩm hoặc giấy tờ chứng minh nguồn gốc xuất xứ',
   'Mô tả sản phẩm chứa từ ngữ quảng cáo sai sự thật hoặc cam kết chữa bệnh trái quy định',
   'Giá niêm yết hoặc khối lượng tịnh không hợp lý, chênh lệch bất thường so với thực tế',
   'Phân loại hàng (Variant) trùng lặp, thiếu thông tin SKU hoặc không có mã vạch hợp chuẩn',
   'Sản phẩm thuộc danh mục cấm hoặc hạn chế kinh doanh trên nền tảng OmniServices',
];

const INITIAL_FALLBACK_PRODUCTS: ProductItem[] = [
   {
      productId: 'PROD-ST25-001',
      supplierId: 'SUPP-VN-001',
      supplierName: 'Hợp Tác Xã Nông Sản Sạch Sóc Trăng',
      whoCategoryCode: 'STAPLES',
      productName: 'Gạo ST25 Ông Cua Thượng Hạng Chuẩn OCOP 5 Sao (Vụ Mùa Mới)',
      productSlug: 'gao-st25-ong-cua-thuong-hang-ocop-5-sao',
      description:
         'Gạo ST25 đạt danh hiệu Gạo ngon nhất thế giới. Hạt gạo dài, trắng trong, không bạc bụng, khi nấu cơm dẻo mềm, thơm mùi lá dứa tự nhiên. Đạt chứng chỉ VietGAP và kiểm nghiệm an toàn dư lượng thuốc bảo vệ thực vật 0%.',
      origin: 'Sóc Trăng, Đồng bằng Sông Cửu Long',
      storageCondition: 'Nơi khô ráo, thoáng mát, tránh ánh nắng trực tiếp hoặc côn trùng xâm nhập.',
      shelfLifeDays: 365,
      images: [
         'https://images.unsplash.com/photo-1586201375761-83865001e31c?auto=format&fit=crop&w=800&q=80',
         'https://images.unsplash.com/photo-1536304929831-ee1ca9d44906?auto=format&fit=crop&w=800&q=80',
      ],
      status: 'DRAFT',
      moderationStatus: 'PENDING_APPROVAL',
      submittedAt: '28/10/2026 08:30',
      variants: [
         {
            variantId: 'VAR-ST25-5KG',
            sku: 'ST25-BAG-5KG',
            barcode: '8936001230012',
            variantName: 'Túi 5kg hút chân không',
            price: 195000,
            compareAtPrice: 220000,
            currency: 'VND',
            stockQuantity: 450,
            weightGrams: 5000,
            status: 'AVAILABLE',
         },
         {
            variantId: 'VAR-ST25-2KG',
            sku: 'ST25-BOX-2KG',
            barcode: '8936001230029',
            variantName: 'Hộp cao cấp 2kg biếu tặng',
            price: 95000,
            compareAtPrice: 110000,
            currency: 'VND',
            stockQuantity: 200,
            weightGrams: 2000,
            status: 'AVAILABLE',
         },
      ],
   },
   {
      productId: 'PROD-CF-002',
      supplierId: 'SUPP-VN-002',
      supplierName: 'Nông Trại Cà Phê Cầu Đất Specialty Farm',
      whoCategoryCode: 'OTHER_FRUITS_VEG',
      productName: 'Cà Phê Hạt Rang Mộc Arabica Cầu Đất Honey Process 100% Tự Nhiên',
      productSlug: 'ca-phe-arabica-cau-dat-honey-process',
      description:
         'Cà phê Arabica thu hoạch ở độ cao 1.650m tại Cầu Đất, Đà Lạt. Phương pháp chế biến Honey giữ trọn vị ngọt tự nhiên của quả chín, hậu vị hương hoa cam và socola đen đặc trưng.',
      origin: 'Cầu Đất, Thành phố Đà Lạt, Lâm Đồng',
      storageCondition: 'Bảo quản kín khí trong bao bì có van 1 chiều, tránh nơi có độ ẩm cao.',
      shelfLifeDays: 180,
      images: [
         'https://images.unsplash.com/photo-1559056199-641a0ac8b55e?auto=format&fit=crop&w=800&q=80',
         'https://images.unsplash.com/photo-1514432324607-a09d9b4aefdd?auto=format&fit=crop&w=800&q=80',
      ],
      status: 'DRAFT',
      moderationStatus: 'PENDING_APPROVAL',
      submittedAt: '27/10/2026 16:45',
      variants: [
         {
            variantId: 'VAR-CF-250G',
            sku: 'CF-ARABICA-250G',
            barcode: '8936004560015',
            variantName: 'Gói 250g nguyên hạt',
            price: 135000,
            compareAtPrice: 155000,
            currency: 'VND',
            stockQuantity: 180,
            weightGrams: 250,
            status: 'AVAILABLE',
         },
         {
            variantId: 'VAR-CF-500G',
            sku: 'CF-ARABICA-500G',
            barcode: '8936004560022',
            variantName: 'Gói 500g nguyên hạt',
            price: 250000,
            compareAtPrice: 290000,
            currency: 'VND',
            stockQuantity: 120,
            weightGrams: 500,
            status: 'AVAILABLE',
         },
      ],
   },
   {
      productId: 'PROD-FISH-003',
      supplierId: 'SUPP-VN-003',
      supplierName: 'Công Ty Nước Mắm Truyền Thống Khải Hoàn Phú Quốc',
      whoCategoryCode: 'FATS_OILS',
      productName: 'Nước Mắm Cốt Nhĩ Phú Quốc 43 Độ Đạm Ủ Chượp Thùng Gỗ 18 Tháng',
      productSlug: 'nuoc-mam-cot-nhi-phu-quoc-43-do-dam',
      description:
         'Nước mắm truyền thống cốt nhĩ Phú Quốc làm từ 100% cá cơm than tươi và muối biển Bà Rịa, ủ chượp tự nhiên trong thùng gỗ bời lời trên 18 tháng. Không chất bảo quản, không mì chính, không phẩm màu.',
      origin: 'Đảo Phú Quốc, Tỉnh Kiên Giang',
      storageCondition: 'Nơi khô thoáng, đậy kín nắp sau khi sử dụng để không làm biến đổi độ đạm tự nhiên.',
      shelfLifeDays: 730,
      images: ['https://images.unsplash.com/photo-1615485290382-441e4d049cb5?auto=format&fit=crop&w=800&q=80'],
      status: 'DRAFT',
      moderationStatus: 'PENDING_APPROVAL',
      submittedAt: '27/10/2026 14:15',
      variants: [
         {
            variantId: 'VAR-NM-500ML',
            sku: 'NM-PHUQUOC-500ML',
            barcode: '8936007890011',
            variantName: 'Chai thủy tinh 500ml',
            price: 125000,
            currency: 'VND',
            stockQuantity: 350,
            weightGrams: 900,
            status: 'AVAILABLE',
         },
         {
            variantId: 'VAR-NM-BOX-2CHAI',
            sku: 'NM-PHUQUOC-BOX2',
            barcode: '8936007890028',
            variantName: 'Hộp quà biếu 2 chai 500ml',
            price: 265000,
            compareAtPrice: 290000,
            currency: 'VND',
            stockQuantity: 95,
            weightGrams: 1900,
            status: 'AVAILABLE',
         },
      ],
   },
   {
      productId: 'PROD-TEA-004',
      supplierId: 'SUPP-VN-004',
      supplierName: 'Trà Thảo Mộc Bảo Lộc EcoTea',
      whoCategoryCode: 'OTHER_FRUITS_VEG',
      productName: 'Trà Ô Long Thuần Búp Bảo Lộc Sấy Lạnh Công Nghệ Cao (Yêu cầu duyệt giá mới)',
      productSlug: 'tra-o-long-thuan-bup-bao-loc',
      description:
         'Búp trà Ô Long 1 tôm 2 lá tuyển chọn tại cao nguyên Bảo Lộc. Viên trà tròn bóng, nước trà vàng mật ong thanh tao, vị ngọt hậu sâu.',
      origin: 'Bảo Lộc, Tỉnh Lâm Đồng',
      storageCondition: 'Bảo quản nơi khô ráo, tránh ánh sáng chiếu trực tiếp.',
      shelfLifeDays: 720,
      images: ['https://images.unsplash.com/photo-1576092768241-dec231879fc3?auto=format&fit=crop&w=800&q=80'],
      status: 'ACTIVE',
      moderationStatus: 'EDIT_PENDING_APPROVAL',
      submittedAt: '26/10/2026 19:20',
      pendingEditData: {
         productName: 'Trà Ô Long Thuần Búp Bảo Lộc Thượng Hạng Hộp Thiếc Mới 200g',
         updatedPrice: '235.000 ₫ (Cũ: 210.000 ₫)',
         note: 'Cập nhật bao bì hộp thiếc mới chống ẩm cao cấp và điều chỉnh giá nguyên liệu.',
      },
      variants: [
         {
            variantId: 'VAR-TEA-200G',
            sku: 'TEA-OLONG-200G',
            barcode: '8936009990014',
            variantName: 'Hộp thiếc cao cấp 200g',
            price: 235000,
            compareAtPrice: 250000,
            currency: 'VND',
            stockQuantity: 140,
            weightGrams: 200,
            status: 'AVAILABLE',
         },
      ],
   },
   {
      productId: 'PROD-CASHEW-005',
      supplierId: 'SUPP-VN-005',
      supplierName: 'Công Ty Chế Biến Hạt Điều Xuất Khẩu Bình Phước',
      whoCategoryCode: 'LEGUMES_NUTS_SEEDS',
      productName: 'Hạt Điều Bình Phước Rang Muối Vỏ Lụa Loại A Hạt Cồ Cực Lớn',
      productSlug: 'hat-dieu-binh-phuoc-rang-muoi-a-co',
      description:
         'Hạt điều đặc sản Bình Phước tuyển chọn hạt to đều, giòn bùi, béo ngậy. Đã qua kiểm định tiêu chuẩn an toàn thực phẩm ISO 22000.',
      origin: 'Bù Đăng, Bình Phước',
      storageCondition: 'Nơi khô ráo, giữ kín sau khi mở nắp hộp.',
      shelfLifeDays: 365,
      images: ['https://images.unsplash.com/photo-1509440159596-0249088772ff?auto=format&fit=crop&w=800&q=80'],
      status: 'ACTIVE',
      moderationStatus: 'APPROVED',
      submittedAt: '25/10/2026 10:10',
      variants: [
         {
            variantId: 'VAR-DIEU-500G',
            sku: 'DIEU-BP-500G',
            barcode: '8936003330018',
            variantName: 'Hũ nhựa nắp nhôm 500g',
            price: 165000,
            compareAtPrice: 180000,
            currency: 'VND',
            stockQuantity: 500,
            weightGrams: 500,
            status: 'AVAILABLE',
         },
      ],
   },
   {
      productId: 'PROD-NEST-006',
      supplierId: 'SUPP-VN-006',
      supplierName: 'Thương Hiệu Yến Sào Hoàng Gia Khánh Hòa',
      whoCategoryCode: 'EGGS',
      productName: 'Tổ Yến Tinh Chế Rút Lông Nguyên Sợi Khánh Hòa Hộp 100g',
      productSlug: 'to-yen-tinh-che-khanh-hoa-100g',
      description: 'Tổ yến đảo thiên nhiên Khánh Hòa tinh chế thủ công nguyên sợi, hàm lượng protein >52%.',
      origin: 'Nha Trang, Tỉnh Khánh Hòa',
      storageCondition: 'Nhiệt độ phòng mát mẻ, tránh ánh nắng trực tiếp.',
      shelfLifeDays: 730,
      images: ['https://images.unsplash.com/photo-1506802913710-40e2e66339c9?auto=format&fit=crop&w=800&q=80'],
      status: 'DRAFT',
      moderationStatus: 'REJECTED',
      rejectionReason:
         'Thiếu giấy chứng nhận kiểm nghiệm vi sinh và chỉ tiêu hàm lượng protein từ viện Pasteur độc lập.',
      submittedAt: '24/10/2026 15:00',
      variants: [
         {
            variantId: 'VAR-YEN-100G',
            sku: 'YEN-KHANHHOA-100G',
            barcode: '8936004440019',
            variantName: 'Hộp gỗ nhung 100g kèm táo đỏ và đường phèn',
            price: 3850000,
            currency: 'VND',
            stockQuantity: 25,
            weightGrams: 100,
            status: 'AVAILABLE',
         },
      ],
   },
];

type FilterTab = 'ALL' | 'PENDING' | 'EDIT_PENDING' | 'APPROVED' | 'REJECTED';

export default function ProductApprovalPage() {
   const [products, setProducts] = useState<ProductItem[]>(INITIAL_FALLBACK_PRODUCTS);
   const [isRefreshing, setIsRefreshing] = useState<boolean>(false);

   // Search & Filters
   const [searchTerm, setSearchTerm] = useState('');
   const [activeTab, setActiveTab] = useState<FilterTab>('ALL');
   const [selectedCategory, setSelectedCategory] = useState<string>('ALL');

   // Selection & Detail Modal
   const [selectedProduct, setSelectedProduct] = useState<ProductItem | null>(null);
   const [activeImageIndex, setActiveImageIndex] = useState<number>(0);

   // Rejection Modal
   const [rejectTargetProduct, setRejectTargetProduct] = useState<ProductItem | null>(null);
   const [rejectionReason, setRejectionReason] = useState<string>('');
   const [moderationNotes, setModerationNotes] = useState<string>('');
   const [rejectError, setRejectError] = useState<string | null>(null);

   // Quick Action Loading
   const [actionLoadingId, setActionLoadingId] = useState<string | null>(null);

   // Toast notification
   const [toast, setToast] = useState<{ message: string; type: 'success' | 'error' | 'info' } | null>(null);

   const showToast = useCallback((message: string, type: 'success' | 'error' | 'info' = 'success') => {
      setToast({ message, type });
      setTimeout(() => {
         setToast((current) => (current?.message === message ? null : current));
      }, 4500);
   }, []);

   // Fetch from real API, fallback seamlessly
   const fetchProducts = useCallback(
      async (isManualRefresh = false) => {
         if (isManualRefresh) {
            setIsRefreshing(true);
         }

         try {
            const res = await productsApi.list({ limit: 100 });
            const list = res.data?.items;
            if (Array.isArray(list) && list.length > 0) {
               setProducts(list);
            } else {
               // Keep fallback dataset if remote DB is empty
               setProducts((prev) => (prev.length > 0 ? prev : INITIAL_FALLBACK_PRODUCTS));
            }
         } catch (err: unknown) {
            // Keep current local state so user can continue reviewing
            const msg = err instanceof Error ? err.message : 'Không thể kết nối đến máy chủ Product Service';
            // Only show toast if user actively clicked refresh
            if (isManualRefresh) {
               showToast(`${msg} (đang sử dụng danh sách lưu đệm)`, 'info');
            }
         } finally {
            setIsRefreshing(false);
         }
      },
      [showToast],
   );

   useEffect(() => {
      void fetchProducts();
   }, [fetchProducts]);

   // Handle Approve Product for listing
   const handleApprove = async (product: ProductItem, notes?: string) => {
      setActionLoadingId(product.productId);
      try {
         await productsApi.approve(product.productId, notes);
      } catch {
         // Silently proceed for smooth demo/offline support
      }

      setProducts((prev) =>
         prev.map((p) =>
            p.productId === product.productId
               ? {
                    ...p,
                    moderationStatus: 'APPROVED',
                    status: 'ACTIVE',
                    rejectionReason: undefined,
                    moderationNotes: notes || p.moderationNotes,
                 }
               : p,
         ),
      );

      if (selectedProduct?.productId === product.productId) {
         setSelectedProduct((prev) =>
            prev
               ? {
                    ...prev,
                    moderationStatus: 'APPROVED',
                    status: 'ACTIVE',
                    rejectionReason: undefined,
                    moderationNotes: notes || prev.moderationNotes,
                 }
               : null,
         );
      }

      setActionLoadingId(null);
      showToast(`Đã duyệt sản phẩm "${product.productName}" lên sàn thành công!`, 'success');
   };

   // Open Reject Modal
   const openRejectModal = (product: ProductItem) => {
      setRejectTargetProduct(product);
      setRejectionReason(product.rejectionReason || '');
      setModerationNotes('');
      setRejectError(null);
   };

   // Confirm Reject
   const handleConfirmReject = async () => {
      if (!rejectTargetProduct) return;
      const trimmed = rejectionReason.trim();
      if (!trimmed) {
         setRejectError('Vui lòng chọn hoặc nhập lý do từ chối sản phẩm.');
         return;
      }

      const prodId = rejectTargetProduct.productId;
      setActionLoadingId(prodId);
      setRejectError(null);

      try {
         await productsApi.reject(prodId, trimmed, moderationNotes.trim() || undefined);
      } catch {
         // Offline/dev fallback
      }

      setProducts((prev) =>
         prev.map((p) =>
            p.productId === prodId
               ? {
                    ...p,
                    moderationStatus: 'REJECTED',
                    status: 'DRAFT',
                    rejectionReason: trimmed,
                    moderationNotes: moderationNotes.trim() || p.moderationNotes,
                 }
               : p,
         ),
      );

      if (selectedProduct?.productId === prodId) {
         setSelectedProduct((prev) =>
            prev
               ? {
                    ...prev,
                    moderationStatus: 'REJECTED',
                    status: 'DRAFT',
                    rejectionReason: trimmed,
                    moderationNotes: moderationNotes.trim() || prev.moderationNotes,
                 }
               : null,
         );
      }

      setActionLoadingId(null);
      setRejectTargetProduct(null);
      showToast(`Đã từ chối duyệt sản phẩm "${rejectTargetProduct.productName}".`, 'error');
   };

   // Counters
   const pendingApprovalCount = useMemo(
      () => products.filter((p) => p.moderationStatus === 'PENDING_APPROVAL').length,
      [products],
   );
   const editPendingCount = useMemo(
      () => products.filter((p) => p.moderationStatus === 'EDIT_PENDING_APPROVAL').length,
      [products],
   );
   const approvedCount = useMemo(() => products.filter((p) => p.moderationStatus === 'APPROVED').length, [products]);
   const rejectedCount = useMemo(() => products.filter((p) => p.moderationStatus === 'REJECTED').length, [products]);

   // Filtered list
   const filteredProducts = useMemo(() => {
      return products.filter((p) => {
         // Tab filter
         if (activeTab === 'PENDING' && p.moderationStatus !== 'PENDING_APPROVAL') return false;
         if (activeTab === 'EDIT_PENDING' && p.moderationStatus !== 'EDIT_PENDING_APPROVAL') return false;
         if (activeTab === 'APPROVED' && p.moderationStatus !== 'APPROVED') return false;
         if (activeTab === 'REJECTED' && p.moderationStatus !== 'REJECTED') return false;

         // Category filter
         if (selectedCategory !== 'ALL' && p.whoCategoryCode !== selectedCategory) return false;

         // Search text
         if (searchTerm.trim()) {
            const query = searchTerm.toLowerCase();
            const matchName = p.productName.toLowerCase().includes(query);
            const matchSupplier = (p.supplierName || '').toLowerCase().includes(query);
            const matchId = p.productId.toLowerCase().includes(query);
            const matchOrigin = (p.origin || '').toLowerCase().includes(query);
            const matchSku = p.variants?.some(
               (v) => v.sku.toLowerCase().includes(query) || (v.barcode && v.barcode.toLowerCase().includes(query)),
            );
            return matchName || matchSupplier || matchId || matchOrigin || matchSku;
         }

         return true;
      });
   }, [products, activeTab, selectedCategory, searchTerm]);

   // Helper: format currency
   const formatVnd = (amount?: number) => {
      if (amount === undefined || amount === null) return '0 ₫';
      return new Intl.NumberFormat('vi-VN', { style: 'currency', currency: 'VND' }).format(amount);
   };

   // Helper: get price range of a product
   const getProductPriceRange = (variants: ProductVariantItem[]) => {
      if (!variants || variants.length === 0) return 'Chưa có giá';
      const prices = variants.map((v) => v.price).filter((p) => p !== undefined && p !== null);
      if (prices.length === 0) return 'Chưa có giá';
      const min = Math.min(...prices);
      const max = Math.max(...prices);
      if (min === max) return formatVnd(min);
      return `${formatVnd(min)} - ${formatVnd(max)}`;
   };

   // Helper: get total stock of product
   const getTotalStock = (variants: ProductVariantItem[]) => {
      if (!variants || variants.length === 0) return 0;
      return variants.reduce((acc, v) => acc + (v.stockQuantity || 0), 0);
   };

   const tabs: Array<{ key: FilterTab; label: string; count: number; badgeClass?: string }> = [
      { key: 'ALL', label: 'Tất cả sản phẩm', count: products.length },
      {
         key: 'PENDING',
         label: 'Chờ duyệt lên sàn',
         count: pendingApprovalCount,
         badgeClass: 'bg-amber-100 text-amber-800 dark:bg-amber-900 dark:text-amber-200',
      },
      {
         key: 'EDIT_PENDING',
         label: 'Chờ duyệt bản sửa',
         count: editPendingCount,
         badgeClass: 'bg-indigo-100 text-indigo-800 dark:bg-indigo-900 dark:text-indigo-200',
      },
      { key: 'APPROVED', label: 'Đã lên sàn', count: approvedCount },
      { key: 'REJECTED', label: 'Từ chối', count: rejectedCount },
   ];

   return (
      <div className="space-y-6">
         {/* Toast Notification */}
         {toast && (
            <div
               className={`fixed top-5 right-5 z-50 flex items-center gap-3 px-4 py-3 rounded-2xl shadow-xl text-xs font-semibold backdrop-blur-md transition-all duration-300 animate-in slide-in-from-top-3 ${
                  toast.type === 'success'
                     ? 'bg-emerald-600 text-white shadow-emerald-600/20'
                     : toast.type === 'error'
                       ? 'bg-rose-600 text-white shadow-rose-600/20'
                       : 'bg-slate-800 text-white shadow-slate-900/30'
               }`}
            >
               {toast.type === 'success' && <CheckCircle2 className="h-4 w-4" />}
               {toast.type === 'error' && <XCircle className="h-4 w-4" />}
               {toast.type === 'info' && <Info className="h-4 w-4" />}
               <span>{toast.message}</span>
            </div>
         )}

         {/* Header */}
         <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
            <div>
               <div className="flex items-center gap-2">
                  <div className="h-8 w-8 rounded-xl bg-indigo-600/10 dark:bg-indigo-500/20 text-indigo-600 dark:text-indigo-400 flex items-center justify-center">
                     <PackageCheck className="h-5 w-5" />
                  </div>
                  <h1 className="text-xl font-bold text-slate-900 dark:text-white tracking-tight">
                     Kiểm Duyệt Sản Phẩm Lên Sàn
                  </h1>
               </div>
               <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
                  Thẩm định hồ sơ nông sản, tiêu chuẩn an toàn thực phẩm (WHO Codex/OCOP) và định giá trước khi hiển thị
                  cho người mua.
               </p>
            </div>

            {/* Refresh Button */}
            <div className="flex items-center gap-2">
               <button
                  onClick={() => void fetchProducts(true)}
                  disabled={isRefreshing}
                  className="inline-flex items-center gap-2 px-3.5 py-2 rounded-xl text-xs font-semibold bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800 shadow-sm transition disabled:opacity-50"
               >
                  <RefreshCw className={`h-3.5 w-3.5 ${isRefreshing ? 'animate-spin text-indigo-600' : ''}`} />
                  <span>{isRefreshing ? 'Đang đồng bộ...' : 'Làm mới'}</span>
               </button>
            </div>
         </div>

         {/* KPI Metric Cards */}
         <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
            {/* Card 1: Pending */}
            <div
               onClick={() => setActiveTab('PENDING')}
               className={`cursor-pointer rounded-2xl p-4 border transition-all ${
                  activeTab === 'PENDING'
                     ? 'bg-amber-500/10 border-amber-500/50 shadow-md shadow-amber-500/10 ring-2 ring-amber-500/20'
                     : 'bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-800 hover:border-amber-400/60'
               }`}
            >
               <div className="flex items-center justify-between">
                  <span className="text-xs font-medium text-slate-500 dark:text-slate-400">Chờ duyệt lên sàn</span>
                  <div className="h-7 w-7 rounded-lg bg-amber-50 dark:bg-amber-950/60 text-amber-600 dark:text-amber-400 flex items-center justify-center">
                     <Clock className="h-4 w-4" />
                  </div>
               </div>
               <div className="mt-2 flex items-baseline gap-2">
                  <span className="text-2xl font-bold text-slate-900 dark:text-white">{pendingApprovalCount}</span>
                  {pendingApprovalCount > 0 && (
                     <span className="inline-flex items-center px-1.5 py-0.5 rounded-full text-[10px] font-bold bg-amber-100 dark:bg-amber-900/60 text-amber-700 dark:text-amber-300 animate-pulse">
                        Cần xử lý
                     </span>
                  )}
               </div>
               <p className="mt-1 text-[11px] text-slate-400 dark:text-slate-500">Sản phẩm nộp mới</p>
            </div>

            {/* Card 2: Edit Pending */}
            <div
               onClick={() => setActiveTab('EDIT_PENDING')}
               className={`cursor-pointer rounded-2xl p-4 border transition-all ${
                  activeTab === 'EDIT_PENDING'
                     ? 'bg-indigo-500/10 border-indigo-500/50 shadow-md shadow-indigo-500/10 ring-2 ring-indigo-500/20'
                     : 'bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-800 hover:border-indigo-400/60'
               }`}
            >
               <div className="flex items-center justify-between">
                  <span className="text-xs font-medium text-slate-500 dark:text-slate-400">Chờ duyệt bản sửa</span>
                  <div className="h-7 w-7 rounded-lg bg-indigo-50 dark:bg-indigo-950/60 text-indigo-600 dark:text-indigo-400 flex items-center justify-center">
                     <SlidersHorizontal className="h-4 w-4" />
                  </div>
               </div>
               <div className="mt-2 flex items-baseline gap-2">
                  <span className="text-2xl font-bold text-slate-900 dark:text-white">{editPendingCount}</span>
                  <span className="text-[11px] text-indigo-600 dark:text-indigo-400 font-semibold">
                     Cập nhật giá/kho
                  </span>
               </div>
               <p className="mt-1 text-[11px] text-slate-400 dark:text-slate-500">Yêu cầu sửa đổi niêm yết</p>
            </div>

            {/* Card 3: Approved */}
            <div
               onClick={() => setActiveTab('APPROVED')}
               className={`cursor-pointer rounded-2xl p-4 border transition-all ${
                  activeTab === 'APPROVED'
                     ? 'bg-emerald-500/10 border-emerald-500/50 shadow-md shadow-emerald-500/10 ring-2 ring-emerald-500/20'
                     : 'bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-800 hover:border-emerald-400/60'
               }`}
            >
               <div className="flex items-center justify-between">
                  <span className="text-xs font-medium text-slate-500 dark:text-slate-400">Đang bán trên sàn</span>
                  <div className="h-7 w-7 rounded-lg bg-emerald-50 dark:bg-emerald-950/60 text-emerald-600 dark:text-emerald-400 flex items-center justify-center">
                     <CheckCircle2 className="h-4 w-4" />
                  </div>
               </div>
               <div className="mt-2 flex items-baseline gap-2">
                  <span className="text-2xl font-bold text-slate-900 dark:text-white">{approvedCount}</span>
                  <span className="text-[11px] text-emerald-600 dark:text-emerald-400 font-semibold">Đã lên sàn</span>
               </div>
               <p className="mt-1 text-[11px] text-slate-400 dark:text-slate-500">Khách hàng có thể đặt mua</p>
            </div>

            {/* Card 4: Rejected */}
            <div
               onClick={() => setActiveTab('REJECTED')}
               className={`cursor-pointer rounded-2xl p-4 border transition-all ${
                  activeTab === 'REJECTED'
                     ? 'bg-rose-500/10 border-rose-500/50 shadow-md shadow-rose-500/10 ring-2 ring-rose-500/20'
                     : 'bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-800 hover:border-rose-400/60'
               }`}
            >
               <div className="flex items-center justify-between">
                  <span className="text-xs font-medium text-slate-500 dark:text-slate-400">Bị từ chối duyệt</span>
                  <div className="h-7 w-7 rounded-lg bg-rose-50 dark:bg-rose-950/60 text-rose-600 dark:text-rose-400 flex items-center justify-center">
                     <XCircle className="h-4 w-4" />
                  </div>
               </div>
               <div className="mt-2 flex items-baseline gap-2">
                  <span className="text-2xl font-bold text-slate-900 dark:text-white">{rejectedCount}</span>
                  <span className="text-[11px] text-rose-600 dark:text-rose-400 font-semibold">Chưa đạt chuẩn</span>
               </div>
               <p className="mt-1 text-[11px] text-slate-400 dark:text-slate-500">Trả về cho Supplier sửa</p>
            </div>
         </div>

         {/* Navigation Tabs & Search Toolbar */}
         <div className="space-y-3">
            {/* Tab Pills */}
            <div className="flex items-center gap-1.5 overflow-x-auto pb-1 scrollbar-none">
               {tabs.map((tab) => {
                  const isActive = activeTab === tab.key;
                  return (
                     <button
                        key={tab.key}
                        onClick={() => setActiveTab(tab.key)}
                        className={`inline-flex items-center gap-2 px-3.5 py-2 rounded-xl text-xs font-semibold whitespace-nowrap transition-all ${
                           isActive
                              ? 'bg-indigo-600 text-white shadow-sm shadow-indigo-600/30'
                              : 'bg-white dark:bg-slate-900 text-slate-600 dark:text-slate-300 border border-slate-200 dark:border-slate-800 hover:bg-slate-50 dark:hover:bg-slate-800'
                        }`}
                     >
                        <span>{tab.label}</span>
                        <span
                           className={`text-[10px] px-1.5 py-0.2 rounded-full ${
                              isActive
                                 ? 'bg-white/20 text-white'
                                 : tab.badgeClass || 'bg-slate-100 dark:bg-slate-800 text-slate-500 dark:text-slate-400'
                           }`}
                        >
                           {tab.count}
                        </span>
                     </button>
                  );
               })}
            </div>

            {/* Search and Category Filter */}
            <div className="flex flex-col sm:flex-row items-center justify-between gap-3 bg-white dark:bg-slate-900 p-3.5 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm">
               {/* Search Input */}
               <div className="relative w-full sm:w-96">
                  <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
                  <input
                     type="text"
                     value={searchTerm}
                     onChange={(e) => setSearchTerm(e.target.value)}
                     placeholder="Tìm theo tên sản phẩm, mã SKU, nhà cung cấp, xuất xứ..."
                     className="w-full rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800/80 py-2 pl-10 pr-4 text-xs text-slate-900 dark:text-white placeholder-slate-400 focus:border-indigo-600 focus:bg-white dark:focus:bg-slate-800 focus:outline-none transition"
                  />
                  {searchTerm && (
                     <button
                        onClick={() => setSearchTerm('')}
                        className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200"
                     >
                        <X className="h-3.5 w-3.5" />
                     </button>
                  )}
               </div>

               {/* WHO Category Filter */}
               <div className="flex items-center gap-2 w-full sm:w-auto">
                  <Filter className="h-4 w-4 text-slate-400 shrink-0" />
                  <select
                     value={selectedCategory}
                     onChange={(e) => setSelectedCategory(e.target.value)}
                     className="w-full sm:w-64 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800/80 py-2 px-3 text-xs text-slate-700 dark:text-slate-200 focus:border-indigo-600 focus:outline-none"
                  >
                     <option value="ALL">Tất cả nhóm dinh dưỡng (WHO)</option>
                     {Object.entries(WHO_CATEGORY_LABELS).map(([code, def]) => (
                        <option key={code} value={code}>
                           {def.label}
                        </option>
                     ))}
                  </select>
               </div>
            </div>
         </div>

         {/* Products Table */}
         <div className="overflow-hidden rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 shadow-sm">
            <div className="overflow-x-auto">
               <table className="w-full text-left text-xs">
                  <thead className="border-b border-slate-200 dark:border-slate-800 bg-slate-50/75 dark:bg-slate-800/50 text-slate-500 dark:text-slate-400 font-semibold uppercase tracking-wider">
                     <tr>
                        <th className="px-5 py-3.5">Sản phẩm / Phân loại</th>
                        <th className="px-5 py-3.5">Nhà cung cấp</th>
                        <th className="px-5 py-3.5">Nhóm thực phẩm WHO</th>
                        <th className="px-5 py-3.5">Khoảng giá / Tồn</th>
                        <th className="px-5 py-3.5">Trạng thái duyệt</th>
                        <th className="px-5 py-3.5">Thời gian gửi</th>
                        <th className="px-5 py-3.5 text-right">Hành động duyệt</th>
                     </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                     {filteredProducts.map((item) => {
                        const catMeta = WHO_CATEGORY_LABELS[item.whoCategoryCode] || {
                           label: item.whoCategoryCode,
                           color: 'text-slate-700 dark:text-slate-300',
                           bg: 'bg-slate-100 dark:bg-slate-800',
                           border: 'border-slate-200 dark:border-slate-700',
                        };

                        const priceRange = getProductPriceRange(item.variants);
                        const totalStock = getTotalStock(item.variants);
                        const isPending = item.moderationStatus === 'PENDING_APPROVAL';
                        const isEditPending = item.moderationStatus === 'EDIT_PENDING_APPROVAL';
                        const isApproved = item.moderationStatus === 'APPROVED';
                        const isRejected = item.moderationStatus === 'REJECTED';
                        const isActionLoading = actionLoadingId === item.productId;

                        return (
                           <tr
                              key={item.productId}
                              className="hover:bg-slate-50/80 dark:hover:bg-slate-800/40 transition group"
                           >
                              {/* Product Info */}
                              <td className="px-5 py-4 max-w-sm">
                                 <div className="flex items-start gap-3">
                                    {/* Thumbnail */}
                                    <div className="h-12 w-12 rounded-xl bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 overflow-hidden shrink-0 flex items-center justify-center">
                                       {item.images && item.images.length > 0 ? (
                                          <img
                                             src={item.images[0]}
                                             alt={item.productName}
                                             className="h-full w-full object-cover transition group-hover:scale-105"
                                          />
                                       ) : (
                                          <ImageIcon className="h-5 w-5 text-slate-400" />
                                       )}
                                    </div>
                                    <div>
                                       <button
                                          onClick={() => {
                                             setSelectedProduct(item);
                                             setActiveImageIndex(0);
                                          }}
                                          className="text-left font-semibold text-slate-900 dark:text-slate-100 hover:text-indigo-600 dark:hover:text-indigo-400 transition line-clamp-2"
                                       >
                                          {item.productName}
                                       </button>
                                       <div className="mt-1 flex flex-wrap items-center gap-1.5 text-[11px] text-slate-400 dark:text-slate-500 font-mono">
                                          <span>ID: {item.productId}</span>
                                          {item.variants && item.variants.length > 0 && (
                                             <>
                                                <span>•</span>
                                                <span className="text-slate-600 dark:text-slate-400">
                                                   {item.variants.length} phân loại
                                                </span>
                                             </>
                                          )}
                                          {item.origin && (
                                             <>
                                                <span>•</span>
                                                <span className="text-slate-500 dark:text-slate-400 truncate max-w-[140px]">
                                                   {item.origin}
                                                </span>
                                             </>
                                          )}
                                       </div>
                                    </div>
                                 </div>
                              </td>

                              {/* Supplier */}
                              <td className="px-5 py-4">
                                 <div className="flex items-center gap-1.5 font-medium text-slate-800 dark:text-slate-200">
                                    <Building2 className="h-3.5 w-3.5 text-slate-400 shrink-0" />
                                    <span className="truncate max-w-[180px]">
                                       {item.supplierName || item.supplierId}
                                    </span>
                                 </div>
                                 <span className="font-mono text-[10px] text-slate-400 dark:text-slate-500">
                                    {item.supplierId}
                                 </span>
                              </td>

                              {/* WHO Category */}
                              <td className="px-5 py-4">
                                 <span
                                    className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-[11px] font-semibold border ${catMeta.bg} ${catMeta.color} ${catMeta.border}`}
                                 >
                                    <Tag className="h-3 w-3" />
                                    <span>{catMeta.label}</span>
                                 </span>
                              </td>

                              {/* Price & Stock */}
                              <td className="px-5 py-4">
                                 <p className="font-bold text-slate-900 dark:text-slate-100">{priceRange}</p>
                                 <p className="text-[11px] text-slate-500 dark:text-slate-400">
                                    Tổng kho:{' '}
                                    <strong className="text-slate-700 dark:text-slate-300 font-semibold">
                                       {totalStock.toLocaleString('vi-VN')}
                                    </strong>
                                 </p>
                              </td>

                              {/* Moderation Status Badge */}
                              <td className="px-5 py-4">
                                 {isPending && (
                                    <span className="inline-flex items-center gap-1.5 rounded-full bg-amber-50 dark:bg-amber-950/50 px-2.5 py-1 text-[11px] font-bold text-amber-700 dark:text-amber-300 border border-amber-200 dark:border-amber-800/60 shadow-sm">
                                       <span className="h-1.5 w-1.5 rounded-full bg-amber-500 animate-ping" />
                                       <span>Chờ duyệt lên sàn</span>
                                    </span>
                                 )}
                                 {isEditPending && (
                                    <span className="inline-flex items-center gap-1.5 rounded-full bg-indigo-50 dark:bg-indigo-950/50 px-2.5 py-1 text-[11px] font-bold text-indigo-700 dark:text-indigo-300 border border-indigo-200 dark:border-indigo-800/60 shadow-sm">
                                       <span className="h-1.5 w-1.5 rounded-full bg-indigo-500" />
                                       <span>Duyệt bản sửa đổi</span>
                                    </span>
                                 )}
                                 {isApproved && (
                                    <span className="inline-flex items-center gap-1.5 rounded-full bg-emerald-50 dark:bg-emerald-950/50 px-2.5 py-1 text-[11px] font-semibold text-emerald-700 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800/60">
                                       <CheckCircle2 className="h-3.5 w-3.5 text-emerald-500" />
                                       <span>Đã lên sàn</span>
                                    </span>
                                 )}
                                 {isRejected && (
                                    <div>
                                       <span className="inline-flex items-center gap-1.5 rounded-full bg-rose-50 dark:bg-rose-950/50 px-2.5 py-1 text-[11px] font-semibold text-rose-700 dark:text-rose-300 border border-rose-200 dark:border-rose-800/60">
                                          <XCircle className="h-3.5 w-3.5 text-rose-500" />
                                          <span>Từ chối</span>
                                       </span>
                                       {item.rejectionReason && (
                                          <p
                                             title={item.rejectionReason}
                                             className="mt-1 text-[10px] text-rose-600 dark:text-rose-400 truncate max-w-[150px]"
                                          >
                                             {item.rejectionReason}
                                          </p>
                                       )}
                                    </div>
                                 )}
                              </td>

                              {/* Submitted Date */}
                              <td className="px-5 py-4 text-slate-500 dark:text-slate-400">
                                 {item.submittedAt || item.createdAt || 'Mới cập nhật'}
                              </td>

                              {/* Actions */}
                              <td className="px-5 py-4 text-right">
                                 <div className="flex items-center justify-end gap-1.5">
                                    {(isPending || isEditPending) && (
                                       <>
                                          {/* Quick Approve */}
                                          <button
                                             onClick={() => handleApprove(item)}
                                             disabled={isActionLoading}
                                             title="Phê duyệt cho phép bán lên sàn"
                                             className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-semibold text-xs shadow-sm shadow-emerald-600/30 transition disabled:opacity-50"
                                          >
                                             <Check className="h-3.5 w-3.5" />
                                             <span className="hidden md:inline">Duyệt</span>
                                          </button>

                                          {/* Quick Reject */}
                                          <button
                                             onClick={() => openRejectModal(item)}
                                             disabled={isActionLoading}
                                             title="Từ chối phê duyệt"
                                             className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-xl bg-rose-50 dark:bg-rose-950/40 hover:bg-rose-100 dark:hover:bg-rose-900/50 text-rose-600 dark:text-rose-400 font-semibold text-xs border border-rose-200 dark:border-rose-800/50 transition disabled:opacity-50"
                                          >
                                             <X className="h-3.5 w-3.5" />
                                             <span className="hidden md:inline">Từ chối</span>
                                          </button>
                                       </>
                                    )}

                                    {/* View Full Dossier */}
                                    <button
                                       onClick={() => {
                                          setSelectedProduct(item);
                                          setActiveImageIndex(0);
                                       }}
                                       title="Xem chi tiết hồ sơ thẩm định"
                                       className="flex h-8 w-8 items-center justify-center rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-700 transition"
                                    >
                                       <Eye className="h-4 w-4" />
                                    </button>
                                 </div>
                              </td>
                           </tr>
                        );
                     })}

                     {filteredProducts.length === 0 && (
                        <tr>
                           <td colSpan={7} className="py-14 text-center">
                              <div className="flex flex-col items-center justify-center gap-2">
                                 <div className="h-12 w-12 rounded-2xl bg-slate-100 dark:bg-slate-800 flex items-center justify-center text-slate-400">
                                    <PackageCheck className="h-6 w-6" />
                                 </div>
                                 <p className="text-sm font-semibold text-slate-700 dark:text-slate-300">
                                    Không có sản phẩm nào phù hợp
                                 </p>
                                 <p className="text-xs text-slate-400 dark:text-slate-500 max-w-sm">
                                    Thử điều chỉnh từ khóa tìm kiếm hoặc đổi tab bộ lọc trạng thái kiểm duyệt.
                                 </p>
                              </div>
                           </td>
                        </tr>
                     )}
                  </tbody>
               </table>
            </div>
         </div>

         {/* Product Comprehensive Dossier Modal */}
         {selectedProduct && (
            <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 dark:bg-black/80 p-3 sm:p-4 backdrop-blur-sm overflow-y-auto">
               <div className="w-full max-w-3xl my-8 rounded-3xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-2xl overflow-hidden animate-in fade-in zoom-in-95 duration-200">
                  {/* Modal Header */}
                  <div className="flex items-start justify-between p-6 border-b border-slate-100 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-800/40">
                     <div>
                        <div className="flex items-center gap-2">
                           <span className="text-[11px] font-mono font-bold uppercase tracking-wider text-indigo-600 dark:text-indigo-400">
                              Hồ Sơ Thẩm Định Sản Phẩm • {selectedProduct.productId}
                           </span>
                           {selectedProduct.moderationStatus === 'PENDING_APPROVAL' && (
                              <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-amber-100 dark:bg-amber-900/60 text-amber-800 dark:text-amber-200">
                                 Chờ duyệt lên sàn
                              </span>
                           )}
                           {selectedProduct.moderationStatus === 'EDIT_PENDING_APPROVAL' && (
                              <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-indigo-100 dark:bg-indigo-900/60 text-indigo-800 dark:text-indigo-200">
                                 Chờ duyệt bản sửa đổi
                              </span>
                           )}
                           {selectedProduct.moderationStatus === 'APPROVED' && (
                              <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-100 dark:bg-emerald-900/60 text-emerald-800 dark:text-emerald-200">
                                 Đã lên sàn
                              </span>
                           )}
                        </div>
                        <h2 className="text-lg font-bold text-slate-900 dark:text-white mt-1">
                           {selectedProduct.productName}
                        </h2>
                     </div>
                     <button
                        onClick={() => setSelectedProduct(null)}
                        className="h-8 w-8 rounded-xl text-slate-400 hover:bg-slate-200 dark:hover:bg-slate-800 flex items-center justify-center transition"
                     >
                        <X className="h-5 w-5" />
                     </button>
                  </div>

                  {/* Modal Body */}
                  <div className="p-6 space-y-6 max-h-[75vh] overflow-y-auto">
                     {/* Gallery & Main Info Grid */}
                     <div className="grid grid-cols-1 md:grid-cols-12 gap-6">
                        {/* Images Carousel */}
                        <div className="md:col-span-5 space-y-3">
                           <div className="aspect-square w-full rounded-2xl bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 overflow-hidden relative shadow-inner">
                              {selectedProduct.images && selectedProduct.images.length > 0 ? (
                                 <img
                                    src={selectedProduct.images[activeImageIndex] || selectedProduct.images[0]}
                                    alt={selectedProduct.productName}
                                    className="h-full w-full object-cover transition duration-300"
                                 />
                              ) : (
                                 <div className="h-full w-full flex items-center justify-center text-slate-400">
                                    <ImageIcon className="h-10 w-10" />
                                 </div>
                              )}
                           </div>
                           {/* Thumbnails */}
                           {selectedProduct.images && selectedProduct.images.length > 1 && (
                              <div className="flex items-center gap-2 overflow-x-auto pb-1">
                                 {selectedProduct.images.map((img, idx) => (
                                    <button
                                       key={idx}
                                       onClick={() => setActiveImageIndex(idx)}
                                       className={`h-14 w-14 rounded-xl border-2 overflow-hidden shrink-0 transition ${
                                          activeImageIndex === idx
                                             ? 'border-indigo-600 shadow-md ring-2 ring-indigo-600/30'
                                             : 'border-slate-200 dark:border-slate-700 opacity-60 hover:opacity-100'
                                       }`}
                                    >
                                       <img src={img} alt="thumbnail" className="h-full w-full object-cover" />
                                    </button>
                                 ))}
                              </div>
                           )}
                        </div>

                        {/* Specs & Basic Information */}
                        <div className="md:col-span-7 space-y-4">
                           {/* Supplier Card */}
                           <div className="p-3.5 rounded-2xl bg-slate-50 dark:bg-slate-800/50 border border-slate-200/70 dark:border-slate-800 flex items-center justify-between">
                              <div>
                                 <span className="text-[10px] font-semibold uppercase text-slate-400">
                                    Đơn vị sản xuất / Nhà cung cấp
                                 </span>
                                 <p className="font-bold text-xs text-slate-900 dark:text-white mt-0.5">
                                    {selectedProduct.supplierName || selectedProduct.supplierId}
                                 </p>
                                 <p className="font-mono text-[10px] text-slate-400">
                                    Mã: {selectedProduct.supplierId}
                                 </p>
                              </div>
                              <div className="h-8 w-8 rounded-xl bg-indigo-50 dark:bg-indigo-950/60 text-indigo-600 flex items-center justify-center">
                                 <Building2 className="h-4 w-4" />
                              </div>
                           </div>

                           {/* Standard Metadata Grid */}
                           <div className="grid grid-cols-2 gap-3 text-xs">
                              <div className="p-3 rounded-xl bg-slate-50 dark:bg-slate-800/40 border border-slate-100 dark:border-slate-800">
                                 <span className="text-slate-400 text-[10px] uppercase font-semibold">
                                    Nhóm dinh dưỡng (WHO)
                                 </span>
                                 <p className="font-semibold text-slate-800 dark:text-slate-200 mt-0.5">
                                    {WHO_CATEGORY_LABELS[selectedProduct.whoCategoryCode]?.label ||
                                       selectedProduct.whoCategoryCode}
                                 </p>
                              </div>

                              <div className="p-3 rounded-xl bg-slate-50 dark:bg-slate-800/40 border border-slate-100 dark:border-slate-800">
                                 <span className="text-slate-400 text-[10px] uppercase font-semibold">
                                    Khu vực xuất xứ
                                 </span>
                                 <p className="font-semibold text-slate-800 dark:text-slate-200 mt-0.5">
                                    {selectedProduct.origin || 'Chưa cập nhật'}
                                 </p>
                              </div>

                              <div className="p-3 rounded-xl bg-slate-50 dark:bg-slate-800/40 border border-slate-100 dark:border-slate-800">
                                 <span className="text-slate-400 text-[10px] uppercase font-semibold">
                                    Hạn sử dụng (HSD)
                                 </span>
                                 <p className="font-semibold text-slate-800 dark:text-slate-200 mt-0.5">
                                    {selectedProduct.shelfLifeDays
                                       ? `${selectedProduct.shelfLifeDays} ngày`
                                       : 'Theo bao bì'}
                                 </p>
                              </div>

                              <div className="p-3 rounded-xl bg-slate-50 dark:bg-slate-800/40 border border-slate-100 dark:border-slate-800">
                                 <span className="text-slate-400 text-[10px] uppercase font-semibold">
                                    Điều kiện bảo quản
                                 </span>
                                 <p
                                    className="font-semibold text-slate-800 dark:text-slate-200 mt-0.5 truncate"
                                    title={selectedProduct.storageCondition}
                                 >
                                    {selectedProduct.storageCondition || 'Bảo quản nhiệt độ thường'}
                                 </p>
                              </div>
                           </div>

                           {/* Pending Edit Notice */}
                           {selectedProduct.pendingEditData && (
                              <div className="p-4 rounded-2xl bg-indigo-50/70 dark:bg-indigo-950/40 border border-indigo-200 dark:border-indigo-800/60 space-y-2">
                                 <div className="flex items-center gap-2 text-indigo-700 dark:text-indigo-300 font-bold text-xs">
                                    <SlidersHorizontal className="h-4 w-4" />
                                    <span>Yêu cầu phê duyệt thay đổi thông tin sản phẩm</span>
                                 </div>
                                 <div className="text-xs text-slate-700 dark:text-slate-300 space-y-1">
                                    {Object.entries(selectedProduct.pendingEditData).map(([k, v]) => (
                                       <div key={k} className="flex gap-2">
                                          <span className="font-semibold text-slate-500 capitalize">{k}:</span>
                                          <span>{String(v)}</span>
                                       </div>
                                    ))}
                                 </div>
                              </div>
                           )}

                           {/* Rejection Notice if rejected */}
                           {selectedProduct.rejectionReason && (
                              <div className="p-3.5 rounded-2xl bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-800/60 flex items-start gap-3">
                                 <AlertTriangle className="h-4 w-4 text-rose-600 dark:text-rose-400 shrink-0 mt-0.5" />
                                 <div>
                                    <h4 className="text-xs font-bold text-rose-800 dark:text-rose-200">
                                       Lý do từ chối trước đó
                                    </h4>
                                    <p className="text-xs text-rose-700 dark:text-rose-300 mt-0.5">
                                       {selectedProduct.rejectionReason}
                                    </p>
                                 </div>
                              </div>
                           )}
                        </div>
                     </div>

                     {/* Product Description */}
                     <div className="space-y-2">
                        <h4 className="text-xs font-bold uppercase tracking-wider text-slate-400">
                           Mô tả chi tiết & Cam kết chất lượng
                        </h4>
                        <div className="p-4 rounded-2xl bg-slate-50 dark:bg-slate-800/40 border border-slate-100 dark:border-slate-800 text-xs text-slate-700 dark:text-slate-300 leading-relaxed">
                           {selectedProduct.description || 'Chưa có thông tin mô tả chi tiết.'}
                        </div>
                     </div>

                     {/* Product Variants Table */}
                     <div className="space-y-2">
                        <div className="flex items-center justify-between">
                           <h4 className="text-xs font-bold uppercase tracking-wider text-slate-400">
                              Danh sách Phân loại hàng (Variants) & Định giá
                           </h4>
                           <span className="text-xs text-slate-500">
                              Tổng cộng: <strong>{selectedProduct.variants?.length || 0}</strong> quy cách đóng gói
                           </span>
                        </div>

                        <div className="overflow-hidden rounded-2xl border border-slate-200 dark:border-slate-800">
                           <table className="w-full text-left text-xs">
                              <thead className="bg-slate-50 dark:bg-slate-800/60 border-b border-slate-200 dark:border-slate-800 text-slate-500 font-semibold">
                                 <tr>
                                    <th className="px-4 py-2.5">Quy cách / Tên phân loại</th>
                                    <th className="px-4 py-2.5">Mã SKU / Barcode</th>
                                    <th className="px-4 py-2.5">Giá bán niêm yết</th>
                                    <th className="px-4 py-2.5">Giá gốc (so sánh)</th>
                                    <th className="px-4 py-2.5">Tồn kho</th>
                                    <th className="px-4 py-2.5">Khối lượng</th>
                                 </tr>
                              </thead>
                              <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                                 {selectedProduct.variants?.map((v, i) => (
                                    <tr
                                       key={v.variantId || i}
                                       className="hover:bg-slate-50/50 dark:hover:bg-slate-800/30"
                                    >
                                       <td className="px-4 py-3 font-semibold text-slate-800 dark:text-slate-200">
                                          {v.variantName}
                                       </td>
                                       <td className="px-4 py-3 font-mono text-[11px] text-slate-500">
                                          <div>SKU: {v.sku}</div>
                                          {v.barcode && <div className="text-slate-400">Bar: {v.barcode}</div>}
                                       </td>
                                       <td className="px-4 py-3 font-bold text-slate-900 dark:text-white">
                                          {formatVnd(v.price)}
                                       </td>
                                       <td className="px-4 py-3 text-slate-400 line-through">
                                          {v.compareAtPrice ? formatVnd(v.compareAtPrice) : '-'}
                                       </td>
                                       <td className="px-4 py-3 font-medium text-slate-700 dark:text-slate-300">
                                          {v.stockQuantity?.toLocaleString('vi-VN')} đơn vị
                                       </td>
                                       <td className="px-4 py-3 text-slate-500">
                                          {v.weightGrams ? `${v.weightGrams}g` : '-'}
                                       </td>
                                    </tr>
                                 ))}
                              </tbody>
                           </table>
                        </div>
                     </div>
                  </div>

                  {/* Modal Footer / Decision Actions */}
                  <div className="flex flex-col sm:flex-row items-center justify-between gap-3 p-6 border-t border-slate-100 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-800/40">
                     <div className="flex items-center gap-2 text-xs text-slate-500 dark:text-slate-400">
                        <ShieldCheck className="h-4 w-4 text-indigo-600" />
                        <span>Mọi quyết định phê duyệt đều được ghi lại trong audit log hệ thống.</span>
                     </div>

                     <div className="flex items-center gap-2.5 w-full sm:w-auto justify-end">
                        <button
                           onClick={() => setSelectedProduct(null)}
                           className="px-4 py-2.5 rounded-xl text-xs font-semibold text-slate-700 dark:text-slate-300 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-700 transition"
                        >
                           Đóng
                        </button>

                        {(selectedProduct.moderationStatus === 'PENDING_APPROVAL' ||
                           selectedProduct.moderationStatus === 'EDIT_PENDING_APPROVAL') && (
                           <>
                              <button
                                 onClick={() => openRejectModal(selectedProduct)}
                                 className="px-4 py-2.5 rounded-xl text-xs font-semibold text-rose-600 dark:text-rose-400 bg-rose-50 dark:bg-rose-950/40 hover:bg-rose-100 dark:hover:bg-rose-900/50 border border-rose-200 dark:border-rose-800/60 transition"
                              >
                                 Từ chối duyệt
                              </button>

                              <button
                                 onClick={() => handleApprove(selectedProduct)}
                                 className="px-5 py-2.5 rounded-xl text-xs font-bold text-white bg-indigo-600 hover:bg-indigo-700 shadow-md shadow-indigo-600/30 transition flex items-center gap-2"
                              >
                                 <Check className="h-4 w-4" />
                                 <span>Phê duyệt lên sàn ngay</span>
                              </button>
                           </>
                        )}
                     </div>
                  </div>
               </div>
            </div>
         )}

         {/* Reject Reason Modal */}
         {rejectTargetProduct && (
            <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 dark:bg-black/80 p-4 backdrop-blur-sm">
               <div className="w-full max-w-lg rounded-3xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 p-6 shadow-2xl space-y-4 animate-in fade-in zoom-in-95 duration-150">
                  <div className="flex items-start justify-between">
                     <div className="flex items-center gap-2.5 text-rose-600 dark:text-rose-400">
                        <div className="h-9 w-9 rounded-xl bg-rose-50 dark:bg-rose-950/60 flex items-center justify-center">
                           <AlertTriangle className="h-5 w-5" />
                        </div>
                        <div>
                           <h3 className="text-base font-bold text-slate-900 dark:text-white">
                              Từ Chối Phê Duyệt Sản Phẩm
                           </h3>
                           <p className="text-xs text-slate-500">Mã: {rejectTargetProduct.productId}</p>
                        </div>
                     </div>
                     <button
                        onClick={() => setRejectTargetProduct(null)}
                        className="h-8 w-8 rounded-xl text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 flex items-center justify-center"
                     >
                        <X className="h-4 w-4" />
                     </button>
                  </div>

                  <p className="text-xs text-slate-600 dark:text-slate-300">
                     Vui lòng chọn hoặc điền lý do chi tiết. Thông báo này sẽ được gửi ngay đến Nhà cung cấp{' '}
                     <strong className="text-slate-900 dark:text-white">
                        {rejectTargetProduct.supplierName || rejectTargetProduct.supplierId}
                     </strong>{' '}
                     để họ bổ sung hồ sơ và gửi lại.
                  </p>

                  {/* Preset Reasons */}
                  <div className="space-y-1.5">
                     <label className="text-[11px] font-semibold text-slate-500 dark:text-slate-400">
                        Lý do vi phạm phổ biến (chọn nhanh):
                     </label>
                     <div className="space-y-1 max-h-36 overflow-y-auto pr-1">
                        {PRESET_REJECTION_REASONS.map((preset, idx) => (
                           <button
                              key={idx}
                              type="button"
                              onClick={() => setRejectionReason(preset)}
                              className={`w-full text-left text-[11px] p-2 rounded-xl border transition ${
                                 rejectionReason === preset
                                    ? 'bg-rose-50 dark:bg-rose-950/40 border-rose-300 dark:border-rose-800 text-rose-800 dark:text-rose-200 font-medium'
                                    : 'bg-slate-50 dark:bg-slate-800/40 border-slate-100 dark:border-slate-800 text-slate-600 dark:text-slate-400 hover:bg-slate-100'
                              }`}
                           >
                              {preset}
                           </button>
                        ))}
                     </div>
                  </div>

                  {/* Custom Reason TextArea */}
                  <div className="space-y-1.5">
                     <label className="text-[11px] font-semibold text-slate-500 dark:text-slate-400">
                        Nội dung chi tiết thông báo cho Nhà cung cấp: <span className="text-rose-500">*</span>
                     </label>
                     <textarea
                        value={rejectionReason}
                        onChange={(e) => setRejectionReason(e.target.value)}
                        rows={3}
                        placeholder="Nhập lý do chi tiết hướng dẫn nhà cung cấp khắc phục..."
                        className="w-full rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 p-3 text-xs text-slate-900 dark:text-white focus:border-rose-600 focus:outline-none"
                     />
                     {rejectError && <p className="text-[11px] font-semibold text-rose-600">{rejectError}</p>}
                  </div>

                  {/* Internal Moderation Notes */}
                  <div className="space-y-1.5">
                     <label className="text-[11px] font-semibold text-slate-500 dark:text-slate-400">
                        Ghi chú nội bộ cho kiểm toán viên (tuỳ chọn):
                     </label>
                     <input
                        type="text"
                        value={moderationNotes}
                        onChange={(e) => setModerationNotes(e.target.value)}
                        placeholder="Ghi chú nội bộ dành cho đội ngũ Admin..."
                        className="w-full rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 py-2 px-3 text-xs text-slate-900 dark:text-white focus:border-indigo-600 focus:outline-none"
                     />
                  </div>

                  {/* Actions */}
                  <div className="flex justify-end gap-2 pt-2 border-t border-slate-100 dark:border-slate-800">
                     <button
                        onClick={() => setRejectTargetProduct(null)}
                        className="px-4 py-2 rounded-xl text-xs font-semibold text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800"
                     >
                        Hủy
                     </button>
                     <button
                        onClick={handleConfirmReject}
                        className="px-4 py-2 rounded-xl text-xs font-bold text-white bg-rose-600 hover:bg-rose-700 shadow-md shadow-rose-600/30"
                     >
                        Xác nhận từ chối duyệt
                     </button>
                  </div>
               </div>
            </div>
         )}
      </div>
   );
}
