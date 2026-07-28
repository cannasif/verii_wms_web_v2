import { type ReactElement, useState, useEffect, useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { useAuthStore } from '@/stores/auth-store';
import { useProjectSettingsStore } from '@/stores/project-settings-store';
import { toast } from 'sonner';
import { OpsActionButton } from '@/components/shared/OpsActionButton';
import { OpsFieldShell } from '@/components/shared/OpsFieldShell';
import { OpsSelect } from '@/components/shared/OpsSelect';
import { OPS_FIELD_CLASS } from '@/components/shared/ops-field-styles';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form';
import { useUserDetail } from '../hooks/useUserDetail';
import { useCreateUserDetail } from '../hooks/useCreateUserDetail';
import { useUpdateUserDetail } from '../hooks/useUpdateUserDetail';
import { createUserDetailFormSchema, type UserDetailFormData, Gender } from '../types/user-detail';
import { parseProfileMeta, serializeProfileMeta } from '../utils/profile-description-meta';
import { useChangePassword } from '@/features/auth/hooks/useChangePassword';
import type { ChangePasswordRequest } from '@/features/auth/types/auth';
import {
  Loader2,
  Shield,
  Lock,
  Eye,
  EyeOff,
  Ruler,
  Scale,
  User,
  Phone,
  Mail,
  Linkedin,
  type LucideIcon,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { type ComponentProps } from 'react';

export interface ProfileSettingsModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

type ProfileTab = 'personal' | 'security';

function ProfileSettingsIconInput({
  icon: Icon,
  invalid,
  className,
  ...props
}: {
  icon: LucideIcon;
  invalid?: boolean;
} & ComponentProps<typeof Input>): ReactElement {
  return (
    <OpsFieldShell aria-invalid={invalid}>
      <div className="relative">
        <Icon className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2" aria-hidden />
        <Input
          className={cn(OPS_FIELD_CLASS, 'pl-10', className)}
          aria-invalid={invalid}
          {...props}
        />
      </div>
    </OpsFieldShell>
  );
}

function ProfileSettingsPasswordInput({
  icon: Icon,
  invalid,
  visible,
  onToggleVisible,
  ...props
}: {
  icon: LucideIcon;
  invalid?: boolean;
  visible: boolean;
  onToggleVisible: () => void;
} & ComponentProps<typeof Input>): ReactElement {
  return (
    <OpsFieldShell aria-invalid={invalid}>
      <div className="relative">
        <Icon className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2" aria-hidden />
        <Input
          className={cn(OPS_FIELD_CLASS, 'pl-10 pr-10')}
          aria-invalid={invalid}
          type={visible ? 'text' : 'password'}
          {...props}
        />
        <button
          type="button"
          onClick={onToggleVisible}
          className="absolute right-3 top-1/2 -translate-y-1/2 text-[var(--wms-ops-accent)] opacity-70 transition-opacity hover:opacity-100"
        >
          {visible ? <EyeOff className="size-4" aria-hidden /> : <Eye className="size-4" aria-hidden />}
        </button>
      </div>
    </OpsFieldShell>
  );
}

export function ProfileSettingsModal({ open, onOpenChange }: ProfileSettingsModalProps): ReactElement {
  const { t } = useTranslation();
  const { user } = useAuthStore();
  const [tab, setTab] = useState<ProfileTab>('personal');
  const [isEditMode, setIsEditMode] = useState(false);
  const [isCurrentPasswordVisible, setIsCurrentPasswordVisible] = useState(false);
  const [isNewPasswordVisible, setIsNewPasswordVisible] = useState(false);
  const passwordMinimumLength = useProjectSettingsStore((state) => state.settings.passwordMinimumLength);
  const passwordMaximumLength = useProjectSettingsStore((state) => state.settings.passwordMaximumLength);

  const { data: userDetail, isLoading: isLoadingUserDetail, refetch } = useUserDetail();
  const createMutation = useCreateUserDetail();
  const updateMutation = useUpdateUserDetail();
  const changePasswordMutation = useChangePassword();

  const schema = useMemo(() => createUserDetailFormSchema(t), [t]);

  const form = useForm<UserDetailFormData>({
    resolver: zodResolver(schema),
    defaultValues: {
      height: null,
      weight: null,
      note: '',
      phone: '',
      linkedInUrl: '',
      gender: null,
    },
  });

  const changePasswordSchema = useMemo(
    () =>
      z
        .object({
          currentPassword: z.string().min(1, t('userDetail.currentPasswordRequired')),
          newPassword: z
            .string()
            .min(passwordMinimumLength, t('userDetail.newPasswordMinLength', { min: passwordMinimumLength }))
            .max(passwordMaximumLength, t('userDetail.newPasswordMaxLength', { max: passwordMaximumLength })),
        })
        .refine((data) => data.currentPassword !== data.newPassword, {
          message: t('userDetail.newPasswordSameAsCurrent'),
          path: ['newPassword'],
        }),
    [passwordMaximumLength, passwordMinimumLength, t]
  );

  const changePasswordForm = useForm<ChangePasswordRequest>({
    resolver: zodResolver(changePasswordSchema),
    defaultValues: {
      currentPassword: '',
      newPassword: '',
    },
  });

  useEffect(() => {
    if (open) {
      void refetch();
    }
  }, [open, refetch]);

  useEffect(() => {
    if (!open) {
      setTab('personal');
    }
  }, [open]);

  useEffect(() => {
    if (userDetail) {
      setIsEditMode(true);
      const meta = parseProfileMeta(userDetail.description ?? undefined);
      form.reset({
        height: userDetail.height ?? null,
        weight: userDetail.weight ?? null,
        note: meta.note,
        phone: meta.phone,
        linkedInUrl: meta.linkedInUrl,
        gender: userDetail.gender ?? null,
      });
    } else if (!isLoadingUserDetail && open) {
      setIsEditMode(false);
      form.reset({
        height: null,
        weight: null,
        note: '',
        phone: '',
        linkedInUrl: '',
        gender: null,
      });
    }
  }, [userDetail, isLoadingUserDetail, open, form]);

  const descriptionPayload = (data: UserDetailFormData): string =>
    serializeProfileMeta({
      note: data.note ?? '',
      phone: data.phone ?? '',
      linkedInUrl: data.linkedInUrl ?? '',
    });

  const handleSubmitProfile = (data: UserDetailFormData): void => {
    const desc = descriptionPayload(data);
    if (isEditMode) {
      updateMutation.mutate(
        {
          height: data.height ?? undefined,
          weight: data.weight ?? undefined,
          description: desc || undefined,
          gender: (data.gender ?? undefined) as Gender | undefined,
        },
        {
          onSuccess: () => {
            toast.success(t('userDetail.updatedSuccessfully'));
            onOpenChange(false);
          },
          onError: (error: Error) => {
            toast.error(error.message || t('userDetail.updateError'));
          },
        }
      );
    } else {
      if (!user?.id) {
        toast.error(t('userDetail.userNotFound'));
        return;
      }
      createMutation.mutate(
        {
          userId: user.id,
          height: data.height ?? undefined,
          weight: data.weight ?? undefined,
          description: desc || undefined,
          gender: (data.gender ?? undefined) as Gender | undefined,
        },
        {
          onSuccess: () => {
            toast.success(t('userDetail.createdSuccessfully'));
            onOpenChange(false);
          },
          onError: (error: Error) => {
            toast.error(error.message || t('userDetail.createError'));
          },
        }
      );
    }
  };

  const handleChangePasswordSubmit = async (data: ChangePasswordRequest): Promise<void> => {
    await changePasswordMutation.mutateAsync(data);
    changePasswordForm.reset();
  };

  const isLoading = isLoadingUserDetail || createMutation.isPending || updateMutation.isPending;
  const isChangingPassword = changePasswordMutation.isPending;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
          showCloseButton
          tone="plain"
          portalRoot="body"
          className={cn(
            'wms-ops-profile-settings wms-ops-form flex h-full max-h-[100dvh] w-full max-w-[min(100vw,24rem)] flex-col gap-0 overflow-hidden p-0 sm:max-w-[28rem]',
            '!fixed !top-0 !right-0 !bottom-0 !left-auto !flex !translate-x-0 !translate-y-0',
            'data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0 data-[state=closed]:slide-out-to-right data-[state=open]:slide-in-from-right data-[state=closed]:zoom-out-100 data-[state=open]:zoom-in-100 duration-300',
          )}
        >
          <div className="wms-ops-profile-settings__header shrink-0">
            <DialogHeader className="gap-2 space-y-0 text-left">
              <DialogTitle className="wms-ops-profile-settings__title">
                {t('profile.profileSettings')}
              </DialogTitle>
              <DialogDescription className="wms-ops-profile-settings__subtitle">
                {t('profile.settingsModalSubtitle')}
              </DialogDescription>
            </DialogHeader>

            <div className="wms-ops-profile-settings__tabs" role="tablist">
              <button
                type="button"
                role="tab"
                aria-selected={tab === 'personal'}
                onClick={() => setTab('personal')}
                className={cn(
                  'wms-ops-profile-settings__tab',
                  tab === 'personal' && 'wms-ops-profile-settings__tab--active',
                )}
              >
                <User className="size-4 shrink-0" aria-hidden />
                {t('profile.tabPersonal')}
              </button>
              <button
                type="button"
                role="tab"
                aria-selected={tab === 'security'}
                onClick={() => setTab('security')}
                className={cn(
                  'wms-ops-profile-settings__tab',
                  tab === 'security' && 'wms-ops-profile-settings__tab--active',
                )}
              >
                <Lock className="size-4 shrink-0" aria-hidden />
                {t('profile.tabSecurity')}
              </button>
            </div>
          </div>

          <div className="wms-ops-profile-settings__body wms-ops-scrollbar flex min-h-0 flex-1 flex-col overflow-y-auto">
            {isLoadingUserDetail ? (
              <div className="flex items-center justify-center py-14">
                <Loader2 className="size-8 animate-spin text-[var(--cyb-cyan)]" aria-hidden />
              </div>
            ) : tab === 'personal' ? (
              <Form {...form}>
                <form onSubmit={form.handleSubmit(handleSubmitProfile)} className="wms-ops-profile-settings__form">
                  <FormField
                    control={form.control}
                    name="note"
                    render={({ field }) => <input type="hidden" {...field} />}
                  />

                  <div className="wms-ops-profile-settings__panel">
                    <div className="grid grid-cols-1 gap-5 md:grid-cols-2 md:gap-4">
                      <FormField
                        control={form.control}
                        name="height"
                        render={({ field, fieldState }) => (
                          <FormItem className="wms-ops-form-item">
                            <FormLabel>{t('userDetail.height')}</FormLabel>
                            <FormControl>
                              <ProfileSettingsIconInput
                                icon={Ruler}
                                invalid={fieldState.invalid}
                                type="number"
                                step="0.1"
                                min={0}
                                max={300}
                                placeholder={t('userDetail.placeholderHeight')}
                                {...field}
                                value={field.value ?? ''}
                                onChange={(e) => {
                                  const value = e.target.value;
                                  field.onChange(value === '' ? null : parseFloat(value));
                                }}
                              />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />

                      <FormField
                        control={form.control}
                        name="weight"
                        render={({ field, fieldState }) => (
                          <FormItem className="wms-ops-form-item">
                            <FormLabel>{t('userDetail.weight')}</FormLabel>
                            <FormControl>
                              <ProfileSettingsIconInput
                                icon={Scale}
                                invalid={fieldState.invalid}
                                type="number"
                                step="0.1"
                                min={0}
                                max={500}
                                placeholder={t('userDetail.placeholderWeight')}
                                {...field}
                                value={field.value ?? ''}
                                onChange={(e) => {
                                  const value = e.target.value;
                                  field.onChange(value === '' ? null : parseFloat(value));
                                }}
                              />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                    </div>

                    <div className="mt-5">
                      <FormField
                        control={form.control}
                        name="gender"
                        render={({ field, fieldState }) => (
                          <FormItem className="wms-ops-form-item">
                            <FormLabel>{t('userDetail.genderFieldLabel')}</FormLabel>
                            <FormControl>
                              <OpsSelect
                                value={field.value?.toString() ?? Gender.NotSpecified.toString()}
                                onValueChange={(value) => {
                                  const numValue = parseInt(value, 10);
                                  field.onChange(numValue === Gender.NotSpecified ? null : (numValue as Gender));
                                }}
                                options={[
                                  { value: Gender.NotSpecified.toString(), label: t('userDetail.gender.notSpecified') },
                                  { value: Gender.Male.toString(), label: t('userDetail.gender.male') },
                                  { value: Gender.Female.toString(), label: t('userDetail.gender.female') },
                                  { value: Gender.Other.toString(), label: t('userDetail.gender.other') },
                                ]}
                                aria-invalid={fieldState.invalid}
                              />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                    </div>

                    <div className="mt-5 grid grid-cols-1 gap-5 md:grid-cols-2 md:gap-4">
                      <FormField
                        control={form.control}
                        name="phone"
                        render={({ field, fieldState }) => (
                          <FormItem className="wms-ops-form-item">
                            <FormLabel>{t('userDetail.phoneNumber')}</FormLabel>
                            <FormControl>
                              <ProfileSettingsIconInput
                                icon={Phone}
                                invalid={fieldState.invalid}
                                type="tel"
                                placeholder={t('userDetail.placeholderPhone')}
                                {...field}
                                value={field.value ?? ''}
                              />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />

                      <FormItem className="wms-ops-form-item">
                        <FormLabel>{t('userDetail.emailAddress')}</FormLabel>
                        <ProfileSettingsIconInput
                          icon={Mail}
                          readOnly
                          value={user?.email ?? ''}
                          placeholder={t('userDetail.placeholderEmail')}
                          className="cursor-default opacity-90"
                        />
                      </FormItem>
                    </div>

                    <div className="mt-5">
                      <FormField
                        control={form.control}
                        name="linkedInUrl"
                        render={({ field, fieldState }) => (
                          <FormItem className="wms-ops-form-item">
                            <FormLabel>{t('userDetail.linkedInProfile')}</FormLabel>
                            <FormControl>
                              <ProfileSettingsIconInput
                                icon={Linkedin}
                                invalid={fieldState.invalid}
                                type="url"
                                placeholder={t('userDetail.placeholderLinkedIn')}
                                {...field}
                                value={field.value ?? ''}
                              />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                    </div>
                  </div>

                  <DialogFooter className="wms-ops-profile-settings__footer wms-ops-actions">
                    <OpsActionButton
                      type="button"
                      variant="secondary"
                      onClick={() => onOpenChange(false)}
                      disabled={isLoading}
                    >
                      {t('common.cancel')}
                    </OpsActionButton>
                    <OpsActionButton type="submit" variant="primary" disabled={isLoading}>
                      {isLoading ? (
                        <>
                          <Loader2 className="mr-2 size-4 animate-spin" aria-hidden />
                          {t('common.saving')}
                        </>
                      ) : isEditMode ? (
                        t('common.update')
                      ) : (
                        t('common.save')
                      )}
                    </OpsActionButton>
                  </DialogFooter>
                </form>
              </Form>
            ) : (
              <Form {...changePasswordForm}>
                <form
                  onSubmit={changePasswordForm.handleSubmit(handleChangePasswordSubmit)}
                  className="wms-ops-profile-settings__form"
                >
                  <div className="wms-ops-profile-settings__panel">
                    <FormField
                      control={changePasswordForm.control}
                      name="currentPassword"
                      render={({ field, fieldState }) => (
                        <FormItem className="wms-ops-form-item">
                          <FormLabel>{t('userDetail.currentPassword')}</FormLabel>
                          <FormControl>
                            <ProfileSettingsPasswordInput
                              icon={Lock}
                              invalid={fieldState.invalid}
                              visible={isCurrentPasswordVisible}
                              onToggleVisible={() => setIsCurrentPasswordVisible((v) => !v)}
                              placeholder="••••••••"
                              {...field}
                            />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />

                    <div className="mt-5">
                      <FormField
                        control={changePasswordForm.control}
                        name="newPassword"
                        render={({ field, fieldState }) => (
                          <FormItem className="wms-ops-form-item">
                            <FormLabel>{t('userDetail.newPassword')}</FormLabel>
                            <FormControl>
                              <ProfileSettingsPasswordInput
                                icon={Lock}
                                invalid={fieldState.invalid}
                                visible={isNewPasswordVisible}
                                onToggleVisible={() => setIsNewPasswordVisible((v) => !v)}
                                placeholder={t('userDetail.newPasswordPlaceholder')}
                                maxLength={passwordMaximumLength}
                                {...field}
                              />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                    </div>

                    <div className="mt-6 flex justify-end">
                      <OpsActionButton type="submit" variant="primary" disabled={isChangingPassword}>
                        {isChangingPassword ? (
                          <>
                            <Loader2 className="mr-2 size-4 animate-spin" aria-hidden />
                            {t('userDetail.changingPassword')}
                          </>
                        ) : (
                          <>
                            <Shield className="mr-2 size-4" aria-hidden />
                            {t('userDetail.changePasswordButton')}
                          </>
                        )}
                      </OpsActionButton>
                    </div>
                  </div>
                </form>
              </Form>
            )}
          </div>
        </DialogContent>
    </Dialog>
  );
}
