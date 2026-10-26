import { Test, TestingModule } from '@nestjs/testing';
import { BadRequestException, DEFAULT_ROLES, type JwtPayload } from '@common';
import type { Request } from 'express';
import { GenderDto } from '@contracts/user';
import { UsersController } from '@/modules/users/users.controller';
import { UsersService } from '@/modules/users/users.service';

describe('UsersController', () => {
   let controller: UsersController;
   const mockReq = { headers: {} } as unknown as Request;
   const mockUsersService = {
      checkUsername: jest.fn(),
      createProfile: jest.fn(),
      getAllUsers: jest.fn(),
      getUserById: jest.fn(),
      updateUsername: jest.fn(),
      updateDisplayName: jest.fn(),
      updateBio: jest.fn(),
      updatePersonalInfo: jest.fn(),
      updateLocation: jest.fn(),
      updateWebsite: jest.fn(),
      updateCoverImage: jest.fn(),
      getMyProfile: jest.fn(),
      getDateOfBirth: jest.fn(),
      searchUsers: jest.fn(),
      getFollowSuggestions: jest.fn(),
   };

   const mockUser: JwtPayload = {
      sub: 'user-1',
      email: 'user@example.com',
      roles: [DEFAULT_ROLES.USER],
   };

   beforeEach(async () => {
      jest.clearAllMocks();

      const module: TestingModule = await Test.createTestingModule({
         controllers: [UsersController],
         providers: [
            {
               provide: UsersService,
               useValue: mockUsersService,
            },
         ],
      }).compile();

      controller = module.get<UsersController>(UsersController);
   });

   it('should be defined', () => {
      expect(controller).toBeDefined();
   });

   describe('checkUsername', () => {
      it('should return availability status for valid username', async () => {
         mockUsersService.checkUsername.mockResolvedValue({ available: true, username: 'john_doe' });

         const result = await controller.checkUsername('john_doe');

         expect(mockUsersService.checkUsername).toHaveBeenCalledWith('john_doe');
         expect(result).toEqual({ available: true, username: 'john_doe' });
      });

      it('should throw BadRequestException if username is empty', async () => {
         await expect(controller.checkUsername('')).rejects.toThrow(BadRequestException);
      });
   });

   describe('createProfile', () => {
      it('should create profile for current authenticated user', async () => {
         const createProfileDto = {
            displayName: 'John Doe',
            username: 'johndoe',
         };
         mockUsersService.createProfile.mockResolvedValue({ id: 'u1', ...createProfileDto });

         const result = await controller.createProfile(createProfileDto, mockUser);

         expect(mockUsersService.createProfile).toHaveBeenCalledWith(createProfileDto, mockUser);
         expect(result).toEqual({ id: 'u1', ...createProfileDto });
      });
   });

   it('should get all users with user context', async () => {
      mockUsersService.getAllUsers.mockResolvedValue([{ id: 'u1' }]);

      const result = await controller.getAllUsers('1', '10', mockUser, mockReq);
      expect(mockUsersService.getAllUsers).toHaveBeenCalledWith(1, 10, mockUser, undefined);
      expect(result).toEqual([{ id: 'u1' }]);
   });

   it('should get user by id with user context', async () => {
      mockUsersService.getUserById.mockResolvedValue({ id: 'u1' });

      const result = await controller.getUserById('u1', mockUser);
      expect(mockUsersService.getUserById).toHaveBeenCalledWith('u1', mockUser);
      expect(result).toEqual({ id: 'u1' });
   });

   it('should update username via updateMyUsername', async () => {
      mockUsersService.updateUsername.mockResolvedValue({ id: 'u1', username: 'new_john' });

      const result = await controller.updateMyUsername({ username: 'new_john' }, mockUser);
      expect(mockUsersService.updateUsername).toHaveBeenCalledWith(mockUser.sub, 'new_john', mockUser);
      expect(result).toEqual({ id: 'u1', username: 'new_john' });
   });

   it('should get current user profile via getMyProfile', async () => {
      mockUsersService.getMyProfile.mockResolvedValue({
         userId: 'u1',
         displayName: 'My Name',
         username: 'myusername',
      });

      const result = await controller.getMyProfile(mockUser);
      expect(mockUsersService.getMyProfile).toHaveBeenCalledWith(mockUser);
      expect(result).toEqual({ userId: 'u1', displayName: 'My Name', username: 'myusername' });
   });

   it('should update display name via updateMyDisplayName', async () => {
      mockUsersService.updateDisplayName.mockResolvedValue({
         id: 'u1',
         displayName: 'New Display Name',
      });

      const result = await controller.updateMyDisplayName({ displayName: 'New Display Name' }, mockUser);
      expect(mockUsersService.updateDisplayName).toHaveBeenCalledWith(mockUser.sub, 'New Display Name', mockUser);
      expect(result).toEqual({ id: 'u1', displayName: 'New Display Name' });
   });

   it('should update personal info via updateMyPersonalInfo', async () => {
      const dob = '1995-05-20';
      mockUsersService.updatePersonalInfo.mockResolvedValue({
         id: 'u1',
         dateOfBirth: dob,
         gender: GenderDto.MALE,
      });

      const result = await controller.updateMyPersonalInfo({ dateOfBirth: dob, gender: GenderDto.MALE }, mockUser);
      expect(mockUsersService.updatePersonalInfo).toHaveBeenCalledWith(
         mockUser.sub,
         { dateOfBirth: dob, gender: GenderDto.MALE },
         mockUser,
      );
      expect(result).toEqual({ id: 'u1', dateOfBirth: dob, gender: GenderDto.MALE });
   });

   it('should get current user date of birth via getMyDateOfBirth', async () => {
      const mockDobRes = {
         userId: 'user-1',
         dateOfBirth: '1995-06-15T00:00:00.000Z',
         age: 31,
      };
      mockUsersService.getDateOfBirth.mockResolvedValue(mockDobRes);

      const result = await controller.getMyDateOfBirth(mockUser, mockReq);
      expect(mockUsersService.getDateOfBirth).toHaveBeenCalledWith('user-1', mockUser, undefined);
      expect(result).toEqual(mockDobRes);
   });

   it('should get user date of birth by id via getUserDateOfBirth', async () => {
      const mockDobRes = {
         userId: 'other-user-99',
         dateOfBirth: '2000-01-01T00:00:00.000Z',
         age: 26,
      };
      mockUsersService.getDateOfBirth.mockResolvedValue(mockDobRes);

      const result = await controller.getUserDateOfBirth('other-user-99', mockUser, mockReq);
      expect(mockUsersService.getDateOfBirth).toHaveBeenCalledWith('other-user-99', mockUser, undefined);
      expect(result).toEqual(mockDobRes);
   });

   it('should search users via searchUsers endpoint with cursor', async () => {
      const mockSearchRes = {
         items: [{ id: 'u1', username: 'alex', displayName: 'Alex' }],
         meta: { nextCursor: 'next_cursor_1', hasMore: true, limit: 10, total: 1 },
      };
      mockUsersService.searchUsers.mockResolvedValue(mockSearchRes);

      const result = await controller.searchUsers({ q: 'alex', limit: 10, cursor: 'cur_1' }, mockUser);
      expect(mockUsersService.searchUsers).toHaveBeenCalledWith('alex', 10, 'cur_1', mockUser);
      expect(result).toEqual(mockSearchRes);
   });

   it('should get follow suggestions via getFollowSuggestions endpoint', async () => {
      const mockSuggestions = [
         { id: 'u2', username: 'sarah', displayName: 'Sarah', reason: 'mutual_friends', mutualCount: 2 },
      ];
      mockUsersService.getFollowSuggestions.mockResolvedValue(mockSuggestions);

      const result = await controller.getFollowSuggestions({ limit: 10 }, mockUser);
      expect(mockUsersService.getFollowSuggestions).toHaveBeenCalledWith(10, mockUser);
      expect(result).toEqual(mockSuggestions);
   });
});
