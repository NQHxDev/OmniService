import { WhoCategoryRepository } from './who-category.repository';

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
      it('should return records from database ordered by order asc', async () => {
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

      it('should return empty array if database table is empty without fallback', async () => {
         mockPrisma.whoCategory.findMany.mockResolvedValue([]);

         const result = await repository.findAll();

         expect(mockPrisma.whoCategory.findMany).toHaveBeenCalledWith({
            orderBy: { order: 'asc' },
         });
         expect(result).toEqual([]);
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

         expect(mockPrisma.whoCategory.findUnique).toHaveBeenCalledWith({
            where: { code: 'DAIRY' },
         });
         expect(result).toBe(dbCategory);
      });

      it('should return null if not found in database without fallback', async () => {
         mockPrisma.whoCategory.findUnique.mockResolvedValue(null);

         const result = await repository.findByCode('NON_EXISTENT');

         expect(mockPrisma.whoCategory.findUnique).toHaveBeenCalledWith({
            where: { code: 'NON_EXISTENT' },
         });
         expect(result).toBeNull();
      });
   });
});
