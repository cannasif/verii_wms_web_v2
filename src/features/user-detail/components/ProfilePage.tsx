import { type ReactElement, type ChangeEvent, useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Link } from 'react-router-dom';
import { toast } from 'sonner';
import { ArrowLeftRight, ArrowRight, Boxes, Building2, Camera, ClipboardList, Loader2, Mail, Settings, ShieldCheck } from 'lucide-react';
import { useAuthStore } from '@/stores/auth-store';
import { useUIStore } from '@/stores/ui-store';
import { formatProjectNumber } from '@/lib/project-format';
import { OpsActionButton } from '@/components/shared/OpsActionButton';
import { usePermissionAccess } from '@/features/access-control/hooks/usePermissionAccess';
import { useDashboardMetrics } from '@/features/dashboard/hooks/useDashboardMetrics';
import { useUserDetail } from '../hooks/useUserDetail';
import { useUploadProfilePicture } from '../hooks/useUploadProfilePicture';
import { getFullProfileImageUrl } from '../utils/profile-image';
import { ProfileSettingsModal } from './ProfileSettingsModal';

const MAX_PROFILE_IMAGE_BYTES = 5 * 1024 * 1024;
const PROFILE_IMAGE_ACCEPT_TYPES = ['image/jpeg', 'image/jpg', 'image/png', 'image/gif', 'image/webp'] as const;
const PROFILE_IMAGE_ACCEPT_ATTR = PROFILE_IMAGE_ACCEPT_TYPES.join(',');

