<?php

namespace App\Http\Middleware;

use Closure;
use Illuminate\Http\Request;
use Symfony\Component\HttpFoundation\Response;

final class EnsureRole
{
    public function handle(Request $request, Closure $next, string ...$roles): Response
    {
        abort_unless($request->user() !== null, 401, 'Unauthenticated.');
        $role = $request->user()->role;
        $roleValue = $role instanceof \BackedEnum ? $role->value : $role;
        abort_unless(in_array($roleValue, $roles, true), 403, 'Forbidden.');

        return $next($request);
    }
}
