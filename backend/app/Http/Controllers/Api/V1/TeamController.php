<?php

declare(strict_types=1);

namespace App\Http\Controllers\Api\V1;

use App\Enums\TicketStatus;
use App\Enums\UserRole;
use App\Http\Controllers\Controller;
use App\Http\Resources\TeamResource;
use App\Http\Resources\TicketResource;
use App\Models\Team;
use App\Models\Ticket;
use App\Models\User;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Gate;
use Illuminate\Support\Facades\Hash;
use Illuminate\Validation\ValidationException;

final class TeamController extends Controller
{
    public function index(Request $request): JsonResponse
    {
        Gate::authorize('viewAny', Team::class);

        $teams = $this->withStats(Team::query())->orderBy('name')->get();

        return response()->json(['data' => TeamResource::collection($teams)]);
    }

    /** Detail tim + riwayat tiket yang ditangani. */
    public function show(Request $request, Team $team): JsonResponse
    {
        Gate::authorize('view', $team);

        $team = $this->withStats(Team::query())->findOrFail($team->id);
        $tickets = Ticket::where('assigned_team_id', $team->id)
            ->orderByDesc('created_at')
            ->paginate($request->integer('per_page', 20));

        return response()->json([
            'data' => [
                'team' => new TeamResource($team),
                'tickets' => TicketResource::collection($tickets),
                'meta' => [
                    'currentPage' => $tickets->currentPage(),
                    'lastPage' => $tickets->lastPage(),
                    'total' => $tickets->total(),
                ],
            ],
        ]);
    }

    /** Buat tim baru beserta akun PJ (baru atau user existing yang diubah jadi Tim). */
    public function store(Request $request): JsonResponse
    {
        Gate::authorize('manage', Team::class);

        $validated = $request->validate($this->teamRules() + $this->leaderRules());

        $team = DB::transaction(function () use ($validated) {
            $leader = $this->resolveLeader($validated);

            $team = Team::create([
                'name' => $validated['name'],
                'district' => $validated['district'],
                'type' => $validated['type'] ?? null,
                'description' => $validated['description'] ?? null,
                'user_id' => $leader->id,
            ]);
            $team->members()->attach($leader->id, ['role_in_team' => 'leader']);

            return $team;
        });

        return response()->json([
            'data' => new TeamResource($this->withStats(Team::query())->findOrFail($team->id)),
        ], 201);
    }

    /** Edit data tim (bukan PJ — PJ lewat changeLeader). */
    public function update(Request $request, Team $team): JsonResponse
    {
        Gate::authorize('manage', $team);

        $validated = $request->validate([
            'name' => 'required|string|max:100|unique:teams,name,' . $team->id,
            'district' => 'required|string|max:100',
            'type' => 'nullable|string|max:100',
            'description' => 'nullable|string|max:500',
        ]);

        $team->update($validated);

        return response()->json([
            'data' => new TeamResource($this->withStats(Team::query())->findOrFail($team->id)),
        ]);
    }

    /** Ganti PJ: PJ lama kembali jadi warga (riwayat laporan tetap), PJ baru diikat ke tim. */
    public function changeLeader(Request $request, Team $team): JsonResponse
    {
        Gate::authorize('manage', $team);

        $validated = $request->validate($this->leaderRules());

        $team = DB::transaction(function () use ($team, $validated) {
            $old = $team->leader;
            $leader = $this->resolveLeader($validated);

            if ($old !== null && $old->id === $leader->id) {
                throw ValidationException::withMessages([
                    'user_id' => 'User tersebut sudah menjadi PJ tim ini.',
                ]);
            }

            if ($old !== null) {
                $team->members()->detach($old->id);
                $old->update(['role' => UserRole::CITIZEN]);
            }

            $team->update(['user_id' => $leader->id]);
            $team->members()->attach($leader->id, ['role_in_team' => 'leader']);

            return $team;
        });

        return response()->json([
            'data' => new TeamResource($this->withStats(Team::query())->findOrFail($team->id)),
        ]);
    }

    public function resetPassword(Request $request, Team $team): JsonResponse
    {
        Gate::authorize('manage', $team);

        if ($team->leader === null) {
            return response()->json(['error' => ['message' => 'Tim ini belum memiliki PJ. Atur PJ terlebih dahulu.']], 422);
        }

        $validated = $request->validate([
            'password' => 'required|string|min:8|max:100',
        ]);

        $team->leader->update(['password' => Hash::make($validated['password'])]);

        return response()->json(['data' => ['message' => 'Password akun PJ berhasil direset.']]);
    }

