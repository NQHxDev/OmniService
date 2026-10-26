import { WhoCategoryEntity } from '@product/entities';

export const WHO_CATEGORY_REPOSITORY = Symbol('WHO_CATEGORY_REPOSITORY');

export interface IWhoCategoryRepository {
   findAll(): Promise<WhoCategoryEntity[]>;
   findByCode(code: string): Promise<WhoCategoryEntity | null>;
}
