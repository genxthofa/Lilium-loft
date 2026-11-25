<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsToMany;
use Illuminate\Database\Eloquent\Relations\HasMany;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class WooOrder extends Model
{
    protected $table = 'woo_orders';

    protected $guarded = [];

    protected $hidden = ['raw'];

    protected function casts(): array
    {
        return [
            'total' => 'decimal:2',
            'refunded_total' => 'decimal:2',
            'discount_total' => 'decimal:2',
            'shipping_total' => 'decimal:2',
            'total_tax' => 'decimal:2',
            'coupon_codes' => 'array',
            'woo_created_at' => 'datetime',
            'woo_paid_at' => 'datetime',
            'woo_completed_at' => 'datetime',
            'dispatched_at' => 'datetime',
            'raw' => 'array',
        ];
    }


    public function items(): HasMany
    {
        return $this->hasMany(WooOrderItem::class, 'order_woo_id', 'woo_id');
    }

    public function customer(): BelongsTo
    {
        return $this->belongsTo(WooCustomer::class, 'customer_woo_id', 'woo_id');
    }

    public const DETAIL_ATTRS = ['billing', 'shipping'];

    public function getBillingAttribute(): array
    {
        return $this->raw['billing'] ?? [];
    }

    public function getShippingAttribute(): array
    {
        return $this->raw['shipping'] ?? [];
    }
}
