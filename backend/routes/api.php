<?php

use App\Http\Controllers\Api\AuthController;
use App\Http\Controllers\Api\CategoryController;
use App\Http\Controllers\Api\CouponController;
use App\Http\Controllers\Api\CustomerController;
use App\Http\Controllers\Api\CustomerInvoiceController;
use App\Http\Controllers\Api\DashboardController;
use App\Http\Controllers\Api\NotificationController;
use App\Http\Controllers\Api\OrderController;
use App\Http\Controllers\Api\PaymentGatewayController;
use App\Http\Controllers\Api\ProductController;
use App\Http\Controllers\Api\ReportController;
use App\Http\Controllers\Api\SettingsController;
use App\Http\Controllers\Api\SyncController;
use App\Http\Controllers\Api\ShippingController;
use App\Http\Controllers\Api\WebhookController;
use App\Http\Controllers\Api\WriteSettingController;
use App\Http\Controllers\Api\Write\CategoryWriteController;
use App\Http\Controllers\Api\Write\CouponWriteController;
use App\Http\Controllers\Api\Write\CustomerWriteController;
use App\Http\Controllers\Api\Write\OrderWriteController;
use App\Http\Controllers\Api\Write\PaymentGatewayWriteController;
use App\Http\Controllers\Api\Write\ProductTrashController;
use App\Http\Controllers\Api\Write\ProductWriteController;
use App\Http\Controllers\Api\Write\SettingsWriteController;
use App\Http\Controllers\Api\Write\ShippingWriteController;
use Illuminate\Support\Facades\Route;

