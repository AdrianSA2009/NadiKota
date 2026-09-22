<?php

use App\Http\Controllers\Api\V1\Admin\AnalyticsController;
use App\Http\Controllers\Api\V1\Admin\ConfigurationController;
use App\Http\Controllers\Api\V1\AuthController;
use App\Http\Controllers\Api\V1\NotificationController;
use App\Http\Controllers\Api\V1\ReportController;
use App\Http\Controllers\Api\V1\TicketController;
use Illuminate\Support\Facades\Route;

Route::prefix('v1')->group(function (): void {
    // Auth routes
    Route::post('/auth/google', [AuthController::class, 'googleLogin']);
    Route::get('/auth/google/redirect', [AuthController::class, 'googleRedirect']);
    Route::get('/auth/google/callback', [AuthController::class, 'googleCallback']);
    Route::post('/auth/otp/request', [AuthController::class, 'otpRequest']);
    Route::post('/auth/otp/verify', [AuthController::class, 'otpVerify']);
    Route::post('/auth/logout', [AuthController::class, 'logout'])
        ->middleware('auth:sanctum');

    // Protected routes
    Route::middleware('auth:sanctum')->group(function (): void {
        Route::post('/reports', [ReportController::class, 'store'])
            ->middleware('throttle:reports');
        Route::get('/reports/{report}', [ReportController::class, 'show']);

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
            ->middleware('role:field_team');
        Route::post('/tickets/{ticket}/confirmation', [TicketController::class, 'confirmation']);

        // Field team my tasks
        Route::get('/me/tickets', [TicketController::class, 'myTasks'])
            ->middleware('role:field_team');

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
        });
    });
});
