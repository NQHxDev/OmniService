export const WHO_CATEGORY_CODES = {
   STAPLES: 'STAPLES',
   LEGUMES_NUTS_SEEDS: 'LEGUMES_NUTS_SEEDS',
   DAIRY: 'DAIRY',
   MEAT_FISH_POULTRY: 'MEAT_FISH_POULTRY',
   EGGS: 'EGGS',
   VITAMIN_A_FRUITS_VEG: 'VITAMIN_A_FRUITS_VEG',
   OTHER_FRUITS_VEG: 'OTHER_FRUITS_VEG',
   FATS_OILS: 'FATS_OILS',
} as const;

export type WhoCategoryCode = (typeof WHO_CATEGORY_CODES)[keyof typeof WHO_CATEGORY_CODES];

export interface WhoCategoryDefinition {
   code: WhoCategoryCode;
   name: string;
   description: string;
   examples: string;
   order: number;
}

export const WHO_FOOD_GROUPS: readonly WhoCategoryDefinition[] = [
   {
      code: WHO_CATEGORY_CODES.STAPLES,
      name: 'Lương thực chính (Tinh bột)',
      description: 'Gạo, ngô, lúa mì, khoai lang, khoai tây, sắn và các loại củ giàu tinh bột khác.',
      examples: 'Gạo tẻ, gạo lứt, ngô ngọt, khoai lang mật, khoai tây, bột mì, bột sắn dây',
      order: 1,
   },
   {
      code: WHO_CATEGORY_CODES.LEGUMES_NUTS_SEEDS,
      name: 'Các loại đậu và hạt',
      description: 'Đậu nành, đậu phộng, đậu xanh, đậu đen, hạt điều, hạt hạnh nhân...',
      examples: 'Đậu đen xanh lòng, đậu xanh tách vỏ, hạt điều rang muối, đậu phộng sẻ, hạt sen khô',
      order: 2,
   },
   {
      code: WHO_CATEGORY_CODES.DAIRY,
      name: 'Sữa và các sản phẩm từ sữa',
      description: 'Sữa tươi, sữa chua, phô mai (ngoại trừ bơ).',
      examples: 'Sữa tươi thanh trùng, sữa tiệt trùng, sữa chua không đường, phô mai cheddar, mozzarella',
      order: 3,
   },
   {
      code: WHO_CATEGORY_CODES.MEAT_FISH_POULTRY,
      name: 'Thịt, cá và gia cầm',
      description: 'Thịt bò, thịt heo, thịt gà, vịt, các loại cá, tôm, cua và hải sản.',
      examples: 'Thịt bò phi lê, thịt ba rọi heo, ức gà ta, cá hồi phi lê, tôm sú sống, cua biển',
      order: 4,
   },
   {
      code: WHO_CATEGORY_CODES.EGGS,
      name: 'Trứng',
      description: 'Trứng gà, trứng vịt, trứng cút...',
      examples: 'Trứng gà ta thảo mộc, trứng vịt thả đồng, trứng cút tươi',
      order: 5,
   },
   {
      code: WHO_CATEGORY_CODES.VITAMIN_A_FRUITS_VEG,
      name: 'Rau củ và quả giàu Vitamin A',
      description: 'Cà rốt, bí ngô, khoai lang ruột vàng, đu đủ, xoài chín, rau ngót, rau muống.',
      examples: 'Cà rốt hữu cơ Đà Lạt, bí đỏ hồ lô, đu đủ chín cây, rau ngót ta, rau muống non',
      order: 6,
   },
   {
      code: WHO_CATEGORY_CODES.OTHER_FRUITS_VEG,
      name: 'Rau củ và quả khác',
      description: 'Bắp cải, dưa leo, cà chua, chuối, táo...',
      examples: 'Bắp cải trắng, dưa leo baby, cà chua bi cherry, chuối già Nam Mỹ, nấm hương tươi',
      order: 7,
   },
   {
      code: WHO_CATEGORY_CODES.FATS_OILS,
      name: 'Chất béo và dầu mỡ',
      description: 'Dầu thực vật, mỡ động vật, bơ.',
      examples: 'Dầu mè nguyên chất, dầu đậu nành ép lạnh, mỡ heo sạch, bơ động vật lạt',
      order: 8,
   },
] as const;