// Reads are GET. Anything that changes WooCommerce sits in the "write routes" group at the
// bottom and is blocked by the woo.write middleware unless writes are explicitly switched on.
Route::prefix('v1')->group(function () {
    Route::post('auth/login', [AuthController::class, 'login'])->middleware('throttle:5,1,login');

    // Outside auth:api on purpose: refreshing must work with an EXPIRED token (inside the refresh window).
    Route::post('auth/refresh', [AuthController::class, 'refresh'])->middleware('throttle:30,1,refresh');

    Route::middleware(['auth:api', 'throttle:120,1,api-read'])->group(function () {
        Route::get('auth/me', [AuthController::class, 'me']);
        Route::post('auth/logout', [AuthController::class, 'logout']);

        Route::get('dashboard/summary', [DashboardController::class, 'summary']);
        Route::get('dashboard/revenue', [DashboardController::class, 'revenue']);
        Route::get('dashboard/orders-by-status', [DashboardController::class, 'ordersByStatus']);
        Route::get('dashboard/top-products', [DashboardController::class, 'topProducts']);
        Route::get('sync/status', [DashboardController::class, 'syncStatus']);
        Route::get('write-settings', [WriteSettingController::class, 'index']);

        Route::get('orders', [OrderController::class, 'index']);
        Route::get('orders/{id}', [OrderController::class, 'show'])->whereNumber('id');
        Route::get('orders/{id}/notes', [OrderWriteController::class, 'notes'])->whereNumber('id');
        Route::get('orders/{id}/refunds', [OrderWriteController::class, 'refunds'])->whereNumber('id');
        Route::get('products/trash', [ProductTrashController::class, 'index']);
        Route::get('products', [ProductController::class, 'index']);
        Route::get('products/{id}', [ProductController::class, 'show'])->whereNumber('id');
        Route::get('customers', [CustomerController::class, 'index']);
        Route::get('customers/{id}', [CustomerController::class, 'show'])->whereNumber('id');
        Route::get('categories', [CategoryController::class, 'index']);
        Route::get('categories/{id}', [CategoryController::class, 'show'])->whereNumber('id');
        Route::get('coupons', [CouponController::class, 'index']);
        Route::get('coupons/{id}', [CouponController::class, 'show'])->whereNumber('id');

        // Shipping, settings and payment gateways: live GET reads from WooCommerce (cached, secrets masked).
        Route::get('shipping/zones', [ShippingController::class, 'zones']);
        Route::get('shipping/zones/{id}', [ShippingController::class, 'zone'])->whereNumber('id');
        Route::get('shipping/methods', [ShippingController::class, 'methods']);
        Route::get('shipping/classes', [ShippingController::class, 'classes']);
        Route::get('settings', [SettingsController::class, 'groups']);
        Route::get('settings/{group}', [SettingsController::class, 'group'])->where('group', '[A-Za-z0-9_-]+');
        Route::get('payments', [PaymentGatewayController::class, 'index']);
        Route::get('payments/{id}', [PaymentGatewayController::class, 'show'])->where('id', '[A-Za-z0-9_-]+');

        // Notifications and reports: computed from the local mirror.
        Route::get('notifications', [NotificationController::class, 'index']);
        Route::post('notifications/read', [NotificationController::class, 'markRead']); // local read-state only
        Route::get('reports/sales', [ReportController::class, 'sales']);
        Route::get('reports/products', [ReportController::class, 'products']);
        Route::get('reports/categories', [ReportController::class, 'categories']);
        Route::get('reports/customers', [ReportController::class, 'customers']);
        Route::get('reports/coupons', [ReportController::class, 'coupons']);
        Route::get('reports/stock', [ReportController::class, 'stock']);
    });

    // Polled rapidly by the admin panel; has its own rate limit so it never eats the normal read allowance.
    Route::get('sync/changes', [SyncController::class, 'changes'])->middleware(['auth:api', 'throttle:360,1,api-poll']);

    // Import from WooCommerce into the local database. READ-ONLY towards WooCommerce (GET only), so it needs no write switch.
    Route::post('sync', [SyncController::class, 'run'])->middleware(['auth:api', 'throttle:60,1,api-sync']);

    // Flipping the write switches themselves: needs can_write (checked in the controller), not a write switch.
    Route::put('write-settings/{key}', [WriteSettingController::class, 'update'])->middleware(['auth:api', 'throttle:30,1,api-write-settings']);

    // Write routes: each one names the capability switch it needs.
    Route::middleware(['auth:api', 'throttle:30,1,api-write'])->group(function () {
        Route::match(['put', 'patch'], 'products/{id}', [ProductController::class, 'update'])
            ->whereNumber('id')
            ->middleware('woo.write:products.update');
        Route::post('products', [ProductWriteController::class, 'store'])->middleware('woo.write:products.create');
        Route::post('products/trash/{wooId}/restore', [ProductTrashController::class, 'restore'])->whereNumber('wooId')->middleware('woo.write:products.delete');
        Route::delete('products/{id}', [ProductWriteController::class, 'destroy'])->whereNumber('id')->middleware('woo.write:products.delete');

        Route::match(['put', 'patch'], 'orders/{id}', [OrderWriteController::class, 'update'])->whereNumber('id')->middleware('woo.write:orders.update');
        Route::delete('orders/{id}', [OrderWriteController::class, 'destroy'])->whereNumber('id')->middleware('woo.write:orders.update');
        Route::put('orders/{id}/status', [OrderWriteController::class, 'status'])->whereNumber('id')->middleware('woo.write:orders.update');
        Route::post('orders/{id}/whatsapp', [OrderWriteController::class, 'sendWhatsApp'])->whereNumber('id')->middleware('woo.write:orders.update');
        Route::post('orders/{id}/notes', [OrderWriteController::class, 'addNote'])->whereNumber('id')->middleware('woo.write:orders.note');
        Route::post('orders/{id}/refunds', [OrderWriteController::class, 'addRefund'])->whereNumber('id')->middleware('woo.write:orders.refund');

        // Customers and categories have no trash in WooCommerce: deleting them also needs the permanent_delete switch (enforced in WooWriteClient).
        Route::post('customers', [CustomerWriteController::class, 'store'])->middleware('woo.write:customers.create');
        Route::match(['put', 'patch'], 'customers/{id}', [CustomerWriteController::class, 'update'])->whereNumber('id')->middleware('woo.write:customers.update');
        Route::delete('customers/{id}', [CustomerWriteController::class, 'destroy'])->whereNumber('id')->middleware('woo.write:customers.delete');

        Route::post('categories', [CategoryWriteController::class, 'store'])->middleware('woo.write:categories.create');
        Route::match(['put', 'patch'], 'categories/{id}', [CategoryWriteController::class, 'update'])->whereNumber('id')->middleware('woo.write:categories.update');
        Route::delete('categories/{id}', [CategoryWriteController::class, 'destroy'])->whereNumber('id')->middleware('woo.write:categories.delete');

        Route::post('coupons', [CouponWriteController::class, 'store'])->middleware('woo.write:coupons.create');
        Route::match(['put', 'patch'], 'coupons/{id}', [CouponWriteController::class, 'update'])->whereNumber('id')->middleware('woo.write:coupons.update');
        Route::delete('coupons/{id}', [CouponWriteController::class, 'destroy'])->whereNumber('id')->middleware('woo.write:coupons.delete');

        Route::post('shipping/zones/{zone}/methods', [ShippingWriteController::class, 'store'])->whereNumber('zone')->middleware('woo.write:shipping.manage');
        Route::match(['put', 'patch'], 'shipping/zones/{zone}/methods/{instance}', [ShippingWriteController::class, 'update'])->whereNumber(['zone', 'instance'])->middleware('woo.write:shipping.manage');
        Route::delete('shipping/zones/{zone}/methods/{instance}', [ShippingWriteController::class, 'destroy'])->whereNumber(['zone', 'instance'])->middleware('woo.write:shipping.manage');

        Route::match(['put', 'patch'], 'payments/{id}', [PaymentGatewayWriteController::class, 'update'])->where('id', '[A-Za-z0-9_-]+')->middleware('woo.write:payments.update');

        Route::match(['put', 'patch'], 'settings/{group}', [SettingsWriteController::class, 'updateGroup'])->where('group', '[A-Za-z0-9_-]+')->middleware('woo.write:settings.update');
        Route::match(['put', 'patch'], 'settings/{group}/{id}', [SettingsWriteController::class, 'update'])->where(['group' => '[A-Za-z0-9_-]+', 'id' => '[A-Za-z0-9_]+'])->middleware('woo.write:settings.update');
    });
});

// Signed public Non-GST Customer Invoice & Packing Slip endpoints for WhatsApp / Interakt delivery.
Route::get('v1/public/orders/{id}/customer-invoice', [CustomerInvoiceController::class, 'show'])
    ->whereNumber('id')
    ->name('orders.customer-invoice.public')
    ->middleware('signed');
Route::get('v1/public/orders/{id}/packing-slip', [CustomerInvoiceController::class, 'packingSlip'])
    ->whereNumber('id')
    ->name('orders.packing-slip.public')
    ->middleware('signed');

// WooCommerce calls this itself, so there is no JWT and no /v1 prefix (URL: /api/webhooks/woocommerce).
// The HMAC signature is verified inside the controller before anything is stored.
Route::post('webhooks/woocommerce', WebhookController::class)->middleware('throttle:300,1,webhook');
