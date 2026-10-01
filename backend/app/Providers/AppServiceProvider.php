<?php

namespace App\Providers;

use App\Repositories\Contracts\ReportRepository;
use App\Repositories\EloquentReportRepository;
use App\Services\Contracts\AiImageValidator;
use App\Services\Contracts\NotificationChannel;
use App\Services\Contracts\OtpProvider;
use App\Services\InAppNotificationChannel;
use App\Services\LogOtpProvider;
use App\Services\OpenAiImageValidator;
use Illuminate\Cache\RateLimiting\Limit;
use Illuminate\Support\Facades\RateLimiter;
use Illuminate\Support\ServiceProvider;

class AppServiceProvider extends ServiceProvider
{
    public function register(): void
    {
        $this->app->bind(OtpProvider::class, fn () => new LogOtpProvider);
        $this->app->bind(AiImageValidator::class, fn () => new OpenAiImageValidator);
        $this->app->bind(ReportRepository::class, fn () => new EloquentReportRepository);
        $this->app->bind(NotificationChannel::class, fn () => new InAppNotificationChannel);
    }

    public function boot(): void
    {
        $this->loadMigrationsFrom(database_path('migrations/nadi_kota'));

        RateLimiter::for('reports', function ($request): Limit {
            return Limit::perMinute((int) config('nadi-kota.rate_limiting.reports_per_ip_per_minute', 30))
                ->by($request->user()?->id ?? $request->ip());
        });
    }
}
