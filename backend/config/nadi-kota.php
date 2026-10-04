<?php

return [

    /*
    |--------------------------------------------------------------------------
    | Clustering Configuration (FR-14)
    |--------------------------------------------------------------------------
    | Radius pencarian tiket terdekat untuk penggabungan laporan duplikat.
    | Range valid: 15–25 meter. Default 20 meter.
    */
    'clustering' => [
        'radius_meters' => (int) env('CLUSTERING_RADIUS_METERS', 20),
        'min_radius' => 15,
        'max_radius' => 25,
    ],

    /*
    |--------------------------------------------------------------------------
    | AI Validation Configuration (FR-08, FR-09, FR-11)
    |--------------------------------------------------------------------------
    | Model, timeout, prompt version, dan ambang keputusan untuk validasi foto.
    */
    'ai' => [
        'model' => env('OPENAI_MODEL', 'cx/gpt-5.6-luna'),
        'base_url' => env('OPENAI_BASE_URL', 'http://localhost:20128/v1'),
        'timeout_seconds' => (int) env('AI_TIMEOUT_SECONDS', 20),
        'max_daily_calls' => (int) env('AI_MAX_DAILY_CALLS', 5000),
        'prompt_version' => env('AI_PROMPT_VERSION', 'v1.2'),
        'thresholds' => [
            'accepted_min_confidence' => (float) env('AI_ACCEPTED_MIN_CONFIDENCE', 0.7),
            'rejected_max_confidence' => (float) env('AI_REJECTED_MAX_CONFIDENCE', 0.3),
        ],
        'rephoto' => [
            'score_threshold' => (float) env('AI_REPHOTO_SCORE_THRESHOLD', 0.8),
            'edge_dark_ratio' => (float) env('AI_REPHOTO_EDGE_DARK_RATIO', 62),
            'periodic_correlation' => (float) env('AI_REPHOTO_PERIODIC_CORRELATION', 0.9),
        ],
    ],

    /*
    |--------------------------------------------------------------------------
    | SLA Configuration (FR-30)
    |--------------------------------------------------------------------------
    | Batas waktu penyelesaian tiket dalam hari kerja dan jenjang eskalasi.
    */
    'sla' => [
        'business_hours_per_day' => (int) env('SLA_BUSINESS_HOURS', 8),
        // Batas hari kerja per kategori — diisi saat admin menyetujui tiket.
        'days_by_category' => [
            'pothole' => (int) env('SLA_DAYS_POTHOLE', 3),
            'street_light' => (int) env('SLA_DAYS_STREET_LIGHT', 7),
            'other' => (int) env('SLA_DAYS_OTHER', 7),
        ],
        'escalation' => [
            'day_1_role' => env('SLA_ESCALATION_DAY1_ROLE', 'supervisor'),
            'day_3_role' => env('SLA_ESCALATION_DAY3_ROLE', 'admin'),
            'day_5_role' => env('SLA_ESCALATION_DAY5_ROLE', 'super_admin'),
        ],
    ],

    /*
    |--------------------------------------------------------------------------
    | Rate Limiting (FR-12, NFR-7.2)
    |--------------------------------------------------------------------------
    | Pembatasan frekuensi laporan per pengguna per hari.
    */
    'rate_limiting' => [
        'reports_per_user_per_day' => (int) env('REPORTS_PER_USER_PER_DAY', 10),
        'reports_per_ip_per_minute' => (int) env('REPORTS_PER_IP_PER_MINUTE', 30),
    ],

    /*
    |--------------------------------------------------------------------------
    | Photo Configuration (NFR-7.1)
    |--------------------------------------------------------------------------
    | Batas ukuran foto dan kompresi.
    */
    'photo' => [
        'max_size_bytes' => (int) env('PHOTO_MAX_SIZE_BYTES', 1048576), // 1 MB
        'allowed_mime_types' => [
            'image/jpeg',
            'image/png',
            'image/webp',
        ],
    ],

    /*
    |--------------------------------------------------------------------------
    | OTP Configuration (FR-01)
    |--------------------------------------------------------------------------
    | Konfigurasi OTP untuk login via nomor telepon.
    */
    'otp' => [
        'length' => (int) env('OTP_LENGTH', 6),
        'expiry_minutes' => (int) env('OTP_EXPIRY_MINUTES', 5),
        'max_attempts' => (int) env('OTP_MAX_ATTEMPTS', 3),
        'rate_limit_per_hour' => (int) env('OTP_RATE_LIMIT_PER_HOUR', 5),
    ],

    /*
    |--------------------------------------------------------------------------
    | Map / Geo (FR-05)
    |--------------------------------------------------------------------------
    | Bounding box Batam untuk validasi koordinat wajar.
    */
    'geo' => [
        'bounding_box' => [
            'min_lat' => (float) env('GEO_MIN_LAT', 0.9),
            'max_lat' => (float) env('GEO_MAX_LAT', 1.3),
            'min_lng' => (float) env('GEO_MIN_LNG', 103.6),
            'max_lng' => (float) env('GEO_MAX_LNG', 104.2),
        ],
        // Deteksi fake GPS (sinyal, bukan bukti — hasilnya needs_review)
        'exif_mismatch_meters' => (float) env('GEO_EXIF_MISMATCH_METERS', 500),
        'ip_mismatch_km' => (float) env('GEO_IP_MISMATCH_KM', 100),
        'ip_lookup_url' => env('GEO_IP_LOOKUP_URL', 'http://ip-api.com/json'),
    ],

    /*
    |--------------------------------------------------------------------------
    | Queue Job Configuration
    |--------------------------------------------------------------------------
    | Batas percobaan dan timeout untuk queue jobs.
    */
    'queue' => [
        'validate_image_tries' => (int) env('VALIDATE_IMAGE_TRIES', 3),
        'validate_image_timeout' => (int) env('VALIDATE_IMAGE_TIMEOUT', 30),
        'notification_tries' => (int) env('NOTIFICATION_TRIES', 3),
    ],

    /*
    |--------------------------------------------------------------------------
    | Poin Kontribusi (FR-17)
    |--------------------------------------------------------------------------
    | Poin diberikan kepada warga ketika laporan diterima AI.
    */
    'points' => [
        'report_accepted' => (int) env('POINTS_REPORT_ACCEPTED', 10),
    ],

];
