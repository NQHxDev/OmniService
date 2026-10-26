export const DISK_GUARD_SERVICE = Symbol('DISK_GUARD_SERVICE');

export interface IDiskSpaceInfo {
   freeBytes: number;
   totalBytes: number;
   freeGb: number;
   totalGb: number;
}

export interface IDiskGuardService {
   getDiskSpace(targetPath?: string): Promise<IDiskSpaceInfo>;
   assertSufficientDiskSpace(targetPath: string, requiredBytes: number): Promise<void>;
   hasSufficientSpace(targetPath?: string, requiredBytes?: number): Promise<boolean>;
}
