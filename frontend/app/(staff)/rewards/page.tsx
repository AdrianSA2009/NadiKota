"use client";

import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Gift, Pencil, Plus, Trash2, Sparkles } from "lucide-react";
import { z } from "zod";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { EmptyState } from "@/components/ui/EmptyState";
import { ErrorState } from "@/components/ui/ErrorState";
import { Skeleton } from "@/components/ui/Skeleton";
import { apiClient } from "@/lib/apiClient";
import { useToastStore } from "@/lib/toastStore";
import { RewardIcon } from "@/lib/rewardIcons";

type Reward = {
  id: number;
  name: string;
  description: string | null;
  icon: string | null;
  pointsCost: number;
  stock: number | null;
  isActive: boolean;
};

const rewardSchema = z.object({
  name: z.string().trim().min(2, "Nama minimal 2 karakter."),
  description: z.string().trim().max(200, "Deskripsi maksimal 200 karakter.").optional(),
  points_cost: z.coerce.number().int().min(1, "Poin minimal 1.").max(100000),
});

type FormValues = { name: string; description: string; points_cost: string };

const emptyForm: FormValues = { name: "", description: "", points_cost: "" };

async function fetchRewards(): Promise<Reward[]> {
  const res = await apiClient.get<{ data: Reward[] }>("/admin/rewards");
  return res.data.data;
}

