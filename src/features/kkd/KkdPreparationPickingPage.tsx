import { useEffect, useMemo, useState, type ReactElement } from 'react';
import { Link, useParams, useSearchParams } from 'react-router-dom';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { ArrowLeft, CheckCircle2, Loader2, PackageCheck, ScanBarcode, TriangleAlert } from 'lucide-react';
import { OpsActionButton } from '@/components/shared/OpsActionButton';
import { WarehouseBarcodeScanner } from '@/features/barcode-resolution/WarehouseBarcodeScanner';
import type { ResolvedWarehouseBarcode } from '@/features/barcode-resolution/barcode-resolution.api';
import { warehouseOutboundApi, type ShipmentOperationLinePayload } from '@/features/warehouse-outbound/warehouseOutbound-api';
import { formatProjectNumber } from '@/lib/project-format';
import { useAuthStore } from '@/stores/auth-store';
import { KKD_CELL, KKD_HEAD_CELL, KkdCallout, KkdPage, KkdPanel, KkdTableShell } from './kkd-ops-ui';
import { kkdApi } from './kkd-api';
import { KkdDistributionReceiptDialog } from './KkdDistributionReceiptDialog';

const BOARD_TABS = new Set(['pending', 'preparing', 'completed', 'cancelled', 'mine']);

function resolveBoardHref(returnTab: string | null): string {
  let tab = returnTab;
  if (!tab || !BOARD_TABS.has(tab)) {
    try {
      tab = sessionStorage.getItem('kkd-requests-return-tab');
    } catch {
      tab = null;
    }
  }
  if (!tab || !BOARD_TABS.has(tab)) tab = 'mine';
  return `/warehouse/kkd/requests?tab=${tab}`;
}

type Stage = 'loading' | 'not-found' | 'working' | 'excess-pending' | 'finishing' | 'done' | 'error';

/**
 * Toplama tezgahındaki tek satır. Görev zaten grup+miktarı biliyor; stok/beden bilinmiyorsa
 * (`stockId === null`) barkod okutulunca hem çözümlenir hem de aynı taramanın miktarı toplanan
 * miktara sayılır — ayrı bir "önce çöz sonra başlat" adımı yok, tek ekranda tek akış.
 */
type PickLine = {
  requestLineId: number;
  requestLineRowVersion: string;
  groupCode: string;
  groupName?: string | null;
  stockId: number | null;
  stockCode: string | null;
  stockName: string | null;
  unitCode: string;
  targetQuantity: number;
  quantity: number;
  sourceLocationId: number | null;
  lotNo: string | null;
  serialNo: string | null;
};

/**
 * "Benim İşlerim"den bir hazırlama görevini üzerine alan depocu için doğrudan barkodlu fiziksel
 * toplama ekranı. Kullanıcı tek bir barkod okutma alanından işlem yapar: taranan barkod zaten
 * bilinen bir stoğa karşılık geliyorsa doğrudan toplanan miktara eklenir; grup henüz bilinen bir
 * stoğa bağlanmamışsa (beden/stok bekleniyor) aynı tarama önce o kalemi çözer, sonra taranan
 * miktarı yine toplanan miktara sayar. Kullanıcı "Teslimi Tamamla"ya basınca sistem arka planda
 * dağıtım + ambar çıkışı taslağını oluşturup pick→pack→load→ship'i otomatik ilerletir, ERP
 * postalamayı ve teslim belgesini tetikler.
 */
