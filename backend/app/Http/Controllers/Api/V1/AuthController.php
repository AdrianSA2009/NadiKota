<?php

namespace App\Http\Controllers\Api\V1;

use App\Enums\UserRole;
use App\Http\Controllers\Controller;
use App\Models\User;
use App\Services\OtpService;
use App\Support\PhotoUrl;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Auth;
use Illuminate\Support\Facades\Hash;
use Illuminate\Support\Facades\RateLimiter;
use Illuminate\Support\Facades\Storage;
use Laravel\Socialite\Facades\Socialite;
use Symfony\Component\HttpFoundation\RedirectResponse;

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

    public function register(Request $request): JsonResponse
    {
        $data = $request->validate([
            'username' => 'required|string|min:3|max:40|alpha_dash|unique:users,username',
            'name' => 'required|string|min:2|max:100',
            'password' => 'required|string|min:8|confirmed',
        ]);

        $user = User::create([
            'username' => $data['username'],
            'name' => $data['name'],
            'password' => Hash::make($data['password']),
            'role' => UserRole::CITIZEN,
        ]);

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
        $data = $request->validate([
            'username' => 'required|string|min:3|max:40|alpha_dash|unique:users,username,' . $user->id,
            'name' => 'required|string|min:2|max:100',
        ]);

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
     * Redirect ke Google OAuth.
     */
    public function googleRedirect(): RedirectResponse
    {
        return Socialite::driver('google')
            ->scopes([
                'openid',
                'https://www.googleapis.com/auth/userinfo.email',
                'https://www.googleapis.com/auth/userinfo.profile',
            ])
            ->redirect();
    }

    /**
     * Handle callback dari Google OAuth.
     */
    public function googleCallback(Request $request): RedirectResponse
    {
        $googleUser = Socialite::driver('google')
            ->stateless()
            ->user();

        $user = User::updateOrCreate(
            [
                'oauth_provider' => 'google',
                'oauth_subject' => $googleUser->getId(),
            ],
            [
                'name' => $googleUser->getName(),
                'email' => $googleUser->getEmail(),
                'role' => UserRole::CITIZEN,
            ],
        );

        Auth::login($user);

        return redirect(config('app.frontend_url', 'http://localhost:3000') . '/peta');
    }

    /**
     * Login via id_token Google (untuk PWA/mobile).
     */
    public function googleLogin(Request $request): JsonResponse
    {
        $request->validate([
            'id_token' => 'required|string',
        ]);

        try {
            $googleUser = Socialite::driver('google')
                ->stateless()
                ->userFromToken($request->input('id_token'));
        } catch (\Exception $e) {
            return response()->json([
                'error' => ['message' => 'Token Google tidak valid.'],
            ], 422);
        }

        $user = User::updateOrCreate(
            [
                'oauth_provider' => 'google',
                'oauth_subject' => $googleUser->getId(),
            ],
            [
                'name' => $googleUser->getName(),
                'email' => $googleUser->getEmail(),
                'role' => UserRole::CITIZEN,
            ],
        );

        Auth::login($user);

        $token = $user->createToken('app')->plainTextToken;

        return response()->json([
            'data' => [
                'token' => $token,
                'user' => [
                    'id' => $user->id,
                    'name' => $user->name,
                    'email' => $user->email,
                    'role' => $user->role->value,
                ],
            ],
        ]);
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
