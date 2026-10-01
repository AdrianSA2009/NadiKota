<?php

use App\Http\Middleware\EnsureRole;
use App\Http\Middleware\TransformsRequestKeysToSnakeCase;
use Illuminate\Auth\AuthenticationException;
use Illuminate\Foundation\Application;
use Illuminate\Foundation\Configuration\Exceptions;
use Illuminate\Foundation\Configuration\Middleware;
use Illuminate\Http\Middleware\HandleCors;
use Illuminate\Http\Request;
use Illuminate\Validation\ValidationException;
use Laravel\Sanctum\Http\Middleware\EnsureFrontendRequestsAreStateful;
use Symfony\Component\HttpFoundation\Response;
use Symfony\Component\HttpKernel\Exception\HttpException;

return Application::configure(basePath: dirname(__DIR__))
    ->withRouting(
        api: __DIR__ . '/../routes/api.php',
        web: __DIR__ . '/../routes/web.php',
        commands: __DIR__ . '/../routes/console.php',
        health: '/up',
    )
    ->withMiddleware(function (Middleware $middleware): void {
        $middleware->api(prepend: [
            HandleCors::class,
            EnsureFrontendRequestsAreStateful::class,
            TransformsRequestKeysToSnakeCase::class,
        ]);

        $middleware->alias([
            'role' => EnsureRole::class,
        ]);

        if (env('APP_ENV') === 'production' || env('APP_ENV') === 'staging') {
            $middleware->throttleWithRedis();
        }
    })
    ->withExceptions(function (Exceptions $exceptions): void {
        $exceptions->render(function (Throwable $e, Request $request) {
            if ($request->is('api/*')) {
                $status = $e instanceof HttpException
                    ? $e->getStatusCode()
                    : ($e instanceof ValidationException
                        ? 422
                        : ($e instanceof AuthenticationException
                            ? Response::HTTP_UNAUTHORIZED
                            : Response::HTTP_INTERNAL_SERVER_ERROR));

                $body = [
                    'error' => [
                        'code' => $status === 500 ? 'SERVER_ERROR' : class_basename($e),
                        'message' => $status === 500 ? 'Terjadi kesalahan pada server.' : $e->getMessage(),
                        'request_id' => (string) $request->attributes->get('request_id'),
                    ],
                ];

                if ($status === 422 && $e instanceof ValidationException) {
                    $body['error']['details'] = collect($e->errors())->mapWithKeys(function ($msgs, $key) {
                        $camelKey = lcfirst(str_replace(' ', '', ucwords(str_replace(['-', '_'], ' ', $key))));

                        return [$camelKey => $msgs];
                    })->all();
                }

                return response()->json($body, $status);
            }
        });
    })->create();
