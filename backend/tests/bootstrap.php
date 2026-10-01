<?php

/**
 * Bootstrap for PHPUnit tests.
 * Load .env.testing AFTER autoload to override .env values with test settings.
 */

require __DIR__ . '/../vendor/autoload.php';

// Now override .env values with testing values
$envTestingPath = __DIR__ . '/../.env.testing';
if (file_exists($envTestingPath)) {
    $dotenv = Dotenv\Dotenv::createUnsafeMutable(__DIR__ . '/..', '.env.testing');
    $dotenv->load();
}
