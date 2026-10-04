<?php

namespace App\Http\Controllers\Api\V1;

use App\Enums\UserRole;
use App\Http\Controllers\Controller;
use App\Models\User;
use App\Services\EmailOtpService;
use App\Services\OtpService;
use App\Support\PhotoUrl;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Database\QueryException;
use Illuminate\Support\Facades\Auth;
use Illuminate\Support\Facades\Hash;
use Illuminate\Support\Facades\Log;
use Illuminate\Support\Facades\RateLimiter;
use Illuminate\Support\Facades\Storage;

final class AuthController extends Controller
{
    public function passwordLogin(Request $request): JsonResponse
    {
        $credentials = $request->validate([
            'username' => 'required|string',
            'password' => 'required|string',
        ]);

        $user = User::where('username', $credentials['username'])->first();
        if (! $user || ! $user->password || ! Hash::check($credentials['password'], $user->password)) {
            return response()->json(['error' => ['message' => 'Username atau password salah.']], 422);
        }

        Auth::login($user);

        // Token untuk klien mobile (Bearer) — web tetap pakai session cookie
        $token = $user->createToken('app')->plainTextToken;

        return response()->json(['data' => ['user' => $this->userData($user), 'token' => $token]]);
    }

    public function usernameAvailable(Request $request): JsonResponse
    {
        $data = $request->validate([
            'username' => 'required|string|min:3|max:40|alpha_dash',
        ]);

        $taken = User::where('username', $data['username'])->exists();

        return response()->json(['data' => ['available' => ! $taken]]);
    }

    public function emailAvailable(Request $request): JsonResponse
    {
        $email = mb_strtolower(trim((string) $request->query('email', '')));
        validator(['email' => $email], ['email' => 'required|email|max:255'])->validate();

        $taken = User::whereRaw('LOWER(TRIM(email)) = ?', [$email])->exists();

        return response()->json(['data' => ['available' => ! $taken]]);
    }

    /**
     * POST /auth/register — langkah 1: validasi data + kirim OTP ke email.
     * Akun belum dibuat — menunggu verifikasi (POST /auth/register/verify).
     */
    public function register(Request $request, EmailOtpService $otp): JsonResponse
    {
        // Email identitas unik case-insensitive; normalisasi sebelum validasi, rate-limit,
        // penyimpanan pending OTP, dan pembuatan akun.
        $request->merge(['email' => mb_strtolower(trim((string) $request->input('email')))]);

        $data = $request->validate([
            'username' => 'required|string|min:3|max:40|alpha_dash|unique:users,username',
            'name' => 'required|string|min:2|max:100',
            'email' => 'required|email|max:255',
            'password' => 'required|string|min:8|confirmed',
        ]);

        if (User::whereRaw('LOWER(TRIM(email)) = ?', [$data['email']])->exists()) {
            throw \Illuminate\Validation\ValidationException::withMessages([
                'email' => ['Email sudah terdaftar, silakan login atau gunakan email lain.'],
            ]);
        }

        $throttleKey = 'register:' . $data['email'];
        if (RateLimiter::tooManyAttempts($throttleKey, 5)) {
            return response()->json([
                'error' => ['message' => 'Terlalu banyak permintaan OTP. Coba lagi beberapa menit lagi.'],
            ], 429);
        }
        // Pending registrasi disimpan di Redis — password sudah di-hash sekali.
        try {
            $otp->send($data['email'], [
                'username' => $data['username'],
                'name' => $data['name'],
                'email' => $data['email'],
                'password' => Hash::make($data['password']),
            ]);
        } catch (\Symfony\Component\Mailer\Exception\TransportExceptionInterface $e) {
            // SMTP unavailable/credentials rejected: fail clearly and let user retry.
            Log::warning('Registration OTP email delivery failed.', [
                'email_hash' => hash('sha256', $data['email']),
                'exception' => $e::class,
            ]);

            return response()->json([
                'error' => ['code' => 'OTP_EMAIL_UNAVAILABLE', 'message' => 'Email verifikasi belum dapat dikirim. Coba lagi nanti atau hubungi administrator.'],
            ], 503);
        }

        RateLimiter::hit($throttleKey, 600);

        return response()->json([
            'message' => 'Kode verifikasi dikirim ke email Anda.',
            'email' => $data['email'],
        ], 202);
    }

    /**
     * POST /auth/register/verify — langkah 2: cocokkan OTP, baru akun dibuat + sesi.
     */
    public function registerVerify(Request $request, EmailOtpService $otp): JsonResponse
    {
        $request->merge(['email' => mb_strtolower(trim((string) $request->input('email')))]);
        $data = $request->validate([
            'email' => 'required|email',
            'otp' => 'required|string|size:' . config('nadi-kota.otp.length', 6),
        ]);

        $pending = $otp->verify($data['email'], $data['otp']);
        if ($pending === null) {
            return response()->json([
                'error' => ['message' => 'Kode OTP salah atau kedaluwarsa.'],
            ], 422);
        }

        // Bisa saja sudah terpakai selama menunggu OTP.
        if (User::where('username', $pending['username'])->exists() || User::whereRaw('LOWER(TRIM(email)) = ?', [mb_strtolower(trim((string) $pending['email']))])->exists()) {
            return response()->json([
                'error' => ['message' => 'Username sudah digunakan atau email sudah terdaftar, silakan login atau gunakan data lain.'],
            ], 422);
        }

        try {
            $user = User::create([
                'username' => $pending['username'],
                'name' => $pending['name'],
                'email' => $pending['email'],
                'password' => $pending['password'], // sudah di-hash saat langkah 1
                'role' => UserRole::CITIZEN,
            ]);
        } catch (QueryException $e) {
            // DB index tetap jadi pengaman race bila dua pendaftaran bersamaan.
            if (str_contains($e->getMessage(), 'users_email_lower_unique')) {
                return response()->json([
                    'error' => ['message' => 'Email sudah terdaftar, silakan login atau gunakan email lain.'],
                ], 422);
            }

            throw $e;
        }

        Auth::login($user);

        $token = $user->createToken('app')->plainTextToken;

        return response()->json(['data' => ['user' => $this->userData($user), 'token' => $token]], 201);
    }