    /** Nonaktifkan tim (soft delete) — dicegah bila masih memegang tiket aktif. */
    public function deactivate(Team $team): JsonResponse
    {
        Gate::authorize('manage', $team);

        $activeCount = Ticket::where('assigned_team_id', $team->id)
            ->whereIn('status', [TicketStatus::QUEUED->value, TicketStatus::IN_PROGRESS->value])
            ->count();

        if ($activeCount > 0) {
            return response()->json([
                'error' => ['message' => "Tim masih memegang {$activeCount} tiket aktif. Pindahkan (reassign) tiketnya dulu sebelum menonaktifkan tim."],
            ], 422);
        }

        $team->update(['is_active' => false]);

        return response()->json([
            'data' => new TeamResource($this->withStats(Team::query())->findOrFail($team->id)),
        ]);
    }

    public function activate(Team $team): JsonResponse
    {
        Gate::authorize('manage', $team);

        $team->update(['is_active' => true]);

        return response()->json([
            'data' => new TeamResource($this->withStats(Team::query())->findOrFail($team->id)),
        ]);
    }

    /** Cari warga (citizen) yang belum menjadi PJ — untuk memilih PJ dari user existing. */
    public function searchUsers(Request $request): JsonResponse
    {
        Gate::authorize('manage', Team::class);

        $q = trim((string) $request->query('q', ''));
        if ($q === '') {
            return response()->json(['data' => []]);
        }

        $users = User::query()
            ->where('role', UserRole::CITIZEN)
            ->whereNotIn('id', Team::select('user_id')->whereNotNull('user_id'))
            ->where(function ($builder) use ($q): void {
                $builder->where('name', 'ilike', "%{$q}%")
                    ->orWhere('username', 'ilike', "%{$q}%")
                    ->orWhere('email', 'ilike', "%{$q}%");
            })
            ->limit(10)
            ->get(['id', 'name', 'username', 'email', 'phone']);

        return response()->json(['data' => $users]);
    }

    private function withStats($query)
    {
        return $query->with(['leader:id,name,username,email,phone'])
            ->withCount([
                'tickets as activeTicketCount' => fn ($q) => $q->whereIn('status', [TicketStatus::QUEUED->value, TicketStatus::IN_PROGRESS->value]),
                'tickets as totalTicketCount',
            ]);
    }

    /** @return array<string, mixed> */
    private function teamRules(): array
    {
        return [
            'name' => 'required|string|max:100|unique:teams,name',
            'district' => 'required|string|max:100',
            'type' => 'nullable|string|max:100',
            'description' => 'nullable|string|max:500',
        ];
    }

    /** @return array<string, mixed> */
    private function leaderRules(): array
    {
        return [
            'pj_mode' => 'required|in:new,existing',
            'pj_name' => 'required_if:pj_mode,new|nullable|string|max:100',
            'pj_username' => 'required_if:pj_mode,new|nullable|string|min:3|max:40|alpha_dash|unique:users,username',
            'pj_email' => 'nullable|email|max:255|unique:users,email',
            'pj_phone' => 'nullable|string|max:20|unique:users,phone',
            'pj_password' => 'required_if:pj_mode,new|nullable|string|min:8',
            'user_id' => 'required_if:pj_mode,existing|nullable|integer|exists:users,id',
        ];
    }

    /**
     * Arahkan PJ sesuai mode: buat akun Tim baru, atau jadikan user existing sebagai Tim.
     *
     * @param  array<string, mixed>  $validated
     */
    private function resolveLeader(array $validated): User
    {
        if ($validated['pj_mode'] === 'existing') {
            $user = User::findOrFail($validated['user_id']);

            if (Team::where('user_id', $user->id)->exists()) {
                throw ValidationException::withMessages([
                    'user_id' => 'User tersebut sudah menjadi PJ tim lain. Satu user hanya boleh menjadi PJ satu tim.',
                ]);
            }

            if (! in_array($user->role, [UserRole::CITIZEN, UserRole::FIELD_TEAM], true)) {
                throw ValidationException::withMessages([
                    'user_id' => 'Hanya warga atau akun tim yang bisa dijadikan PJ.',
                ]);
            }

            // Riwayat laporan user tetap (laporan menempel pada user_id); role berganti jadi Tim.
            $user->update(['role' => UserRole::FIELD_TEAM]);

            return $user;
        }

        return User::create([
            'name' => $validated['pj_name'],
            'username' => $validated['pj_username'],
            'email' => $validated['pj_email'] ?? null,
            'phone' => $validated['pj_phone'] ?? null,
            'password' => Hash::make($validated['pj_password']),
            'role' => UserRole::FIELD_TEAM,
        ]);
    }
}
