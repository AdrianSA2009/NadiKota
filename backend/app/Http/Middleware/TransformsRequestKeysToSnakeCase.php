<?php

declare(strict_types=1);

namespace App\Http\Middleware;

use Closure;
use Illuminate\Http\Request;

final class TransformsRequestKeysToSnakeCase
{
    public function handle(Request $request, Closure $next): mixed
    {
        $request->replace($this->transform($request->all()));

        return $next($request);
    }

    private function transform(mixed $value): mixed
    {
        if (! is_array($value)) {
            return $value;
        }

        $result = [];
        foreach ($value as $key => $item) {
            $result[is_string($key) ? strtolower((string) preg_replace('/(?<!^)[A-Z]/', '_$0', $key)) : $key] = $this->transform($item);
        }

        return $result;
    }
}
