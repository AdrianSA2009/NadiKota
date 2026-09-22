<?php

namespace App\Http\Controllers\Api\V1;

use App\Enums\UserRole;
use App\Http\Controllers\Controller;
use App\Models\User;
use App\Services\Contracts\OtpProvider;
use App\Services\OtpService;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\RateLimiter;
use Illuminate\Support\Str;
use Laravel\Socialite\Facades\Socialite;

final class AuthController extends Controller
{
    /**
     * Redirect ke Google OAuth.
     */
    public function googleRedirect(): \Symfony\Component\HttpFoundation\RedirectResponse
    {
        return Socialite::driver('google')
            ->stateless()
            ->redirect();
    }

    /**
     * Handle callback dari Google OAuth.
     */
    public function googleCallback(Request $request): JsonResponse
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

        $token = $user->createToken('auth-token')->plainTextToken;

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

        $token = $user->createToken('auth-token')->plainTextToken;

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
            'otp' => 'required|string|size:'. config('nadi-kota.otp.length', 6),
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

        $token = $user->createToken('auth-token')->plainTextToken;

        return response()->json([
            'data' => [
                'token' => $token,
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
     * Logout — revoke token.
     */
    public function logout(Request $request): JsonResponse
    {
        $request->user()->currentAccessToken()->delete();

        return response()->json(['message' => 'Berhasil logout.']);
    }
}
