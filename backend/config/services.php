<?php

return [

    /*
    |--------------------------------------------------------------------------
    | Third Party Services
    |--------------------------------------------------------------------------
    |
    | This file is for storing the credentials for third party services such
    | as Resend, Postmark, AWS, and more. This file provides the de facto
    | location for this type of information, allowing packages to have
    | a conventional file to locate the various service credentials.
    |
    */

    'postmark' => [
        'key' => env('POSTMARK_API_KEY'),
    ],

    'resend' => [
        'key' => env('RESEND_API_KEY'),
    ],

    'ses' => [
        'key' => env('AWS_ACCESS_KEY_ID'),
        'secret' => env('AWS_SECRET_ACCESS_KEY'),
        'region' => env('AWS_DEFAULT_REGION', 'us-east-1'),
    ],

    'slack' => [
        'notifications' => [
            'bot_user_oauth_token' => env('SLACK_BOT_USER_OAUTH_TOKEN'),
            'channel' => env('SLACK_BOT_USER_DEFAULT_CHANNEL'),
        ],
    ],

    'interakt' => [
        'enabled' => filter_var(env('INTERAKT_ENABLED', false), FILTER_VALIDATE_BOOLEAN),
        'api_key' => env('INTERAKT_API_KEY'),
        'base_url' => env('INTERAKT_BASE_URL', 'https://api.interakt.ai/v1/public'),
        'country_code' => env('INTERAKT_DEFAULT_COUNTRY_CODE', '+91'),
        'templates' => [
            'order_created' => env('INTERAKT_TEMPLATE_ORDER_CREATED', 'lilium_loft_order_placed'),
            'order_processing' => env('INTERAKT_TEMPLATE_ORDER_PROCESSING', 'lilium_order_processing'),
            'order_dispatched' => env('INTERAKT_TEMPLATE_ORDER_DISPATCHED', 'loft_order_dispatched'),
            'out_for_delivery' => env('INTERAKT_TEMPLATE_OUT_FOR_DELIVERY', 'lilium_out_for_delivery'),
            'order_completed' => env('INTERAKT_TEMPLATE_ORDER_COMPLETED', 'lilium_order_delivered_jr'),
        ],
    ],

];