export function ProfilePage(): ReactElement {
  const { t } = useTranslation();
  const { user, branch } = useAuthStore();
  const { setPageTitle } = useUIStore();
  const { data: userDetail, isLoading: isLoadingUserDetail } = useUserDetail();
  const permissionAccess = usePermissionAccess();
  const { metrics, isLoading: isLoadingMetrics } = useDashboardMetrics();
  const uploadPictureMutation = useUploadProfilePicture();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [profileSettingsOpen, setProfileSettingsOpen] = useState(false);

  useEffect(() => {
    setPageTitle(t('profile.title'));
    return () => setPageTitle(null);
  }, [setPageTitle, t]);

  const displayName = user?.name || user?.email || t('dashboard.user');
  const normalizedDisplayName = displayName.trim().toLowerCase();
  const isSystemLikeDisplayName =
    normalizedDisplayName.startsWith('system') || normalizedDisplayName.startsWith('sistem');
  const displayInitial = isSystemLikeDisplayName ? 'S' : displayName.charAt(0).toUpperCase();
  const imageUrl = getFullProfileImageUrl(userDetail?.profilePictureUrl);
  const emailLine = user?.email ?? '—';
  const branchCodeTrimmed = branch?.code?.trim();
  const branchCodeDisplay =
    branchCodeTrimmed && branchCodeTrimmed.toLowerCase() !== '0'
      ? branchCodeTrimmed.toUpperCase()
      : undefined;
  const branchLine =
    branch != null
      ? [branchCodeDisplay, branch.name?.trim()]
          .filter((part): part is string => Boolean(part?.trim()))
          .join(' · ') || '—'
      : '—';

  const wmsCards = [
    {
      key: 'assignments',
      visible: permissionAccess.can('wms.goods-receipt.view') || permissionAccess.can('wms.shipment.view'),
      label: t('dashboard.terminal.myAssignments'),
      description: t('dashboard.terminal.myAssignmentsHint'),
      value: metrics.myTasksCount,
      href: permissionAccess.can('wms.goods-receipt.view') ? '/goods-receipt/assigned' : '/shipment/assigned',
      icon: ClipboardList,
      iconClassName: 'border-cyan-500/30 bg-cyan-500/10 text-cyan-600 dark:text-cyan-300',
    },
    {
      key: 'approvals',
      visible: permissionAccess.can('wms.goods-receipt.update'),
      label: t('dashboard.terminal.pendingApproval'),
      description: t('dashboard.terminal.pendingApprovalHint'),
      value: metrics.pendingApprovalCount,
      href: '/goods-receipt/approval',
      icon: ShieldCheck,
      iconClassName: 'border-amber-500/30 bg-amber-500/10 text-amber-700 dark:text-amber-300',
    },
    {
      key: 'stock',
      visible: permissionAccess.can('wms.warehouse-balance.view'),
      label: t('dashboard.terminal.stockSkuCount'),
      description: t('dashboard.terminal.stockSkuHint'),
      value: metrics.stockSkuCount,
      href: '/erp/warehouse-stock-balance',
      icon: Boxes,
      iconClassName: 'border-emerald-500/30 bg-emerald-500/10 text-emerald-700 dark:text-emerald-300',
    },
    {
      key: 'transfers',
      visible: permissionAccess.can('wms.transfer.view'),
      label: t('dashboard.terminal.transferCount'),
      description: t('dashboard.terminal.transferHint'),
      value: metrics.transferCount,
      href: '/transfer/list',
      icon: ArrowLeftRight,
      iconClassName: 'border-fuchsia-500/30 bg-fuchsia-500/10 text-fuchsia-700 dark:text-fuchsia-300',
    },
  ].filter((card) => card.visible);

  const handleAvatarPickClick = (): void => {
    if (uploadPictureMutation.isPending) return;
    fileInputRef.current?.click();
  };

  const handleProfileImageSelected = (event: ChangeEvent<HTMLInputElement>): void => {
    const input = event.target;
    const file = input.files?.[0];
    input.value = '';
    if (!file) return;

    const allowedTypes: readonly string[] = PROFILE_IMAGE_ACCEPT_TYPES;
    if (!allowedTypes.includes(file.type)) {
      toast.error(t('userDetail.invalidFileFormat'));
      return;
    }
    if (file.size > MAX_PROFILE_IMAGE_BYTES) {
      toast.error(t('userDetail.fileSizeExceeded'));
      return;
    }

    uploadPictureMutation.mutate(file, {
      onSuccess: (response) => {
        if (response.success && response.data) {
          toast.success(t('userDetail.profilePictureUploadedSuccessfully'));
        } else {
          toast.error(response.message || t('userDetail.profilePictureUploadError'));
        }
      },
      onError: (error: Error) => {
        toast.error(error.message || t('userDetail.profilePictureUploadError'));
      },
    });
  };

  return (
    <div className="wms-ops-profile-page mx-auto w-full max-w-6xl px-4 pb-12 pt-2 md:px-6">
      <section aria-label={t('profile.title')} className="wms-ops-profile-page__card wms-ops-form">
        <span className="wms-ops-profile-page__frame" aria-hidden>
          <span className="wms-ops-profile-page__corner wms-ops-profile-page__corner--tl" />
          <span className="wms-ops-profile-page__corner wms-ops-profile-page__corner--tr" />
          <span className="wms-ops-profile-page__corner wms-ops-profile-page__corner--bl" />
          <span className="wms-ops-profile-page__corner wms-ops-profile-page__corner--br" />
        </span>

        {isLoadingUserDetail ? (
          <div className="flex w-full items-center justify-center py-16">
            <Loader2 className="size-8 animate-spin text-[var(--cyb-cyan)]" aria-hidden />
          </div>
        ) : (
          <div className="wms-ops-profile-page__content">
            <div className="wms-ops-profile-page__toolbar">
              <p className="wms-ops-profile-page__eyebrow">
                {t('profile.terminal.eyebrow', { defaultValue: 'PROFIL / KULLANICI' })}
              </p>
              <OpsActionButton
                type="button"
                variant="secondary"
                onClick={() => setProfileSettingsOpen(true)}
                className="wms-ops-profile-page__settings-btn wms-ops-action-btn--secondary"
              >
                <Settings className="size-4 shrink-0" strokeWidth={1.85} aria-hidden />
                {t('profile.profileSettings')}
              </OpsActionButton>
            </div>

            <div className="wms-ops-profile-page__main">
              <div className="wms-ops-profile-page__avatar-wrap">
                <input
                  ref={fileInputRef}
                  type="file"
                  accept={PROFILE_IMAGE_ACCEPT_ATTR}
                  className="sr-only"
                  tabIndex={-1}
                  onChange={handleProfileImageSelected}
                />
                <button
                  type="button"
                  disabled={uploadPictureMutation.isPending}
                  onClick={handleAvatarPickClick}
                  aria-label={t('profile.changePhoto')}
                  className="wms-ops-profile-page__avatar-btn group"
                >
                  <div className="wms-ops-profile-page__avatar">
                    {uploadPictureMutation.isPending ? (
                      <div className="flex size-full items-center justify-center">
                        <Loader2 className="size-9 animate-spin text-[var(--cyb-cyan)]" aria-hidden />
                      </div>
                    ) : imageUrl ? (
                      <>
                        <img src={imageUrl} alt="" className="size-full object-cover" />
                        <span className="wms-ops-profile-page__avatar-overlay" aria-hidden />
                        <Camera className="wms-ops-profile-page__avatar-camera" strokeWidth={1.75} aria-hidden />
                      </>
                    ) : (
                      <>
                        <span className="wms-ops-profile-page__avatar-initial">{displayInitial}</span>
                        <span className="wms-ops-profile-page__avatar-overlay" aria-hidden />
                        <Camera className="wms-ops-profile-page__avatar-camera" strokeWidth={1.75} aria-hidden />
                      </>
                    )}
                  </div>
                </button>
              </div>

              <div className="wms-ops-profile-page__meta">
                <h1 className="wms-ops-profile-page__name">{displayName}</h1>
                <div className="wms-ops-profile-page__lines">
                  <p className="wms-ops-profile-page__line">
                    <Mail className="size-4 shrink-0" aria-hidden />
                    <span className="wms-ops-profile-page__line-prefix" aria-hidden>
                      {'> '}
                    </span>
                    <span className="truncate">{emailLine}</span>
                  </p>
                  <p className="wms-ops-profile-page__line" aria-label={t('profile.branchLabel')}>
                    <Building2 className="size-4 shrink-0" aria-hidden />
                    <span className="wms-ops-profile-page__line-prefix" aria-hidden>
                      {'> '}
                    </span>
                    <span>{branchLine}</span>
                  </p>
                </div>
              </div>
            </div>
          </div>
        )}
      </section>

      {wmsCards.length > 0 ? (
        <section className="mt-6" aria-labelledby="profile-wms-overview-title">
          <div className="mb-3 flex flex-col gap-1 sm:flex-row sm:items-end sm:justify-between">
            <div>
              <h2 id="profile-wms-overview-title" className="text-base font-bold text-slate-900 dark:text-slate-100">
                {t('profile.wmsOverview')}
              </h2>
              <p className="mt-1 text-sm text-slate-600 dark:text-slate-400">{t('profile.wmsOverviewHint')}</p>
            </div>
            <span className="wms-ops-code-badge w-fit" aria-hidden>WMS / LIVE</span>
          </div>

          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-4">
            {wmsCards.map((card) => {
              const Icon = card.icon;
              return (
                <Link
                  key={card.key}
                  to={card.href}
                  className="group min-h-36 rounded border border-slate-200 bg-white p-4 shadow-sm transition-colors hover:border-cyan-500/50 hover:bg-slate-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-500/50 dark:border-white/10 dark:bg-white/[0.04] dark:hover:border-cyan-400/40 dark:hover:bg-white/[0.07]"
                >
                  <div className="flex items-start justify-between gap-3">
                    <span className={`flex size-10 shrink-0 items-center justify-center rounded border ${card.iconClassName}`}>
                      <Icon className="size-5" aria-hidden />
                    </span>
                    <ArrowRight className="size-4 text-slate-400 transition-transform group-hover:translate-x-0.5 group-hover:text-cyan-600 dark:group-hover:text-cyan-300" aria-hidden />
                  </div>
                  <p className="mt-3 text-2xl font-bold text-slate-950 dark:text-white" aria-busy={isLoadingMetrics}>
                    {isLoadingMetrics ? '...' : formatProjectNumber(card.value, { maximumFractionDigits: 0 })}
                  </p>
                  <h3 className="mt-1 text-sm font-semibold text-slate-800 dark:text-slate-200">{card.label}</h3>
                  <p className="mt-1 text-xs leading-5 text-slate-500 dark:text-slate-400">{card.description}</p>
                </Link>
              );
            })}
          </div>
        </section>
      ) : null}

      <ProfileSettingsModal open={profileSettingsOpen} onOpenChange={setProfileSettingsOpen} />
    </div>
  );
}
