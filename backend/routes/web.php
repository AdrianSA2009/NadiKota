<?php

use Illuminate\Support\Facades\Route;

Route::get('/', function () {
    return response()->json(['app' => 'NadiKota', 'status' => 'running']);
});

// Required by Sanctum SPA middleware for unauthenticated redirects
Route::get('/login', function () {
    return redirect(config('app.frontend_url', 'http://localhost:3000') . '/login');
})->name('login');
