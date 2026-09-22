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
use Illuminate\Support\ServiceProvider;

class AppServiceProvider extends ServiceProvider
{
    public function register(): void
    {
        $this->app->bind(OtpProvider::class, fn () => new LogOtpProvider());
        $this->app->bind(AiImageValidator::class, fn () => new OpenAiImageValidator());
        $this->app->bind(ReportRepository::class, fn () => new EloquentReportRepository());
        $this->app->bind(NotificationChannel::class, fn () => new InAppNotificationChannel());
    }

    public function boot(): void
    {
        //
    }
}
