import { useEffect, useRef, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { ArrowLeft, ArrowRight, Crown, ImagePlus, Loader2, Pencil, Trash2, Upload, X } from 'lucide-react';
import { toast } from 'sonner';
import { OpsActionButton } from '@/components/shared/OpsActionButton';
import { cn } from '@/lib/utils';
import {
  resolveStockImageUrl,
  stockImagesApi,
  type StockImage,
} from '../api/stock-images.api';

interface Props { stockId: number; stockName: string; canManage: boolean }
const acceptedTypes = new Set(['image/jpeg', 'image/png', 'image/webp']);
const maximumBytes = 10 * 1024 * 1024;

export function StockImageManager({ stockId, stockName, canManage }: Props) {
  const client = useQueryClient();
  const inputRef = useRef<HTMLInputElement>(null);
  const [dragging, setDragging] = useState(false);
  const [preview, setPreview] = useState<StockImage | null>(null);
  const key = ['stock-images', stockId];
  const query = useQuery({ queryKey: key, queryFn: () => stockImagesApi.list(stockId) });
  const refresh = async () => client.invalidateQueries({ queryKey: key });
  const upload = useMutation({
    mutationFn: (files: File[]) => stockImagesApi.upload(stockId, files),
    onSuccess: async () => { await refresh(); toast.success('Stok görselleri yüklendi.'); },
    onError: showError,
  });
  const action = useMutation({
    mutationFn: async (operation: () => Promise<unknown>) => operation(),
    onSuccess: refresh,
    onError: showError,
  });

  const selectFiles = (files: File[]) => {
    if (!canManage || files.length === 0) return;
    if (files.length > 10) return toast.error('Tek seferde en fazla 10 görsel yükleyebilirsiniz.');
    const invalid = files.find(file => !acceptedTypes.has(file.type) || file.size <= 0 || file.size > maximumBytes);
    if (invalid) return toast.error(`${invalid.name}: yalnızca JPG, PNG veya WebP ve en fazla 10 MB desteklenir.`);
    if ((query.data?.length ?? 0) + files.length > 20) return toast.error('Bir stokta en fazla 20 görsel bulunabilir.');
    upload.mutate(files);
  };

  if (query.isLoading) return <div className="grid min-h-52 place-items-center"><Loader2 className="size-6 animate-spin text-[var(--wms-ops-accent)]" /></div>;
  if (query.isError) return <div className="rounded-xl border border-red-500/30 bg-red-500/10 p-4 text-sm text-red-500">{query.error instanceof Error ? query.error.message : 'Görseller alınamadı.'}</div>;
  const images = query.data ?? [];

  return (
    <div className="space-y-4">
      <div
        className={cn(
          'relative grid min-h-36 place-items-center rounded-xl border border-dashed p-5 text-center transition-colors',
          dragging ? 'border-[var(--wms-ops-accent)] bg-[color-mix(in_oklab,var(--wms-ops-accent)_12%,transparent)]' : 'border-[var(--wms-app-border)] bg-[color-mix(in_oklab,var(--wms-app-panel)_92%,transparent)]',
          !canManage && 'opacity-60',
        )}
        onDragOver={event => { event.preventDefault(); if (canManage) setDragging(true); }}
        onDragLeave={() => setDragging(false)}
        onDrop={event => { event.preventDefault(); setDragging(false); selectFiles(Array.from(event.dataTransfer.files)); }}
      >
        <input ref={inputRef} hidden multiple type="file" accept="image/jpeg,image/png,image/webp" onChange={event => { selectFiles(Array.from(event.target.files ?? [])); event.target.value = ''; }} />
        <div>
          <div className="mx-auto grid size-11 place-items-center rounded-xl bg-[color-mix(in_oklab,var(--wms-ops-accent)_12%,transparent)] text-[var(--wms-ops-accent)]"><ImagePlus className="size-5" /></div>
          <p className="mt-3 text-sm font-bold text-[var(--wms-app-text)]">Görselleri sürükleyin veya seçin</p>
          <p className="mt-1 text-xs text-[var(--wms-app-text-muted)]">JPG, PNG, WebP · görsel başına 10 MB · en fazla 20 görsel</p>
          {canManage ? <OpsActionButton className="mt-3" type="button" disabled={upload.isPending} onClick={() => inputRef.current?.click()}><Upload className="size-4" />{upload.isPending ? 'Yükleniyor…' : 'Görsel seç'}</OpsActionButton> : null}
        </div>
      </div>

      <div className="flex items-center justify-between gap-3">
        <div><h3 className="text-sm font-bold text-[var(--wms-app-text)]">Medya kütüphanesi</h3><p className="text-xs text-[var(--wms-app-text-muted)]">{images.length}/20 görsel · ilk sıradaki kapak olarak kullanılabilir</p></div>
        {action.isPending ? <Loader2 className="size-4 animate-spin text-[var(--wms-ops-accent)]" /> : null}
      </div>

      {images.length === 0 ? (
        <div className="grid min-h-44 place-items-center rounded-xl border border-[var(--wms-app-border)] text-center text-sm text-[var(--wms-app-text-muted)]">Bu stok için henüz görsel eklenmedi.</div>
      ) : (
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {images.map((image, index) => (
            <ImageCard key={image.id} image={image} index={index} total={images.length} canManage={canManage} stockId={stockId}
              imageIds={images.map(item => item.id)}
              onPreview={() => setPreview(image)}
              run={operation => action.mutate(operation)} />
          ))}
        </div>
      )}
      {preview ? <ImagePreview image={preview} stockName={stockName} onClose={() => setPreview(null)} /> : null}
    </div>
  );
}

function ImageCard({ image, imageIds, index, total, canManage, stockId, onPreview, run }: {
  image: StockImage; imageIds: number[]; index: number; total: number; canManage: boolean; stockId: number; onPreview: () => void; run: (operation: () => Promise<unknown>) => void;
}) {
  const [editing, setEditing] = useState(false);
  const [altText, setAltText] = useState(image.altText ?? '');
  useEffect(() => setAltText(image.altText ?? ''), [image.altText]);
  const move = (direction: -1 | 1) => {
    const ids = [...imageIds];
    const next = index + direction; [ids[index], ids[next]] = [ids[next], ids[index]];
    run(() => stockImagesApi.reorder(stockId, ids));
  };
  return (
    <article data-stock-image-id={image.id} className="overflow-hidden rounded-xl border border-[var(--wms-app-border)] bg-[color-mix(in_oklab,var(--wms-app-panel)_94%,transparent)]">
      <button type="button" className="relative block aspect-[4/3] w-full overflow-hidden bg-black/10" onClick={onPreview}>
        <img src={resolveStockImageUrl(image.url)} alt={image.altText || image.originalFileName} className="size-full object-contain" loading="lazy" />
        {image.isPrimary ? <span className="absolute left-2 top-2 inline-flex items-center gap-1 rounded-full bg-amber-400 px-2 py-1 text-[10px] font-black text-black"><Crown className="size-3" />KAPAK</span> : null}
      </button>
      <div className="space-y-2 p-3">
        {editing ? (
          <div className="flex gap-2"><input className="input min-w-0 flex-1 text-xs" maxLength={200} value={altText} placeholder="Görsel açıklaması" onChange={event => setAltText(event.target.value)} /><button className="text-xs font-bold text-[var(--wms-ops-accent)]" type="button" onClick={() => { run(() => stockImagesApi.update(stockId, image.id, altText)); setEditing(false); }}>Kaydet</button></div>
        ) : <p className="truncate text-xs text-[var(--wms-app-text-muted)]" title={image.altText || image.originalFileName}>{image.altText || image.originalFileName}</p>}
        {canManage ? <div className="flex flex-wrap gap-1">
          {!image.isPrimary ? <IconButton title="Kapak yap" onClick={() => run(() => stockImagesApi.setPrimary(stockId, image.id))}><Crown /></IconButton> : null}
          <IconButton title="Açıklamayı düzenle" onClick={() => setEditing(value => !value)}><Pencil /></IconButton>
          <IconButton title="Sola taşı" disabled={index === 0} onClick={() => move(-1)}><ArrowLeft /></IconButton>
          <IconButton title="Sağa taşı" disabled={index === total - 1} onClick={() => move(1)}><ArrowRight /></IconButton>
          <IconButton title="Sil" danger onClick={() => { if (window.confirm('Bu stok görseli silinsin mi?')) run(() => stockImagesApi.remove(stockId, image.id)); }}><Trash2 /></IconButton>
        </div> : null}
      </div>
    </article>
  );
}

function IconButton({ title, children, disabled, danger, onClick }: { title: string; children: React.ReactElement; disabled?: boolean; danger?: boolean; onClick: () => void }) {
  return <button type="button" title={title} aria-label={title} disabled={disabled} onClick={onClick} className={cn('grid size-8 place-items-center rounded-lg border border-[var(--wms-app-border)] text-[var(--wms-app-text-muted)] hover:text-[var(--wms-ops-accent)] disabled:opacity-30', danger && 'hover:border-red-500/40 hover:text-red-500')}>{children && <span className="[&>svg]:size-3.5">{children}</span>}</button>;
}

function ImagePreview({ image, stockName, onClose }: { image: StockImage; stockName: string; onClose: () => void }) {
  useEffect(() => { const close = (event: KeyboardEvent) => { if (event.key === 'Escape') onClose(); }; window.addEventListener('keydown', close); return () => window.removeEventListener('keydown', close); }, [onClose]);
  return <div data-wms-image-lightbox="" className="fixed inset-0 z-[1000] grid place-items-center bg-black/85 p-4" role="dialog" aria-modal="true" aria-label={`${stockName} görseli`} onMouseDown={event => { if (event.target === event.currentTarget) onClose(); }}><img className="max-h-[88dvh] max-w-[92vw] object-contain" src={resolveStockImageUrl(image.url)} alt={image.altText || stockName} /><button type="button" className="absolute right-5 top-5 grid size-10 place-items-center rounded-full bg-black/60 text-white" onClick={onClose} aria-label="Kapat"><X className="size-5" /></button></div>;
}

function showError(error: unknown) { toast.error(error instanceof Error ? error.message : 'İşlem tamamlanamadı.'); }
