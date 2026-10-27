import { WhoCategoryRepository } from './who-category.repository';
import { WHO_FOOD_GROUPS } from '@contracts/product';

describe('WhoCategoryRepository', () => {
   let repository: WhoCategoryRepository;

   const mockPrisma = {
      whoCategory: {
         findMany: jest.fn(),
         findUnique: jest.fn(),
      },
   };

   beforeEach(() => {
      jest.clearAllMocks();
      repository = new WhoCategoryRepository(mockPrisma as never);
   });

   describe('findAll', () => {
      it('should return records from database if present', async () => {
         const dbCategories = [
            {
               code: 'STAPLES',
               name: 'Lương thực chính',
               description: 'Tinh bột',
               examples: 'Gạo',
               order: 1,
               createdAt: new Date(),
               updatedAt: new Date(),
            },
         ];
         mockPrisma.whoCategory.findMany.mockResolvedValue(dbCategories);

         const result = await repository.findAll();

         expect(mockPrisma.whoCategory.findMany).toHaveBeenCalledWith({
            orderBy: { order: 'asc' },
         });
         expect(result).toBe(dbCategories);
      });

      it('should fallback to WHO_FOOD_GROUPS if database table is empty', async () => {
         mockPrisma.whoCategory.findMany.mockResolvedValue([]);

         const result = await repository.findAll();

         expect(result).toHaveLength(8);
         expect(result[0].code).toBe(WHO_FOOD_GROUPS[0].code);
      });
   });

   describe('findByCode', () => {
      it('should return database record when found', async () => {
         const dbCategory = {
            code: 'DAIRY',
            name: 'Sữa',
            description: 'Sữa tươi',
            examples: 'Sữa',
            order: 3,
            createdAt: new Date(),
            updatedAt: new Date(),
         };
         mockPrisma.whoCategory.findUnique.mockResolvedValue(dbCategory);

         const result = await repository.findByCode('DAIRY');

         expect(result).toBe(dbCategory);
      });

      it('should fallback to WHO_FOOD_GROUPS if not found in database', async () => {
         mockPrisma.whoCategory.findUnique.mockResolvedValue(null);

         const result = await repository.findByCode('DAIRY');

         expect(result).not.toBeNull();
         expect(result?.code).toBe('DAIRY');
      });

      it('should return null if code is invalid and not found in fallback', async () => {
         mockPrisma.whoCategory.findUnique.mockResolvedValue(null);

         const result = await repository.findByCode('INVALID_CODE');

         expect(result).toBeNull();
      });
   });
});