export function KkdPreparationPickingPage(): ReactElement {
  const { requestId: requestIdParam, taskId: taskIdParam } = useParams();
  const [searchParams] = useSearchParams();
  const requestId = Number(requestIdParam);
  const taskId = Number(taskIdParam);
  const branchCode = useAuthStore((state) => state.branch?.code ?? '0');
  const queryClient = useQueryClient();
  const boardHref = useMemo(
    () => resolveBoardHref(searchParams.get('returnTab')),
    [searchParams],
  );

  const [stage, setStage] = useState<Stage>('loading');
  const [errorMessage, setErrorMessage] = useState('');
  const [distributionId, setDistributionId] = useState<number | null>(null);
  const [lines, setLines] = useState<PickLine[]>([]);
  const [seeded, setSeeded] = useState(false);
  const [receiptOpen, setReceiptOpen] = useState(false);

  const requestQuery = useQuery({
    queryKey: ['kkd', 'requests', requestId],
    queryFn: () => kkdApi.requestDetail(requestId),
    enabled: Number.isFinite(requestId) && requestId > 0,
  });
  const tasksQuery = useQuery({
    queryKey: ['kkd', 'requests', requestId, 'preparation-tasks'],
    queryFn: () => kkdApi.requestPreparationTasks(requestId),
    enabled: Number.isFinite(requestId) && requestId > 0,
  });
  const seriesQuery = useQuery({ queryKey: ['kkd', 'distribution-series'], queryFn: kkdApi.distributionSeries });
  const receiptDetail = useQuery({
    queryKey: ['kkd', 'distributions', 'detail', distributionId],
    queryFn: () => kkdApi.distributionDetail(distributionId!),
    enabled: Boolean(distributionId) && receiptOpen,
  });

  const task = tasksQuery.data?.find((item) => item.id === taskId);
  const loading = requestQuery.isLoading || tasksQuery.isLoading;
  const notFound = !loading && (!requestQuery.data || !task);
  const effectiveStage: Stage = stage !== 'loading' ? stage : loading ? 'loading' : notFound ? 'not-found' : 'working';

  // Görev verisi ilk geldiğinde tezgahı bir kez tohumlar; sonrası tamamen yerel tarama ilerlemesiyle yönetilir
  // (arka planda tasksQuery yeniden çekilse bile devam eden taramayı sıfırlamaz).
  useEffect(() => {
    if (seeded || !task) return;
    setLines(task.lines
      .filter((line) => line.quantity - line.preparedQuantity - line.deliveredQuantity > 0)
      .map((line) => ({
        requestLineId: line.requestLineId,
        requestLineRowVersion: line.requestLineRowVersion,
        groupCode: line.groupCode,
        groupName: line.groupName,
        stockId: line.stockId ?? null,
        stockCode: line.stockCode ?? null,
        stockName: line.stockName ?? null,
        unitCode: line.unitCode,
        targetQuantity: line.quantity - line.preparedQuantity - line.deliveredQuantity,
        quantity: 0,
        sourceLocationId: null,
        lotNo: null,
        serialNo: null,
      })));
    setSeeded(true);
  }, [seeded, task]);

  const resolveLine = useMutation({
    mutationFn: async ({ line, value }: { line: PickLine; value: ResolvedWarehouseBarcode }) =>
      kkdApi.resolveRequestLine(requestId, line.requestLineId, {
        stockId: value.stockId,
        reason: 'Toplama sırasında barkod ile çözümlendi.',
        expectedRowVersion: line.requestLineRowVersion,
      }),
  });

  const handleScan = async (value: ResolvedWarehouseBarcode) => {
    // Önce zaten bilinen (çözülmüş) ve hâlâ eksik olan bir kalemle eşleşiyor mu bak.
    const knownTarget = lines.find((line) => line.stockId === value.stockId && line.quantity < line.targetQuantity);
    if (knownTarget) {
      const quantity = Math.min(knownTarget.targetQuantity, knownTarget.quantity + (value.quantity ?? 1));
      setLines((current) => current.map((line) => (line.requestLineId === knownTarget.requestLineId
        ? {
            ...line,
            quantity,
            sourceLocationId: value.suggestedLocationId ?? line.sourceLocationId,
            lotNo: value.lotNo ?? line.lotNo,
            serialNo: value.serialNo ?? line.serialNo,
          }
        : line)));
      return;
    }

    // Eşleşmiyorsa: grubu henüz bilinen bir stoğa bağlanmamış, eksik kalan kalemler için sırayla çözümleme dene
    // (birden fazla çözülmemiş grup olabilir; backend grup uyuşmazlığında hata verir, o zaman bir sonrakini deneriz).
    const unresolvedTargets = lines.filter((line) => !line.stockId && line.quantity < line.targetQuantity);
    if (unresolvedTargets.length === 0) {
      toast.error(`${value.stockCode} bu toplamada beklenen kalemlerden biri değil veya zaten tamamlandı.`);
      return;
    }
    let lastError: unknown = null;
    for (const target of unresolvedTargets) {
      try {
        await resolveLine.mutateAsync({ line: target, value });
        const quantity = Math.min(target.targetQuantity, value.quantity ?? 1);
        setLines((current) => current.map((line) => (line.requestLineId === target.requestLineId
          ? {
              ...line,
              stockId: value.stockId,
              stockCode: value.stockCode,
              stockName: value.stockName,
              quantity,
              sourceLocationId: value.suggestedLocationId ?? line.sourceLocationId,
              lotNo: value.lotNo ?? line.lotNo,
              serialNo: value.serialNo ?? line.serialNo,
            }
          : line)));
        toast.success(`${target.groupCode} grubu ${value.stockCode} stoğuna bağlandı.`);
        void queryClient.invalidateQueries({ queryKey: ['kkd', 'requests', requestId, 'preparation-tasks'] });
        return;
      } catch (error) {
        lastError = error;
      }
    }
    toast.error(lastError instanceof Error ? lastError.message : 'Stok çözümlenemedi.');
  };

  const readyLines = lines.filter((line) => line.stockId && line.quantity > 0);
  const pendingLines = lines.filter((line) => !line.stockId || line.quantity < line.targetQuantity);

  const finish = async () => {
    if (readyLines.length === 0 || !task || !requestQuery.data) return;
    const series = seriesQuery.data?.find((item) => item.isDefault) ?? seriesQuery.data?.[0];
    if (!series) {
      toast.error('Ambar çıkışı için belge serisi bulunamadı.');
      return;
    }
    setStage('finishing');
    try {
      const result = await kkdApi.createDistribution({
        idempotencyKey: crypto.randomUUID(),
        employeeId: requestQuery.data.employeeId,
        warehouseId: task.warehouseId,
        documentSeriesId: series.id,
        documentDate: new Date().toISOString().slice(0, 10),
        stagingLocationId: null,
        loadingLocationId: null,
        description: null,
        createWarehouseTask: false,
        assignedUserIds: null,
        kkdRequestId: task.requestId,
        lines: readyLines.map((line) => ({
          stockId: line.stockId!,
          yapCodeId: null,
          quantity: line.quantity,
          unitCode: line.unitCode,
          sourceLocationId: line.sourceLocationId,
          orderNumber: null,
          orderLineId: null,
          requireHandlingUnit: false,
          description: null,
          trackings: null,
          kkdRequestLineId: line.requestLineId,
        })),
      });
      setDistributionId(result.id);
      if (result.excessApprovalStatus === 'Pending') {
        setStage('excess-pending');
        return;
      }

      const outboundDetail = await warehouseOutboundApi.detail(result.warehouseOutboundId);
      if (outboundDetail.header.status === 'Draft') {
        try {
          await warehouseOutboundApi.transition(result.warehouseOutboundId, 'release');
        } catch {
          // Depo politikası ambar çıkışı için onay şartı koşuyor olabilir — önce onayla, sonra tekrar dene.
          await warehouseOutboundApi.transition(result.warehouseOutboundId, 'approve');
          await warehouseOutboundApi.transition(result.warehouseOutboundId, 'release');
        }
      }
      const payload: ShipmentOperationLinePayload[] = outboundDetail.lines.map((outboundLine) => {
        const match = readyLines.find((line) => line.stockId === outboundLine.stockId);
        return {
          lineId: outboundLine.id,
          quantity: match?.quantity ?? outboundLine.requestedQuantity,
          sourceLocationId: match?.sourceLocationId ?? null,
          targetLocationId: null,
          lotNo: match?.lotNo ?? null,
          serialNo: match?.serialNo ?? null,
          handlingUnitNo: null,
        };
      });
      await warehouseOutboundApi.operate(result.warehouseOutboundId, 'pick', { lines: payload });
      await warehouseOutboundApi.operate(result.warehouseOutboundId, 'pack', { lines: payload });
      await warehouseOutboundApi.operate(result.warehouseOutboundId, 'load', { lines: payload });
      await warehouseOutboundApi.operate(result.warehouseOutboundId, 'ship', { lines: payload });
      toast.success('Fiziksel toplama tamamlandı; ambar çıkışı ve ERP postalaması otomatik yapıldı.');
      setStage('done');
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : 'Teslim tamamlanamadı.');
      setStage('error');
    }
  };

  if (effectiveStage === 'loading') {
    return (
      <KkdPage title="Toplama" description="Hazırlama görevi yükleniyor…">
        <div className="grid min-h-60 place-items-center text-[var(--wms-ops-accent)]">
          <Loader2 className="size-7 animate-spin" />
        </div>
      </KkdPage>
    );
  }

  if (effectiveStage === 'not-found') {
    return (
      <KkdPage title="Toplama" description="Hazırlama görevi bulunamadı.">
        <KkdCallout tone="danger" icon={<TriangleAlert className="size-5" />} title="Görev bulunamadı">
          Bu görev artık mevcut değil ya da erişim yetkiniz yok.
        </KkdCallout>
        <div className="mt-4">
          <OpsActionButton variant="secondary" asChild>
            <Link to={boardHref}><ArrowLeft className="size-3.5 shrink-0" />Talepler panosuna dön</Link>
          </OpsActionButton>
        </div>
      </KkdPage>
    );
  }

  return (
    <KkdPage
      title={`Toplama · ${task!.taskNo}`}
      description={`${requestQuery.data!.employeeName} (${requestQuery.data!.employeeCode}) için ${task!.taskNo} görevi`}
      actions={
        <OpsActionButton variant="secondary" asChild>
          <Link to={boardHref}><ArrowLeft className="size-3.5 shrink-0" />Panoya dön</Link>
        </OpsActionButton>
      }
    >
      {effectiveStage === 'excess-pending' ? (
        <KkdPanel title="Kota aşımı onayı bekleniyor" icon={<TriangleAlert className="size-4" />}>
          <KkdCallout tone="warn" title="Müdür onayı gerekiyor">
            Bu teslimde kota aşımı var; depo yöneticisinin fiziksel kontrol sonrası onaylaması bekleniyor.
            Onaylandıktan sonra "Dağıtım ve Ambar Çıkış" listesinden devam edebilirsiniz.
          </KkdCallout>
          <div className="mt-4">
            <OpsActionButton variant="secondary" asChild>
              <Link to="/warehouse/kkd/distributions">Dağıtım listesine git</Link>
            </OpsActionButton>
          </div>
        </KkdPanel>
      ) : effectiveStage === 'error' ? (
        <KkdPanel title="Bir sorun oluştu" icon={<TriangleAlert className="size-4" />}>
          <KkdCallout tone="danger" title="İşlem tamamlanamadı">{errorMessage}</KkdCallout>
          <div className="mt-4 flex gap-2">
            <OpsActionButton variant="secondary" onClick={() => setStage('working')}>
              Tekrar dene
            </OpsActionButton>
          </div>
        </KkdPanel>
      ) : (
        <div className="space-y-4">
          <KkdPanel title="Barkod okut" icon={<ScanBarcode className="size-4" />} bodyClassName="px-0 py-0 sm:px-0 sm:py-0">
            <WarehouseBarcodeScanner
              branchCode={branchCode}
              purpose="Outbound"
              warehouseId={task!.warehouseId}
              disabled={effectiveStage !== 'working' || resolveLine.isPending}
              title="Kalemi okut"
              description="Rafta bulduğunuz ürünün barkodunu veya QR kodunu okutun — grup henüz bir stoğa bağlı değilse bu tarama önce onu çözer."
              onResolved={(value) => void handleScan(value)}
            />
          </KkdPanel>
          <KkdPanel title="Toplama durumu" icon={<PackageCheck className="size-4" />}>
            <KkdTableShell>
              <thead>
                <tr>
                  <th className={KKD_HEAD_CELL}>Grup / Stok</th>
                  <th className={KKD_HEAD_CELL}>Hedef</th>
                  <th className={KKD_HEAD_CELL}>Toplanan</th>
                  <th className={KKD_HEAD_CELL}>Durum</th>
                </tr>
              </thead>
              <tbody>
                {lines.map((line) => {
                  const done = Boolean(line.stockId) && line.quantity >= line.targetQuantity;
                  return (
                    <tr key={line.requestLineId}>
                      <td className={KKD_CELL}>
                        {line.stockId ? (
                          <>
                            <strong className="font-mono">{line.stockCode}</strong>
                            <span className="block text-[0.7rem] text-[var(--wms-app-text-muted)]">{line.stockName}</span>
                          </>
                        ) : (
                          <>
                            <strong>{line.groupCode}</strong>
                            <span className="block text-[0.7rem] text-amber-600">Stok/beden bekleniyor — okutunca çözülür</span>
                          </>
                        )}
                      </td>
                      <td className={KKD_CELL}>{formatProjectNumber(line.targetQuantity)} {line.unitCode}</td>
                      <td className={KKD_CELL}>{formatProjectNumber(line.quantity)} {line.unitCode}</td>
                      <td className={KKD_CELL}>
                        {done ? (
                          <span className="inline-flex items-center gap-1.5 text-emerald-500">
                            <CheckCircle2 className="size-4" />Tamamlandı
                          </span>
                        ) : (
                          <span className="text-[var(--wms-app-text-muted)]">Bekleniyor</span>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </KkdTableShell>
            {pendingLines.length > 0 ? (
              <p className="mt-3 text-xs text-[var(--wms-app-text-muted)]">
                {pendingLines.length} kalem henüz tamamlanmadı — kısmen toplayıp geri kalanını sonraya bırakabilirsiniz.
              </p>
            ) : null}
            <div className="mt-5 flex justify-end">
              <OpsActionButton
                onClick={() => void finish()}
                disabled={readyLines.length === 0 || effectiveStage === 'done'}
                loading={effectiveStage === 'finishing'}
              >
                <CheckCircle2 className="size-3.5 shrink-0" />Teslimi Tamamla
              </OpsActionButton>
            </div>
          </KkdPanel>
          {effectiveStage === 'done' ? (
            <KkdCallout tone="success" title="Teslim tamamlandı" icon={<CheckCircle2 className="size-5" />}
              actions={
                <OpsActionButton variant="secondary" onClick={() => setReceiptOpen(true)}>
                  Teslim belgesini görüntüle
                </OpsActionButton>
              }
            >
              Ambar çıkışı ve ERP postalaması otomatik yapıldı.
            </KkdCallout>
          ) : null}
        </div>
      )}
      <KkdDistributionReceiptDialog
        open={receiptOpen && Boolean(receiptDetail.data)}
        onOpenChange={setReceiptOpen}
        detail={receiptDetail.data ?? null}
      />
    </KkdPage>
  );
}
