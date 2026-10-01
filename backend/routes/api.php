<?php

use App\Http\Controllers\Api\V1\Admin\AnalyticsController;
use App\Http\Controllers\Api\V1\Admin\ConfigurationController;
use App\Http\Controllers\Api\V1\AuthController;
use App\Http\Controllers\Api\V1\NotificationController;
use App\Http\Controllers\Api\V1\PhotoScreeningController;
use App\Http\Controllers\Api\V1\PointController;
use App\Http\Controllers\Api\V1\ReportController;
use App\Http\Controllers\Api\V1\Admin\RewardController as AdminRewardController;
use App\Http\Controllers\Api\V1\TeamController;
use App\Http\Controllers\Api\V1\TicketController;
use Illuminate\Cookie\Middleware\EncryptCookies;
use Illuminate\Session\Middleware\StartSession;
use Illuminate\Support\Facades\Route;
use Illuminate\View\Middleware\ShareErrorsFromSession;

Route::prefix('v1')->group(function (): void {
    // Auth routes
    Route::post('/auth/google', [AuthController::class, 'googleLogin']);
    Route::post('/auth/login', [AuthController::class, 'passwordLogin']);
    Route::post('/auth/register', [AuthController::class, 'register']);
    Route::get('/auth/google/redirect', [AuthController::class, 'googleRedirect']);
    Route::get('/auth/google/callback', [AuthController::class, 'googleCallback'])
        ->middleware([EncryptCookies::class, StartSession::class, ShareErrorsFromSession::class]);
    Route::post('/auth/otp/request', [AuthController::class, 'otpRequest']);
    Route::post('/auth/otp/verify', [AuthController::class, 'otpVerify']);
    Route::get('/auth/username-available', [AuthController::class, 'usernameAvailable']);
    Route::get('/auth/session', [AuthController::class, 'session']);
    Route::post('/auth/logout', [AuthController::class, 'logout'])
        ->middleware('auth:sanctum');

    // Current authenticated user
    Route::get('/me', [AuthController::class, 'me'])
        ->middleware('auth:sanctum');
    Route::put('/me/profile', [AuthController::class, 'updateProfile'])
        ->middleware('auth:sanctum');
    Route::put('/me/password', [AuthController::class, 'updatePassword'])
        ->middleware('auth:sanctum');
    Route::post('/me/avatar', [AuthController::class, 'updateAvatar'])
        ->middleware('auth:sanctum');

    Route::get('/tickets/map', [TicketController::class, 'map']);

    // Poin & hadiah
    Route::get('/rewards', [PointController::class, 'rewards']);
    Route::get('/me/points', [PointController::class, 'me'])
        ->middleware('auth:sanctum');
    Route::post('/rewards/{reward}/redeem', [PointController::class, 'redeem'])
        ->middleware('auth:sanctum');

    // Screening foto sebelum laporan dikirim
    Route::post('/photo-screening', [PhotoScreeningController::class, 'check'])
        ->middleware(['auth:sanctum', 'throttle:reports']);
    Route::get('/photo-screening/{checkId}', [PhotoScreeningController::class, 'result'])
        ->middleware('throttle:30,1');

    // Protected routes
    Route::middleware('auth:sanctum')->group(function (): void {
        Route::post('/reports', [ReportController::class, 'store'])
            ->middleware('throttle:reports');
        Route::get('/reports/{report}', [ReportController::class, 'show']);

        // Teams
        Route::get('/teams', [TeamController::class, 'index'])
            ->middleware('role:admin,super_admin');
        Route::post('/teams', [TeamController::class, 'store'])
            ->middleware('role:admin,super_admin');
        Route::get('/teams/{team}', [TeamController::class, 'show'])
            ->middleware('role:admin,super_admin');
        Route::put('/teams/{team}', [TeamController::class, 'update'])
            ->middleware('role:admin,super_admin');
        Route::patch('/teams/{team}/leader', [TeamController::class, 'changeLeader'])
            ->middleware('role:admin,super_admin');
        Route::post('/teams/{team}/reset-password', [TeamController::class, 'resetPassword'])
            ->middleware('role:admin,super_admin');
        Route::patch('/teams/{team}/deactivate', [TeamController::class, 'deactivate'])
            ->middleware('role:admin,super_admin');
        Route::patch('/teams/{team}/activate', [TeamController::class, 'activate'])
            ->middleware('role:admin,super_admin');
        // Cari warga untuk dipilih jadi PJ tim (belum menjadi PJ manapun)
        Route::get('/users/search', [TeamController::class, 'searchUsers'])
            ->middleware('role:admin,super_admin');

        // Field team tickets
        Route::get('/field/tickets', [TicketController::class, 'myTasks'])
            ->middleware('role:field_team');

        // Ticket routes
        Route::get('/tickets', [TicketController::class, 'index'])
            ->middleware('role:admin,super_admin');
        Route::get('/tickets/{ticket}', [TicketController::class, 'show']);
        Route::post('/tickets/{ticket}/support', [TicketController::class, 'support']);
        Route::post('/tickets/{ticket}/review', [TicketController::class, 'review'])
            ->middleware('role:admin,super_admin');
        Route::post('/tickets/{ticket}/dispatch', [TicketController::class, 'dispatch'])
            ->middleware('role:admin,super_admin');
        Route::post('/tickets/{ticket}/complete', [TicketController::class, 'complete'])
            ->middleware('role:admin,super_admin,field_team');
        Route::post('/tickets/{ticket}/finalize', [TicketController::class, 'finalize'])
            ->middleware('role:admin,super_admin');
        Route::post('/tickets/{ticket}/reject-proof', [TicketController::class, 'rejectProof'])
            ->middleware('role:admin,super_admin');
        Route::post('/tickets/{ticket}/start', [TicketController::class, 'start'])
            ->middleware('role:admin,super_admin,field_team');
        Route::post('/tickets/{ticket}/cancel', [TicketController::class, 'cancel'])
            ->middleware('role:admin,super_admin');
        Route::post('/tickets/{ticket}/confirmation', [TicketController::class, 'confirmation']);

        // Notification routes
        Route::get('/me/notifications', [NotificationController::class, 'index']);
        Route::put('/me/notifications/{notification}/read', [NotificationController::class, 'markRead']);
        Route::put('/me/notifications/read-all', [NotificationController::class, 'markAllRead']);

        // Analytics routes (admin only)
        Route::get('/analytics/summary', [AnalyticsController::class, 'summary'])
            ->middleware('role:admin,super_admin');

        // Admin routes
        Route::prefix('admin')->middleware('role:admin,super_admin')->group(function (): void {
            Route::get('/configuration', [ConfigurationController::class, 'index']);
            Route::put('/configuration', [ConfigurationController::class, 'update']);
            Route::get('/audit-logs', [AnalyticsController::class, 'auditLogs']);
            Route::get('/rewards', [AdminRewardController::class, 'index']);
            Route::post('/rewards', [AdminRewardController::class, 'store']);
            Route::post('/rewards/generate-description', [AdminRewardController::class, 'generateDescription']);
            Route::put('/rewards/{reward}', [AdminRewardController::class, 'update']);
            Route::delete('/rewards/{reward}', [AdminRewardController::class, 'destroy']);
        });
    });
});
