<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('woo_orders', function (Blueprint $table) {
            $table->string('courier_name')->nullable()->after('status');
            $table->string('tracking_number')->nullable()->after('courier_name');
            $table->timestamp('dispatched_at')->nullable()->after('tracking_number');
        });
    }

    public function down(): void
    {
        Schema::table('woo_orders', function (Blueprint $table) {
            $table->dropColumn(['courier_name', 'tracking_number', 'dispatched_at']);
        });
    }
};
