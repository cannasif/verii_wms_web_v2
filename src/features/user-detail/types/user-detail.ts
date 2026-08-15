import { z } from 'zod';
import type { ApiResponse } from '@/types/api';
import type { TFunction } from 'i18next';
import { serializeProfileMeta } from '../utils/profile-description-meta';
import type { WmsBackgroundMotionVariant } from '@/lib/background-motion';
import type { NavbarCenterMode, NavbarKpiKey } from '@/lib/navbar-preferences';

export const Gender = {
  NotSpecified: 0,
  Male: 1,
  Female: 2,
  Other: 3,
} as const;

export type Gender = typeof Gender[keyof typeof Gender];

export interface UserDetailDto {
  id: number;
  userId: number;
  profilePictureUrl?: string | null;
  height?: number | null;
  weight?: number | null;
  description?: string | null;
  gender?: Gender | null;
  backgroundMotionEnabled: boolean;
  backgroundMotionVariant: WmsBackgroundMotionVariant;
  navbarCenterMode: NavbarCenterMode;
  navbarKpiKeys: NavbarKpiKey[];
  createdDate?: string | null;
  updatedDate?: string | null;
}

export interface CreateUserDetailDto {
  userId: number;
  height?: number;
  weight?: number;
  description?: string;
  gender?: Gender;
}

export interface UpdateUserDetailDto {
  height?: number;
  weight?: number;
  description?: string;
  gender?: Gender;
}

export interface UpdateUserAppearanceDto {
  backgroundMotionEnabled: boolean;
  backgroundMotionVariant: WmsBackgroundMotionVariant;
  navbarCenterMode: NavbarCenterMode;
  navbarKpiKeys: NavbarKpiKey[];
}

export type UserDetailResponse = ApiResponse<UserDetailDto>;
export type CreateUserDetailResponse = ApiResponse<UserDetailDto>;
export type UpdateUserDetailResponse = ApiResponse<UserDetailDto>;
export type UpdateUserAppearanceResponse = ApiResponse<UserDetailDto>;

export const createUserDetailFormSchema = (t: TFunction) =>
  z
    .object({
      height: z
        .number()
        .min(0, t('userDetail.heightMin'))
        .max(300, t('userDetail.heightMax'))
        .nullable()
        .optional(),
      weight: z
        .number()
        .min(0, t('userDetail.weightMin'))
        .max(500, t('userDetail.weightMax'))
        .nullable()
        .optional(),
      note: z.string().max(1900).optional().or(z.literal('')),
      phone: z.string().max(40).optional().or(z.literal('')),
      linkedInUrl: z.union([z.literal(''), z.string().url({ message: t('userDetail.invalidUrl') })]).optional(),
      gender: z
        .number()
        .refine((val) => Object.values(Gender).includes(val as Gender), {
          message: t('userDetail.invalidGender'),
        })
        .nullable()
        .optional(),
    })
    .superRefine((data, ctx) => {
      const serialized = serializeProfileMeta({
        note: data.note ?? '',
        phone: data.phone ?? '',
        linkedInUrl: data.linkedInUrl ?? '',
      });
      if (serialized.length > 2000) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: t('userDetail.descriptionMax'),
          path: ['note'],
        });
      }
    });

export type UserDetailFormData = z.infer<ReturnType<typeof createUserDetailFormSchema>>;