export default function RewardsAdminPage() {
  const queryClient = useQueryClient();
  const showToast = useToastStore((s) => s.show);

  // State terpisah untuk form create dan form edit — mencegah satu form mempengaruhi yang lain
  const [createForm, setCreateForm] = useState<FormValues>(emptyForm);
  const [createErrors, setCreateErrors] = useState<Partial<Record<keyof FormValues, string>>>({});
  const [isGeneratingDescCreate, setIsGeneratingDescCreate] = useState(false);

  const [editReward, setEditReward] = useState<Reward | null>(null);
  const [editForm, setEditForm] = useState<FormValues>(emptyForm);
  const [editErrors, setEditErrors] = useState<Partial<Record<keyof FormValues, string>>>({});
  const [isGeneratingDescEdit, setIsGeneratingDescEdit] = useState(false);

  const [deleteReward, setDeleteReward] = useState<Reward | null>(null);

  const query = useQuery({ queryKey: ["admin-rewards"], queryFn: fetchRewards });

  const saveMutation = useMutation({
    mutationFn: async ({ id, values, isActive, icon }: { id: number | null; values: FormValues; isActive: boolean; icon: string | null }) => {
      const payload = {
        name: values.name.trim(),
        description: values.description.trim() || null,
        category: "lainnya",
        points_cost: Number(values.points_cost),
        stock: null,
        icon,
        is_active: isActive,
      };
      if (id !== null) return (await apiClient.put(`/admin/rewards/${id}`, payload)).data;
      return (await apiClient.post("/admin/rewards", payload)).data;
    },
    onSuccess: (_data, vars) => {
      showToast(vars.id !== null ? "Hadiah diperbarui." : "Hadiah ditambahkan.", "success");
      setCreateForm(emptyForm);
      setCreateErrors({});
      setEditReward(null);
      void queryClient.invalidateQueries({ queryKey: ["admin-rewards"] });
    },
    onError: (e) => showToast(e instanceof Error ? e.message : "Gagal menyimpan hadiah.", "info"),
  });

  const toggleMutation = useMutation({
    mutationFn: async (reward: Reward) => (await apiClient.put(`/admin/rewards/${reward.id}`, {
      name: reward.name,
      description: reward.description ?? null,
      category: "lainnya",
      points_cost: reward.pointsCost,
      stock: null,
      icon: reward.icon,
      is_active: !reward.isActive,
    })).data,
    onSuccess: () => void queryClient.invalidateQueries({ queryKey: ["admin-rewards"] }),
    onError: (e) => showToast(e instanceof Error ? e.message : "Gagal mengubah status.", "info"),
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: number) => (await apiClient.delete(`/admin/rewards/${id}`)).data,
    onSuccess: () => {
      showToast("Hadiah dihapus / dinonaktifkan.", "success");
      setDeleteReward(null);
      void queryClient.invalidateQueries({ queryKey: ["admin-rewards"] });
    },
    onError: (e) => showToast(e instanceof Error ? e.message : "Gagal menghapus hadiah.", "info"),
  });

  function validate(values: FormValues, setErrors: (e: Partial<Record<keyof FormValues, string>>) => void): boolean {
    const result = rewardSchema.safeParse(values);
    if (result.success) { setErrors({}); return true; }
    const fieldErrors: Partial<Record<keyof FormValues, string>> = {};
    for (const issue of result.error.issues) fieldErrors[issue.path[0] as keyof FormValues] = issue.message;
    setErrors(fieldErrors);
    return false;
  }

  async function submitCreate(e: React.FormEvent) {
    e.preventDefault();
    if (!validate(createForm, setCreateErrors)) return;
    let values = createForm;
    if (!values.description.trim()) {
      values = await fillGeneratedDescription(values, setIsGeneratingDescCreate);
      if (values.description) setCreateForm(values);
    }
    saveMutation.mutate({ id: null, values, isActive: true, icon: null });
  }

  async function submitEdit(e: React.FormEvent) {
    e.preventDefault();
    if (!editReward || !validate(editForm, setEditErrors)) return;
    let values = editForm;
    if (!values.description.trim()) {
      values = await fillGeneratedDescription(values, setIsGeneratingDescEdit);
      if (values.description) setEditForm(values);
    }
    saveMutation.mutate({ id: editReward.id, values, isActive: editReward.isActive, icon: editReward.icon });
  }

  function openEdit(reward: Reward) {
    setEditReward(reward);
    setEditForm({ name: reward.name, description: reward.description ?? "", points_cost: String(reward.pointsCost) });
    setEditErrors({});
  }

  /** Deskripsi kosong → generate otomatis oleh AI sebelum disimpan (gagal = tetap opsional). */
  async function fillGeneratedDescription(current: FormValues, setGenerating: (v: boolean) => void): Promise<FormValues> {
    if (!current.name.trim() || current.description.trim()) return current;
    setGenerating(true);
    try {
      const res = await apiClient.post<{ description: string }>("/admin/rewards/generate-description", {
        name: current.name.trim(),
      });
      const description = res.data.description?.trim();
      if (description) return { ...current, description };
    } catch { /* deskripsi opsional — lanjut simpan tanpa deskripsi */ }
    finally { setGenerating(false); }
    return current;
  }

  async function generateDescription(
    name: string,
    currentForm: FormValues,
    setFormFn: (v: FormValues) => void,
    setGenerating: (v: boolean) => void,
  ) {
    if (!name.trim()) {
      showToast("Masukkan nama hadiah terlebih dahulu.", "info");
      return;
    }
    setGenerating(true);
    try {
      const res = await apiClient.post<{ description: string }>("/admin/rewards/generate-description", {
        name: name.trim(),
      });
      setFormFn({ ...currentForm, description: res.data.description });
    } catch (e) {
      showToast(e instanceof Error ? e.message : "Gagal membuat deskripsi.", "info");
    } finally {
      setGenerating(false);
    }
  }

  const input = "mt-1.5 min-h-11 w-full rounded-xl border border-neutral-300 bg-neutral-0 px-3.5 text-sm text-neutral-900 placeholder:text-neutral-400 focus-visible:border-accent-500 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent-500/25";
  const inputError = "mt-1.5 min-h-11 w-full rounded-xl border border-danger-600 bg-danger-50 px-3.5 text-sm text-neutral-900 focus-visible:border-danger-600 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-danger-600/25";
  const fieldError = "mt-1 text-xs leading-snug text-danger-700";

  return (
    <main className="absolute inset-0 overflow-y-auto bg-neutral-50 px-3 py-6 pb-24 text-neutral-700 sm:px-4 md:pb-6 lg:px-5">
      <div className="w-full">
        <header className="relative mb-5 overflow-hidden rounded-2xl bg-primary-800 px-6 py-7 text-neutral-0 sm:px-8">
          <div className="absolute -right-8 -top-8 size-32 rounded-full bg-primary-700/60" aria-hidden="true" />
          <div className="absolute -bottom-10 right-16 size-24 rounded-full bg-accent-600/30" aria-hidden="true" />
          <div className="relative">
            <p className="flex items-center gap-2 text-sm font-medium text-primary-100"><Gift className="size-4" /> Admin Dinas</p>
            <h1 className="mt-1.5 text-2xl font-bold tracking-tight">Kelola Hadiah</h1>
            <p className="mt-1 text-sm text-primary-100/80">Tambah, ubah, dan nonaktifkan hadiah penukaran poin warga.</p>
          </div>
        </header>

        <Card className="mb-5 overflow-hidden p-6">
          <h2 className="mb-3 flex items-center gap-2 text-base font-bold text-neutral-900">
            <span className="flex size-8 items-center justify-center rounded-lg bg-gradient-to-br from-primary-800 to-primary-600 text-neutral-0 shadow-sm">
              <Plus className="size-4" />
            </span>
            Tambah hadiah
          </h2>
          <form className="space-y-3" onSubmit={submitCreate} noValidate>
            <div>
              <label htmlFor="reward-name" className="text-sm font-medium text-neutral-900">Nama hadiah</label>
              <input id="reward-name" value={createForm.name} onChange={(e) => setCreateForm({ ...createForm, name: e.target.value })} placeholder="mis. Voucher Parkir Rp10.000" className={createErrors.name ? inputError : input} />
              {createErrors.name && <p className={fieldError}>{createErrors.name}</p>}
            </div>
            <div>
              <div className="flex items-center justify-between">
                <label htmlFor="reward-description" className="text-sm font-medium text-neutral-900">Deskripsi <span className="text-neutral-400">(opsional)</span></label>
                <Button
                  type="button"
                  onClick={() => generateDescription(createForm.name, createForm, setCreateForm, setIsGeneratingDescCreate)}
                  disabled={isGeneratingDescCreate || !createForm.name.trim()}
                >
                  <Sparkles className="mr-1.5 inline size-4" aria-hidden="true" />
                  {isGeneratingDescCreate ? "Membuat deskripsi..." : "Generate deskripsi AI"}
                </Button>
              </div>
              <textarea
                id="reward-description"
                value={createForm.description}
                onChange={(e) => setCreateForm({ ...createForm, description: e.target.value })}
                placeholder="mis. Voucher parkir senilai Rp10.000 untuk area parkir umum kota."
                rows={2}
                maxLength={200}
                className={createErrors.description ? inputError : input}
              />
              {createErrors.description && <p className={fieldError}>{createErrors.description}</p>}
            </div>
            <div>
              <label htmlFor="reward-points" className="text-sm font-medium text-neutral-900">Biaya poin</label>
              <input id="reward-points" type="number" min={1} value={createForm.points_cost} onChange={(e) => setCreateForm({ ...createForm, points_cost: e.target.value })} placeholder="mis. 50" className={createErrors.points_cost ? inputError : input} />
              {createErrors.points_cost && <p className={fieldError}>{createErrors.points_cost}</p>}
            </div>
            <Button type="submit" className="w-full sm:w-auto" disabled={saveMutation.isPending}>{saveMutation.isPending ? "Menyimpan..." : "Tambah hadiah"}</Button>
          </form>
        </Card>

        {query.isLoading && <div className="grid gap-4 sm:grid-cols-2"><Skeleton className="h-28" /><Skeleton className="h-28" /></div>}
        {query.isError && <ErrorState message={query.error.message} onRetry={() => void query.refetch()} />}
        {query.data && query.data.length === 0 && <EmptyState title="Belum ada hadiah" description="Tambahkan hadiah pertama lewat form di atas." />}

        {query.data && query.data.length > 0 && (
          <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
            {query.data.map((reward) => (
              <Card key={reward.id} className="relative overflow-hidden p-4 transition-all hover:-translate-y-0.5 hover:shadow-md">
                <div className="absolute inset-y-0 left-0 w-1.5 bg-gradient-to-b from-accent-500 to-primary-700" aria-hidden="true" />
                <div className="flex items-start gap-3 pl-3">
                  <span className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-primary-50 text-primary-700">
                    <RewardIcon name={reward.icon} className="size-4" />
                  </span>
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-semibold text-neutral-900">{reward.name}</p>
                    {reward.description && (
                      <p className="mt-0.5 text-xs text-neutral-500">{reward.description}</p>
                    )}
                    <div className="mt-1.5 flex flex-wrap items-center gap-1.5">
                      <span className="inline-flex items-center rounded-full bg-accent-50 px-2.5 py-0.5 text-xs font-bold text-accent-700">{reward.pointsCost} poin</span>
                      {!reward.isActive && <span className="inline-flex items-center rounded-full bg-danger-50 px-2.5 py-0.5 text-xs font-semibold text-danger-700">Nonaktif</span>}
                      <button
                        type="button"
                        onClick={() => toggleMutation.mutate(reward)}
                        disabled={toggleMutation.isPending}
                        className={`inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-semibold transition-colors ${
                          reward.isActive
                            ? "border-neutral-300 text-neutral-600 hover:border-neutral-400 hover:bg-neutral-100"
                            : "border-success-600 text-success-700 hover:bg-success-50"
                        }`}
                      >
                        {reward.isActive ? "Nonaktifkan" : "Aktifkan"}
                      </button>
                    </div>
                  </div>
                  <div className="flex shrink-0 gap-1">
                    <button type="button" onClick={() => openEdit(reward)} className="rounded-lg p-2 text-neutral-500 transition-colors hover:bg-primary-50 hover:text-primary-800" aria-label={`Ubah ${reward.name}`}>
                      <Pencil className="size-4" />
                    </button>
                    <button type="button" onClick={() => setDeleteReward(reward)} className="rounded-lg p-2 text-danger-700 transition-colors hover:bg-danger-50" aria-label={`Hapus ${reward.name}`}>
                      <Trash2 className="size-4" />
                    </button>
                  </div>
                </div>
              </Card>
            ))}
          </div>
        )}
      </div>

      {/* Modal edit hadiah */}
      {editReward && (
        <div className="fixed inset-0 z-[1200] flex items-center justify-center bg-neutral-900/50 p-4 backdrop-blur-sm" role="dialog" aria-modal="true">
          <section className="w-full max-w-sm overflow-hidden rounded-2xl border border-neutral-200 bg-neutral-0 shadow-xl">
            <div className="relative overflow-hidden bg-primary-800 px-6 py-5 text-neutral-0">
              <div className="absolute -right-6 -top-6 size-24 rounded-full bg-primary-700/60" aria-hidden="true" />
              <div className="relative">
                <p className="text-xs font-medium text-primary-100">Edit Hadiah</p>
                <h2 className="mt-0.5 text-lg font-bold">{editReward.name}</h2>
              </div>
            </div>
            <div className="p-6">
              <form className="space-y-4" onSubmit={submitEdit} noValidate>
                <div>
                  <label htmlFor="edit-reward-name" className="text-sm font-medium text-neutral-900">Nama hadiah</label>
                  <input id="edit-reward-name" value={editForm.name} onChange={(e) => setEditForm({ ...editForm, name: e.target.value })} placeholder="mis. Voucher Parkir Rp10.000" className={editErrors.name ? inputError : input} />
                  {editErrors.name && <p className={fieldError}>{editErrors.name}</p>}
                </div>
                <div>
                  <div className="flex items-center justify-between">
                    <label htmlFor="edit-reward-description" className="text-sm font-medium text-neutral-900">Deskripsi <span className="text-neutral-400">(opsional)</span></label>
                    <Button
                      type="button"
                      onClick={() => generateDescription(editForm.name, editForm, setEditForm, setIsGeneratingDescEdit)}
                      disabled={isGeneratingDescEdit || !editForm.name.trim()}
                    >
                      <Sparkles className="mr-1.5 inline size-4" aria-hidden="true" />
                      {isGeneratingDescEdit ? "Membuat deskripsi..." : "Generate deskripsi AI"}
                    </Button>
                  </div>
                  <textarea
                    id="edit-reward-description"
                    value={editForm.description}
                    onChange={(e) => setEditForm({ ...editForm, description: e.target.value })}
                    placeholder="mis. Voucher parkir senilai Rp10.000 untuk area parkir umum kota."
                    rows={2}
                    maxLength={200}
                    className={editErrors.description ? inputError : input}
                  />
                  {editErrors.description && <p className={fieldError}>{editErrors.description}</p>}
                </div>
                <div>
                  <label htmlFor="edit-reward-points" className="text-sm font-medium text-neutral-900">Biaya poin</label>
                  <input id="edit-reward-points" type="number" min={1} value={editForm.points_cost} onChange={(e) => setEditForm({ ...editForm, points_cost: e.target.value })} placeholder="mis. 50" className={editErrors.points_cost ? inputError : input} />
                  {editErrors.points_cost && <p className={fieldError}>{editErrors.points_cost}</p>}
                </div>
                <div className="flex gap-2">
                  <Button type="submit" className="flex-1" disabled={saveMutation.isPending}>{saveMutation.isPending ? "Menyimpan..." : "Simpan perubahan"}</Button>
                  <Button type="button" variant="secondary" onClick={() => { setEditReward(null); setEditErrors({}); }}>Batal</Button>
                </div>
              </form>
            </div>
          </section>
        </div>
      )}

      {/* Modal hapus (konfirmasi) */}
      {deleteReward && (
        <div className="fixed inset-0 z-[1200] flex items-center justify-center bg-neutral-900/50 p-4 backdrop-blur-sm" role="dialog" aria-modal="true">
          <section className="w-full max-w-sm overflow-hidden rounded-2xl border border-neutral-200 bg-neutral-0 shadow-xl">
            <div className="relative overflow-hidden bg-danger-700 px-6 py-5 text-neutral-0">
              <div className="absolute -right-6 -top-6 size-24 rounded-full bg-danger-600/60" aria-hidden="true" />
              <div className="relative">
                <p className="text-xs font-medium text-danger-50">Hapus Hadiah</p>
                <h2 className="mt-0.5 text-lg font-bold">{deleteReward.name}</h2>
              </div>
            </div>
            <div className="p-6">
              <p className="text-sm text-neutral-600">Hadiah ini akan dinonaktifkan bila sudah pernah ditukar, atau dihapus permanen bila belum.</p>
              <div className="mt-5 flex gap-2">
                <Button type="button" variant="danger" className="flex-1" disabled={deleteMutation.isPending} onClick={() => deleteMutation.mutate(deleteReward.id)}>
                  {deleteMutation.isPending ? "Menghapus..." : "Ya, hapus"}
                </Button>
                <Button type="button" variant="secondary" onClick={() => setDeleteReward(null)}>Batal</Button>
              </div>
            </div>
          </section>
        </div>
      )}
    </main>
  );
}