    private function userData(User $user): array
    {
        return [
            'id' => $user->id,
            'name' => $user->name,
            'username' => $user->username,
            'email' => $user->email,
            'role' => $user->role instanceof \BackedEnum ? $user->role->value : $user->role,
            'avatarUrl' => PhotoUrl::make($user->avatar_path),
        ];
    }

    public function me(Request $request): JsonResponse
    {
        return response()->json(['data' => ['user' => $this->userData($request->user())]]);
    }

    /** Cek sesi tanpa middleware auth: login → user, tamu → null. Selalu 200. */
    public function session(): JsonResponse
    {
        $user = Auth::guard('sanctum')->user();

        return response()->json(['data' => ['user' => $user ? $this->userData($user) : null]]);
    }

    public function updateProfile(Request $request): JsonResponse
    {
        $user = $request->user();
        $request->merge(['email' => mb_strtolower(trim((string) $request->input('email')))]);
        $data = $request->validate([
            'username' => 'required|string|min:3|max:40|alpha_dash|unique:users,username,' . $user->id,
            'name' => 'required|string|min:2|max:100',
            'email' => ['required', 'email', 'max:255'],
        ]);

        if (User::whereRaw('LOWER(TRIM(email)) = ?', [$data['email']])->whereKeyNot($user->id)->exists()) {
            throw \Illuminate\Validation\ValidationException::withMessages([
                'email' => ['Email sudah terdaftar, silakan gunakan email lain.'],
            ]);
        }

        $user->update($data);

        return response()->json(['data' => ['user' => $this->userData($user)]]);
    }

    public function updatePassword(Request $request): JsonResponse
    {
        $data = $request->validate([
            'current_password' => 'required|string',
            'password' => 'required|string|min:8|confirmed',
        ]);

        $user = $request->user();
        if (! $user->password || ! Hash::check($data['current_password'], $user->password)) {
            return response()->json(['error' => ['message' => 'Password saat ini salah.']], 422);
        }

        $user->update(['password' => Hash::make($data['password'])]);

        return response()->json(['message' => 'Password berhasil diubah.']);
    }

    public function updateAvatar(Request $request): JsonResponse
    {
        $request->validate([
            'photo' => 'required|image|mimes:jpeg,jpg,png,webp|max:2048',
        ]);

        $user = $request->user();

        if ($user->avatar_path) {
            Storage::disk()->delete($user->avatar_path);
        }

        $user->update([
            'avatar_path' => $request->file('photo')->store('avatars', 'public'),
        ]);

        return response()->json(['data' => ['user' => $this->userData($user)]]);
    }

    /**
     * Request OTP ke nomor telepon.
     */
    public function otpRequest(Request $request, OtpService $otpService): JsonResponse
    {
        $request->validate([
            'phone' => 'required|string|regex:/^\+62[0-9]{9,13}$/',
        ]);

        $phone = $request->input('phone');

        $throttleKey = 'otp:' . $phone;
        if (RateLimiter::tooManyAttempts($throttleKey, 5)) {
            return response()->json([
                'error' => ['message' => 'Terlalu banyak permintaan. Coba lagi nanti.'],
            ], 429);
        }

        $otpService->send($phone);
        RateLimiter::hit($throttleKey, 3600);

        return response()->json([
            'message' => 'OTP telah dikirim ke nomor Anda.',
        ]);
    }

    /**
     * Verifikasi OTP dan buat sesi.
     */
    public function otpVerify(Request $request, OtpService $otpService): JsonResponse
    {
        $request->validate([
            'phone' => 'required|string',
            'otp' => 'required|string|size:' . config('nadi-kota.otp.length', 6),
        ]);

        $phone = $request->input('phone');
        $otp = $request->input('otp');

        if (! $otpService->verify($phone, $otp)) {
            return response()->json([
                'error' => ['message' => 'OTP tidak valid atau sudah kedaluwarsa.'],
            ], 422);
        }

        $user = User::firstOrCreate(
            ['phone' => $phone],
            [
                'name' => 'Warga ' . substr($phone, -4),
                'role' => UserRole::CITIZEN,
                'phone_verified_at' => now(),
            ],
        );

        $user->update(['phone_verified_at' => $user->phone_verified_at ?? now()]);

        Auth::login($user);

        return response()->json([
            'data' => [
                'user' => [
                    'id' => $user->id,
                    'name' => $user->name,
                    'phone' => $user->phone,
                    'role' => $user->role->value,
                ],
            ],
        ]);
    }

    /**
     * Logout — hancurkan session backend.
     */
    public function logout(Request $request): JsonResponse
    {
        // Cabut token mobile (Bearer) bila dipakai; session web tetap di-invalidate
        $token = $request->user()?->currentAccessToken();
        if ($token instanceof \Laravel\Sanctum\PersonalAccessToken) {
            $token->delete();
        }

        Auth::guard('web')->logout();

        if ($request->hasSession()) {
            $request->session()->invalidate();
            $request->session()->regenerateToken();
        }

        return response()->json(['message' => 'Berhasil logout.']);
    }
}
